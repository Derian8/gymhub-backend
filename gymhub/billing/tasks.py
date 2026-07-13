from smtplib import SMTPException

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


@shared_task(name='billing.tasks.run_daily_membership_maintenance')
def run_daily_membership_maintenance():
    from billing.services import run_daily_billing_maintenance

    result = run_daily_billing_maintenance()
    membership_alerts = check_membership_status_alerts()
    upcoming = check_upcoming_payments()
    overdue = check_overdue_payments()
    return {
        **result,
        'records_updated': overdue['updated'],
        'membership_notifications': membership_alerts['notifications_created'],
        'upcoming_notifications': upcoming['notifications_created'],
        'overdue_notifications': overdue['notifications_created'],
    }


def _notification_recipients(member):
    trainer = getattr(member, 'trainer_asignado', None)
    if trainer is not None:
        return [trainer.user]

    from users.models import TrainerProfile

    return [trainer_profile.user for trainer_profile in TrainerProfile.objects.select_related('user').all()]


@shared_task(name='billing.tasks.check_upcoming_payments')
def check_upcoming_payments():
    """
    Crontab: hour=9, minute=0
    PaymentRecord con status='pending' y due_date <= today+3 días.
    Crea Notification de recordatorio para el miembro (una sola vez por due_date).
    """
    from datetime import timedelta
    from billing.models import PaymentRecord
    from alerts.models import Notification

    today = timezone.localdate()
    cutoff = today + timedelta(days=3)
    notifications_created = 0

    records = PaymentRecord.objects.filter(
        status='pending',
        schedule__is_active=True,
        schedule__due_date__lte=cutoff,
        schedule__due_date__gte=today,
    ).select_related('schedule__member__user', 'schedule__plan', 'schedule__subscription')

    for record in records:
        member = record.schedule.member
        due_date = record.schedule.due_date
        plan_name = record.schedule.resolved_membership_name or 'Membresía'

        dedupe_key = f'payment_due:{record.id}:{due_date.isoformat()}'
        already_notified = Notification.objects.filter(
            user=member.user,
            type='payment_due',
            dedupe_key=dedupe_key,
        ).exists()

        if not already_notified:
            days_left = (due_date - today).days
            Notification.objects.create(
                user=member.user,
                message=f"Tu pago del plan '{plan_name}' vence en {days_left} día(s) el {due_date}.",
                type='payment_due',
                dedupe_key=dedupe_key,
            )
            notifications_created += 1

            # Email de recordatorio
            try:
                send_mail(
                    subject='Recordatorio de pago — GymHub',
                    message=f"Hola {member.user.get_full_name() or member.user.email},\n\nTu pago del plan '{plan_name}' vence el {due_date}.",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[member.user.email],
                    fail_silently=True,
                )
            except (SMTPException, OSError):
                logger.exception(
                    'No se pudo enviar recordatorio de pago',
                    extra={'member_email': member.user.email, 'due_date': str(due_date)}
                )

    logger.info(f"check_upcoming_payments: {notifications_created} notificaciones creadas.")
    return {'notifications_created': notifications_created}


@shared_task(name='billing.tasks.check_membership_status_alerts')
def check_membership_status_alerts():
    from alerts.models import Notification
    from billing.models import MemberSubscription

    today = timezone.localdate()
    notifications_created = 0
    subscriptions = MemberSubscription.objects.filter(
        is_active=True,
        status__in=['expiring', 'expired'],
    ).select_related('member__user', 'member__trainer_asignado__user')

    for subscription in subscriptions:
        member = subscription.member
        plan_name = subscription.membership_name or 'Membresía'
        if subscription.status == 'expiring':
            event = 'membership_expiring'
            message = f"Tu membresía '{plan_name}' está próxima a vencer."
        else:
            event = 'membership_expired'
            message = f"Tu membresía '{plan_name}' está vencida. Regulariza tu pago para recuperar acceso."

        member_key = f'{event}:member:{member.user_id}:{subscription.id}:{today.isoformat()}'
        _, created = Notification.objects.get_or_create(
            user=member.user,
            type='payment_due' if subscription.status == 'expiring' else 'payment_overdue',
            dedupe_key=member_key,
            defaults={'message': message},
        )
        notifications_created += int(created)

        for recipient in _notification_recipients(member):
            trainer_key = f'{event}:trainer:{recipient.id}:{subscription.id}:{today.isoformat()}'
            _, created = Notification.objects.get_or_create(
                user=recipient,
                type='payment_due' if subscription.status == 'expiring' else 'payment_overdue',
                dedupe_key=trainer_key,
                defaults={
                    'message': (
                        f"El miembro {member.user.get_full_name() or member.user.email} "
                        f"tiene membresía {subscription.status}: {plan_name}."
                    ),
                },
            )
            notifications_created += int(created)

    return {'notifications_created': notifications_created}


@shared_task(name='billing.tasks.check_overdue_payments')
def check_overdue_payments():
    """
    Crontab: hour=9, minute=30
    PaymentRecord con status='pending' y (today - due_date).days > grace_period_days.
    Cambia status a 'late'. Crea Notification para miembro y trainer.
    """
    from billing.models import PaymentRecord
    from alerts.models import Notification

    today = timezone.localdate()
    updated = 0
    notifications_created = 0

    pending_records = PaymentRecord.objects.filter(
        status='pending',
        schedule__is_active=True,
    ).select_related('schedule__member__user', 'schedule__plan', 'schedule__subscription__plan')

    for record in pending_records:
        due_date = record.schedule.due_date
        grace_days = record.schedule.grace_period_days
        days_overdue = (today - due_date).days

        if days_overdue > grace_days:
            record.status = 'late'
            record.save()
            updated += 1
            subscription = record.schedule.subscription
            if subscription and subscription.status != 'cancelled':
                subscription.status = 'expired'
                subscription.save(update_fields=['status'])

            member = record.schedule.member
            plan_name = record.schedule.resolved_membership_name or 'Membresía'

            member_dedupe_key = f'payment_overdue:member:{record.id}:{due_date.isoformat()}'
            _, created = Notification.objects.get_or_create(
                user=member.user,
                type='payment_overdue',
                dedupe_key=member_dedupe_key,
                defaults={
                    'message': (
                        f"Tu pago del plan '{plan_name}' está vencido hace {days_overdue} días. "
                        'Por favor regulariza tu situación.'
                    ),
                },
            )
            notifications_created += int(created)

            for recipient in _notification_recipients(member):
                trainer_dedupe_key = (
                    f'payment_overdue:trainer:{recipient.id}:{record.id}:{due_date.isoformat()}'
                )
                _, created = Notification.objects.get_or_create(
                    user=recipient,
                    type='payment_overdue',
                    dedupe_key=trainer_dedupe_key,
                    defaults={
                        'message': (
                            f"El miembro {member.user.get_full_name() or member.user.email} "
                            f'tiene pago vencido hace {days_overdue} días ({plan_name}).'
                        ),
                    },
                )
                notifications_created += int(created)

            # Email al miembro
            try:
                send_mail(
                    subject='Pago vencido — GymHub',
                    message=f"Hola {member.user.get_full_name() or member.user.email},\n\nTu pago del plan '{plan_name}' está vencido hace {days_overdue} días.",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[member.user.email],
                    fail_silently=True,
                )
            except (SMTPException, OSError):
                logger.exception(
                    'No se pudo enviar email de pago vencido',
                    extra={'member_email': member.user.email, 'days_overdue': days_overdue}
                )

    logger.info(f"check_overdue_payments: {updated} registros actualizados, {notifications_created} notificaciones.")
    return {'updated': updated, 'notifications_created': notifications_created}
