"""
settings_test.py — Configuración para tests pytest
"""
from .settings import *  # noqa

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env('DB_NAME', default='gymhub') + '_test',
        'USER': env('DB_USER', default='gymhub_user'),
        'PASSWORD': env('DB_PASSWORD', default='gymhub_pass'),
        'HOST': env('DB_HOST', default='db'),
        'PORT': env('DB_PORT', default='5432'),
        'TEST': {
            'NAME': env('DB_NAME', default='gymhub') + '_test',
        },
    }
}

# Throttling reducido para tests de throttle
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {
    'user': '30/min',
    'anon': '100/hour',
    'login': '10/15min',
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

AI_DAILY_LIMIT_PER_USER = 20
INACTIVITY_DAYS_THRESHOLD = 30
PAYMENT_GRACE_DAYS = 7

MEDIA_ROOT = '/tmp/gymhub_test_media'

# Deshabilitar email real en tests
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
