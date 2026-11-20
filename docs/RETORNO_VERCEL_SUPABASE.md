# Retorno a Vercel y Supabase

## QR fijo — 2026-11-19

Se aplicó `attendance.0007_credencial_acceso_qr` en Supabase y se publicó la API
y el frontend con QR fijo. Se conservó un respaldo privado de PostgreSQL previo
a la migración. La auditoría confirmó consistencia de 51 modelos y 56 tablas.
La publicación conserva los archivos de la versión anterior y agrega únicamente
los cambios del QR; las modificaciones locales de rutinas quedan fuera del despliegue.

El QR se guarda en `credenciales_acceso_qr`, no caduca por tiempo ni por lectura,
y se puede invalidar con **Regenerar QR** en la ficha administrativa del cliente.
Cada lectura valida cliente y membresía antes de registrar la asistencia o
devolver la del día con `entrada_ya_registrada: true`. El cliente debe volver a
abrir su carnet después de una regeneración. Los tokens temporales anteriores
conservan su vencimiento y uso único durante la transición.

El paquete publicado pasó 8 pruebas backend de QR, 21 pruebas frontend y
TypeScript. La validación pública confirmó PostgreSQL, caché, rewrites,
autenticación same-origin, CSP y permiso de cámara.
La cuenta demo recibió el mismo QR desde dos sesiones independientes. También
se verificaron el rechazo de códigos desconocidos, el bloqueo de consultas sin
autenticación y la presencia de **Regenerar QR** en el frontend publicado.

## Estado publicado — 2026-11-18

El frontend público y la API usan Vercel. Las fotos usan Supabase Storage privado
y los datos permanecen en el mismo PostgreSQL de Supabase.
Se creó un respaldo privado antes de aplicar la migración aditiva de QR.
La consulta previa no encontró fotos, logos, QR de pago ni objetos de Storage.

API publicada en `https://proyectoappgym-backend.vercel.app`.
Se validaron HTTP 200 en readiness de PostgreSQL y caché compartida, login y
perfil de ambas cuentas demo y emisión del QR persistente del cliente.
Migración `attendance.0006_token_acceso_qr` aplicada y esquema auditado.
Pruebas finales seleccionadas: 19 pasan, incluidas las de QR, permisos,
mantenimiento, imágenes y esquema público. En la selección ampliada anterior
quedaron dos fallos en pruebas existentes: expectativas de gracia de membresía y
uso del rol antiguo `trainer`; no se cambió esa lógica para ocultar los fallos.
Se corrigió la herencia del mixin de estado de membresía para que DRF registre
su campo calculado y el esquema público no produzca HTTP 500.

Se validaron fotos por la API Vercel y por `www.pulsocr.me`: carga, lectura en una
petición posterior, descarga firmada y rechazo sin firma. La foto temporal fue
retirada y el perfil demo restaurado. Las claves S3 están configuradas como
secretos del backend y en archivos privados locales. El cron protegido respondió
HTTP 200. Membresías, exportaciones CSV/PDF y refresh de sesión pasaron en el
dominio público. El build frontend y TypeScript pasaron; `gym-connection-check`
validó esquema, salud, PostgreSQL, caché, rewrites y CSP.

La tarea Windows `Pulso-Render-KeepAlive` quedó deshabilitada. El servicio Render
anterior se conserva como referencia, sin tráfico del frontend.

## Configuración de la API

- `DATABASE_URL`: Transaction Pooler de Supabase con SSL.
- `DB_POOL_ENABLED=True`, `DB_POOL_MIN_SIZE=0`, `DB_POOL_MAX_SIZE=1`.
- `DB_CONN_MAX_AGE=0`, `DB_DISABLE_SERVER_SIDE_CURSORS=True`.
- `USE_DB_CACHE=True`: crear `registros_cache` mediante `manage.py createcachetable registros_cache`.
- `REDIS_URL=locmem://`: no se utiliza como fuente de verdad del QR.
- `AI_PROVIDER=deterministic`.
- Cookies seguras, `SameSite=Lax`, frontend con `VITE_API_BASE_URL` vacío y rewrites.

Los tokens QR temporales anteriores se guardan solo como hash en `tokens_acceso_qr`; vencen a los
120 segundos. El escaneo bloquea la fila y registra el consumo en la misma
transacción que la asistencia. La caché local deja de determinar su validez.

El cron diario existente ejecuta membresías, planes programados, alertas de
inactividad, limpieza de QR vencidos y limpieza de tokens JWT vencidos.
Requiere `Authorization: Bearer CRON_SECRET`; un bloqueo transaccional de
PostgreSQL impide ejecutar el mantenimiento simultáneamente. No requiere Worker
ni Beat en Vercel. Las llamadas HTTP del cron también consumen recursos.

## Fotos en Supabase Storage

Crear un bucket privado `gymhub-media`, con imágenes JPEG, PNG y WebP de hasta
2 MB. Generar credenciales S3 desde el dashboard autenticado de Supabase y
guardarlas exclusivamente en el entorno privado del backend:

```env
USE_S3_STORAGE=True
S3_ACCESS_KEY_ID=<credencial privada>
S3_SECRET_ACCESS_KEY=<credencial privada>
S3_BUCKET_NAME=gymhub-media
S3_ENDPOINT_URL=<endpoint S3 mostrado por Supabase>
S3_REGION=<región mostrada por Supabase>
S3_URL_EXPIRATION=900
```

El backend ya utiliza `django-storages` con firmas temporales y `default_acl=None`.
No habilitar S3 con valores vacíos. Las claves S3 deben mantenerse fuera del
frontend y Git; no equivalen a la contraseña de PostgreSQL. Para esta primera
versión, Django recibe cargas menores de 2 MB y las envía a Storage. Las
descargas usan URLs firmadas directas, compatibles con `img-src https:` actual.

Las credenciales se generaron desde la sesión autenticada de Supabase.
La firma S3 v4 es obligatoria: la firma anterior producía HTTP 403 al descargar.
Las pruebas automatizadas fuerzan almacenamiento local para no escribir en el
bucket real aunque los archivos privados locales habiliten S3.

## Validación y cambio público

1. Validar migraciones y esquema; conservar el respaldo privado.
2. Desplegar y comprobar `/health/ready/` en la API Vercel.
3. Probar login, cookies, refresh y permisos desde el mismo origen del frontend.
4. Probar QR válido, vencido y reutilizado con PostgreSQL compartido.
5. Subir y descargar una foto; comprobar persistencia y permisos.
6. Probar rutina guiada, guardado de cada ejercicio, pagos y exportaciones.
7. Sustituir los destinos Render de `frontend/vercel.json` por la API Vercel.
8. Cambiar `ACTIVE_BACKEND_PUBLIC_URL` y los valores por defecto de los scripts
   de validación al mismo destino; comprobar nuevamente el dominio público.
9. Tras comprobar el cron y el consumo, retirar Render y el keep-alive de Windows.

No retirar Render ni afirmar que las fotos funcionan mientras falte la prueba
real de Storage. La primera petición de Vercel puede tener demora de arranque.
Notificaciones consultan cada dos minutos; informes se actualizan al navegar
o invalidar consultas. El guardado inmediato de ejercicios se conserva.
