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
El retorno a Vercel se documenta en
[Retorno a Vercel y Supabase](docs/RETORNO_VERCEL_SUPABASE.md).
El frontend y la API públicos usan Vercel; los datos y las fotos privadas usan
Supabase. El QR se comparte mediante PostgreSQL y no requiere Redis.

- Frontend: `https://proyectoappgym-frontend.vercel.app`
- Backend API: `https://proyectoappgym-backend.vercel.app`
- API Docs: `https://www.pulsocr.me/api/docs/`
- Base de datos: Supabase PostgreSQL.

## Arranque rápido
El carnet usa un QR fijo por cliente, almacenado en `credenciales_acceso_qr`.
Cada lectura valida la membresía y reutiliza la asistencia del día si ya existe.
Administración puede invalidar sus copias con **Regenerar QR** en la ficha del cliente.
Antes de usar esta versión, aplica la migración `attendance.0007` y actualiza el frontend.

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

El script aplica y audita las migraciones de Supabase, despliega el backend Vercel
y el frontend, y termina validando el dominio público contra la API de Vercel.
Usa `--help` para omitir etapas. Render no forma parte de esta publicación.

Para reconstruir las demos numeradas sin tocar cuentas reales, ejecuta primero
`python manage.py restablecer_demo` y confirma después con
`python manage.py restablecer_demo --yes`.

## Desarrollo local con recarga automatica en Windows

Si Docker Desktop no permite montar la carpeta WSL, ejecuta desde PowerShell en la
raiz del repositorio:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\gym-watch.ps1
```

El script levanta `backend` y `frontend` con Docker Compose y observa los archivos
cada segundo. Sincroniza los cambios de codigo con los contenedores para que Vite
actualice la vista en `http://localhost:3000/routines`; reinicia Django cuando
cambia el backend y reconstruye la imagen si cambian dependencias o Dockerfiles.
Manten la terminal abierta mientras trabajas y usa `Ctrl+C` para detener la
observacion. Los contenedores siguen encendidos.

## Entorno de feria

La demo usa Vercel para frontend y API, Supabase para PostgreSQL y Storage
privado, caché compartida en PostgreSQL e IA determinista. Los rewrites de
[`frontend/vercel.json`](frontend/vercel.json) apuntan a la API Vercel. Las fotos
admiten hasta 2 MB y se descargan mediante URLs firmadas S3 v4.

El mantenimiento diario usa Vercel Cron; no se necesitan Redis, Celery Worker,
Beat ni el keep-alive de Windows. [`render.yaml`](render.yaml) se conserva como
referencia del despliegue anterior. Ver [operación actual](docs/RETORNO_VERCEL_SUPABASE.md).

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
- La contraseña local de Supabase para el despliegue de feria se guarda en `.secrets/supabase-password.txt`; esa carpeta está ignorada por Git y nunca debe subirse ni copiarse al chat.
- Para aplicaciones Django persistentes, usa el Session Pooler de Supabase y configura `DB_CONN_MAX_AGE`.
- Las migraciones siguen siendo las migraciones Django versionadas del repositorio: `docker compose exec backend python manage.py migrate`.
- El backup/restore operativo debe hacerse desde Supabase Dashboard, `pg_dump` contra la URL de Supabase o la CLI de Supabase; ya no existe servicio local `db`.

## Entrega Y Release
- La fuente principal para operación, soporte y recuperación es [`RUNBOOK.md`](/mnt/c/dev/proyectos/proyectoappgym/RUNBOOK.md).
- El estado exacto para continuar el desarrollo y los pendientes priorizados están en [`docs/TODO.md`](/mnt/c/dev/proyectoappgym/docs/TODO.md).
- El alcance funcional a validar manualmente está congelado en [`docs/MVP_FUNCIONAL.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/MVP_FUNCIONAL.md).
- El orden ejecutable de validación antes de entregar está en [`docs/RELEASE_CHECKLIST.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/RELEASE_CHECKLIST.md).
- [`render.yaml`](render.yaml) conserva la API de feria anterior; no declara Worker, Beat ni Redis y no participa en la publicación actual.
- Vercel y Supabase son los proveedores activos; comprobar sus cuotas gratuitas antes de ampliar la demo.

## Integración Frontend/Backend
- En desarrollo Docker, deja `VITE_API_BASE_URL=` vacío para que Vite use proxy interno hacia `backend`.
- En producción local Docker, deja `VITE_API_BASE_URL=` vacío para que Nginx enrute `/auth/`, `/api/` y `/media/` al backend.
- En Vercel actual, deja `VITE_API_BASE_URL=` vacío y usa los rewrites de `frontend/vercel.json` para enrutar `/auth/`, `/api/`, `/health/` y `/media/` al backend desde el mismo origen del frontend.
- Usa `VITE_API_TIMEOUT_MS=60000`; el login calienta `/health/live/` y reintenta una vez antes de enviar credenciales.
- Las membresías admiten periodos diarios, semanales, quincenales, mensuales, trimestrales y anuales. El primer pago activa la vigencia y cada pago confirmado genera el siguiente cobro pendiente.
- Define `CRON_SECRET` en el backend de Vercel para proteger el mantenimiento diario de vigencias, mora y recordatorios.
- Si frontend y backend viven en dominios distintos, define `VITE_API_BASE_URL`, `CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS` de forma explícita.
- Mantén `VITE_API_BASE_URL=` vacío y el destino de los rewrites alineado con `ACTIVE_BACKEND_PUBLIC_URL`.
- Las cookies JWT del backend ahora se controlan por entorno con `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE`, `AUTH_COOKIE_DOMAIN` y `AUTH_COOKIE_PATH`.
- El frontend obtiene CSRF desde `/auth/csrf/`; toda mutación autenticada por cookie requiere `X-CSRFToken`.
- El chat IA funciona gratis con un motor contextual por reglas y puede mejorar su redacción con Ollama local o Gemini API opcional (nivel gratuito sujeto a límites de Google); la configuración operativa vive en [docs/OPERACION.md](./docs/OPERACION.md) y [gymhub/README.md](./gymhub/README.md).

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