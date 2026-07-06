# Gimnasio Miembros Hub — Backend API

## Stack
- **Backend**: Django 5.1+, DRF, simplejwt (httpOnly cookies), Supabase PostgreSQL
- **Cola**: Celery 5+, django-celery-beat, Redis 7+
- **IA**: motor contextual gratuito por reglas + mejora opcional con Ollama local
- **Infra**: Docker local; `render.yaml` para Django/Celery/Beat/Redis; Supabase PostgreSQL y Storage
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

> Flujo recomendado: usa la orquestación de raíz del repositorio con `./gym-start`, `./gym-start --prod`, `./gym-smoke`, `./gym-log` y `./gym-stop`. Este README conserva los comandos directos del backend solo para tareas puntuales dentro del servicio `backend`.

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
| POST | `/auth/register/` | Registro (trainer requiere IsStaffOrTrainer) |
| POST | `/auth/login/` | Login → httpOnly cookies |
| POST | `/auth/logout/` | Logout + blacklist token |
| POST | `/auth/token/refresh/` | Renovar access token |
| GET | `/api/members/{id}/dashboard-summary/` | Dashboard del miembro |
| POST | `/api/members/{id}/activate/` | Activar miembro |
| GET | `/api/trainer/gym-overview/` | Resumen del gimnasio |
| GET | `/api/plans/{id}/today-workout/` | Entrenamiento de hoy |
| GET | `/api/plans/{id}/weekly-view/` | Vista semanal |
| POST | `/api/workout-sessions/` | Crear sesión |
| PATCH | `/api/workout-sessions/{id}/complete/` | Completar sesión |
| POST | `/api/exercise-logs/bulk/` | Registrar múltiples ejercicios (atómico) |
| GET | `/api/members/{id}/progress-by-exercise/{exercise_id}/` | Progresión por ejercicio |
| POST | `/api/attendance/check-in/` | Check-in (throttle 30/min) |
| POST | `/api/alerts/{id}/resolve/` | Resolver alerta de inactividad |
| GET | `/api/charts/{type}/` | Gráficas PNG (cache 6h) |
| POST | `/api/ai-chat/` | Chat IA contextual por rol |
| GET | `/api/ai-chat/history/` | Historial de conversación IA |
| GET | `/api/ai-chat/context/` | Contexto, prompts sugeridos y límites |

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
| `AI_PROVIDER` | `deterministic` o `local_hybrid` (default: `deterministic`) |
| `AI_LOCAL_BACKEND` | Backend local opcional para mejorar redacción (default: `ollama`) |
| `AI_LOCAL_MODEL` | Modelo local a usar si el backend está disponible |
| `AI_LOCAL_BASE_URL` | URL base del backend local (default: `http://host.docker.internal:11434`) |
| `AI_LOCAL_TIMEOUT_MS` | Timeout del modelo local en milisegundos |
| `AI_DAILY_LIMIT_PER_USER` | Límite diario de mensajes IA por miembro (default: 20) |
| `AI_DAILY_LIMIT_MEMBER` | Límite diario efectivo para members (default: `AI_DAILY_LIMIT_PER_USER`) |
| `AI_DAILY_LIMIT_TRAINER` | Límite diario de mensajes IA para trainers (default: 60) |
| `AI_CHAT_HISTORY_WINDOW` | Cantidad de mensajes recientes incluidos en el contexto (default: 10) |
| `INACTIVITY_DAYS_THRESHOLD` | Días de inactividad para alerta (default: 30) |
| `PAYMENT_GRACE_DAYS` | Valor heredado de gracia (los planes nuevos guardan su propia tolerancia) |
| `CRON_SECRET` | Protege el endpoint diario invocado por Vercel Cron |
| `DB_DISABLE_SERVER_SIDE_CURSORS` | Desactiva cursores persistentes para el pool transaccional de Supabase |
| `DEMO_TRAINER_PASSWORD` | Clave privada usada al crear/restablecer trainer1 |
| `DEMO_MEMBER_PASSWORD` | Clave privada usada al crear/restablecer member1 |

`seed_data` exige ambas claves. `restablecer_demo` es dry-run sin `--yes`;
al confirmarlo elimina demos numeradas adicionales, reconstruye trainer1/member1
y preserva cuentas reales y superusuarios.

## Tareas Celery Beat (2)

| Tarea | Horario | Descripción |
|-------|---------|-------------|
| `check_member_inactivity` | 08:00 Costa Rica | Crea InactivityAlert si >30 días sin check-in |
| `run_daily_membership_maintenance` | 06:05 Costa Rica | Actualiza vigencias, mora y recordatorios de pago |

## Modelos (22)
`User` · `MemberProfile` · `TrainerProfile` · `AuditLog` · `GymClass` · `ClassEnrollment` ·
`TrainingPlan` · `WorkoutDay` · `Exercise` · `Attendance` · `ProgressLog` · `WorkoutSession` ·
`ExerciseLog` · `InactivityAlert` · `Notification` · `MembershipPlan` · `PaymentSchedule` ·
`PaymentRecord` · `PaymentMethod` · `PaymentInstruction` · `NutritionProfile` ·
`NutritionGuideline` · `PlanNutritionLink` (+ AI: `AIChatConversation` · `AIChatMessage`)

## Permisos (users/permissions.py)
`IsTrainer` · `IsMember` · `IsOwnerOrTrainer` · `IsOwnerOnly` · `IsStaffOrTrainer`
