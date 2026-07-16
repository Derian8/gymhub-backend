from datetime import timedelta

from django.db.models import Avg, Count, Max, Sum
from django.utils import timezone

from alerts.models import InactivityAlert
from attendance.models import Attendance
from billing.models import PaymentRecord
from billing.services import membership_summary
from progress.models import ProgressLog, WorkoutSession
from progress.services import build_member_physical_summary
from users.services import get_member_risk_snapshot

QUICK_QUESTIONS = [
    {'label': 'Resume este miembro', 'prompt': 'Resume este miembro usando solo los datos del sistema.'},
    {'label': 'Analiza su progreso', 'prompt': 'Analiza su progreso físico y de entrenamiento con los datos disponibles.'},
    {'label': 'Analiza asistencia', 'prompt': 'Analiza su asistencia y detecta cambios de constancia.'},
    {'label': 'Analiza entrenamiento', 'prompt': 'Analiza su rutina, sesiones y ejercicios registrados.'},
    {'label': 'Analiza pagos', 'prompt': 'Analiza su membresía y pagos pendientes o recientes.'},
    {'label': 'Qué debería hacer', 'prompt': 'Qué debería hacer como trainer con este miembro esta semana.'},
    {'label': 'Qué riesgos detectas', 'prompt': 'Qué riesgos detectas en este miembro y por qué.'},
    {'label': 'Resume últimos 30 días', 'prompt': 'Resume los últimos 30 días de este miembro.'},
]


def _iso(value):
    return value.isoformat() if value else None


def _member_name(member):
    return member.user.get_full_name() or member.user.email


def _attendance_context(member, today):
    start_30 = today - timedelta(days=30)
    prev_start = today - timedelta(days=60)
    start_90 = today - timedelta(days=90)
    attendances = Attendance.objects.filter(member=member)
    last = attendances.order_by('-attendance_date', '-check_in_time').first()
    count_30 = attendances.filter(attendance_date__gte=start_30).count()
    previous_30 = attendances.filter(attendance_date__gte=prev_start, attendance_date__lt=start_30).count()
    count_90 = attendances.filter(attendance_date__gte=start_90).count()
    days_since = (today - last.attendance_date).days if last else None
    weekly_average_30 = round(count_30 / 4.3, 1)
    previous_weekly_average = round(previous_30 / 4.3, 1)
    if count_30 > previous_30:
        trend = 'increasing'
    elif count_30 < previous_30:
        trend = 'decreasing'
    else:
        trend = 'stable'
    return {
        'last_attendance_date': _iso(last.attendance_date if last else None),
        'days_since_last_attendance': days_since,
        'checkins_last_30_days': count_30,
        'checkins_previous_30_days': previous_30,
        'checkins_last_90_days': count_90,
        'weekly_average_last_30_days': weekly_average_30,
        'weekly_average_previous_30_days': previous_weekly_average,
        'trend': trend,
        'recent_notes': list(
            attendances.exclude(notes='')
            .order_by('-attendance_date', '-check_in_time')
            .values_list('notes', flat=True)[:3]
        ),
    }


def _payment_context(member):
    records = PaymentRecord.objects.filter(schedule__member=member).select_related('schedule').order_by('-schedule__due_date', '-id')
    pending = records.filter(status__in=['pending', 'late']).order_by('schedule__due_date', 'id')
    paid = records.filter(status='paid').order_by('-paid_at', '-id')
    return {
        'pending_count': pending.count(),
        'late_count': pending.filter(status='late').count(),
        'next_pending': _payment_record_payload(pending.first()),
        'last_paid': _payment_record_payload(paid.first()),
        'recent_records': [_payment_record_payload(record) for record in records[:5]],
    }


def _payment_record_payload(record):
    if not record:
        return None
    return {
        'id': record.id,
        'status': record.status,
        'amount': str(record.amount),
        'due_date': _iso(record.schedule.due_date),
        'paid_at': _iso(record.paid_at),
        'notes': record.notes,
    }


def _training_context(member, active_prescription, today):
    plan = active_prescription.get('plan_activo')
    days = active_prescription.get('dias') or []
    today_workout = active_prescription.get('entrenamiento_hoy')
    sessions = WorkoutSession.objects.filter(member=member)
    start_30 = today - timedelta(days=30)
    recent_sessions = sessions.filter(started_at__date__gte=start_30)
    completed_recent = recent_sessions.filter(is_completed=True)
    latest_session = sessions.order_by('-started_at', '-id').first()
    exercise_stats = (
        completed_recent
        .filter(exercise_logs__isnull=False)
        .values('exercise_logs__exercise__name')
        .annotate(
            sessions=Count('id', distinct=True),
            total_sets=Sum('exercise_logs__sets_completed'),
            total_minutes=Sum('exercise_logs__minutes_completed'),
            avg_rpe=Avg('exercise_logs__rpe'),
            max_weight=Max('exercise_logs__weight_used_kg'),
        )
        .order_by('-sessions', 'exercise_logs__exercise__name')[:8]
    )
    return {
        'active_plan': {
            'id': plan['id'],
            'name': plan['name'],
            'goal': plan.get('goal'),
            'days_per_week': plan.get('days_per_week'),
            'start_date': plan.get('start_date'),
            'end_date': plan.get('end_date'),
        } if plan else None,
        'days_count': len(days),
        'exercise_count': sum(len(day.get('exercises', [])) for day in days),
        'today_workout_name': today_workout.get('name') if today_workout else None,
        'completed_sessions_last_30_days': completed_recent.count(),
        'latest_session_date': _iso(latest_session.started_at.date() if latest_session else None),
        'latest_session_completed': latest_session.is_completed if latest_session else None,
        'latest_trainer_notes': latest_session.trainer_notes if latest_session and latest_session.trainer_notes else '',
        'exercise_highlights': [
            {
                'name': item['exercise_logs__exercise__name'],
                'sessions': item['sessions'],
                'total_sets': item['total_sets'] or 0,
                'total_minutes': item['total_minutes'] or 0,
                'avg_rpe': round(item['avg_rpe'], 1) if item['avg_rpe'] is not None else None,
                'max_weight_kg': item['max_weight'],
            }
            for item in exercise_stats
        ],
    }


def _progress_context(member):
    physical = build_member_physical_summary(member)
    logs = list(ProgressLog.objects.filter(member=member).order_by('-recorded_at', '-id')[:5])
    days_since = None
    if physical['latest_recorded_at']:
        days_since = (timezone.localdate() - physical['latest_recorded_at'].date()).days
    return {
        'physical_summary': {
            **physical,
            'latest_recorded_at': _iso(physical['latest_recorded_at']),
        },
        'days_since_last_measurement': days_since,
        'recent_measurements': [
            {
                'recorded_at': _iso(log.recorded_at),
                'weight_kg': log.weight_kg,
                'body_fat_pct': log.body_fat_pct,
                'muscle_mass_kg': log.muscle_mass_kg,
                'waist_cm': log.waist_cm,
                'notes': log.notes,
            }
            for log in logs
        ],
    }


def _alert_context(member):
    alerts = InactivityAlert.objects.filter(member=member).order_by('-created_at', '-id')
    open_alert = alerts.filter(status__in=['new', 'in_follow_up']).first()
    latest = alerts.first()
    return {
        'has_open_alert': bool(open_alert),
        'open_alert_status': open_alert.status if open_alert else None,
        'open_alert_days_inactive': open_alert.days_inactive if open_alert else None,
        'latest_alert_status': latest.status if latest else None,
        'latest_alert_reason': latest.status_change_reason if latest else '',
        'latest_contact': _contact_payload(open_alert.contacts.order_by('-contacted_at', '-id').first()) if open_alert else None,
    }


def _contact_payload(contact):
    if not contact:
        return None
    return {
        'contacted_at': _iso(contact.contacted_at),
        'method': contact.method,
        'result': contact.result,
        'note': contact.note,
        'next_follow_up_date': _iso(contact.next_follow_up_date),
    }


def _detect_insights(dossier):
    insights = []
    attendance = dossier['attendance']
    membership = dossier['membership']
    payment = dossier['payments']
    progress = dossier['progress']
    training = dossier['training']
    alerts = dossier['alerts']

    days_inactive = attendance['days_since_last_attendance']
    if days_inactive is None:
        insights.append(_insight('missing', 'Sin asistencia registrada', 'No hay check-ins para evaluar constancia.', 'info'))
    elif days_inactive >= 15:
        insights.append(_insight('attendance_gap', f'Lleva {days_inactive} días sin asistir', 'Conviene contactar y acordar una acción mínima.', 'critical'))
    elif days_inactive >= 5:
        insights.append(_insight('attendance_gap', f'Lleva {days_inactive} días sin asistir', 'Todavía se puede intervenir temprano.', 'warning'))

    if attendance['trend'] == 'decreasing':
        insights.append(_insight('attendance_trend', 'Reducción de asistencia', 'Asistió menos en los últimos 30 días que en el periodo anterior.', 'warning'))
    elif attendance['checkins_last_30_days'] >= 8:
        insights.append(_insight('attendance_consistency', 'Entrenamiento constante', 'Mantiene una frecuencia visible en los últimos 30 días.', 'positive'))

    if membership.get('days_remaining') is not None and 0 <= membership['days_remaining'] <= 5:
        insights.append(_insight('membership_expiring', f'Membresía vence en {membership["days_remaining"]} días', 'Puede afectar continuidad si no se renueva.', 'warning'))
    if membership.get('status') in {'expired', 'suspended', 'cancelled'}:
        insights.append(_insight('membership_blocked', 'Membresía sin acceso activo', 'El acceso puede estar bloqueado para check-in.', 'critical'))

    if payment['late_count']:
        insights.append(_insight('payment_late', 'Tiene pagos vencidos', 'Revisar cobros antes de hablar de continuidad.', 'critical'))
    elif payment['pending_count']:
        insights.append(_insight('payment_pending', 'Tiene pagos pendientes', 'Conviene confirmar el próximo pago.', 'warning'))

    days_since_measurement = progress['days_since_last_measurement']
    if days_since_measurement is None:
        insights.append(_insight('missing_progress', 'Sin medidas registradas', 'No hay datos físicos para comparar progreso.', 'info'))
    elif days_since_measurement >= 30:
        insights.append(_insight('progress_stalled', 'Progreso detenido', f'No hay mediciones desde hace {days_since_measurement} días.', 'warning'))
    elif progress['physical_summary']['weight_change_kg'] == 0:
        insights.append(_insight('weight_stable', 'Peso estable', 'La última comparación no muestra cambio de peso.', 'neutral'))

    if not training['active_plan']:
        insights.append(_insight('no_plan', 'Rutina sin plan activo', 'No hay rutina publicada para este miembro.', 'critical'))
    elif training['completed_sessions_last_30_days'] == 0:
        insights.append(_insight('training_inactive', 'Rutina sin ejecución reciente', 'No hay sesiones completadas en los últimos 30 días.', 'warning'))

    if alerts['has_open_alert']:
        insights.append(_insight('open_alert', 'Alerta de inactividad abierta', 'El miembro ya está en seguimiento por inactividad.', 'critical'))

    return insights[:8]


def _insight(code, title, detail, severity):
    return {
        'code': code,
        'title': title,
        'detail': detail,
        'severity': severity,
    }


def _missing_data(dossier):
    missing = []
    if not dossier['attendance']['last_attendance_date']:
        missing.append('asistencia')
    if not dossier['training']['active_plan']:
        missing.append('rutina')
    if dossier['progress']['physical_summary']['latest_log_id'] is None:
        missing.append('medidas')
    if not dossier['payments']['recent_records']:
        missing.append('pagos')
    if not dossier['membership']['membership_id']:
        missing.append('membresía')
    return missing


def _overall_status(dossier, insights):
    if any(item['severity'] == 'critical' for item in insights):
        return 'immediate_attention'
    if (
        any(item['severity'] == 'warning' for item in insights)
        or dossier['summary']['riesgo_personal']['level'] == 'medium'
    ):
        return 'needs_follow_up'
    return 'excellent'


def build_trainer_assistant_context(member, summary, active_prescription):
    today = timezone.localdate()
    dossier = {
        'generated_at': timezone.now().isoformat(),
        'member': {
            'id': member.id,
            'full_name': _member_name(member),
            'email': member.user.email,
            'phone': member.phone,
            'join_date': _iso(member.join_date),
            'is_active': member.is_active,
            'trainer_name': (
                member.trainer_asignado.user.get_full_name() or member.trainer_asignado.user.email
                if member.trainer_asignado_id else None
            ),
        },
        'summary': summary,
        'membership': membership_summary(member),
        'payments': _payment_context(member),
        'attendance': _attendance_context(member, today),
        'training': _training_context(member, active_prescription, today),
        'progress': _progress_context(member),
        'alerts': _alert_context(member),
    }
    insights = _detect_insights(dossier)
    missing = _missing_data(dossier)
    return {
        'overall_status': _overall_status(dossier, insights),
        'detected_insights': insights,
        'quick_questions': QUICK_QUESTIONS,
        'missing_data': missing,
        'dossier': dossier,
    }
