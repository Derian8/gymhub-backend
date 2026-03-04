from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

import logging
logger = logging.getLogger(__name__)


@shared_task(name='billing.tasks.check_upcoming_payments')
def check_upcoming_payments():
    """
    Crontab: hour=9, minute=0
    PaymentRecord con status='pending' y due_date <= today+3 días.
    Crea Notification de recordatorio para el miembro (una sola vez por due_date).
    """
    from datetime import date, timedelta
    from billing.models import PaymentRecord
    from alerts.models import Notification

    today = date.today()
    cutoff = today + timedelta(days=3)
    notifications_created = 0

    records = PaymentRecord.objects.filter(
        status='pending',
        schedule__due_date__lte=cutoff,
        schedule__due_date__gte=today,
    ).select_related('schedule__member__user', 'schedule__plan')

    for record in records:
        member = record.schedule.member
        due_date = record.schedule.due_date
        plan_name = record.schedule.plan.name

        # Verificar que no existe ya una notificación para esta fecha de vencimiento
        already_notified = Notification.objects.filter(
            user=member.user,
            type='payment_due',
            message__contains=str(due_date),
        ).exists()

        if not already_notified:
            days_left = (due_date - today).days
            Notification.objects.create(
                user=member.user,
                message=f"Tu pago del plan '{plan_name}' vence en {days_left} día(s) el {due_date}.",
                type='payment_due',
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
            except Exception:
                pass

    logger.info(f"check_upcoming_payments: {notifications_created} notificaciones creadas.")
    return {'notifications_created': notifications_created}


@shared_task(name='billing.tasks.check_overdue_payments')
def check_overdue_payments():
    """
    Crontab: hour=9, minute=30
    PaymentRecord con status='pending' y (today - due_date).days > grace_period_days.
    Cambia status a 'late'. Crea Notification para miembro y trainer.
    """
    from datetime import date
    from billing.models import PaymentRecord
    from users.models import TrainerProfile
    from alerts.models import Notification

    today = date.today()
    updated = 0
    notifications_created = 0

    pending_records = PaymentRecord.objects.filter(
        status='pending',
    ).select_related('schedule__member__user', 'schedule__plan')

    for record in pending_records:
        due_date = record.schedule.due_date
        grace_days = record.schedule.grace_period_days
        days_overdue = (today - due_date).days

        if days_overdue > grace_days:
            record.status = 'late'
            record.save()
            updated += 1

            member = record.schedule.member
            plan_name = record.schedule.plan.name

            # Notificar al miembro
            Notification.objects.create(
                user=member.user,
                message=f"Tu pago del plan '{plan_name}' está vencido hace {days_overdue} días. Por favor regulariza tu situación.",
                type='payment_overdue',
            )
            notifications_created += 1

            # Notificar a trainers
            for trainer in TrainerProfile.objects.select_related('user').all():
                Notification.objects.create(
                    user=trainer.user,
                    message=f"El miembro {member.user.get_full_name() or member.user.email} tiene pago vencido hace {days_overdue} días ({plan_name}).",
                    type='payment_overdue',
                )
                notifications_created += 1

            # Email al miembro
            try:
                send_mail(
                    subject='Pago vencido — GymHub',
                    message=f"Hola {member.user.get_full_name() or member.user.email},\n\nTu pago del plan '{plan_name}' está vencido hace {days_overdue} días.",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[member.user.email],
                    fail_silently=True,
                )
            except Exception:
                pass

    logger.info(f"check_overdue_payments: {updated} registros actualizados, {notifications_created} notificaciones.")
    return {'updated': updated, 'notifications_created': notifications_created}
