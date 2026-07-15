from celery import shared_task
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
    from alerts.services import generate_inactivity_alerts, resolve_returned_members

    result = generate_inactivity_alerts()
    resolved = resolve_returned_members()
    result['alerts_resolved'] = resolved

    logger.info(
        'check_member_inactivity: %s alertas creadas, %s resueltas.',
        result['alerts_created'],
        result['alerts_resolved'],
    )
    return result
