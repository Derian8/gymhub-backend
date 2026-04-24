# Operación Y Desarrollo

> La fuente principal de operación y soporte es [`RUNBOOK.md`](/mnt/c/dev/proyectos/proyectoappgym/RUNBOOK.md). Este documento conserva detalle técnico complementario.

## Requisitos
- Docker y Docker Compose
- Si usas WSL, habilita la integración de la distro en Docker Desktop y verifica que el engine Linux esté levantado
- Variables de entorno en `.env` de la raíz
- Proyecto PostgreSQL en Supabase
- Redis 7+

## Puesta En Marcha Local
Desde la raíz del repositorio:

```bash
cp .env.example .env
# Edita .env con DATABASE_URL o DB_* de Supabase.
./gym-start
docker compose exec backend python manage.py seed_data
docker compose exec backend python manage.py createsuperuser
```

Para un arranque de producción local:

```bash
cp .env.prod.example .env
./gym-start --prod
./gym-smoke --prod --seed
```

Para un despliegue real con HTTPS, no reutilices sin cambios el `.env.prod.example` local:
- activa `AUTH_COOKIE_SECURE`, `SESSION_COOKIE_SECURE` y `CSRF_COOKIE_SECURE`
- activa `SECURE_SSL_REDIRECT`
- reemplaza `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS` por dominios reales
- reemplaza `DATABASE_URL` o `DB_*` por credenciales reales de Supabase
- parte de [`.env.staging.example`](/mnt/c/dev/proyectos/proyectoappgym/.env.staging.example) para separar staging real del flujo local

## Scripts Operativos
- `./gym-start`: levanta y reconstruye los contenedores principales.
- `./gym-start --prod`: levanta el stack con backend en Gunicorn y frontend estático servido por Nginx.
- `./gym-stop`: detiene los contenedores preservando volúmenes.
- `./gym-log [servicios...]`: sigue logs de todos los servicios o solo de los indicados.
- `./gym-smoke`: valida login y endpoints críticos de `trainer` y `member`.
- `./gym-smoke --seed`: recarga datos demo antes de ejecutar la validación.

## Servicios
- `frontend`: ejecuta Vite en el puerto `3000`.
- `backend`: ejecuta Django en el puerto `8000`.
- `db`: no existe localmente; PostgreSQL vive en Supabase.
- `redis`: broker y caché.
- `celery`: worker de tareas.
- `celerybeat`: scheduler de tareas recurrentes.

## Pruebas
Comandos principales:

```bash
docker compose exec backend ./run_tests.sh
docker compose exec backend pytest tests/ -v --tb=short
./gym-frontend-test
Ejecuta Vitest dentro del servicio dedicado `frontend-test`, sin usar `node_modules` del host.
cd frontend && npm run build
cd frontend && npm run test:e2e
```

La configuración de pruebas usa [`gymhub/gymhub/settings_test.py`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/gymhub/settings_test.py), base de datos separada, caché en memoria y Celery en modo eager.

Para E2E con Playwright:
- levanta el stack y carga datos demo con `./gym-smoke --seed` o `./gym-smoke --prod --seed`
- ejecuta `cd frontend && npm run test:e2e`
- si necesitas navegador visible, usa `cd frontend && npm run test:e2e:headed`

## Variables Operativas Relevantes
- `DJANGO_SECRET_KEY`
- `AUTH_COOKIE_SECURE`
- `AUTH_COOKIE_SAMESITE`
- `AUTH_COOKIE_DOMAIN`
- `AUTH_COOKIE_PATH`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`
- `DATABASE_URL`
- `DB_SSLMODE`
- `DB_CONN_MAX_AGE`
- `REDIS_URL`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`
- `OPENAI_API_KEY`
- `EMERGENT_LLM_KEY`
- `OPENAI_MODEL`
- `AI_PROVIDER`
- `AI_LOCAL_BACKEND`
- `AI_LOCAL_MODEL`
- `AI_LOCAL_BASE_URL`
- `AI_LOCAL_TIMEOUT_MS`
- `AI_DAILY_LIMIT_PER_USER`
- `AI_DAILY_LIMIT_MEMBER`
- `AI_DAILY_LIMIT_TRAINER`
- `AI_CHAT_HISTORY_WINDOW`
- `INACTIVITY_DAYS_THRESHOLD`
- `PAYMENT_GRACE_DAYS`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `SECURE_SSL_REDIRECT`
- `USE_X_FORWARDED_PROTO`
- `VITE_API_BASE_URL`
- `VITE_PROXY_TARGET`
- `VITE_API_TIMEOUT_MS`

## Consideraciones De Despliegue
- El flujo Docker local usa `runserver` para recarga rápida.
- El flujo `--prod` usa Gunicorn en backend y Nginx para servir el frontend compilado.
- La base de datos es Supabase PostgreSQL en todos los entornos; los compose no crean un contenedor PostgreSQL local.
- Usa `DATABASE_URL` con `sslmode=require` o las variables `DB_*` equivalentes.
- `ALLOWED_HOSTS` ya debe configurarse por entorno desde `.env`.
- En producción local con `docker-compose.prod.yml`, deja `VITE_API_BASE_URL=` vacío para que Nginx enrute `/auth/`, `/api/` y `/media/` al backend.
- Para pruebas E2E desde contenedores, incluye `host.docker.internal` en `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS`.
- Si usas frontend y backend en orígenes distintos, alinea `VITE_API_BASE_URL`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` y la política de cookies antes de probar login.
