# proyectoappgym
# ("Backend Django para Gimnasio Miembros Hub – gestión miembros, planes, IA chat")

## Documentación
- Guía de contribución: [`AGENTS.md`](/mnt/c/dev/proyectos/proyectoappgym/AGENTS.md)
- Runbook operativo principal: [`RUNBOOK.md`](/mnt/c/dev/proyectos/proyectoappgym/RUNBOOK.md)
- Índice de documentación técnica: [`docs/README.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/README.md)
- Backend y uso operativo: [`gymhub/README.md`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/README.md)
- Checklist de release: [`docs/RELEASE_CHECKLIST.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/RELEASE_CHECKLIST.md)
- Supabase y Vercel: [`docs/SUPABASE_VERCEL.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/SUPABASE_VERCEL.md)
- Avance deploy: [`docs/AVANCE_DEPLOY.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/AVANCE_DEPLOY.md)
- Proyecto escrito ExpoTÉCNICA en LaTeX y APA 7: [`docs/gymhub_expotecnica/README.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/gymhub_expotecnica/README.md)
- Roles, perfiles compartidos y selector de contexto: [`docs/ROLES_Y_CONTEXTOS.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/ROLES_Y_CONTEXTOS.md)

## Deploy Actual
- Frontend: `https://proyectoappgym-frontend.vercel.app`
- Backend API: `https://proyectoappgym-backend.vercel.app`
- API Docs: `https://proyectoappgym-backend.vercel.app/api/docs/`
- Base de datos: Supabase PostgreSQL.

## Arranque rápido
1. Crea `.env` a partir de [`.env.example`](/mnt/c/dev/proyectos/proyectoappgym/.env.example).
   Para producción local puedes partir de [`.env.prod.example`](/mnt/c/dev/proyectos/proyectoappgym/.env.prod.example).
   Para staging real con HTTPS usa como base [`.env.staging.example`](/mnt/c/dev/proyectos/proyectoappgym/.env.staging.example).
2. Si trabajas en WSL con Docker Desktop, habilita la integración de la distro en `Settings > Resources > WSL Integration` y confirma que Docker Desktop esté iniciado con contenedores Linux.
3. Configura PostgreSQL en Supabase en `.env`. El proyecto ya no levanta PostgreSQL local.
   Para crear demos, define también `DEMO_TRAINER_PASSWORD` y `DEMO_MEMBER_PASSWORD` con valores privados.
4. Ejecuta `./gym-start` para levantar `frontend`, `backend`, `redis`, `celery` y `celerybeat`.

El panel administrativo prioriza clientes al día, cartera de pagos, clientes sin rutina y rutinas que vencen en 14 días. La asignación rápida publica plantillas para clientes elegibles y programa la siguiente rutina sin interrumpir la vigente.
   Para un arranque de producción local usa `./gym-start --prod`.
5. Usa `./gym-log` para seguir logs en tiempo real.
6. Ejecuta `./gym-smoke` para validar el MVP con usuarios demo y endpoints reales.
   Usa `./gym-smoke --write` únicamente donde se permitan escrituras de prueba.
7. Usa `./gym-stop` para detener los contenedores sin borrar volúmenes.
8. Usa `./gym-frontend-test` para correr Vitest del frontend dentro del contenedor dedicado `frontend-test`, sin depender de `frontend/node_modules` del host.
9. Usa `./gym-connection-check` para validar conexión pública de frontend, backend, base de datos, cache y rewrites de Vercel.

Para publicar todo el entorno con un único comando, primero revisa la simulación y
después ejecuta el despliegue real:

```bash
./deploy-supabase-vercel.sh --dry-run
./deploy-supabase-vercel.sh
```

El script aplica y audita las migraciones de Supabase, despliega backend y frontend
en Vercel y termina con la validación pública. Usa `--help` para omitir etapas.

Para reconstruir las demos numeradas sin tocar cuentas reales, ejecuta primero
`python manage.py restablecer_demo` y confirma después con
`python manage.py restablecer_demo --yes`.

### Arranque local sin Docker

Si Docker Desktop no está iniciado o no está integrado con WSL, puedes levantar ambos proyectos directamente:

Backend:

```bash
cd gymhub
set -a; source ../.env; set +a
REDIS_URL=locmem:// CELERY_BROKER_URL=locmem:// CELERY_RESULT_BACKEND=locmem:// ../.venv/bin/python manage.py runserver 127.0.0.1:8000 --noreload
```

Frontend:

```bash
cd frontend
VITE_API_BASE_URL= VITE_PROXY_TARGET=http://127.0.0.1:8000 npm run dev
```

Valida conexión local con:

```bash
curl http://127.0.0.1:8000/health/live/
curl http://localhost:3000/api/members/
```

El segundo comando debe responder `401` si no hay sesión; eso confirma que el proxy del frontend llega al backend.

## Base De Datos
- PostgreSQL vive en Supabase. Usa `DATABASE_URL` con `sslmode=require` o las variables `DB_*` de [`.env.example`](/mnt/c/dev/proyectos/proyectoappgym/.env.example).
- Para aplicaciones Django persistentes, usa el Session Pooler de Supabase y configura `DB_CONN_MAX_AGE`.
- Las migraciones siguen siendo las migraciones Django versionadas del repositorio: `docker compose exec backend python manage.py migrate`.
- El backup/restore operativo debe hacerse desde Supabase Dashboard, `pg_dump` contra la URL de Supabase o la CLI de Supabase; ya no existe servicio local `db`.

## Entrega Y Release
- La fuente principal para operación, soporte y recuperación es [`RUNBOOK.md`](/mnt/c/dev/proyectos/proyectoappgym/RUNBOOK.md).
- El estado exacto para continuar el desarrollo y los pendientes priorizados están en [`docs/TODO.md`](/mnt/c/dev/proyectoappgym/docs/TODO.md).
- El alcance funcional a validar manualmente está congelado en [`docs/MVP_FUNCIONAL.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/MVP_FUNCIONAL.md).
- El orden ejecutable de validación antes de entregar está en [`docs/RELEASE_CHECKLIST.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/RELEASE_CHECKLIST.md).
- [`render.yaml`](/mnt/c/dev/proyectos/proyectoappgym/render.yaml) declara la API persistente, Celery, Beat y Redis. Vercel sigue como backend activo hasta completar los gates y cambiar el rewrite.

## Integración Frontend/Backend
- En desarrollo Docker, deja `VITE_API_BASE_URL=` vacío para que Vite use proxy interno hacia `backend`.
- En producción local Docker, deja `VITE_API_BASE_URL=` vacío para que Nginx enrute `/auth/`, `/api/` y `/media/` al backend.
- En Vercel actual, deja `VITE_API_BASE_URL=` vacío y usa los rewrites de `frontend/vercel.json` para enrutar `/auth/`, `/api/`, `/health/` y `/media/` al backend desde el mismo origen del frontend.
- Usa `VITE_API_TIMEOUT_MS=60000`; el login calienta `/health/live/` y reintenta una vez antes de enviar credenciales.
- Las membresías admiten periodos diarios, semanales, quincenales, mensuales, trimestrales y anuales. El primer pago activa la vigencia y cada pago confirmado genera el siguiente cobro pendiente.
- Define `CRON_SECRET` en el backend de Vercel para proteger el mantenimiento diario de vigencias, mora y recordatorios.
- Si frontend y backend viven en dominios distintos, define `VITE_API_BASE_URL`, `CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS` de forma explícita.
- Las cookies JWT del backend ahora se controlan por entorno con `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE`, `AUTH_COOKIE_DOMAIN` y `AUTH_COOKIE_PATH`.
- El frontend obtiene CSRF desde `/auth/csrf/`; toda mutación autenticada por cookie requiere `X-CSRFToken`.
- El chat IA funciona gratis con un motor contextual por reglas y puede mejorar su redacción con un LLM local opcional; la configuración operativa vive en [`docs/OPERACION.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/OPERACION.md) y [`gymhub/README.md`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/README.md).
