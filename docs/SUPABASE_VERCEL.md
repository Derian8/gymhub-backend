# Supabase y Vercel

Desde el 18 de noviembre de 2026, frontend y API públicos viven en Vercel.
Supabase conserva la base PostgreSQL y las imágenes privadas. Render no participa
en las peticiones del sitio.

## Destinos

- Frontend: https://www.pulsocr.me
- API: https://proyectoappgym-backend.vercel.app
- Esquema: https://www.pulsocr.me/api/schema/
- Swagger: https://www.pulsocr.me/api/docs/

## Datos y conexiones

Usar el mismo proyecto Supabase: no copiar ni reinicializar las cuentas o datos.
La API utiliza Transaction Pooler (`6543`), SSL, `CONN_MAX_AGE=0`, cursores del
servidor deshabilitados y prepared statements desactivados. El pool local de
cada instancia Vercel abre entre cero y una conexión. Las migraciones pueden
usar Session Pooler si requieren características de sesión.

## Fotos

El backend utiliza `django-storages` por S3 con el bucket privado `gymhub-media`.
Las credenciales S3 reales están en archivos privados locales y en variables
sensibles de producción del backend Vercel. Nunca deben estar en Git ni en
variables `VITE_*`. Mantener `USE_S3_STORAGE=True`, `signature_version=s3v4`,
`default_acl=None` y URLs firmadas con vigencia de 900 segundos.

La API y el bucket admiten imágenes JPEG, PNG y WebP de hasta 2 MB. La aplicación
las sube a Django; Django autoriza y guarda en Storage. El navegador descarga
la imagen directamente mediante su URL firmada. No se necesitan políticas de
lectura pública ni una migración de la autenticación a Supabase Auth.

## Caché y tareas

Con `USE_DB_CACHE=True`, crear `registros_cache` mediante
`manage.py createcachetable registros_cache`. Los tokens QR se guardan como
hash en `tokens_acceso_qr`, tienen vencimiento y consumo de un solo uso.

El cron configurado en [el backend](../gymhub/vercel.json) llama al mantenimiento
diario con `Authorization: Bearer CRON_SECRET`. Incluye membresías, planes,
inactividad y limpieza de tokens. No se despliegan Worker, Beat ni Redis.
El cron gratuito no garantiza precisión por minuto. Las reglas de acceso se
verifican también durante cada operación del cliente.

## Frontend y publicación

Mantener `VITE_API_BASE_URL=` vacío. Los [rewrites](../frontend/vercel.json)
enrutan `/auth/`, `/api/`, `/health/` y `/media/` hacia Vercel backend. Las fotos
persistentes usan URLs firmadas externas permitidas por la CSP de imágenes.

```bash
./deploy-supabase-vercel.sh --dry-run
./deploy-supabase-vercel.sh
./gym-connection-check
```

El script migra, crea la tabla de caché, audita el esquema, publica backend y
frontend y valida la misma API usada por el dominio público. Los identificadores
Vercel de frontend y backend son distintos. Al usar comandos CLI manuales desde
`gymhub/`, establecer `VERCEL_PROJECT_ID` al identificador del backend si el
archivo privado exporta el del frontend.

## Recuperación y límites

Conservar respaldos privados de PostgreSQL y archivos antes de futuros cambios.
La copia previa a este retorno está fuera de Git. Los cambios de esquema fueron
aditivos. El servicio anterior Render se conserva, pero no cambiar los rewrites
sin validar su compatibilidad con el esquema y Storage actuales.

Vercel puede tener arranques fríos y Supabase Free puede pausarse por inactividad.
Comprobar los dashboards antes de una presentación. La tarea Windows
`Pulso-Render-KeepAlive` debe permanecer deshabilitada; no hace falta para Vercel.

Detalles y evidencia: [retorno](RETORNO_VERCEL_SUPABASE.md) y
[infraestructura de feria](INFRAESTRUCTURA_FERIA.md).
