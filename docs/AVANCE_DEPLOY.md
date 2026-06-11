# Avance Deploy

## Estado Actual

El despliegue inicial ya esta operativo con:

- Frontend Vercel: `https://proyectoappgym-frontend.vercel.app`
- Backend Vercel: `https://proyectoappgym-backend.vercel.app`
- API schema: `https://proyectoappgym-backend.vercel.app/api/schema/`
- API docs: `https://proyectoappgym-backend.vercel.app/api/docs/`
- Base de datos: Supabase PostgreSQL por pooler.

## Validaciones Realizadas

- Supabase PostgreSQL: migraciones aplicadas correctamente.
- Reparación directa 2026-04-30 sobre Supabase:
  - se añadió `plans_workoutday.day_of_week`
  - se creó `plans_gymmachine`
  - se añadió `plans_exercise.machine_id`
  - se añadió `progress_progresslog.height_cm`
  - motivo: el historial marcaba migraciones como aplicadas, pero el esquema real no tenía esos cambios
- Supabase seed: `seed_data` completado con usuarios demo, miembros, planes, asistencia, sesiones, pagos, alertas y notificaciones.
- El seed actualizado conserva solo las cuentas demo `trainer1@gymhub.com` y `member1@gymhub.com`.
- Backend Vercel: `/api/schema/` responde `HTTP 200`.
- Frontend Vercel: responde `HTTP 200`.
- Login real contra backend Vercel:
  - usuario: `trainer1@gymhub.com`
  - resultado: `HTTP 200`
  - CORS: correcto desde `https://proyectoappgym-frontend.vercel.app`
  - cookies JWT: emitidas correctamente.
- Build frontend remoto en Vercel: correcto.
- Revalidación post-reparación:
  - `/auth/me/` por preview/frontend: `200`
  - `/api/trainer/gym-overview/`: `200`
  - `/api/charts/overview/`: `200`
  - `/api/members/`: `200`

## Credenciales Demo

Las credenciales demo no deben publicarse en documentacion externa. Para QA interno:

- Trainer demo: `trainer1@gymhub.com`
- Member demo: `member1@gymhub.com`
- Las passwords estan definidas por el comando `seed_data`.
- Para eliminar demos anteriores (`trainer2`, `member2`-`member20`) usa `python manage.py prune_demo_users --yes` despues de revisar el dry-run.

## Cambios De Infraestructura

- PostgreSQL local fue removido del compose principal y de produccion local.
- Django acepta `DATABASE_URL`, `DB_SSLMODE` y `DB_CONN_MAX_AGE`.
- Vercel backend usa cache local en memoria con `REDIS_URL=locmem://`.
- Vercel frontend usa `VITE_API_BASE_URL=` vacio y rewrites same-origin en `frontend/vercel.json` hacia `https://proyectoappgym-backend.vercel.app`.
- Se agregaron `.vercelignore` para frontend y backend para evitar subir artefactos locales.
- Se agrego `./gym-connection-check` para validar frontend, backend, readiness de base/cache y rewrite `/health` desde el dominio publico.

## Limitaciones Actuales

- El repo conserva un problema de permisos en algunas carpetas `gymhub/*/migrations/`, propiedad `nobody:nogroup`, que puede bloquear la creación de migraciones futuras desde este workspace.
- La reparación de esquema del 2026-04-30 ya tiene migraciones versionadas en `plans/0005` y `progress/0004`; antes de futuros deploys se debe validar que el historial Django y el esquema real sigan alineados.
- Vercel ejecuta el backend como runtime web serverless, no como proceso persistente.
- Celery worker y Celery Beat no estan desplegados en Vercel.
- Redis gestionado no esta configurado en produccion.
- Archivos media y graficas generadas no tienen almacenamiento persistente externo.
- No se ha ejecutado smoke completo de navegador sobre todos los flujos MVP.
- Hay artefactos locales con permisos heredados de WSL/Windows ignorados por Git:
  - `frontend/node_modules.inaccessible.bak/`
  - `frontend/dist.inaccessible.bak/`

## Siguiente Hito

1. Ejecutar QA manual completo sobre frontend y backend desplegados.
2. Configurar Redis gestionado si tareas asincronas quedan en alcance de produccion.
3. Resolver almacenamiento media con Supabase Storage, S3 compatible o estrategia equivalente.
4. Rotar secretos compartidos durante preparacion.
5. Configurar dominios propios si aplica.
