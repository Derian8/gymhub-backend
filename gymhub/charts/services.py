from collections import Counter, defaultdict
from datetime import date, timedelta

from django.db.models import Sum
from django.utils import timezone

from attendance.models import Attendance
from billing.models import MemberSubscription, PaymentRecord
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
    active_plan = member.plans.filter(is_active=True).prefetch_related('workout_days').first()
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


def build_trainer_charts(trainer_profile, user):
    from users.models import MemberProfile

    queryset = annotate_member_metrics(
        MemberProfile.objects.select_related('user', 'trainer_asignado__user', 'membership_plan').order_by('id')
    )
    if not user.is_staff:
        queryset = queryset.filter(trainer_asignado=trainer_profile)
    members = list(queryset)
    member_ids = [member.id for member in members]

    risk_distribution = {'low': 0, 'medium': 0, 'high': 0}
    payment_distribution = {'paid': 0, 'pending': 0, 'late': 0, 'sin_dato': 0}
    prescription_distribution = {'lista': 0, 'incompleta': 0, 'sin_plan': 0}
    inactivity_distribution = {'0-3': 0, '4-7': 0, '8-14': 0, '15+': 0}
    top_risk_members = []

    for member in members:
        risk = get_member_risk_snapshot(member)
        prescription = get_member_prescription_status(member)
        risk_distribution[risk['nivel_riesgo']] += 1
        payment_distribution[risk['payment_status'] or 'sin_dato'] += 1
        prescription_distribution[prescription['estado']] += 1

        days_inactive = risk['days_since_last_checkin']
        if days_inactive is None or days_inactive <= 3:
            inactivity_distribution['0-3'] += 1
        elif days_inactive <= 7:
            inactivity_distribution['4-7'] += 1
        elif days_inactive <= 14:
            inactivity_distribution['8-14'] += 1
        else:
            inactivity_distribution['15+'] += 1

        top_risk_members.append({
            'id': member.id,
            'full_name': member.user.get_full_name() or member.user.email,
            'riesgo_adherencia': risk['riesgo_adherencia'],
            'nivel_riesgo': risk['nivel_riesgo'],
            'payment_status': risk['payment_status'],
            'days_since_last_checkin': risk['days_since_last_checkin'],
            'next_action': risk['next_action'],
        })

    top_risk_members.sort(key=lambda item: item['riesgo_adherencia'], reverse=True)

    attendance_counts = defaultdict(int)
    for attendance in Attendance.objects.filter(member_id__in=member_ids, check_in_time__date__gte=date.today() - timedelta(weeks=6)).order_by('check_in_time'):
        week_start = attendance.check_in_time.date() - timedelta(days=attendance.check_in_time.date().weekday())
        attendance_counts[week_start] += 1

    session_counts = defaultdict(int)
    for session in WorkoutSession.objects.filter(member_id__in=member_ids, is_completed=True, started_at__date__gte=date.today() - timedelta(weeks=6)).order_by('started_at'):
        week_start = session.started_at.date() - timedelta(days=session.started_at.date().weekday())
        session_counts[week_start] += 1

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
    for member in members:
        summary = get_member_dashboard_summary(member)
        if summary['cumplimiento_semanal'] is not None:
            completion_values.append(summary['cumplimiento_semanal'])
    cumplimiento_promedio = round(sum(completion_values) / len(completion_values), 1) if completion_values else None

    return {
        'role': 'trainer',
        'summary': {
            'members_count': len(member_ids),
            'high_risk_count': risk_distribution['high'],
            'late_payment_count': payment_distribution['late'],
            'ready_prescriptions_count': prescription_distribution['lista'],
            'average_weekly_completion': cumplimiento_promedio,
        },
        'risk_distribution': [{'label': label, 'value': value} for label, value in risk_distribution.items()],
        'payment_distribution': [{'label': label, 'value': value} for label, value in payment_distribution.items()],
        'prescription_distribution': [{'label': label, 'value': value} for label, value in prescription_distribution.items()],
        'inactivity_distribution': [{'label': label, 'value': value} for label, value in inactivity_distribution.items()],
        'attendance_trend': _serialize_week_series(attendance_counts),
        'sessions_trend': _serialize_week_series(session_counts),
        'revenue_monthly': _serialize_revenue_series(paid_amounts),
        'plan_distribution': [{'label': label, 'value': value} for label, value in plan_distribution.items()],
        'top_risk_members': top_risk_members[:5],
        'insights': [
            f'{risk_distribution["high"]} members están en riesgo alto.',
            f'{payment_distribution["late"]} members tienen mora activa.',
            'La cartera requiere intervención sobre adherencia y pagos.' if risk_distribution['high'] or payment_distribution['late'] else 'La cartera se mantiene estable esta semana.',
        ],
    }
