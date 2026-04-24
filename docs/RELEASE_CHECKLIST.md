# Checklist De Release

> Ejecuta este checklist junto con [`RUNBOOK.md`](/mnt/c/dev/proyectos/proyectoappgym/RUNBOOK.md). El runbook es la fuente principal operativa.

## Antes Del Arranque
- Confirmar `.env`, `.env.prod.example` o [`.env.staging.example`](/mnt/c/dev/proyectos/proyectoappgym/.env.staging.example) según el entorno.
- Confirmar `DATABASE_URL` o `DB_*` de Supabase con SSL habilitado.
- Definir `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS` finales.
- Si el entorno usa HTTPS real, activar `AUTH_COOKIE_SECURE`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` y `SECURE_SSL_REDIRECT`.
- Verificar claves y secretos: `DJANGO_SECRET_KEY`, `OPENAI_API_KEY` o `EMERGENT_LLM_KEY`.
- Confirmar estrategia final de despliegue elegida y única para la entrega.

## Validación Técnica
- Backend tests: `docker compose exec backend pytest tests -q`
- Frontend tests: `./gym-frontend-test`
- Frontend build: `docker compose exec frontend npm run build`
- Playwright: `docker compose exec frontend npm run test:e2e`
- Smoke dev: `./gym-smoke --seed`
- Smoke prod local: `./gym-smoke --prod --seed`
- QA manual: recorrer todas las rutas de [`MVP_FUNCIONAL.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/MVP_FUNCIONAL.md)
- Cobertura mínima objetivo: backend 80%, frontend 75%, sin módulos MVP por debajo de 70%

## Arranque Del Entorno
- Desarrollo: `./gym-start`
- Producción local: `./gym-start --prod`
- Revisar salud de `frontend`, `backend`, `redis`, `celery` y `celerybeat`.
- Revisar conectividad del backend hacia Supabase PostgreSQL.
- Confirmar que `seed_data` y `createsuperuser` funcionan si el entorno lo requiere.

## Flujo Funcional Mínimo
- Login trainer y member.
- Dashboard por rol.
- Listado y detalle de miembros.
- Plan de hoy, creación de sesión, registro de ejercicios y finalización.
- Check-in.
- Billing, nutrition, alerts, charts y ai-chat.

## Operación Y Recuperación
- Revisar logs: `./gym-log` o `./gym-log --prod`.
- Verificar acceso a media/charts en `/media/charts/`.
- Confirmar persistencia de Supabase PostgreSQL y Redis.
- Ejecutar backup de Supabase antes de cambios mayores.
- Validar restore contra Supabase en entorno controlado.
