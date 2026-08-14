# Supabase Y Vercel

Esta guia define que datos hacen falta para conectar el proyecto con Supabase PostgreSQL y desplegar el frontend en Vercel.

## URLs Actuales

- Frontend: `https://proyectoappgym-frontend.vercel.app`
- Backend API: `https://proyectoappgym-backend.vercel.app`
- API schema: `https://proyectoappgym-backend.vercel.app/api/schema/`
- API docs: `https://proyectoappgym-backend.vercel.app/api/docs/`

## Alcance

- Supabase reemplaza PostgreSQL local.
- Vercel sirve el frontend Vite/React.
- El backend Django sigue necesitando un runtime persistente compatible con Docker/Gunicorn, Redis, Celery y Celery Beat. Vercel no reemplaza Redis/Celery ni ejecuta este stack Docker completo.

## Archivo Local De Credenciales

Usa [`.env.supabase-vercel.local`](/mnt/c/dev/proyectos/proyectoappgym/.env.supabase-vercel.local) como plantilla local privada. No debe subirse al repositorio.

El archivo contiene:
- credenciales de Supabase PostgreSQL
- variables opcionales de Supabase API
- variables publicas de Vercel para el frontend
- variables de seguridad Django para dominios reales
- token y metadatos de Vercel CLI/CI

## Datos Necesarios De Supabase

En Supabase Dashboard, abre el proyecto y usa `Connect` para obtener:

- `DATABASE_URL`: connection string de PostgreSQL.
- `PROJECT_REF`: identificador del proyecto.
- `DB_PASSWORD`: password de la base.
- `DB_HOST`: host del pooler o conexion directa.
- `DB_PORT`: normalmente `5432` para Session Pooler o directo.
- `SUPABASE_URL`: URL API del proyecto, si luego se usa Storage/Auth/Data API.
- `SUPABASE_ANON_KEY`: clave publica para clientes, si luego se usa el SDK.
- `SUPABASE_SERVICE_ROLE_KEY`: solo backend/CI; nunca frontend.

Para este backend Django persistente, usar preferentemente Session Pooler:

```env
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require
DB_SSLMODE=require
DB_CONN_MAX_AGE=60
```

La conexion directa de Supabase suele requerir IPv6. Si el entorno local, Vercel, Docker host o proveedor del backend no soporta IPv6, usa la connection string de Session Pooler que aparece en `Connect` dentro del Dashboard de Supabase.

Si despliegas el backend en un entorno serverless, revisa Transaction Pooler; ese modo puede requerir evitar prepared statements.

Estado local validado:
- Vercel API: token y team ID validos.
- Vercel frontend: proyecto `proyectoappgym-frontend` desplegado en `https://proyectoappgym-frontend.vercel.app`.
- Vercel backend: proyecto `proyectoappgym-backend` desplegado en `https://proyectoappgym-backend.vercel.app`.
- Supabase Direct Connection: no valida desde WSL por falta de ruta IPv6.
- Supabase Pooler `aws-1-us-west-2.pooler.supabase.com:6543`: conexion y consulta minima OK.
- Backend Django en Vercel: `/api/schema/` responde `HTTP 200`.
- Login real `trainer1@gymhub.com`: `HTTP 200`, CORS OK desde frontend Vercel y cookies JWT emitidas.

## Datos Necesarios De Vercel

Para el frontend necesitas:

- cuenta o equipo Vercel
- proyecto Vercel vinculado al directorio `frontend/`
- `VERCEL_TOKEN` para CLI/CI si se automatiza despliegue
- `VERCEL_ORG_ID` y `VERCEL_PROJECT_ID` si se despliega por CI
- dominio final del frontend, por ejemplo `https://tu-proyecto.vercel.app`
- URL publica del backend, por ejemplo `https://api.tu-dominio.com`

Variables Vercel para el frontend:

```env
VITE_API_BASE_URL=
VITE_API_TIMEOUT_MS=15000
```

En el despliegue actual se recomienda dejar `VITE_API_BASE_URL` vacio y usar rewrites same-origin en `frontend/vercel.json`. Esto mantiene `/auth/`, `/api/`, `/health/` y `/media/` bajo el dominio del frontend y reduce problemas de cookies. Si decides consumir un backend en otro origen sin proxy, entonces configura `VITE_API_BASE_URL=https://api.tu-dominio.com` y alinea CORS/CSRF/cookies.

## Variables Backend Para Dominio Vercel

Cuando el frontend vive en Vercel y el backend en otro dominio:

```env
ALLOWED_HOSTS=api.tu-dominio.com
CORS_ALLOWED_ORIGINS=https://tu-proyecto.vercel.app
CSRF_TRUSTED_ORIGINS=https://tu-proyecto.vercel.app
AUTH_COOKIE_SECURE=True
AUTH_COOKIE_SAMESITE=None
SESSION_COOKIE_SECURE=True
SESSION_COOKIE_SAMESITE=None
CSRF_COOKIE_SECURE=True
CSRF_COOKIE_SAMESITE=None
USE_X_FORWARDED_HOST=True
USE_X_FORWARDED_PROTO=True
SECURE_SSL_REDIRECT=True
```

Si usas un dominio compartido tipo `app.tu-dominio.com` y `api.tu-dominio.com`, se puede evaluar `AUTH_COOKIE_DOMAIN=.tu-dominio.com`. Si usas `vercel.app` y otro dominio de API, deja `AUTH_COOKIE_DOMAIN` vacio salvo que confirmes compatibilidad de cookies entre dominios.

## Flujo De Conexion

1. Completar `.env.supabase-vercel.local` con valores reales.
2. Copiar las variables backend necesarias al `.env` usado por Docker/backend.
3. Ejecutar migraciones contra Supabase:

```bash
docker compose exec backend python manage.py migrate
```

4. Cargar datos base si aplica:

```bash
docker compose exec backend python manage.py seed_data
```

5. Configurar Vercel con las variables `VITE_*`.
6. Desplegar frontend desde `frontend/`.
7. Validar login, refresh token, CORS/CSRF y endpoints criticos.

## Despliegue Automatizado

Desde la raíz del repositorio:

```bash
./deploy-supabase-vercel.sh --dry-run
./deploy-supabase-vercel.sh
```

El script usa `.env.supabase-vercel.local`, selecciona
`SUPABASE_POOLER_DATABASE_URL` para las migraciones cuando está disponible,
ejecuta `migrate` y `auditar_esquema`, publica primero el backend y espera que
responda antes de publicar el frontend. Finalmente ejecuta
`./gym-connection-check`.

Antes de tocar Supabase también ejecuta `makemigrations --check --dry-run`; si
los modelos cambiaron sin una migración versionada, el despliegue se detiene.

No carga datos demo. Para repetir una parte del flujo están disponibles
`--sin-migraciones`, `--sin-backend`, `--sin-frontend` y `--sin-validacion`.

## Comandos Vercel Utiles

```bash
cd frontend
vercel login
vercel link
vercel env pull .env.vercel.local
cd ..
./deploy-vercel-frontend
./deploy-vercel-backend
```

No uses el mismo `VERCEL_PROJECT_ID` para ambos despliegues. Si despliegas el backend
con el `project id` del frontend, Vercel intentará correr `vite build` dentro de
`gymhub/` y fallará con:

```text
sh: line 1: vite: command not found
Error: Command "vite build" exited with 127
```

Ese error no significa que falle Vite como dependencia del backend; significa que el
deploy salió dirigido al proyecto equivocado en Vercel.

`vercel env pull` descarga variables del proyecto a un archivo local. `vercel pull` descarga variables y settings bajo `.vercel/` para `vercel build` y `vercel dev`.

## Pendientes Antes De Produccion

- Definir donde corre el backend Django persistente.
- Definir Redis gestionado para Celery y cache.
- Definir almacenamiento de media: Supabase Storage, S3 compatible o volumen persistente servido por proxy.
- Mantener Vercel backend como runtime web serverless o migrarlo a un runtime persistente si Celery/Redis pasan a ser obligatorios.
- Ejecutar smoke completo navegador/API contra los dominios finales.
- Confirmar cookies cross-site reales en navegador.

## Fuentes Oficiales

- Supabase connection strings: https://supabase.com/docs/reference/postgres/connection-strings
- Supabase serverless/poolers: https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers
- Vercel environment variables: https://vercel.com/docs/environment-variables
- Vercel CLI env: https://vercel.com/docs/cli/env
- Vercel CLI pull: https://vercel.com/docs/cli/pull
