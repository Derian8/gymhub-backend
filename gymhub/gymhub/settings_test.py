"""
settings_test.py — Configuración para tests pytest
"""
from .settings import *  # noqa

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Throttling reducido para tests de throttle
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {
    'user': '30/min',
    'anon': '100/hour',
    'login': '10/min',
    'register': '5/hour',
    'refresh': '30/hour',
    'test_low': '2/min',
}

# Cache en memoria para tests
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
AUTH_PASSWORD_VALIDATORS = []

AI_DAILY_LIMIT_PER_USER = 20
INACTIVITY_DAYS_THRESHOLD = 30
PAYMENT_GRACE_DAYS = 7

MEDIA_ROOT = '/tmp/gymhub_test_media'

# Deshabilitar email real en tests
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
