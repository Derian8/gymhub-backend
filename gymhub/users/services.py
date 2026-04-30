from datetime import date, timedelta
from types import SimpleNamespace

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Count, DateTimeField, Exists, OuterRef, Q, Subquery, Sum
from django.db.models.functions import Coalesce

from alerts.models import InactivityAlert, Notification
from attendance.models import Attendance
from billing.models import PaymentRecord
from nutrition.models import NutritionProfile
from plans.models import TrainingPlan
from progress.models import ProgressLog, WorkoutSession


RISK_LEVEL_THRESHOLDS = (
    ('high', 70),
    ('medium', 35),
    ('low', 0),
)

RECURRENCE_MONTH_DIVISOR = {
    'monthly': 1,
    'quarterly': 3,
    'annual': 12,
}

WEEKDAY_ORDER = {
    'mon': 0,
    'tue': 1,
    'wed': 2,
    'thu': 3,
    'fri': 4,
    'sat': 5,
    'sun': 6,
}


def annotate_member_metrics(queryset):
    active_plans = TrainingPlan.objects.filter(
        member=OuterRef('pk'),
        is_active=True,
    ).order_by('-start_date', '-id')
    latest_attendance = Attendance.objects.filter(
        member=OuterRef('pk')
    ).order_by('-check_in_time')
    latest_session = WorkoutSession.objects.filter(
        member=OuterRef('pk'),
        is_completed=True,
    ).annotate(
        reference_at=Coalesce('completed_at', 'started_at')
    ).order_by('-reference_at', '-started_at')
    latest_progress = ProgressLog.objects.filter(
        member=OuterRef('pk')
    ).order_by('-recorded_at')
    latest_payment = PaymentRecord.objects.filter(
        schedule__member=OuterRef('pk')
    ).order_by('-schedule__due_date', '-id')
    active_nutrition = NutritionProfile.objects.filter(
        training_plan__member=OuterRef('pk'),
        training_plan__is_active=True,
    ).order_by('-training_plan__start_date', '-id')

    return queryset.annotate(
        active_plan_id_cached=Subquery(active_plans.values('id')[:1]),
        active_plan_name_cached=Subquery(active_plans.values('name')[:1]),
        active_plan_days_per_week_cached=Subquery(active_plans.values('days_per_week')[:1]),
        active_plan_goal_cached=Subquery(active_plans.values('goal')[:1]),
        nutrition_goal_cached=Subquery(active_nutrition.values('goal_type')[:1]),
        last_checkin_at_cached=Subquery(
            latest_attendance.values('check_in_time')[:1],
            output_field=DateTimeField(),
        ),
        last_session_at_cached=Subquery(
            latest_session.values('reference_at')[:1],
            output_field=DateTimeField(),
        ),
        last_progress_at_cached=Subquery(
            latest_progress.values('recorded_at')[:1],
            output_field=DateTimeField(),
        ),
        latest_payment_status_cached=Subquery(latest_payment.values('status')[:1]),
        latest_payment_due_date_cached=Subquery(latest_payment.values('schedule__due_date')[:1]),
        active_plan_workout_days_count_cached=Count(
            'plans__workout_days',
            filter=Q(plans__is_active=True),
            distinct=True,
        ),
        active_plan_exercises_count_cached=Count(
            'plans__workout_days__exercises',
            filter=Q(plans__is_active=True),
            distinct=True,
        ),
        active_plan_guides_count_cached=Count(
            'plans__nutrition_links',
            filter=Q(plans__is_active=True),
            distinct=True,
        ),
        active_plan_nutrition_count_cached=Count(
            'plans__nutrition_profile',
            filter=Q(plans__is_active=True),
            distinct=True,
        ),
        inactivity_alert_open_cached=Exists(
            InactivityAlert.objects.filter(member=OuterRef('pk'), resolved=False)
        ),
    )


def get_today_workout_day(plan):
    if not plan:
        return None
    weekday = date.today().strftime('%a').lower()[:3]
    return plan.workout_days.filter(day_of_week=weekday).order_by('order', 'id').first()


def get_active_plan(member):
    if hasattr(member, '_active_plan_cache'):
        return member._active_plan_cache
    if getattr(member, 'active_plan_id_cached', None):
        member._active_plan_cache = TrainingPlan.objects.filter(
            id=member.active_plan_id_cached
        ).first()
        return member._active_plan_cache
    return member.plans.filter(is_active=True).first()


def get_member_prescription_status(member):
    active_plan_id = getattr(member, 'active_plan_id_cached', None)
    if active_plan_id is not None:
        has_days = getattr(member, 'active_plan_workout_days_count_cached', 0) > 0
        has_exercises = getattr(member, 'active_plan_exercises_count_cached', 0) > 0
        has_nutrition = getattr(member, 'active_plan_nutrition_count_cached', 0) > 0
        has_guides = getattr(member, 'active_plan_guides_count_cached', 0) > 0
        is_ready = has_days and has_exercises and has_nutrition and has_guides
        return {
            'tiene_plan_activo': True,
            'tiene_dias': has_days,
            'tiene_ejercicios': has_exercises,
            'tiene_nutricion': has_nutrition,
            'tiene_guias': has_guides,
            'esta_lista_para_member': is_ready,
            'estado': 'lista' if is_ready else 'incompleta',
        }

    active_plan = get_active_plan(member)
    if not active_plan:
        return {
            'tiene_plan_activo': False,
            'tiene_dias': False,
            'tiene_ejercicios': False,
            'tiene_nutricion': False,
            'tiene_guias': False,
            'esta_lista_para_member': False,
            'estado': 'sin_plan',
        }

    try:
        nutrition_profile = active_plan.nutrition_profile
    except ObjectDoesNotExist:
        nutrition_profile = None

    workout_days = list(active_plan.workout_days.order_by('order'))
    has_exercises = any(day.exercises.exists() for day in workout_days)
    linked_guides = list(active_plan.nutrition_links.order_by('priority_order', 'id'))
    is_ready = bool(workout_days) and has_exercises and nutrition_profile is not None and bool(linked_guides)

    return {
        'tiene_plan_activo': True,
        'tiene_dias': bool(workout_days),
        'tiene_ejercicios': has_exercises,
        'tiene_nutricion': nutrition_profile is not None,
        'tiene_guias': bool(linked_guides),
        'esta_lista_para_member': is_ready,
        'estado': 'lista' if is_ready else 'incompleta',
    }


def get_latest_payment_record(member):
    if hasattr(member, 'latest_payment_status_cached'):
        status_value = getattr(member, 'latest_payment_status_cached', None)
        due_date = getattr(member, 'latest_payment_due_date_cached', None)
        if status_value is None or due_date is None:
            return None
        return SimpleNamespace(
            status=status_value,
            schedule=SimpleNamespace(due_date=due_date),
        )
    return PaymentRecord.objects.filter(
        schedule__member=member
    ).select_related('schedule', 'schedule__plan').order_by('-schedule__due_date').first()


def get_member_payment_access_status(member, overdue_days_threshold=30):
    unpaid_record = PaymentRecord.objects.filter(
        schedule__member=member,
        status__in=('pending', 'late'),
    ).select_related('schedule', 'schedule__plan').order_by('-schedule__due_date', '-id').first()

    if not unpaid_record:
        return {
            'blocked': False,
            'reason': '',
            'days_overdue': 0,
            'record_id': None,
        }

    days_overdue = (date.today() - unpaid_record.schedule.due_date).days
    if days_overdue < overdue_days_threshold:
        return {
            'blocked': False,
            'reason': '',
            'days_overdue': max(days_overdue, 0),
            'record_id': unpaid_record.id,
        }

    return {
        'blocked': True,
        'reason': 'payment_overdue_30d',
        'days_overdue': days_overdue,
        'record_id': unpaid_record.id,
    }


def _days_since(value):
    if value is None:
        return None
    return (date.today() - value).days


def _get_risk_level(score):
    for level, threshold in RISK_LEVEL_THRESHOLDS:
        if score >= threshold:
            return level
    return 'low'


def _build_next_action(payment_status, days_since_last_checkin, today_has_workout, days_since_last_session):
    if payment_status == 'late':
        return 'Regulariza tu pago para evitar fricción en tu entrenamiento.'
    if today_has_workout:
        return 'Completa tu entrenamiento de hoy y registra tu sesión.'
    if days_since_last_checkin is None or days_since_last_checkin >= 3:
        return 'Haz check-in hoy para retomar consistencia.'
    if days_since_last_session is None or days_since_last_session >= 7:
        return 'Registra una nueva sesión para mantener tu progreso visible.'
    return 'Mantén tu ritmo esta semana y cuida tu adherencia.'


def _attendance_streak(member):
    attendance_dates = list(
        Attendance.objects.filter(member=member)
        .order_by('-check_in_time')
        .values_list('check_in_time__date', flat=True)
        .distinct()
    )
    if not attendance_dates:
        return 0

    streak = 0
    expected_day = date.today()
    for attendance_day in attendance_dates:
        if attendance_day == expected_day:
            streak += 1
            expected_day -= timedelta(days=1)
            continue
        if streak == 0 and attendance_day == expected_day - timedelta(days=1):
            streak += 1
            expected_day = attendance_day - timedelta(days=1)
            continue
        break
    return streak


def get_member_risk_snapshot(member):
    active_plan = None
    prescription_status = get_member_prescription_status(member)
    latest_payment = get_latest_payment_record(member)
    last_checkin_at = getattr(member, 'last_checkin_at_cached', None)
    last_session_at = getattr(member, 'last_session_at_cached', None)
    last_progress_at = getattr(member, 'last_progress_at_cached', None)

    if last_checkin_at is None and not hasattr(member, 'last_checkin_at_cached'):
        last_attendance = Attendance.objects.filter(member=member).first()
        last_checkin_at = last_attendance.check_in_time if last_attendance else None
    if last_session_at is None and not hasattr(member, 'last_session_at_cached'):
        last_session = WorkoutSession.objects.filter(
            member=member,
            is_completed=True,
        ).order_by('-completed_at', '-started_at').first()
        if last_session:
            last_session_at = last_session.completed_at or last_session.started_at
    if last_progress_at is None and not hasattr(member, 'last_progress_at_cached'):
        last_progress = ProgressLog.objects.filter(member=member).first()
        last_progress_at = last_progress.recorded_at if last_progress else None

    days_since_last_checkin = _days_since(last_checkin_at.date()) if last_checkin_at else None
    days_since_last_session = _days_since(last_session_at.date()) if last_session_at else None
    days_since_last_progress = _days_since(last_progress_at.date()) if last_progress_at else None

    payment_status = latest_payment.status if latest_payment else None
    days_until_due = None
    days_overdue = None
    if latest_payment:
        delta = (latest_payment.schedule.due_date - date.today()).days
        if delta >= 0:
            days_until_due = delta
        else:
            days_overdue = abs(delta)

    active_plan = get_active_plan(member)
    workout_day = get_today_workout_day(active_plan) if active_plan else None
    today_has_workout = workout_day is not None

    score = 0
    reasons = []

    if not active_plan:
        score += 10
        reasons.append('No tiene plan activo asignado')
    elif not prescription_status['esta_lista_para_member']:
        score += 15
        reasons.append('Su prescripción activa está incompleta')

    if days_since_last_checkin is None:
        score += 25
        reasons.append('No registra asistencias recientes')
    elif days_since_last_checkin >= settings.INACTIVITY_DAYS_THRESHOLD:
        score += 35
        reasons.append(f'Lleva {days_since_last_checkin} días sin check-in')
    elif days_since_last_checkin >= 7:
        score += 15
        reasons.append(f'Acumula {days_since_last_checkin} días sin check-in')

    if payment_status == 'late':
        score += 30
        reasons.append('Tiene pagos en mora')
    elif payment_status == 'pending' and days_until_due is not None and days_until_due <= 3:
        score += 15
        reasons.append(f'Su pago vence en {days_until_due} días')

    if days_since_last_session is None:
        score += 15
        reasons.append('No ha completado sesiones')
    elif days_since_last_session >= 10:
        score += 20
        reasons.append(f'No completa sesiones hace {days_since_last_session} días')

    if days_since_last_progress is None:
        score += 10
        reasons.append('No tiene progreso registrado')
    elif days_since_last_progress >= 21:
        score += 15
        reasons.append(f'No registra progreso hace {days_since_last_progress} días')

    score = min(score, 100)
    return {
        'riesgo_adherencia': score,
        'nivel_riesgo': _get_risk_level(score),
        'motivos_riesgo': reasons[:4],
        'days_since_last_checkin': days_since_last_checkin,
        'days_since_last_session': days_since_last_session,
        'days_since_last_progress': days_since_last_progress,
        'payment_status': payment_status,
        'days_until_due': days_until_due,
        'days_overdue': days_overdue,
        'today_has_workout': today_has_workout,
        'next_action': _build_next_action(
            payment_status,
            days_since_last_checkin,
            today_has_workout,
            days_since_last_session,
        ),
    }


def get_member_dashboard_summary(member):
    active_plan = get_active_plan(member)
    active_plan_payload = None
    if active_plan:
        active_plan_payload = {
            'id': active_plan.id,
            'name': active_plan.name,
        }
    elif getattr(member, 'active_plan_id_cached', None):
        active_plan_payload = {
            'id': member.active_plan_id_cached,
            'name': getattr(member, 'active_plan_name_cached', ''),
        }

    nutrition_goal = getattr(member, 'nutrition_goal_cached', None)
    if nutrition_goal is None and active_plan:
        try:
            nutrition_goal = active_plan.nutrition_profile.goal_type
        except ObjectDoesNotExist:
            nutrition_goal = None

    risk = get_member_risk_snapshot(member)
    last_checkin_at = getattr(member, 'last_checkin_at_cached', None)
    last_attendance = None if last_checkin_at else Attendance.objects.filter(member=member).first()
    unread_notifications = Notification.objects.filter(user=member.user, read=False).count()
    inactivity_alert = getattr(member, 'inactivity_alert_open_cached', None)
    if inactivity_alert is None:
        inactivity_alert = InactivityAlert.objects.filter(member=member, resolved=False).exists()

    week_start = date.today() - timedelta(days=date.today().weekday())
    weekly_sessions_done = WorkoutSession.objects.filter(
        member=member,
        is_completed=True,
        started_at__date__gte=week_start,
    ).count()

    weekly_goal = active_plan.days_per_week if active_plan else 0
    cumplimiento_semanal = None
    if weekly_goal:
        cumplimiento_semanal = min(int((weekly_sessions_done / weekly_goal) * 100), 100)

    resumen_hoy = (
        f"Hoy toca {get_today_workout_day(active_plan).name}."
        if active_plan and risk['today_has_workout']
        else 'Hoy no hay entrenamiento programado; mantén movilidad o recuperación activa.'
    )

    return {
        'payment_status': risk['payment_status'],
        'days_until_due': risk['days_until_due'],
        'days_overdue': risk['days_overdue'],
        'last_checkin': last_checkin_at or (last_attendance.check_in_time if last_attendance else None),
        'active_plan': active_plan_payload,
        'nutrition_goal': nutrition_goal,
        'inactivity_alert': inactivity_alert,
        'unread_notifications': unread_notifications,
        'today_has_workout': risk['today_has_workout'],
        'weekly_sessions_done': weekly_sessions_done,
        'streak_asistencia': _attendance_streak(member),
        'cumplimiento_semanal': cumplimiento_semanal,
        'siguiente_accion': risk['next_action'],
        'resumen_hoy': resumen_hoy,
        'riesgo_personal': {
            'score': risk['riesgo_adherencia'],
            'level': risk['nivel_riesgo'],
            'reasons': risk['motivos_riesgo'],
        },
    }


def get_active_prescription(member):
    from nutrition.serializers import NutritionProfileSerializer, PlanNutritionLinkSerializer
    from plans.serializers import TodayWorkoutSerializer, TrainingPlanSerializer, WorkoutDaySerializer

    active_plan = get_active_plan(member)
    if not active_plan:
        return {
            'member': member.id,
            'trainer': None,
            'plan_activo': None,
            'dias': [],
            'entrenamiento_hoy': None,
            'perfil_nutricional': None,
            'guias_vinculadas': [],
            'estado_prescripcion': {
                'tiene_plan_activo': False,
                'tiene_dias': False,
                'tiene_ejercicios': False,
                'tiene_nutricion': False,
                'tiene_guias': False,
                'esta_lista_para_member': False,
            },
        }

    try:
        nutrition_profile = active_plan.nutrition_profile
    except ObjectDoesNotExist:
        nutrition_profile = None

    workout_days = sorted(
        active_plan.workout_days.all(),
        key=lambda day: (WEEKDAY_ORDER.get(day.day_of_week, 99), day.order, day.id),
    )
    linked_guides = list(active_plan.nutrition_links.order_by('priority_order', 'id'))
    today_workout = get_today_workout_day(active_plan)
    trainer = active_plan.trainer.user
    estado_prescripcion = get_member_prescription_status(member)

    trainer_name = trainer.get_full_name() or trainer.email

    return {
        'member': member.id,
        'trainer': {
            'id': active_plan.trainer.id,
            'nombre': trainer_name,
            'correo': trainer.email,
        },
        'plan_activo': TrainingPlanSerializer(active_plan).data,
        'dias': WorkoutDaySerializer(workout_days, many=True).data,
        'entrenamiento_hoy': TodayWorkoutSerializer(today_workout).data if today_workout else None,
        'perfil_nutricional': NutritionProfileSerializer(nutrition_profile).data if nutrition_profile else None,
        'guias_vinculadas': PlanNutritionLinkSerializer(linked_guides, many=True).data,
        'estado_prescripcion': estado_prescripcion,
    }


def get_trainer_overview(user, trainer_profile):
    from users.models import MemberProfile
    from billing.models import MemberSubscription

    today = date.today()
    month_start = today.replace(day=1)
    week_start = today - timedelta(days=today.weekday())
    cutoff_30d = today - timedelta(days=30)

    miembros = annotate_member_metrics(
        MemberProfile.objects.select_related(
        'user', 'membership_plan', 'trainer_asignado__user'
    ).filter(is_active=True).order_by('id'))
    if not user.is_staff:
        miembros = miembros.filter(trainer_asignado=trainer_profile)

    member_ids = list(miembros.values_list('id', flat=True))
    total_active = len(member_ids)
    checked_in_today = Attendance.objects.filter(
        member_id__in=member_ids,
        check_in_time__date=today,
    ).count()

    members_in_mora = PaymentRecord.objects.filter(
        schedule__member_id__in=member_ids,
        status='late',
    ).values('schedule__member').distinct().count()

    active_ids = Attendance.objects.filter(
        member_id__in=member_ids,
        check_in_time__date__gte=cutoff_30d,
    ).values_list('member_id', flat=True).distinct()
    members_inactive_30d = miembros.exclude(id__in=active_ids).count()

    pending_alerts = InactivityAlert.objects.filter(
        member_id__in=member_ids,
        resolved=False,
    ).count()

    revenue_this_month = float(PaymentRecord.objects.filter(
        schedule__member_id__in=member_ids,
        status='paid',
        paid_at__date__gte=month_start,
    ).aggregate(total=Sum('amount'))['total'] or 0)
    active_subscriptions = list(
        MemberSubscription.objects.filter(
            member_id__in=member_ids,
            is_active=True,
        ).select_related('plan')
    )
    active_subscriptions_count = len(active_subscriptions)
    estimated_mrr = round(sum(
        float(subscription.agreed_price) / RECURRENCE_MONTH_DIVISOR.get(subscription.recurrence_type, 1)
        for subscription in active_subscriptions
    ), 2)
    expected_revenue_this_month = round(sum(
        float(record.amount)
        for record in PaymentRecord.objects.filter(
            schedule__member_id__in=member_ids,
            schedule__due_date__gte=month_start,
            schedule__due_date__lte=today,
        )
    ), 2)

    new_members_this_month = miembros.filter(join_date__gte=month_start).count()
    sessions_this_week = WorkoutSession.objects.filter(
        member_id__in=member_ids,
        is_completed=True,
        started_at__date__gte=week_start,
    ).count()

    members_without_progress_recently = 0
    members_at_risk = []
    payments_due_soon = 0
    payments_overdue = 0
    members_without_active_plan = 0
    incomplete_prescriptions = 0
    members_missing_plan_items = []
    members_incomplete_prescription_items = []

    for member in miembros:
        risk = get_member_risk_snapshot(member)
        prescription_status = get_member_prescription_status(member)
        if risk['days_since_last_progress'] is None or risk['days_since_last_progress'] >= 21:
            members_without_progress_recently += 1
        if risk['payment_status'] == 'late':
            payments_overdue += 1
        elif risk['payment_status'] == 'pending' and risk['days_until_due'] is not None and risk['days_until_due'] <= 3:
            payments_due_soon += 1
        if not prescription_status['tiene_plan_activo']:
            members_without_active_plan += 1
            members_missing_plan_items.append({
                'id': member.id,
                'full_name': member.user.get_full_name() or member.user.email,
                'riesgo_adherencia': risk['riesgo_adherencia'],
                'nivel_riesgo': risk['nivel_riesgo'],
                'motivos_riesgo': risk['motivos_riesgo'],
                'next_action': 'Asigna un plan activo para iniciar su prescripción.',
                'estado_prescripcion': prescription_status['estado'],
            })
        elif not prescription_status['esta_lista_para_member']:
            incomplete_prescriptions += 1
            members_incomplete_prescription_items.append({
                'id': member.id,
                'full_name': member.user.get_full_name() or member.user.email,
                'riesgo_adherencia': risk['riesgo_adherencia'],
                'nivel_riesgo': risk['nivel_riesgo'],
                'motivos_riesgo': risk['motivos_riesgo'],
                'next_action': 'Completa días, ejercicios o nutrición para publicarla al member.',
                'estado_prescripcion': prescription_status['estado'],
            })

        if risk['riesgo_adherencia'] >= 35:
            members_at_risk.append({
                'id': member.id,
                'full_name': member.user.get_full_name() or member.user.email,
                'payment_status': risk['payment_status'],
                'riesgo_adherencia': risk['riesgo_adherencia'],
                'nivel_riesgo': risk['nivel_riesgo'],
                'motivos_riesgo': risk['motivos_riesgo'],
                'days_since_last_checkin': risk['days_since_last_checkin'],
                'next_action': risk['next_action'],
                'estado_prescripcion': prescription_status['estado'],
            })

    members_at_risk.sort(key=lambda member: member['riesgo_adherencia'], reverse=True)
    members_missing_plan_items.sort(key=lambda member: member['riesgo_adherencia'], reverse=True)
    members_incomplete_prescription_items.sort(key=lambda member: member['riesgo_adherencia'], reverse=True)
    late_rate = round((payments_overdue / active_subscriptions_count) * 100, 1) if active_subscriptions_count else 0

    return {
        'total_active_members': total_active,
        'active_subscriptions_count': active_subscriptions_count,
        'checked_in_today': checked_in_today,
        'members_in_mora': members_in_mora,
        'members_inactive_30d': members_inactive_30d,
        'pending_alerts': pending_alerts,
        'revenue_this_month': revenue_this_month,
        'estimated_mrr': estimated_mrr,
        'expected_revenue_this_month': expected_revenue_this_month,
        'late_rate_pct': late_rate,
        'new_members_this_month': new_members_this_month,
        'sessions_completed_this_week': sessions_this_week,
        'payments_due_soon': payments_due_soon,
        'payments_overdue': payments_overdue,
        'members_without_progress_recently': members_without_progress_recently,
        'members_without_active_plan': members_without_active_plan,
        'incomplete_prescriptions': incomplete_prescriptions,
        'miembros_en_riesgo': members_at_risk[:5],
        'miembros_sin_plan_activo': members_missing_plan_items[:3],
        'miembros_con_prescripcion_incompleta': members_incomplete_prescription_items[:3],
    }
