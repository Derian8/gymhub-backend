# Gimnasio Miembros Hub — Backend API

## Stack
- **Backend**: Django 5.1+, DRF, simplejwt (httpOnly cookies), PostgreSQL 15+
- **Cola**: Celery 5+, django-celery-beat, Redis 7+
- **IA**: motor contextual gratuito por reglas + mejora opcional con Ollama local
- **Infra**: Docker + docker-compose (web, db, redis, celery, celerybeat)
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
# Editar .env con tus credenciales

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
| `EMERGENT_LLM_KEY` | Clave universal Emergent (para AI chat) |
| `OPENAI_API_KEY` | Tu propia API key de OpenAI (opcional, reemplaza EMERGENT_LLM_KEY) |
| `OPENAI_MODEL` | Modelo a usar (default: `gpt-4.1-mini`) |
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
| `PAYMENT_GRACE_DAYS` | Período de gracia antes de bloqueo (default: 7) |

## Tareas Celery Beat (3)

| Tarea | Horario | Descripción |
|-------|---------|-------------|
| `check_member_inactivity` | 08:00 UTC diario | Crea InactivityAlert si >30 días sin check-in |
| `check_upcoming_payments` | 09:00 UTC diario | Notifica pagos a vencer en 3 días |
| `check_overdue_payments` | 09:30 UTC diario | Cambia status a 'late' y notifica |

## Modelos (22)
`User` · `MemberProfile` · `TrainerProfile` · `AuditLog` · `GymClass` · `ClassEnrollment` ·
`TrainingPlan` · `WorkoutDay` · `Exercise` · `Attendance` · `ProgressLog` · `WorkoutSession` ·
`ExerciseLog` · `InactivityAlert` · `Notification` · `MembershipPlan` · `PaymentSchedule` ·
`PaymentRecord` · `PaymentMethod` · `PaymentInstruction` · `NutritionProfile` ·
`NutritionGuideline` · `PlanNutritionLink` (+ AI: `AIChatConversation` · `AIChatMessage`)

## Permisos (users/permissions.py)
`IsTrainer` · `IsMember` · `IsOwnerOrTrainer` · `IsOwnerOnly` · `IsStaffOrTrainer`
