from celery import shared_task
from django.conf import settings
import logging
logger = logging.getLogger(__name__)


def _notification_recipients(member):
    trainer = getattr(member, 'trainer_asignado', None)
    if trainer is not None:
        return [trainer.user]

    from users.models import TrainerProfile

    return [trainer_profile.user for trainer_profile in TrainerProfile.objects.select_related('user').all()]


@shared_task(name='alerts.tasks.check_member_inactivity')
def check_member_inactivity():
    """
    Crontab: hour=8, minute=0
    Itera MemberProfiles activos. Si el último Attendance > INACTIVITY_DAYS_THRESHOLD días:
    - Crea InactivityAlert (si no hay una abierta)
    - Crea Notification para el trainer
    """
    from datetime import date, timedelta
    from users.models import MemberProfile
    from attendance.models import Attendance
    from alerts.models import InactivityAlert, Notification

    threshold = settings.INACTIVITY_DAYS_THRESHOLD
    alerts_created = 0
    notifications_created = 0

    for member in MemberProfile.objects.filter(is_active=True).select_related(
        'user', 'trainer_asignado__user'
    ):
        last_att = Attendance.objects.filter(member=member).first()

        if last_att is None:
            # Nunca ha ido → usar join_date
            last_date = member.join_date
        else:
            last_date = last_att.check_in_time.date()

        days_inactive = (date.today() - last_date).days

        if days_inactive > threshold:
            # Crear alert solo si no hay una abierta
            existing = InactivityAlert.objects.filter(member=member, resolved=False).exists()
            if not existing:
                InactivityAlert.objects.create(
                    member=member,
                    last_checkin_date=last_date,
                    days_inactive=days_inactive,
                )
                alerts_created += 1

                for recipient in _notification_recipients(member):
                    dedupe_key = (
                        f'inactivity:{recipient.id}:{member.id}:{last_date.isoformat()}'
                    )
                    _, created = Notification.objects.get_or_create(
                        user=recipient,
                        type='inactivity',
                        dedupe_key=dedupe_key,
                        defaults={
                            'message': (
                                f"El miembro {member.user.get_full_name() or member.user.email} "
                                f'lleva {days_inactive} días inactivo.'
                            ),
                        },
                    )
                    notifications_created += int(created)

    logger.info(f"check_member_inactivity: {alerts_created} alertas creadas, {notifications_created} notificaciones.")
    return {'alerts_created': alerts_created, 'notifications_created': notifications_created}
