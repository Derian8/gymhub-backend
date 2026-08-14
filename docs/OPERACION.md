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
- `./gym-smoke --write`: habilita mutaciones; sin esta bandera no crea sesiones ni blacklists de logout.
- `python manage.py restablecer_demo`: muestra el inventario demo sin modificarlo.
- `python manage.py restablecer_demo --yes`: recrea trainer1/member1 y elimina demos numeradas adicionales.
- `./deploy-supabase-vercel.sh --dry-run`: muestra el flujo de publicación sin modificar Supabase ni Vercel.
- `./deploy-supabase-vercel.sh`: migra y audita Supabase, despliega backend y frontend en Vercel y valida los servicios públicos.

El despliegue automatizado se detiene ante el primer error. También acepta
`--sin-migraciones`, `--sin-backend`, `--sin-frontend` y `--sin-validacion` para
repetir solo una parte del proceso. Las credenciales permanecen en
`.env.supabase-vercel.local`; el script no ejecuta `seed_data` ni imprime secretos.

## Servicios
- `frontend`: ejecuta Vite en el puerto `3000`.
- `backend`: ejecuta Django en el puerto `8000`.
- `db`: no existe localmente; PostgreSQL vive en Supabase.
- `redis`: broker y caché.
- `celery`: worker de tareas.
- `celerybeat`: scheduler de tareas recurrentes.

La rutina `plans.tasks.activate_scheduled_plans` se ejecuta diariamente a las 05:55 (Costa Rica). Además, el mantenimiento diario protegido por `CRON_SECRET` invoca la misma operación de forma idempotente para instalaciones serverless sin Celery Beat.

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
- `USE_S3_STORAGE`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_BUCKET_NAME`
- `S3_ENDPOINT_URL`
- `S3_REGION`
- `S3_URL_EXPIRATION`
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
- `MEMBERSHIP_EXPIRING_DAYS`: días para marcar una membresía como próxima a vencer. Valor por defecto: `5`.
- `CRON_SECRET`: secreto compartido que Vercel Cron envía como `Authorization: Bearer ...` al mantenimiento diario.
- `DB_DISABLE_SERVER_SIDE_CURSORS=True`: obligatorio al usar el Transaction Pooler de Supabase en el puerto 6543.

Las tolerancias operativas se guardan por plan: 0 días para diario, 1 para semanal, 2 para quincenal y 7 para periodos mayores. `PAYMENT_GRACE_DAYS` queda como valor heredado para flujos antiguos.

## Membresías
- `MemberSubscription` es la membresía individual del miembro y se administra desde `/api/member-memberships/`.
- Cada miembro puede tener solo una membresía operativa a la vez (`pending`, `active`, `expiring` o `suspended` con `is_active=True`).
- La renovación extiende de forma controlada la membresía existente y crea un nuevo `PaymentSchedule`/`PaymentRecord` para el siguiente periodo.
- Una membresía `expired`, `suspended` o `cancelled` bloquea check-in. El trainer/admin puede hacer override manual solo si envía un motivo en `notes`; el motivo queda en `AuditLog.details`.
- La tarea diaria `run_daily_membership_maintenance` actualiza `expiring`/`expired` y crea notificaciones deduplicadas por evento y día.
- El mismo mantenimiento activa rutinas publicadas con estado `scheduled` cuando llega su fecha inicial y finaliza la rutina activa anterior del cliente.

En Vercel, `gymhub/vercel.json` invoca diariamente `/api/internal/daily-membership-maintenance/` a las 12:05 UTC (06:05 Costa Rica). El endpoint es idempotente y exige `CRON_SECRET`.
- `DEMO_TRAINER_PASSWORD`
- `DEMO_MEMBER_PASSWORD`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `SECURE_SSL_REDIRECT`
- `USE_X_FORWARDED_PROTO`
- `VITE_API_BASE_URL`
- `VITE_PROXY_TARGET`
- `VITE_API_TIMEOUT_MS`

## Consideraciones De Despliegue
- `render.yaml` declara web Django, worker Celery, Beat y Render Key Value en Oregon.
- Render usa el Session Pooler de Supabase (`5432`); `6543` se reserva para serverless.
- El predeploy aplica migraciones y `auditar_esquema` valida tablas y columnas.
- Con `USE_S3_STORAGE=True`, media vive en el bucket privado `gymhub-media` y usa URLs firmadas.
- El flujo Docker local usa `runserver` para recarga rápida.
- El flujo `--prod` usa Gunicorn en backend y Nginx para servir el frontend compilado.
- La base de datos es Supabase PostgreSQL en todos los entornos; los compose no crean un contenedor PostgreSQL local.
- Usa `DATABASE_URL` con `sslmode=require` o las variables `DB_*` equivalentes.
- `ALLOWED_HOSTS` ya debe configurarse por entorno desde `.env`.
- En producción local con `docker-compose.prod.yml`, deja `VITE_API_BASE_URL=` vacío para que Nginx enrute `/auth/`, `/api/` y `/media/` al backend.
- Para pruebas E2E desde contenedores, incluye `host.docker.internal` en `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS`.
- Si usas frontend y backend en orígenes distintos, alinea `VITE_API_BASE_URL`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` y la política de cookies antes de probar login.
- En Vercel, elimina `VITE_API_BASE_URL` y usa `VITE_API_TIMEOUT_MS=60000`. `./gym-connection-check` falla si el bundle vuelve a apuntar al backend absoluto mientras la CSP mantiene `connect-src 'self'`.
