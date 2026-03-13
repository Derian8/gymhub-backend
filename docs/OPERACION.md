# Operación Y Desarrollo

## Requisitos
- Docker y Docker Compose
- Variables de entorno en `gymhub/.env`
- PostgreSQL 15+
- Redis 7+

## Puesta En Marcha Local
Desde [`gymhub/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub):

```bash
docker-compose up --build -d
docker-compose exec web python manage.py migrate
docker-compose exec web python manage.py seed_data
docker-compose exec web python manage.py createsuperuser
```

## Servicios
- `web`: ejecuta Django con Gunicorn.
- `db`: PostgreSQL.
- `redis`: broker y caché.
- `celery`: worker de tareas.
- `celerybeat`: scheduler de tareas recurrentes.

## Pruebas
Comandos principales:

```bash
./run_tests.sh
docker-compose run --rm web pytest tests/ -v --tb=short
```

La configuración de pruebas usa [`gymhub/gymhub/settings_test.py`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/gymhub/settings_test.py), base de datos separada, caché en memoria y Celery en modo eager.

## Variables Operativas Relevantes
- `DJANGO_SECRET_KEY`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`
- `REDIS_URL`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`
- `OPENAI_API_KEY`
- `EMERGENT_LLM_KEY`
- `OPENAI_MODEL`
- `AI_DAILY_LIMIT_PER_USER`
- `INACTIVITY_DAYS_THRESHOLD`
- `PAYMENT_GRACE_DAYS`

## Consideraciones De Despliegue
- El proyecto usa Gunicorn con `--reload`, lo cual es útil en desarrollo pero no ideal en producción.
- `ALLOWED_HOSTS` está abierto a `['*']`; debe cerrarse por entorno antes de exponer el servicio.
- La documentación actual referencia `.env.example`, pero no existe en el repositorio.
- No hay evidencia de directorios `migrations/` versionados en las apps.
