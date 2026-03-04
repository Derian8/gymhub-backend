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
    'check-upcoming-payments': {
        'task': 'billing.tasks.check_upcoming_payments',
        'schedule': crontab(hour=9, minute=0),
    },
    'check-overdue-payments': {
        'task': 'billing.tasks.check_overdue_payments',
        'schedule': crontab(hour=9, minute=30),
    },
}
