import logging
import environ
from pathlib import Path
from datetime import timedelta

env = environ.Env()
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
environ.Env.read_env(BASE_DIR / '.env')

SECRET_KEY = env('DJANGO_SECRET_KEY')
DEBUG = env.bool('DEBUG', default=False)
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['localhost', '127.0.0.1', 'backend'])
USE_X_FORWARDED_HOST = env.bool('USE_X_FORWARDED_HOST', default=False)

AUTH_COOKIE_SECURE = env.bool('AUTH_COOKIE_SECURE', default=not DEBUG)
AUTH_COOKIE_SAMESITE = env('AUTH_COOKIE_SAMESITE', default='Lax')
AUTH_COOKIE_DOMAIN = env('AUTH_COOKIE_DOMAIN', default=None)
AUTH_COOKIE_PATH = env('AUTH_COOKIE_PATH', default='/')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'drf_spectacular',
    'django_filters',
    'corsheaders',
    'django_celery_beat',
    # Local apps
    'users.apps.UsersConfig',
    'classes.apps.ClassesConfig',
    'plans.apps.PlansConfig',
    'attendance.apps.AttendanceConfig',
    'progress.apps.ProgressConfig',
    'alerts.apps.AlertsConfig',
    'billing.apps.BillingConfig',
    'nutrition.apps.NutritionConfig',
    'ai_chat.apps.AiChatConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'gymhub.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'gymhub.wsgi.application'

AUTH_USER_MODEL = 'users.User'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env('DB_NAME'),
        'USER': env('DB_USER'),
        'PASSWORD': env('DB_PASSWORD'),
        'HOST': env('DB_HOST', default='db'),
        'PORT': env('DB_PORT', default='5432'),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'es-es'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = env('STATIC_ROOT', default=str(BASE_DIR / 'staticfiles'))

MEDIA_URL = '/media/'
MEDIA_ROOT = env('MEDIA_ROOT', default=str(BASE_DIR / 'media'))

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'users.authentication.JWTCookieAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'user': '30/min',
        'anon': '100/hour',
        'login': '10/min',
    },
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
}

# JWT
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_HEADER_TYPES': ('Bearer',),
}

ACCESS_TOKEN_COOKIE_NAME = 'access_token'
REFRESH_TOKEN_COOKIE_NAME = 'refresh_token'

# Celery
CELERY_BROKER_URL = env('CELERY_BROKER_URL', default='redis://redis:6379/0')
CELERY_RESULT_BACKEND = env('CELERY_RESULT_BACKEND', default='redis://redis:6379/1')
CELERY_TIMEZONE = 'UTC'
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

# Cache
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': env('REDIS_URL', default='redis://redis:6379/0'),
    }
}

# CORS
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=['http://localhost:3000'])
CSRF_TRUSTED_ORIGINS = env.list('CSRF_TRUSTED_ORIGINS', default=CORS_ALLOWED_ORIGINS)

SESSION_COOKIE_SAMESITE = env('SESSION_COOKIE_SAMESITE', default='Lax')
SESSION_COOKIE_SECURE = env.bool('SESSION_COOKIE_SECURE', default=not DEBUG)
CSRF_COOKIE_SAMESITE = env('CSRF_COOKIE_SAMESITE', default='Lax')
CSRF_COOKIE_SECURE = env.bool('CSRF_COOKIE_SECURE', default=not DEBUG)
CSRF_COOKIE_HTTPONLY = False

SECURE_PROXY_SSL_HEADER = (
    ('HTTP_X_FORWARDED_PROTO', 'https')
    if env.bool('USE_X_FORWARDED_PROTO', default=False)
    else None
)
SECURE_SSL_REDIRECT = env.bool('SECURE_SSL_REDIRECT', default=False)
SECURE_HSTS_SECONDS = env.int('SECURE_HSTS_SECONDS', default=0)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool('SECURE_HSTS_INCLUDE_SUBDOMAINS', default=False)
SECURE_HSTS_PRELOAD = env.bool('SECURE_HSTS_PRELOAD', default=False)
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
REFERRER_POLICY = 'same-origin'

if not DEBUG:
    if not AUTH_COOKIE_SECURE or not SESSION_COOKIE_SECURE or not CSRF_COOKIE_SECURE:
        logger.warning(
            'DEBUG=False con cookies inseguras. Revisa AUTH_COOKIE_SECURE, '
            'SESSION_COOKIE_SECURE y CSRF_COOKIE_SECURE antes de desplegar.'
        )
    if not SECURE_SSL_REDIRECT:
        logger.warning(
            'DEBUG=False con SECURE_SSL_REDIRECT=False. '
            'Habilita redirección HTTPS en staging/producción reales.'
        )
    if ALLOWED_HOSTS == ['localhost', '127.0.0.1', 'backend']:
        logger.warning(
            'DEBUG=False usando ALLOWED_HOSTS por defecto. '
            'Configura hosts reales antes de desplegar.'
        )

# AI Config
AI_PROVIDER = env('AI_PROVIDER', default='deterministic')
AI_LOCAL_BACKEND = env('AI_LOCAL_BACKEND', default='ollama')
AI_LOCAL_MODEL = env('AI_LOCAL_MODEL', default='llama3.2:3b')
AI_LOCAL_BASE_URL = env('AI_LOCAL_BASE_URL', default='http://host.docker.internal:11434')
AI_LOCAL_TIMEOUT_MS = env.int('AI_LOCAL_TIMEOUT_MS', default=2500)
OPENAI_API_KEY = env('OPENAI_API_KEY', default='')
OPENAI_MODEL = env('OPENAI_MODEL', default='gpt-4.1-mini')
OPENAI_MAX_TOKENS = env.int('OPENAI_MAX_TOKENS', default=300)
AI_DAILY_LIMIT_PER_USER = env.int('AI_DAILY_LIMIT_PER_USER', default=20)
AI_DAILY_LIMIT_MEMBER = env.int('AI_DAILY_LIMIT_MEMBER', default=AI_DAILY_LIMIT_PER_USER)
AI_DAILY_LIMIT_TRAINER = env.int('AI_DAILY_LIMIT_TRAINER', default=60)
AI_CHAT_HISTORY_WINDOW = env.int('AI_CHAT_HISTORY_WINDOW', default=10)
EMERGENT_LLM_KEY = env('EMERGENT_LLM_KEY', default='')

# Business rules
INACTIVITY_DAYS_THRESHOLD = env.int('INACTIVITY_DAYS_THRESHOLD', default=30)
PAYMENT_GRACE_DAYS = env.int('PAYMENT_GRACE_DAYS', default=7)

DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', default='noreply@gymhub.com')

# DRF Spectacular
SPECTACULAR_SETTINGS = {
    'TITLE': 'Gimnasio Miembros Hub API',
    'DESCRIPTION': 'API backend para gestión integral de gimnasios',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}
