import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gymhub.settings')

app = Celery('gymhub')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

app.conf.beat_schedule = {
    'check-member-inactivity': {
        'task': 'alerts.tasks.check_member_inactivity',
        'schedule': crontab(hour=8, minute=0),
    },
    'daily-membership-maintenance': {
        'task': 'billing.tasks.run_daily_membership_maintenance',
        'schedule': crontab(hour=6, minute=5),
    },
    'activate-scheduled-training-plans': {
        'task': 'plans.tasks.activate_scheduled_plans',
        'schedule': crontab(hour=5, minute=55),
    },
}
