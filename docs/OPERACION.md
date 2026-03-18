# Operación Y Desarrollo

## Requisitos
- Docker y Docker Compose
- Variables de entorno en `.env` de la raíz
- PostgreSQL 15+
- Redis 7+

## Puesta En Marcha Local
Desde la raíz del repositorio:

```bash
cp .env.example .env
./gym-start
docker compose exec backend python manage.py seed_data
docker compose exec backend python manage.py createsuperuser
```

## Scripts Operativos
- `./gym-start`: levanta y reconstruye los contenedores principales.
- `./gym-stop`: detiene los contenedores preservando volúmenes.
- `./gym-log [servicios...]`: sigue logs de todos los servicios o solo de los indicados.

## Servicios
- `frontend`: ejecuta Vite en el puerto `3000`.
- `backend`: ejecuta Django en el puerto `8000`.
- `db`: PostgreSQL.
- `redis`: broker y caché.
- `celery`: worker de tareas.
- `celerybeat`: scheduler de tareas recurrentes.

## Pruebas
Comandos principales:

```bash
docker compose exec backend ./run_tests.sh
docker compose exec backend pytest tests/ -v --tb=short
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
- `VITE_API_BASE_URL`
- `VITE_PROXY_TARGET`

## Consideraciones De Despliegue
- El flujo Docker local usa `runserver` para recarga rápida; producción debe usar una configuración separada.
- `ALLOWED_HOSTS` ya debe configurarse por entorno desde `.env`.
- No hay evidencia de directorios `migrations/` versionados en las apps.
