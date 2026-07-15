from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.utils import timezone

from attendance.models import Attendance
from billing.services import current_member_membership, refresh_membership_status
from users.models import MemberProfile

from .models import (
    InactivityAlert,
    InactivityAlertContact,
    MemberJustifiedAbsence,
    Notification,
    OPEN_ALERT_STATUSES,
)

INACTIVITY_PRIORITY_LIMITS = {
    'low': (5, 7),
    'medium': (8, 14),
    'high': (15, 21),
}
MIN_INACTIVITY_DAYS = INACTIVITY_PRIORITY_LIMITS['low'][0]
URGENT_INACTIVITY_DAYS = 22
RECENT_CONTACT_DAYS = 7
PRIOR_ATTENDANCE_WEEKS = 4

STATUS_FILTERS = {
    'all': None,
    'new': 'new',
    'in_follow_up': 'in_follow_up',
    'resolved': 'resolved',
    'dismissed': 'dismissed',
}


def open_alert_filter():
    return Q(status__in=OPEN_ALERT_STATUSES)


def latest_attendance(member):
    return Attendance.objects.filter(member=member).order_by('-attendance_date', '-check_in_time').first()


def days_since_attendance(attendance, today=None):
    if not attendance:
        return None
    today = today or timezone.localdate()
    return max(0, (today - attendance.attendance_date).days)


def active_membership_status(member, today=None):
    subscription = current_member_membership(member)
    if not subscription:
        return 'none', None
    status = refresh_membership_status(subscription, today=today)
    return status, subscription


def has_active_membership(member, today=None):
    status, subscription = active_membership_status(member, today=today)
    return status in {'active', 'expiring'}, subscription


def has_current_justified_absence(member, today=None):
    today = today or timezone.localdate()
    return MemberJustifiedAbsence.objects.filter(
        member=member,
        is_active=True,
        start_date__lte=today,
        end_date__gte=today,
    ).exists()


def weekly_attendance_average(member, last_attendance_date=None):
    if not last_attendance_date:
        last_att = latest_attendance(member)
        last_attendance_date = last_att.attendance_date if last_att else None
    if not last_attendance_date:
        return 0
    start = last_attendance_date - timedelta(weeks=PRIOR_ATTENDANCE_WEEKS)
    count = Attendance.objects.filter(
        member=member,
        attendance_date__gte=start,
        attendance_date__lte=last_attendance_date,
    ).count()
    return round(count / PRIOR_ATTENDANCE_WEEKS, 1)


def last_contact(alert):
    return alert.contacts.select_related('trainer__user').order_by('-contacted_at', '-id').first()


def has_recent_contact(alert, today=None):
    contact = last_contact(alert)
    if not contact:
        return False
    today = today or timezone.localdate()
    return contact.contacted_at.date() >= today - timedelta(days=RECENT_CONTACT_DAYS)


def inactivity_priority(days_inactive, membership_status='none', recent_contact=False):
    if days_inactive is None or days_inactive < MIN_INACTIVITY_DAYS:
        return None
    if (
        days_inactive >= URGENT_INACTIVITY_DAYS
        and membership_status in {'active', 'expiring'}
        and not recent_contact
    ):
        return 'urgent'
    if INACTIVITY_PRIORITY_LIMITS['high'][0] <= days_inactive <= INACTIVITY_PRIORITY_LIMITS['high'][1]:
        return 'high'
    if INACTIVITY_PRIORITY_LIMITS['medium'][0] <= days_inactive <= INACTIVITY_PRIORITY_LIMITS['medium'][1]:
        return 'medium'
    return 'low'


def recommended_action(priority, alert_status, membership_status, recent_contact=False):
    if alert_status == 'resolved':
        return 'Revisar si mantiene asistencia.'
    if alert_status == 'dismissed':
        return 'Sin acción pendiente.'
    if membership_status not in {'active', 'expiring'}:
        return 'Revisar membresía antes de contactar.'
    if recent_contact:
        return 'Dar seguimiento en la fecha acordada.'
    if priority == 'urgent':
        return 'Contactar hoy y acordar retorno.'
    if priority == 'high':
        return 'Contactar esta semana.'
    if priority == 'medium':
        return 'Enviar mensaje de seguimiento.'
    return 'Monitorear y enviar recordatorio.'


def serialize_contact(contact):
    if not contact:
        return None
    trainer_name = contact.trainer.user.get_full_name() or contact.trainer.user.email
    return {
        'id': contact.id,
        'trainer': contact.trainer_id,
        'trainer_name': trainer_name,
        'contacted_at': contact.contacted_at.isoformat(),
        'method': contact.method,
        'result': contact.result,
        'note': contact.note,
        'next_follow_up_date': contact.next_follow_up_date.isoformat() if contact.next_follow_up_date else None,
        'created_at': contact.created_at.isoformat(),
    }


def alert_context(alert, today=None):
    today = today or timezone.localdate()
    member = alert.member
    status, subscription = active_membership_status(member, today=today)
    contact = last_contact(alert)
    recent_contact = bool(contact and contact.contacted_at.date() >= today - timedelta(days=RECENT_CONTACT_DAYS))
    days_inactive = alert.days_inactive
    if alert.last_checkin_date:
        days_inactive = max(0, (today - alert.last_checkin_date).days)
    priority = inactivity_priority(days_inactive, status, recent_contact)
    full_name = member.user.get_full_name() or member.user.email
    return {
        'member_name': full_name,
        'member_email': member.user.email,
        'member_phone': member.phone,
        'member_photo': member.photo.url if member.photo else None,
        'membership_status': status,
        'membership_name': subscription.membership_name if subscription else None,
        'membership_end_date': subscription.current_period_end.isoformat() if subscription and subscription.current_period_end else None,
        'days_inactive': days_inactive,
        'weekly_attendance_average': weekly_attendance_average(member, alert.last_checkin_date),
        'priority': priority,
        'last_contact': serialize_contact(contact),
        'latest_note': contact.note if contact and contact.note else '',
        'recommended_action': recommended_action(priority, alert.status, status, recent_contact),
        'whatsapp_url': whatsapp_url(member, full_name),
    }


def whatsapp_url(member, full_name):
    phone = ''.join(ch for ch in (member.phone or '') if ch.isdigit())
    if not phone:
        return None
    text = (
        f'Hola {full_name}, te escribo de GymHub para saber como vas. '
        'Notamos que no has asistido recientemente y queremos ayudarte a retomar.'
    )
    from urllib.parse import quote
    return f'https://wa.me/{phone}?text={quote(text)}'


def eligible_member_for_inactivity(member, today=None):
    today = today or timezone.localdate()
    active_membership, _ = has_active_membership(member, today=today)
    if not active_membership:
        return False, None, None
    if has_current_justified_absence(member, today=today):
        return False, None, None
    last_att = latest_attendance(member)
    if not last_att:
        return False, None, None
    days_inactive = days_since_attendance(last_att, today=today)
    return days_inactive >= MIN_INACTIVITY_DAYS, last_att, days_inactive


@transaction.atomic
def create_alert_if_needed(member, today=None):
    today = today or timezone.localdate()
    eligible, last_att, days_inactive = eligible_member_for_inactivity(member, today=today)
    if not eligible:
        return None, False
    existing = InactivityAlert.objects.filter(member=member).filter(open_alert_filter()).first()
    if existing:
        return existing, False
    try:
        alert = InactivityAlert.objects.create(
            member=member,
            last_checkin_date=last_att.attendance_date,
            days_inactive=days_inactive,
            status='new',
        )
    except IntegrityError:
        return InactivityAlert.objects.filter(member=member).filter(open_alert_filter()).first(), False
    return alert, True


def notify_alert_created(alert):
    recipients = []
    trainer = getattr(alert.member, 'trainer_asignado', None)
    if trainer is not None:
        recipients.append(trainer.user)
    for recipient in recipients:
        Notification.objects.get_or_create(
            user=recipient,
            type='inactivity',
            dedupe_key=f'inactivity:{recipient.id}:{alert.member_id}:{alert.last_checkin_date}',
            defaults={
                'message': (
                    f"{alert.member.user.get_full_name() or alert.member.user.email} "
                    f'lleva {alert.days_inactive} días sin asistir.'
                ),
            },
        )


def generate_inactivity_alerts(today=None):
    today = today or timezone.localdate()
    created = 0
    checked = 0
    for member in MemberProfile.objects.filter(is_active=True).select_related(
        'user', 'trainer_asignado__user'
    ).iterator():
        checked += 1
        alert, was_created = create_alert_if_needed(member, today=today)
        if was_created and alert:
            notify_alert_created(alert)
            created += 1
    return {'members_checked': checked, 'alerts_created': created}


def resolve_alert(alert, user=None, reason='Alerta resuelta manualmente.'):
    now = timezone.now()
    alert.status = 'resolved'
    alert.resolved = True
    alert.resolved_by = user
    alert.resolved_at = now
    alert.status_changed_by = user
    alert.status_changed_at = now
    alert.status_change_reason = reason
    alert.save()
    return alert


def set_alert_status(alert, status, user=None, reason=''):
    now = timezone.now()
    alert.status = status
    alert.status_changed_by = user
    alert.status_changed_at = now
    alert.status_change_reason = reason
    if status == 'resolved':
        alert.resolved = True
        alert.resolved_by = user
        alert.resolved_at = now
    elif status == 'dismissed':
        alert.resolved = False
    elif status in {'new', 'in_follow_up'}:
        alert.resolved = False
        if status == 'new':
            alert.reopened_at = now
    alert.save()
    return alert


def create_contact(alert, trainer, method, result, note='', next_follow_up_date=None, contacted_at=None):
    contact = InactivityAlertContact.objects.create(
        member=alert.member,
        trainer=trainer,
        alert=alert,
        contacted_at=contacted_at or timezone.now(),
        method=method,
        result=result,
        note=note,
        next_follow_up_date=next_follow_up_date,
    )
    if alert.status == 'new':
        set_alert_status(alert, 'in_follow_up', user=trainer.user, reason='Contacto registrado.')
    return contact


def resolve_returned_members(today=None):
    today = today or timezone.localdate()
    resolved = 0
    open_alerts = InactivityAlert.objects.filter(open_alert_filter()).select_related('member__user')
    for alert in open_alerts:
        if not alert.last_checkin_date:
            continue
        returned = Attendance.objects.filter(
            member=alert.member,
            attendance_date__gt=alert.last_checkin_date,
        ).exists()
        if returned:
            resolve_alert(alert, reason='El miembro volvió a asistir.')
            resolved += 1
    return resolved


def resolve_open_alerts_for_attendance(attendance):
    alerts = InactivityAlert.objects.filter(
        member=attendance.member,
        last_checkin_date__lt=attendance.attendance_date,
    ).filter(open_alert_filter())
    count = 0
    for alert in alerts:
        resolve_alert(alert, user=attendance.checked_in_by, reason='El miembro volvió a asistir.')
        count += 1
    return count


def base_trainer_alert_queryset(user):
    queryset = InactivityAlert.objects.select_related(
        'member__user',
        'member__trainer_asignado__user',
    ).prefetch_related('contacts')
    if user.is_staff:
        return queryset
    if getattr(user, 'role', None) != 'trainer':
        return InactivityAlert.objects.none()
    try:
        return queryset.filter(member__trainer_asignado=user.trainerprofile)
    except AttributeError:
        return InactivityAlert.objects.none()


def filter_alerts(queryset, params):
    status_filter = params.get('status') or 'all'
    priority_filter = params.get('priority') or 'all'
    period_filter = params.get('period_without_attendance') or 'all'
    membership_filter = params.get('membership_status') or 'all'
    search = (params.get('search') or '').strip()

    if STATUS_FILTERS.get(status_filter):
        queryset = queryset.filter(status=STATUS_FILTERS[status_filter])
    if search:
        queryset = queryset.filter(
            Q(member__user__first_name__icontains=search)
            | Q(member__user__last_name__icontains=search)
            | Q(member__user__email__icontains=search)
        )
    if period_filter == '5_7':
        queryset = queryset.filter(days_inactive__gte=5, days_inactive__lte=7)
    elif period_filter == '8_14':
        queryset = queryset.filter(days_inactive__gte=8, days_inactive__lte=14)
    elif period_filter == '15_21':
        queryset = queryset.filter(days_inactive__gte=15, days_inactive__lte=21)
    elif period_filter == '22_plus':
        queryset = queryset.filter(days_inactive__gte=22)

    if priority_filter != 'all' or membership_filter != 'all':
        ids = []
        today = timezone.localdate()
        for alert in queryset:
            context = alert_context(alert, today=today)
            if priority_filter != 'all' and context['priority'] != priority_filter:
                continue
            if membership_filter != 'all' and context['membership_status'] != membership_filter:
                continue
            ids.append(alert.id)
        queryset = queryset.filter(id__in=ids)
    return queryset


def trainer_alert_summary(user):
    queryset = base_trainer_alert_queryset(user)
    today = timezone.localdate()
    month_start = today.replace(day=1)
    new_count = queryset.filter(status='new').count()
    follow_up_count = queryset.filter(status='in_follow_up').count()
    resolved_this_month = queryset.filter(status='resolved', resolved_at__date__gte=month_start).count()
    recovered_this_month = queryset.filter(
        status='resolved',
        resolved_at__date__gte=month_start,
        status_change_reason='El miembro volvió a asistir.',
    ).count()
    needs_attention = queryset.filter(status__in=OPEN_ALERT_STATUSES).count()
    return {
        'new_alerts': new_count,
        'in_follow_up': follow_up_count,
        'resolved_this_month': resolved_this_month,
        'recovered_this_month': recovered_this_month,
        'attention_message': f'{needs_attention} miembros necesitan atención esta semana.',
    }


def members_without_open_alerts(user):
    queryset = MemberProfile.objects.filter(is_active=True).select_related('user', 'trainer_asignado__user')
    if user.is_staff:
        pass
    elif getattr(user, 'role', None) == 'trainer':
        queryset = queryset.filter(trainer_asignado=user.trainerprofile)
    else:
        return MemberProfile.objects.none()
    queryset = queryset.exclude(inactivity_alerts__status__in=OPEN_ALERT_STATUSES)
    active_ids = []
    today = timezone.localdate()
    for member in queryset:
        is_active, _ = has_active_membership(member, today=today)
        if is_active and Attendance.objects.filter(member=member).exists():
            active_ids.append(member.id)
    return queryset.filter(id__in=active_ids)
