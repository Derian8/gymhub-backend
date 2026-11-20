# Operación Y Desarrollo

> La fuente principal de operación y soporte es [`RUNBOOK.md`](/mnt/c/dev/proyectos/proyectoappgym/RUNBOOK.md). Este documento conserva detalle técnico complementario.

## Requisitos
Para la demo pública en Vercel, consultar
[Retorno a Vercel y Supabase](RETORNO_VERCEL_SUPABASE.md).
Usa PostgreSQL para QR y caché compartida (`USE_DB_CACHE=True`), un pool de
0–1 conexiones por instancia y el cron diario protegido por `CRON_SECRET`.
Las imágenes nuevas admiten hasta 2 MB y requieren Storage privado externo.
Redis y Beat siguen siendo opciones del entorno local, no requisitos de esa demo.

- Docker y Docker Compose
- Si usas WSL, habilita la integración de la distro en Docker Desktop y verifica que el engine Linux esté levantado
- Variables de entorno en `.env` de la raíz
- Proyecto PostgreSQL en Supabase
- Redis 7+

## Puesta En Marcha Local
El QR del cliente es fijo y no caduca por tiempo ni por lectura. Se crea al abrir
el carnet y permanece en `credenciales_acceso_qr`; el cron solo elimina los tokens
temporales anteriores vencidos. Cada lectura requiere administración autenticada
y valida el estado del cliente y la membresía antes de registrar o devolver la entrada del día.
Para invalidar copias, abre la ficha del cliente y pulsa **Regenerar QR**. El cliente
debe volver a abrir su carnet para obtener el código actual; el evento queda auditado.
Aplica `docker compose exec backend python manage.py migrate` antes de activar esta versión
del backend y actualiza el frontend junto con él.

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
- `python manage.py reemplazar_rutinas_interval_timer --confirmar-borrado`: elimina rutinas y plantillas de entrenamiento, sesiones e historial de ejercicios; conserva el catálogo multimedia y planes vacíos archivados que sostienen datos nutricionales, y carga cuatro plantillas de ejemplo con 3×10–12 y descanso de 60 s.
- `./deploy-supabase-vercel.sh --dry-run`: muestra el flujo de publicación sin modificar Supabase ni Vercel.
- `./deploy-supabase-vercel.sh`: migra y audita Supabase, despliega backend y frontend en Vercel y valida sus rewrites desde el dominio público.

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
- `ACTIVE_FRONTEND_PUBLIC_URL`: dominio de producción que valida el release; por defecto `https://www.pulsocr.me`.
- `ACTIVE_BACKEND_PUBLIC_URL`: destino real de los rewrites públicos; por defecto `https://proyectoappgym-backend.vercel.app`.
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
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `OPENROUTER_API_KEY` (alias: `OPEN_ROUTER`)
- `OPENROUTER_MODEL` (default: `openrouter/free`; solo modelos gratuitos)
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
- `MEMBERSHIP_EXPIRING_DAYS`: días para marcar una membresía como próxima a vencer y mostrar el aviso de renovación. Valor por defecto: `7`.
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
- `render.yaml` declara solamente la API web en Render; usa caché local y no declara Redis, Celery Worker ni Celery Beat.
- La API activa está en Vercel; Render queda como referencia histórica y no requiere publicación.
- Render usa el Session Pooler de Supabase (`5432`); `6543` se reserva para serverless.
- El predeploy aplica migraciones y `auditar_esquema` valida tablas y columnas.
- La demo mantiene `USE_S3_STORAGE=True`: bucket privado `gymhub-media`, firmas `s3v4` y credenciales S3 sensibles exclusivamente en backend.
- La API y el bucket limitan las imágenes a 2 MB y admiten JPG, PNG y WebP.
- Las consultas de miembros y panel del frontend reutilizan respuestas durante 30 segundos y desactivan refetch por foco; las mutaciones invalidan esas consultas para mantener la información actualizada sin multiplicar llamadas a la API.
- Antes de cambiar el frontend a `api.pulsocr.me`, valida la API directamente y conserva el rewrite de Vercel como plan de reversión.
- El flujo Docker local usa `runserver` para recarga rápida.
- El flujo `--prod` usa Gunicorn en backend y Nginx para servir el frontend compilado.
- La base de datos es Supabase PostgreSQL en todos los entornos; los compose no crean un contenedor PostgreSQL local.
- Usa `DATABASE_URL` con `sslmode=require` o las variables `DB_*` equivalentes.
- `ALLOWED_HOSTS` ya debe configurarse por entorno desde `.env`.
- En producción local con `docker-compose.prod.yml`, deja `VITE_API_BASE_URL=` vacío para que Nginx enrute `/auth/`, `/api/` y `/media/` al backend.
- Para pruebas E2E desde contenedores, incluye `host.docker.internal` en `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS`.
- Si usas frontend y backend en orígenes distintos, alinea `VITE_API_BASE_URL`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` y la política de cookies antes de probar login.
- En Vercel, elimina `VITE_API_BASE_URL` y usa `VITE_API_TIMEOUT_MS=60000`. `./gym-connection-check` falla si el bundle vuelve a apuntar al backend absoluto mientras la CSP mantiene `connect-src 'self'`.

### Rendimiento de la lista de clientes

El listado pagina y ordena por riesgo en PostgreSQL, sin consultar planes o
membresias individualmente para cada cliente. Los resultados conservan las
reglas de riesgo, permisos y estados comerciales.

El backend utiliza `psycopg[binary,pool]` para reutilizar conexiones entre
peticiones, incluidas las conexiones del servidor de desarrollo. El pool tiene
una conexion minima y hasta cuatro por proceso; no almacena respuestas ni
retrasa la actualizacion de pagos. `DB_POOL_ENABLED` vale `True` por defecto.
`DB_POOL_MAX_SIZE` permite ajustar el maximo por proceso; considerar tambien
los procesos web y Celery al calcular el limite de conexiones. Con el pool
activo, `CONN_MAX_AGE` es `0`. Para deshabilitarlo, configurar
`DB_POOL_ENABLED=False`; entonces vuelve a aplicarse `DB_CONN_MAX_AGE`.
Reconstruir las imagenes backend y workers tras actualizar dependencias.

## Demo de IA con OpenRouter

Configura `OPENROUTER_API_KEY` (también se acepta `OPEN_ROUTER`),
`AI_PROVIDER=openrouter_hybrid` y `OPENROUTER_MODEL=openrouter/free` en `.env`.
Recrea el backend con `docker compose up -d --no-deps --force-recreate backend`
para cargar las variables nuevas. El agente de administración consulta herramientas
permitidas de solo lectura y conserva el respaldo por reglas ante cuotas o errores.
Solo se admiten el router gratuito y modelos cuyo identificador termine en `:free`.
Cada análisis puede necesitar hasta tres solicitudes al proveedor. No hay reintentos
automáticos por errores del proveedor, para conservar la cuota de la demo.

En Vercel, guarda la clave como variable sensible de Production del proyecto backend
(nunca como variable `VITE_`), configura el proveedor y modelo, y despliega de nuevo.
El frontend debe desplegarse también para mostrar la etiqueta OpenRouter.
Los chats de miembros e instructores comparten su contexto con OpenRouter; usa
usuarios y datos ficticios en la feria. El agente administrativo envía métricas
agregadas y la pregunta del administrador; evita datos personales en la pregunta.

## Copilot con respaldo OpenRouter

`AI_PROVIDER=copilot_hybrid` activa GitHub Copilot (modelo `auto` compatible
con Copilot Student), después OpenRouter gratuito y finalmente reglas.
`COPILOT_GITHUB_TOKEN` es un token privado fine-grained con permiso de cuenta
Copilot Requests; guárdalo en `.env` y como secreto Production del backend Vercel.
`COPILOT_TIMEOUT_SECONDS=45` limita la espera antes del respaldo.

El SDK está fijado a `github-copilot-sdk==1.0.35`. Descarga su runtime compatible
en una caché temporal del servidor; el primer arranque puede tardar más.
Cada consulta usa un directorio temporal y un entorno sin secretos de la base de
datos. Se deshabilitan herramientas incorporadas, archivos, shell, Git y skills;
el agente administrativo solo recibe herramientas con métricas agregadas.
El token tiene vencimiento: renueva la variable privada antes de que caduque.
Los créditos de la suscripción Copilot se consumen con las consultas; no se
habilita gasto adicional. Los fallos usan OpenRouter y luego reglas.
Después de cambiar estas variables, recrea el backend local y redespliega Vercel.
## Ejecución de rutinas del cliente

Con una entrada de hoy sin salida registrada, «Mi entrenamiento» permite seguir
el siguiente bloque del plan o elegir una rutina libre. El administrador habilita
esta última opción con «Disponible como rutina libre para clientes» al editar la
rutina; las existentes permanecen privadas hasta habilitarlas explícitamente.
La ejecución libre se guarda en el historial sin adelantar el plan asignado.

El administrador configura series, repeticiones o segundos de trabajo, descanso
entre series y descanso opcional entre ejercicios. El cliente ve la demostración
antes de comenzar cada ejercicio. En fuerza confirma «Serie completada»; en tiempo
el reloj avanza por preparación, trabajo y descanso. Puede pausar, saltar descansos,
omitir series o ejercicios y finalizar con confirmación sin perder lo realizado.
El historial distingue trabajo completo, parcial y omitido. Las repeticiones
prescritas no se presentan como una medición real del cliente.

Cada transición se guarda en el servidor con revisión e identificador de petición.
Al ocultar la página se solicita pausa; al recuperar un reloj activo se pausa antes
de mostrarlo. Una interrupción brusca conserva la última transición confirmada;
la aplicación no da por hechas varias series mientras estuvo suspendida.
Se requiere conexión para confirmar y avanzar; un fallo permite reintentar el mismo
registro sin duplicarlo. Las sesiones conservan su prescripción al iniciarse.

Antes de desplegar el frontend, aplicar las migraciones de `plans` y `progress`
con `manage.py migrate`. Los endpoints nuevos son `GET/POST /api/entrenamiento-cliente/`
y `POST /api/entrenamiento-cliente/{id}/accion/`. La consulta y las acciones se
limitan al cliente autenticado. La salida del gimnasio se registra por separado.

Vercel instala `requirements.txt`, que contiene las mismas dependencias que `requirements-prod.txt`.
Para desarrollar y ejecutar pytest, instala `pip install -r requirements-test.txt`.
Esto reduce el paquete y evita que las herramientas de prueba compitan con la
caché temporal del runtime Copilot. No se requiere cambiar el plan de Vercel.
## Correos de demo con Resend Free

Los comprobantes PDF de pagos confirmados (incluido el registro inicial), los
recordatorios de pago y los avisos de mora usan una cola persistente en la tabla
`correos_pendientes`. Los envíos están desactivados por defecto.

1. Crear una cuenta en https://resend.com/signup y conservar el plan **Free**:
   3.000 correos/mes y 100/día. No activar planes de pago.
2. Crear una API key de envío y guardarla únicamente en el entorno del backend.
3. Configurar `RESEND_HABILITADO=True`, `RESEND_API_KEY`,
   `DEFAULT_FROM_EMAIL=PULSO <onboarding@resend.dev>`, `RESEND_MODO_DEMO=True`
   y `RESEND_DESTINATARIO_DEMO` con el correo de la cuenta Resend. El demo
   redirige todos los correos a ese buzón, incluidos los comprobantes: utilizar
   datos ficticios. Nunca poner claves privadas en variables `VITE_*`.
4. Aplicar `python manage.py migrate` y reiniciar/desplegar el backend.
5. Confirmar un pago demo y comprobar el PDF adjunto y el registro de Resend.
   La aceptación del proveedor no demuestra entrega al buzón.

Para enviar a clientes hay que verificar un dominio en Resend, configurar su
remitente y cambiar `RESEND_MODO_DEMO=False`. Cambiar el destinatario demo no
redirige correos que ya estaban en cola; requieren revisión manual.

Cada comprobante se encola una vez por pago, junto con la transacción. Los avisos
se encolan junto con sus notificaciones. La red se usa después del commit.
Los fallos del proveedor no revierten pagos. Los comprobantes intentan enviarse
inmediatamente; Celery Beat procesa pendientes cada cinco minutos. El cron diario
existente de Vercel también procesa hasta diez pendientes después del commit.
En Vercel sin worker persistente, ejecutar `python manage.py procesar_correos`
para reintentar antes de 23 horas: el cron diario por sí solo no garantiza esa
ventana. No se agrega un cron frecuente incompatible con Vercel Hobby.

El backend limita sus aceptaciones a 90 en 24 horas y 2.700 en 31 días para dejar
margen al plan gratuito; otros envíos desde la cuenta también consumen cuota.
Los errores de red, HTTP 429 y HTTP 5xx se reintentan con espera creciente. Los
HTTP restantes requieren revisar la configuración. Se conserva la misma petición
y clave de idempotencia; tras 23 horas desde el primer intento se marca `revisar`
para evitar reenvíos fuera de la ventana de 24 horas de Resend. Antes de resolver
un resultado ambiguo, consultar el panel del proveedor.

Estados: `pendiente`, `fallido`, `revisar`, `aceptado`. Se guarda el identificador
de Resend, pero no se implementan webhooks de entrega o rebote. La cola contiene
correo, texto y adjuntos financieros; limitar el acceso a administradores y
aplicar la política de retención del gimnasio. No registra claves ni cuerpos de
error del proveedor. Bienvenida y recuperación de contraseña quedan fuera de
esta integración de comprobantes y cobros.
El build de Vercel ejecuta preparar_vercel.py para retirar exclusivamente los
 directorios de pruebas de NumPy y Matplotlib instalados. Conserva el código y
 los recursos de producción y deja espacio temporal para el runtime de Copilot.


El paso de empaquetado también retira mpl-data/sample_data (datos de ejemplo
de Matplotlib). La validación final debe incluir una consulta autenticada cuya
fuente sea copilot; el respaldo puede responder aunque Copilot no arranque.


### Seguimiento y recuperación desde Pagos

En **Pagos → Historial**, el panel **Correos de pagos** muestra configuración,
modo demo, pendientes, aceptados por Resend y mensajes que requieren revisión.
**Procesar correos pendientes** procesa hasta diez mensajes respetando la espera
entre reintentos y las cuotas. Esta opción permite recuperar el demo de Vercel
sin contratar otro servicio ni agregar un cron frecuente. La API administrativa
`GET/POST /api/admin/correos/` requiere una cuenta staff y no expone destinatarios,
contenidos ni claves. Un HTTP 503 al procesar indica configuración incompleta.

El primer intento y una reserva de dos minutos se confirman antes de usar HTTP.
Si el worker se interrumpe, otro proceso recupera esa reserva una vez vencida,
con el mismo contenido y clave de idempotencia. La red no mantiene abierta una
transacción de base de datos. Los correos nunca intentados pueden esperar en
cola más de un día; la ventana de 23 horas solo comienza al intentar enviarlos.
Los mensajes `revisar` no se reenvían desde el panel: consultar el proveedor antes
de resolver manualmente un resultado ambiguo. La vista Django Admin muestra el
identificador y el error técnico sin exponer el contenido financiero.
### Demo de correos publicado — 2026-11-19

Cuenta de Resend creada mediante GitHub; plan transaccional de $0/mes y sin
método de pago. Se generó una clave de solo envío, guardada en archivos privados
y como variable cifrada del backend de Vercel. El modo demo está activo y dirige
todos los correos a `imasisc@ctpplatanares.ed.cr`; no se envían a clientes reales.

Se publicaron la API y el frontend a partir de sus versiones activas, incorporando
solo la integración de correos y el panel de seguimiento. La tabla
`correos_pendientes` ya existía en Supabase; el plan de migración no tenía acciones
pendientes. Se probó el comprobante del pago demo 79 sin alterar cobros: Resend
confirmó `delivered` con PDF adjunto. Una segunda solicitud mantuvo un solo
intento y el mismo identificador de proveedor, sin duplicar el correo.

La validación pública confirmó HTTP 200 para el estado administrativo y el PDF.
**Pagos → Historial → Correos de pagos** muestra el modo demo, los contadores y
la acción para procesar pendientes. El paquete publicado pasó 19 pruebas de
correo, TypeScript y build; el frontend local pasó 15 pruebas de pagos y correos.
Los fallos anteriores de pruebas de roles y gracia se ajustaron a las reglas
vigentes; se corrigió además el reloj de las fixtures de autenticación.

El envío a destinatarios distintos del buzón demo requiere verificar un dominio
y desactivar expresamente `RESEND_MODO_DEMO`. La aplicación registra aceptación
por el proveedor; la entrega de esta prueba se verificó en el panel de Resend.