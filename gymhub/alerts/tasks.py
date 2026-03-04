from celery import shared_task
from django.conf import settings
from django.utils import timezone

import logging
logger = logging.getLogger(__name__)


@shared_task(name='alerts.tasks.check_member_inactivity')
def check_member_inactivity():
    """
    Crontab: hour=8, minute=0
    Itera MemberProfiles activos. Si el último Attendance > INACTIVITY_DAYS_THRESHOLD días:
    - Crea InactivityAlert (si no hay una abierta)
    - Crea Notification para el trainer
    """
    from datetime import date, timedelta
    from users.models import MemberProfile, TrainerProfile
    from attendance.models import Attendance
    from alerts.models import InactivityAlert, Notification

    threshold = settings.INACTIVITY_DAYS_THRESHOLD
    cutoff = date.today() - timedelta(days=threshold)

    alerts_created = 0
    notifications_created = 0

    for member in MemberProfile.objects.filter(is_active=True).select_related('user'):
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

                # Notificar a todos los trainers
                for trainer in TrainerProfile.objects.select_related('user').all():
                    Notification.objects.create(
                        user=trainer.user,
                        message=f"El miembro {member.user.get_full_name() or member.user.email} lleva {days_inactive} días inactivo.",
                        type='inactivity',
                    )
                    notifications_created += 1

    logger.info(f"check_member_inactivity: {alerts_created} alertas creadas, {notifications_created} notificaciones.")
    return {'alerts_created': alerts_created, 'notifications_created': notifications_created}
