# Gimnasio Miembros Hub — Backend API

## Stack
La demo pública usa Django en Vercel con Supabase PostgreSQL y Storage privado.
Ver [Retorno a Vercel y Supabase](../docs/RETORNO_VERCEL_SUPABASE.md) para variables,
migración, caché compartida, cron y comprobaciones previas al cambio público.

- **Backend**: Django 5.1+, DRF, simplejwt (httpOnly cookies), Supabase PostgreSQL
- **Cola**: Celery 5+, django-celery-beat, Redis 7+
- **IA**: motor contextual gratuito por reglas + mejora opcional con Ollama local o Gemini API (nivel gratuito sujeto a límites de Google)
- **Infra**: Docker local; Vercel para la API; Supabase PostgreSQL y Storage privado con firmas S3 v4
- **Docs API**: drf-spectacular (Swagger UI en `/api/docs/`)

## Apps Django (9)
`users` · `classes` · `plans` · `attendance` · `progress` · `alerts` · `billing` · `nutrition` · `ai_chat`

## Convenciones del proyecto
- Python debe seguir `PEP 8` con indentación de 4 espacios.
- El estándar para código nuevo es usar nombres en español y `snake_case` en variables, funciones, archivos, carpetas, tablas y campos.
- Las clases deben usar `PascalCase`.
- La base de datos nueva debe modelarse en español, por ejemplo `usuarios`, `planes_entrenamiento`, `fecha_vencimiento`, `esta_activo`.
- No mezclar inglés y español en la lógica nueva del mismo dominio.
- Excepción: se conservan nombres en inglés cuando ya formen parte del backend actual o sean requeridos por Django, DRF o dependencias externas.

## Inicio rápido
El endpoint `GET /api/attendance/qr-token/` devuelve siempre la credencial QR del
cliente autenticado, con `expires_at` y `expires_in_seconds` en `null`.
`POST /api/attendance/clientes/<id>/regenerar-qr/` exige administración, invalida
el código anterior y los tokens temporales del cliente y registra auditoría.
La tabla `credenciales_acceso_qr` se crea con la migración `attendance.0007`.
Los QR temporales anteriores conservan su vencimiento y uso único. Una lectura
QR repetida de la asistencia del día devuelve HTTP 200 y `entrada_ya_registrada: true`;
la primera devuelve HTTP 201. Ambas verifican el estado actual de la membresía.


> Flujo recomendado: usa la orquestación de raíz del repositorio con `./gym-start`, `./gym-start --prod`, `./gym-smoke`, `./gym-log` y `./gym-stop`. Este README conserva los comandos directos del backend solo para tareas puntuales dentro del servicio `backend`.

Para desplegar Supabase y los proyectos de Vercel desde la raíz, usa primero
`./deploy-supabase-vercel.sh --dry-run` y luego `./deploy-supabase-vercel.sh`.
El comando aplica las migraciones Django y ejecuta `auditar_esquema` antes de
publicar el backend y el frontend en Vercel. Las solicitudes públicas usan
rewrites del mismo origen; las fotos usan URLs firmadas de Supabase Storage.

```bash
# 1. Clonar y configurar variables de entorno
cp ../.env.example ../.env
# Editar .env con tus credenciales de Supabase

# 2. Levantar servicios desde la raíz
../gym-start
# o para producción local
../gym-start --prod

# 3. Migraciones y seed data
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_data

# 4. Crear superusuario (opcional)
docker compose exec backend python manage.py createsuperuser

# 5. Validar MVP
../gym-smoke --seed
```

## Endpoints principales

| Método | URL | Descripción |
|--------|-----|-------------|
| GET | `/auth/csrf/` | Emite cookie/token CSRF para mutaciones por cookie |
| POST | `/auth/register/` | Alta administrativa de cuentas de administrador o cliente |
| POST | `/auth/login/` | Login → httpOnly cookies |
| POST | `/auth/logout/` | Logout + blacklist token |
| POST | `/auth/token/refresh/` | Renovar access token |
| GET | `/api/members/{id}/dashboard-summary/` | Dashboard del miembro |
| POST | `/api/members/{id}/activate/` | Activar miembro |
| GET | `/api/admin/gym-overview/` | Resumen del gimnasio |
| GET | `/api/admin/dashboard/` | Cartera y alertas operativas del administrador |
| GET | `/api/plans/summary/` | Métricas reales de planes para el administrador |
| POST | `/api/plans/assign-template/` | Publica o programa una plantilla con cliente y administrador |
| POST | `/api/plans/create-complete/` | Crear plan completo con miembro, días y ejercicios |
| POST | `/api/plans/{id}/duplicate/` | Duplicar plan como copia independiente |
| POST | `/api/plans/{id}/finish/` | Finalizar plan |
| POST | `/api/plans/{id}/archive/` | Archivar plan |
| GET | `/api/plans/{id}/today-workout/` | Entrenamiento de hoy |
| GET | `/api/plans/{id}/weekly-view/` | Vista semanal |
| POST | `/api/workout-sessions/` | Crear sesión |
| PATCH | `/api/workout-sessions/{id}/complete/` | Completar sesión |
| POST | `/api/workout-sessions/{id}/progreso-ejercicio/` | Registrar un ejercicio como realizado u omitido |
| POST | `/api/exercise-logs/bulk/` | Registrar múltiples ejercicios (atómico) |
| GET | `/api/members/{id}/progress-by-exercise/{exercise_id}/` | Progresión por ejercicio |
| POST | `/api/attendance/check-in/` | Check-in (throttle 30/min) |
| GET | `/api/admin/inactivity-alerts/` | Bandeja de seguimiento de inactividad |
| GET | `/api/admin/inactivity-alerts/summary/` | Resumen de alertas de inactividad |
| POST | `/api/admin/inactivity-alerts/{id}/resolve/` | Resolver alerta de inactividad |
| GET | `/api/charts/{type}/` | Gráficas PNG (cache 6h) |
| POST | `/api/ai-chat/` | Chat IA contextual por rol |
| GET | `/api/ai-chat/history/` | Historial de conversación IA |
| GET | `/api/ai-chat/context/` | Contexto estructurado, asistente trainer, preguntas rápidas y límites |
| POST | `/api/ai-chat/agente-administracion/` | Agentes especialistas de cobranza, retención, entrenamiento y crecimiento; solo lectura, 10 solicitudes por hora |

## Tipos de gráficas
`attendance_monthly` · `retention_rate` · `payment_status` · `physical_progress` · `exercise_progression`

## Ejecutar tests

```bash
./run_tests.sh
# o
docker compose exec backend pytest tests/ -v
```

## Variables de entorno clave

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URL PostgreSQL de Supabase con `sslmode=require` |
| `DB_SSLMODE` | Modo SSL para PostgreSQL si usas variables `DB_*` |
| `DB_CONN_MAX_AGE` | Persistencia de conexiones Django hacia Supabase |
| `REDIS_URL` | URL base; Django deriva bases separadas para broker, resultados y caché |
| `USE_S3_STORAGE` | Activa media privada mediante storage S3 compatible |
| `S3_*` | Credenciales, endpoint, bucket, región y expiración de URLs firmadas |
| `AI_PROVIDER` | `deterministic`, `local_hybrid`, `gemini_hybrid`, `openrouter_hybrid` o `copilot_hybrid` (default: `deterministic`) |
| `AI_LOCAL_BACKEND` | Backend local opcional para mejorar redacción (default: `ollama`) |
| `AI_LOCAL_MODEL` | Modelo local a usar si el backend está disponible |
| `AI_LOCAL_BASE_URL` | URL base del backend local (default: `http://host.docker.internal:11434`) |
| `AI_LOCAL_TIMEOUT_MS` | Timeout del modelo local en milisegundos |
| `GEMINI_API_KEY` | Clave privada de Google AI Studio; nunca se envía al frontend |
| `GEMINI_MODEL` | Modelo Gemini (default: `gemini-3.8-flash`) |
| `OPENROUTER_API_KEY` | Clave privada de OpenRouter; acepta `OPEN_ROUTER` como alias |
| `OPENROUTER_MODEL` | `openrouter/free` por defecto; solo se admiten este router y modelos terminados en `:free` |
| `AI_DAILY_LIMIT_PER_USER` | Límite diario de mensajes IA por miembro (default: 20) |
| `AI_DAILY_LIMIT_MEMBER` | Límite diario efectivo para members (default: `AI_DAILY_LIMIT_PER_USER`) |
| `AI_DAILY_LIMIT_TRAINER` | Límite diario de mensajes IA para trainers (default: 60) |
| `AI_CHAT_HISTORY_WINDOW` | Cantidad de mensajes recientes incluidos en el contexto (default: 10) |
| `INACTIVITY_DAYS_THRESHOLD` | Umbral heredado usado en señales de riesgo de miembros (default: 30) |
| `PAYMENT_GRACE_DAYS` | Valor heredado de gracia (los planes nuevos guardan su propia tolerancia) |
| `CRON_SECRET` | Protege el endpoint diario invocado por Vercel Cron |
| `DB_DISABLE_SERVER_SIDE_CURSORS` | Desactiva cursores persistentes para el pool transaccional de Supabase |
| `DEMO_TRAINER_PASSWORD` | Clave privada usada al crear/restablecer trainer1 |
| `DEMO_MEMBER_PASSWORD` | Clave privada usada al crear/restablecer member1 |

Para probar Gemini en un demo, crea una API key en [Google AI Studio](https://aistudio.google.com/app/apikey), configura `GEMINI_API_KEY` y `AI_PROVIDER=gemini_hybrid` en el `.env` de la raíz y reinicia el backend. El nivel gratuito y sus cuotas dependen de la región, el modelo y las políticas vigentes de Google. Usa datos ficticios para el demo: el contexto de miembros se envía a Google para generar cada respuesta.

El panel de agentes usa llamadas de funciones permitidas sobre métricas agregadas del gimnasio. Las herramientas no envían nombres ni correos, y no pueden editar pagos, membresías ni rutinas. La pregunta del administrador también se envía a Google; evita incluir datos personales. Si Gemini no está disponible, el endpoint devuelve el análisis local por reglas.

`seed_data` exige ambas claves. `restablecer_demo` es dry-run sin `--yes`;
al confirmarlo elimina demos numeradas adicionales, reconstruye trainer1/member1
y preserva cuentas reales y superusuarios.

`reemplazar_rutinas_interval_timer --confirmar-borrado` reemplaza de forma
irreversible las rutinas, plantillas y sesiones de entrenamiento. Mantiene el
catálogo de ejercicios y sus medios, conserva planes archivados vacíos cuando
son necesarios para los datos nutricionales y crea cuatro plantillas de ejemplo.

## Tareas Celery Beat (3)

| Tarea | Horario | Descripción |
|-------|---------|-------------|
| `check_member_inactivity` | 08:00 Costa Rica | Crea y resuelve alertas de inactividad desde 5 días sin asistir, solo con membresía activa e historial previo |
| `run_daily_membership_maintenance` | 06:05 Costa Rica | Actualiza vigencias, mora y recordatorios de pago |
| `activate_scheduled_plans` | 05:55 Costa Rica | Activa rutinas programadas y finaliza la versión anterior |

## Modelos (21)
`User` · `MemberProfile` · `AuditLog` · `GymClass` · `ClassEnrollment` ·
`TrainingPlan` · `WorkoutDay` · `Exercise` · `Attendance` · `ProgressLog` · `WorkoutSession` ·
`ExerciseLog` · `InactivityAlert` · `Notification` · `MembershipPlan` · `PaymentSchedule` ·
`PaymentRecord` · `PaymentMethod` · `PaymentInstruction` · `NutritionProfile` ·
`NutritionGuideline` · `PlanNutritionLink` (+ AI: `AIChatConversation` · `AIChatMessage`)

## Permisos (users/permissions.py)
`IsAdministrator` · `IsMember` · `IsOwnerOrAdministrator` · `IsOwnerOnly`

Las cuentas tienen dos roles: administrador (`admin`, `is_staff=True`) y cliente
(`member`). Clientes, planes, clases, membresías, alertas y datos del gimnasio
se asignan directamente a cuentas administradoras. La migración
`users.0008_reemplazar_trainerprofile_por_administrador` elimina el perfil
técnico anterior y conserva las relaciones existentes.

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