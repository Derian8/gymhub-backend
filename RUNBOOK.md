# Runbook De Entrega Y Soporte

## Fuente Principal
Este documento concentra el flujo de arranque, validación, soporte y recuperación. La documentación en `docs/` queda como detalle técnico complementario.

## Entornos Soportados
- Desarrollo local: usa [`.env.example`](/mnt/c/dev/proyectos/proyectoappgym/.env.example) y `./gym-start`.
- Producción local validada: usa [`.env.prod.example`](/mnt/c/dev/proyectos/proyectoappgym/.env.prod.example) y `./gym-start --prod`.
- Staging real: usa [`.env.staging.example`](/mnt/c/dev/proyectos/proyectoappgym/.env.staging.example) como plantilla y reemplaza dominios, secretos, cookies y SSL por valores reales antes de desplegar.
- Base de datos: PostgreSQL vive en Supabase. No hay contenedor local `db`.

## Arranque
```bash
cp .env.example .env
# Edita .env con DATABASE_URL o DB_* de Supabase antes de levantar servicios.
./gym-start
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_data
```

## Arranque Producción Local
```bash
cp .env.prod.example .env
./gym-start --prod
./gym-smoke --prod --seed
```

## Staging Real
Antes de desplegar un staging accesible por internet:
- define `ALLOWED_HOSTS` con el dominio real
- define `CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS` con orígenes HTTPS reales
- activa `AUTH_COOKIE_SECURE`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` y `SECURE_SSL_REDIRECT`
- activa HSTS según tu terminación TLS
- configura `USE_X_FORWARDED_PROTO=True` si hay proxy reverso con HTTPS
- configura `DATABASE_URL` de Supabase con `sslmode=require` o `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `DB_SSLMODE`
- confirma persistencia real para `MEDIA_ROOT` y acceso a `/media/charts/`

## Credenciales Demo Y Seed
- El entorno demo debe reconstruirse con `docker compose exec backend python manage.py seed_data`.
- El seed oficial deja solo `trainer1@gymhub.com` y `member1@gymhub.com` como cuentas demo.
- Para limpiar demos antiguos sin tocar usuarios reales, primero revisa candidatos con `docker compose exec backend python manage.py prune_demo_users` y luego confirma con `docker compose exec backend python manage.py prune_demo_users --yes`.
- Las credenciales oficiales de demo deben documentarse junto al despliegue final o en un secreto compartido del equipo. No deben quedar hardcodeadas en documentación pública.
- Si el entorno requiere datos limpios, recrea base de datos y vuelve a correr `seed_data` antes de QA o demos.

## Logs
```bash
./gym-log
./gym-log backend frontend celery celerybeat
```

## Stop
```bash
./gym-stop
```

## Reset Operativo
```bash
# Siempre simula primero.
python gymhub/manage.py reset_member_operational_data

# Después de validar el respaldo y las cantidades:
python gymhub/manage.py reset_member_operational_data --confirm
```

Este reinicio elimina planes asignados, actividad, asistencia y facturación de los
miembros. Conserva usuarios, contraseñas, perfiles, asignaciones trainer-miembro,
auditoría, máquinas, plantillas y catálogos comerciales.

## Backup De Base De Datos
```bash
pg_dump "$DATABASE_URL" > backup.sql
```

## Restore De Base De Datos
```bash
psql "$DATABASE_URL" < backup.sql
docker compose exec backend python manage.py migrate
```

## Validación Post-Despliegue
Ejecuta en este orden:
1. Backend tests: `docker compose exec backend pytest tests/ -q`
2. Frontend tests: `./gym-frontend-test`
3. Frontend build: `docker compose exec frontend npm run build`
4. Playwright: `docker compose exec frontend npm run test:e2e`
5. Smoke dev o prod local: `./gym-smoke --seed` o `./gym-smoke --prod --seed`
6. Conexión pública Vercel/Supabase: `./gym-connection-check`
7. Smoke contra backend desplegado: `BACKEND_URL=https://proyectoappgym-backend.vercel.app ./gym-smoke`
8. QA manual sobre todas las rutas de [`docs/MVP_FUNCIONAL.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/MVP_FUNCIONAL.md)

## Diagnóstico De Conexión
```bash
./gym-connection-check
FRONTEND_URL=https://app.tu-dominio.com BACKEND_URL=https://api.tu-dominio.com ./gym-connection-check
```

El check valida HTML del frontend, schema OpenAPI del backend, `/health/live/`, `/health/ready/` directo y `/health/ready/` pasando por el rewrite del frontend. Si falla, el mensaje separa problemas de frontend, backend, base de datos, cache o proxy.

## Umbrales Mínimos De Cobertura
- Backend total objetivo: 80%
- Frontend total objetivo: 75%
- Ningún módulo del MVP debería quedar por debajo de 70%
- Si todavía no hay tooling de coverage activo en el entorno, la release no queda bloqueada por este punto, pero el pendiente debe quedar explícito en el acta de entrega

## QA Manual Del MVP
Verifica por rol:
- login y redirección correcta
- dashboards sin placeholders
- miembros, planes y plan de hoy
- check-in
- billing
- nutrition
- alerts
- charts
- ai-chat
- profile

Confirma en cada ruta estado `loading`, `empty`, `error`, permisos y navegación.

## Estrategia De Despliegue
La entrega final debe fijar una sola estrategia operativa. Recomendación pragmática actual:
- App Django/React en Docker Compose o plataforma compatible, con PostgreSQL gestionado por Supabase

Alternativas posibles, pero no definidas aquí:
- Render
- Fly.io
- infraestructura propia
