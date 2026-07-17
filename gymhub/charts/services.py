from collections import Counter, defaultdict
from datetime import date, timedelta

from django.db.models import Sum
from django.utils import timezone
from django.utils.dateparse import parse_date

from attendance.models import Attendance
from billing.models import MemberSubscription, PaymentRecord
from billing.services import current_member_membership, refresh_membership_status
from progress.models import ExerciseLog, ProgressLog, WorkoutSession
from progress.services import build_member_physical_summary
from users.services import (
    annotate_member_metrics,
    get_member_dashboard_summary,
    get_member_prescription_status,
    get_member_risk_snapshot,
)


def _week_bucket_labels(total_weeks=6):
    today = date.today()
    current_week_start = today - timedelta(days=today.weekday())
    week_starts = [current_week_start - timedelta(weeks=offset) for offset in reversed(range(total_weeks))]
    return week_starts


def _month_bucket_labels(total_months=4):
    today = date.today().replace(day=1)
    buckets = []
    cursor = today
    for _ in range(total_months):
        buckets.append(cursor)
        if cursor.month == 1:
            cursor = cursor.replace(year=cursor.year - 1, month=12)
        else:
            cursor = cursor.replace(month=cursor.month - 1)
    return list(reversed(buckets))


def _serialize_week_series(raw_counts, total_weeks=6):
    return [
        {
            'label': week_start.strftime('%d %b'),
            'week_start': week_start.isoformat(),
            'value': raw_counts.get(week_start, 0),
        }
        for week_start in _week_bucket_labels(total_weeks)
    ]


def _serialize_revenue_series(raw_amounts, total_months=4):
    payload = []
    for month_start in _month_bucket_labels(total_months):
        key = month_start.strftime('%Y-%m')
        payload.append({
            'label': month_start.strftime('%b'),
            'month': key,
            'value': float(raw_amounts.get(key, 0)),
        })
    return payload


def _resolve_trainer_period(filters):
    today = date.today()
    period = (filters or {}).get('period') or '30'
    if period == 'custom':
        start = parse_date((filters or {}).get('start_date') or '')
        end = parse_date((filters or {}).get('end_date') or '')
        return start or today - timedelta(days=29), end or today
    days = 30
    if period in {'7', '90'}:
        days = int(period)
    return today - timedelta(days=days - 1), today


def _serialize_period_series(raw_counts, start_date, end_date):
    total_days = max(1, (end_date - start_date).days + 1)
    if total_days <= 31:
        return [
            {
                'label': (start_date + timedelta(days=offset)).strftime('%d %b'),
                'date': (start_date + timedelta(days=offset)).isoformat(),
                'value': raw_counts.get(start_date + timedelta(days=offset), 0),
            }
            for offset in range(total_days)
        ]

    week_starts = []
    cursor = start_date - timedelta(days=start_date.weekday())
    final_week = end_date - timedelta(days=end_date.weekday())
    while cursor <= final_week:
        week_starts.append(cursor)
        cursor += timedelta(weeks=1)
    return [
        {
            'label': week_start.strftime('%d %b'),
            'week_start': week_start.isoformat(),
            'value': raw_counts.get(week_start, 0),
        }
        for week_start in week_starts
    ]


def _followup_status(member, risk, prescription, membership_status):
    if (
        membership_status in {'expired', 'suspended'}
        or risk['payment_status'] == 'late'
        or (risk['days_since_last_checkin'] is not None and risk['days_since_last_checkin'] >= 15)
    ):
        return 'urgent'
    if (
        membership_status == 'expiring'
        or risk['payment_status'] == 'pending'
        or risk['days_since_last_checkin'] is None
        or risk['days_since_last_checkin'] >= 8
        or not prescription['esta_lista_para_member']
    ):
        return 'attention'
    summary = get_member_dashboard_summary(member)
    if summary['cumplimiento_semanal'] is not None and summary['cumplimiento_semanal'] < 50:
        return 'attention'
    return 'ok'


def _trainer_action(risk, prescription, membership_status):
    if membership_status in {'expired', 'suspended'}:
        return 'Renovar o revisar membresía'
    if risk['payment_status'] in {'late', 'pending'}:
        return 'Confirmar pago pendiente'
    if risk['days_since_last_checkin'] is None or risk['days_since_last_checkin'] >= 8:
        return 'Contactar por inasistencia'
    if not prescription['esta_lista_para_member']:
        return 'Completar rutina/prescripción'
    return 'Dar seguimiento esta semana'


def _build_member_insights(member, dashboard_summary, risk_snapshot, progress_logs):
    insights = []
    if dashboard_summary['cumplimiento_semanal'] is not None:
        if dashboard_summary['cumplimiento_semanal'] >= 100:
            insights.append('Cumpliste tu objetivo semanal completo.')
        elif dashboard_summary['cumplimiento_semanal'] < 50:
            insights.append('Tu cumplimiento semanal cayó por debajo del 50%; conviene retomar hoy.')
    if risk_snapshot['payment_status'] == 'late':
        insights.append('Tienes mora activa; regularizar tu pago evitará fricción en la continuidad.')
    elif risk_snapshot['payment_status'] == 'pending' and risk_snapshot['days_until_due'] is not None:
        insights.append(f'Tu próximo cobro vence en {risk_snapshot["days_until_due"]} días.')
    if risk_snapshot['days_since_last_progress'] is None:
        insights.append('Aún no registras progreso físico; añade un registro para medir cambios reales.')
    elif risk_snapshot['days_since_last_progress'] >= 21:
        insights.append('Llevas más de 3 semanas sin registrar progreso físico.')
    if not insights and progress_logs:
        first = progress_logs[0]
        last = progress_logs[-1]
        if first.weight_kg is not None and last.weight_kg is not None:
            diff = round(last.weight_kg - first.weight_kg, 1)
            direction = 'subió' if diff > 0 else 'bajó'
            if diff != 0:
                insights.append(f'Tu peso {direction} {abs(diff)} kg entre el primer y último registro visible.')
    if not insights:
        insights.append(dashboard_summary['siguiente_accion'])
    return insights[:3]


def build_member_charts(member):
    dashboard_summary = get_member_dashboard_summary(member)
    risk_snapshot = get_member_risk_snapshot(member)
    prescription_status = get_member_prescription_status(member)

    progress_logs = list(
        ProgressLog.objects.filter(member=member).order_by('recorded_at')
    )
    attendance_counts = defaultdict(int)
    for attendance in Attendance.objects.filter(member=member, check_in_time__date__gte=date.today() - timedelta(weeks=6)).order_by('check_in_time'):
        week_start = attendance.check_in_time.date() - timedelta(days=attendance.check_in_time.date().weekday())
        attendance_counts[week_start] += 1

    session_counts = defaultdict(int)
    completed_sessions = WorkoutSession.objects.filter(
        member=member,
        is_completed=True,
        started_at__date__gte=date.today() - timedelta(weeks=6),
    ).order_by('started_at')
    for session in completed_sessions:
        week_start = session.started_at.date() - timedelta(days=session.started_at.date().weekday())
        session_counts[week_start] += 1

    plan_completion = []
    current_week_start = date.today() - timedelta(days=date.today().weekday())
    sessions_by_day = Counter(
        WorkoutSession.objects.filter(
            member=member,
            is_completed=True,
            started_at__date__gte=current_week_start,
        ).values_list('workout_day__day_label', flat=True)
    )
    active_plan = member.plans.filter(status='active').prefetch_related('workout_days').first()
    if active_plan:
        for day in active_plan.workout_days.order_by('order'):
            plan_completion.append({
                'label': day.day_label,
                'name': day.name,
                'completed': sessions_by_day.get(day.day_label, 0),
            })

    exercise_progress = []
    top_exercise = (
        ExerciseLog.objects.filter(
            session__member=member,
            session__is_completed=True,
            exercise__exercise_type='strength',
        )
        .values('exercise__id', 'exercise__name')
        .annotate(total=Sum('weight_used_kg'))
        .order_by('-total', 'exercise__name')
        .first()
    )
    if top_exercise:
        exercise_logs = ExerciseLog.objects.filter(
            session__member=member,
            session__is_completed=True,
            exercise_id=top_exercise['exercise__id'],
        ).select_related('session').order_by('session__started_at')
        for log in exercise_logs:
            exercise_progress.append({
                'date': log.session.started_at.date().isoformat(),
                'label': log.session.started_at.date().strftime('%d %b'),
                'weight_used_kg': log.weight_used_kg or 0,
                'sets_completed': log.sets_completed,
                'reps_completed': log.reps_completed,
            })

    current_weight = next((log.weight_kg for log in reversed(progress_logs) if log.weight_kg is not None), None)
    physical_summary = build_member_physical_summary(member)
    weight_30d = None
    cutoff_30d = timezone.now() - timedelta(days=30)
    for log in progress_logs:
        if log.recorded_at >= cutoff_30d and log.weight_kg is not None:
            weight_30d = log.weight_kg
            break

    return {
        'role': 'member',
        'summary': {
            'current_weight': current_weight,
            'weight_change_30d': round(current_weight - weight_30d, 1) if current_weight is not None and weight_30d is not None else None,
            'current_height_cm': physical_summary['height_cm'],
            'current_bmi': physical_summary['bmi'],
            'sessions_this_week': dashboard_summary['weekly_sessions_done'],
            'streak_asistencia': dashboard_summary['streak_asistencia'],
            'cumplimiento_semanal': dashboard_summary['cumplimiento_semanal'],
            'payment_status': dashboard_summary['payment_status'],
            'days_until_due': dashboard_summary['days_until_due'],
            'days_overdue': dashboard_summary['days_overdue'],
            'riesgo_personal': dashboard_summary['riesgo_personal'],
            'siguiente_accion': dashboard_summary['siguiente_accion'],
            'resumen_hoy': dashboard_summary['resumen_hoy'],
            'estado_prescripcion': prescription_status,
        },
        'physical_progress': [
            {
                'date': log.recorded_at.date().isoformat(),
                'label': log.recorded_at.date().strftime('%d %b'),
                'weight_kg': log.weight_kg,
                'height_cm': log.height_cm,
                'body_fat_pct': log.body_fat_pct,
                'waist_cm': log.waist_cm,
                'muscle_mass_kg': log.muscle_mass_kg,
            }
            for log in progress_logs
        ],
        'attendance_weekly': _serialize_week_series(attendance_counts),
        'sessions_weekly': [
            {
                **item,
                'goal': active_plan.days_per_week if active_plan else 0,
            }
            for item in _serialize_week_series(session_counts)
        ],
        'plan_completion': plan_completion,
        'exercise_progress': {
            'exercise_name': top_exercise['exercise__name'] if top_exercise else None,
            'series': exercise_progress,
        },
        'insights': _build_member_insights(member, dashboard_summary, risk_snapshot, progress_logs),
    }


def build_trainer_charts(trainer_profile, user, filters=None):
    from users.models import MemberProfile

    filters = filters or {}
    period_start, period_end = _resolve_trainer_period(filters)
    membership_filter = filters.get('membership_status') or 'all'
    followup_filter = filters.get('followup_status') or 'all'
    search = (filters.get('search') or '').strip()

    queryset = annotate_member_metrics(
        MemberProfile.objects.select_related('user', 'trainer_asignado__user', 'membership_plan').order_by('id')
    )
    if not user.is_staff:
        queryset = queryset.filter(trainer_asignado=trainer_profile)
    if search:
        queryset = queryset.filter(
            user__first_name__icontains=search
        ) | queryset.filter(
            user__last_name__icontains=search
        ) | queryset.filter(
            user__email__icontains=search
        )
    members = list(queryset)

    payment_distribution = {'paid': 0, 'pending': 0, 'late': 0, 'sin_dato': 0}
    membership_distribution = {'active': 0, 'expiring': 0, 'expired': 0, 'suspended': 0, 'pending': 0, 'none': 0}
    followup_distribution = {'ok': 0, 'attention': 0, 'urgent': 0}
    members_needing_followup = []
    filtered_members = []

    for member in members:
        risk = get_member_risk_snapshot(member)
        prescription = get_member_prescription_status(member)
        subscription = current_member_membership(member)
        membership_status = 'none'
        membership_name = None
        membership_end_date = None
        if subscription:
            membership_status = refresh_membership_status(subscription)
            membership_name = subscription.membership_name
            membership_end_date = subscription.current_period_end.isoformat() if subscription.current_period_end else None
        followup_status = _followup_status(member, risk, prescription, membership_status)

        if membership_filter != 'all' and membership_status != membership_filter:
            continue
        if followup_filter != 'all' and followup_status != followup_filter:
            continue

        filtered_members.append(member)
        payment_distribution[risk['payment_status'] or 'sin_dato'] += 1
        membership_distribution[membership_status if membership_status in membership_distribution else 'none'] += 1
        followup_distribution[followup_status] += 1

        summary = get_member_dashboard_summary(member)
        if followup_status in {'attention', 'urgent'}:
            members_needing_followup.append({
                'id': member.id,
                'full_name': member.user.get_full_name() or member.user.email,
                'email': member.user.email,
                'followup_status': followup_status,
                'membership_status': membership_status,
                'membership_name': membership_name,
                'membership_end_date': membership_end_date,
                'payment_status': risk['payment_status'],
                'days_since_last_checkin': risk['days_since_last_checkin'],
                'weekly_completion': summary['cumplimiento_semanal'],
                'reason': (risk['motivos_riesgo'] or ['Necesita seguimiento esta semana.'])[0],
                'next_action': _trainer_action(risk, prescription, membership_status),
            })

    member_ids = [member.id for member in filtered_members]
    members_needing_followup.sort(key=lambda item: {'urgent': 0, 'attention': 1}[item['followup_status']])

    attendance_counts = defaultdict(int)
    for attendance in Attendance.objects.filter(member_id__in=member_ids, attendance_date__gte=period_start, attendance_date__lte=period_end).order_by('attendance_date'):
        if (period_end - period_start).days + 1 <= 31:
            key = attendance.attendance_date
        else:
            key = attendance.attendance_date - timedelta(days=attendance.attendance_date.weekday())
        attendance_counts[key] += 1

    session_counts = defaultdict(int)
    for session in WorkoutSession.objects.filter(member_id__in=member_ids, is_completed=True, started_at__date__gte=period_start, started_at__date__lte=period_end).order_by('started_at'):
        session_date = session.started_at.date()
        if (period_end - period_start).days + 1 <= 31:
            key = session_date
        else:
            key = session_date - timedelta(days=session_date.weekday())
        session_counts[key] += 1

    paid_amounts = defaultdict(float)
    for record in PaymentRecord.objects.filter(
        schedule__member_id__in=member_ids,
        status='paid',
        paid_at__date__gte=_month_bucket_labels()[0],
    ).order_by('paid_at'):
        key = record.paid_at.date().replace(day=1).strftime('%Y-%m')
        paid_amounts[key] += float(record.amount)

    plan_distribution = Counter(
        MemberSubscription.objects.filter(member_id__in=member_ids, is_active=True)
        .values_list('plan__name', flat=True)
    )

    completion_values = []
    for member in filtered_members:
        summary = get_member_dashboard_summary(member)
        if summary['cumplimiento_semanal'] is not None:
            completion_values.append(summary['cumplimiento_semanal'])
    cumplimiento_promedio = round(sum(completion_values) / len(completion_values), 1) if completion_values else None

    return {
        'role': 'trainer',
        'filters': {
            'period': filters.get('period') or '30',
            'start_date': period_start.isoformat(),
            'end_date': period_end.isoformat(),
            'membership_status': membership_filter,
            'followup_status': followup_filter,
            'search': search,
        },
        'summary': {
            'members_count': len(member_ids),
            'active_attendance_count': Attendance.objects.filter(member_id__in=member_ids, attendance_date__gte=period_start, attendance_date__lte=period_end).values('member_id').distinct().count(),
            'inactive_count': followup_distribution['attention'] + followup_distribution['urgent'],
            'expiring_membership_count': membership_distribution['expiring'],
            'expired_membership_count': membership_distribution['expired'],
            'pending_payment_count': payment_distribution['pending'],
            'late_payment_count': payment_distribution['late'],
            'urgent_followup_count': followup_distribution['urgent'],
            'attention_followup_count': followup_distribution['attention'],
            'average_weekly_completion': cumplimiento_promedio,
        },
        'risk_distribution': [{'label': label, 'value': value} for label, value in followup_distribution.items()],
        'payment_distribution': [{'label': label, 'value': value} for label, value in payment_distribution.items()],
        'membership_distribution': [{'label': label, 'value': value} for label, value in membership_distribution.items() if label != 'pending' or value],
        'followup_distribution': [{'label': label, 'value': value} for label, value in followup_distribution.items()],
        'prescription_distribution': [],
        'inactivity_distribution': [],
        'attendance_trend': _serialize_period_series(attendance_counts, period_start, period_end),
        'sessions_trend': _serialize_period_series(session_counts, period_start, period_end),
        'revenue_monthly': _serialize_revenue_series(paid_amounts),
        'plan_distribution': [{'label': label, 'value': value} for label, value in plan_distribution.items()],
        'top_risk_members': [
            {
                'id': item['id'],
                'full_name': item['full_name'],
                'riesgo_adherencia': 100 if item['followup_status'] == 'urgent' else 60,
                'nivel_riesgo': 'high' if item['followup_status'] == 'urgent' else 'medium',
                'payment_status': item['payment_status'],
                'days_since_last_checkin': item['days_since_last_checkin'],
                'next_action': item['next_action'],
            }
            for item in members_needing_followup[:5]
        ],
        'members_needing_followup': members_needing_followup[:8],
        'insights': [
            f'{followup_distribution["urgent"]} miembros requieren seguimiento urgente.',
            f'{payment_distribution["pending"] + payment_distribution["late"]} miembros tienen pagos pendientes o en mora.',
            'Revisa primero los casos urgentes.' if followup_distribution['urgent'] else 'No hay casos urgentes con los filtros actuales.',
        ],
    }
