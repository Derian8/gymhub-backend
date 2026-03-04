# PRD — Gimnasio Miembros Hub (Backend)

## Fecha: 2026-03-04

## Descripción del Proyecto
SaaS backend para gestión integral de gimnasios. Incluye gestión de miembros, planes de entrenamiento, asistencia, facturación, nutrición, alertas y chat IA.

## Stack Técnico
- **Backend**: Django 5.1+, DRF, simplejwt+blacklist (httpOnly cookies)
- **Base de datos**: PostgreSQL 15+
- **Cola de tareas**: Celery 5+, django-celery-beat, Redis 7+
- **IA**: emergentintegrations (OpenAI gpt-4.1-mini) con soporte para OPENAI_API_KEY propia
- **Infra**: Docker + docker-compose (web, db, redis, celery, celerybeat)
- **API Docs**: drf-spectacular (Swagger UI)
- **Tests**: pytest, pytest-django, factory-boy, freezegun, pytest-mock

## Apps Django (9)
`users` · `classes` · `plans` · `attendance` · `progress` · `alerts` · `billing` · `nutrition` · `ai_chat`

## Modelos (22 + AIChatMessage = 23)
1. users.User
2. users.MemberProfile
3. users.TrainerProfile
4. users.AuditLog
5. classes.GymClass
6. classes.ClassEnrollment
7. plans.TrainingPlan
8. plans.WorkoutDay
9. plans.Exercise
10. attendance.Attendance
11. progress.ProgressLog
12. progress.WorkoutSession
13. progress.ExerciseLog
14. alerts.InactivityAlert
15. alerts.Notification
16. billing.MembershipPlan
17. billing.PaymentSchedule
18. billing.PaymentRecord
19. billing.PaymentMethod
20. billing.PaymentInstruction
21. nutrition.NutritionProfile
22. nutrition.NutritionGuideline
23. nutrition.PlanNutritionLink
24. ai_chat.AIChatMessage

## Relaciones (25)
Implementadas todas según spec.

## Permisos (5)
- `IsTrainer`
- `IsMember`
- `IsOwnerOrTrainer`
- `IsOwnerOnly`
- `IsStaffOrTrainer` (usado en /auth/register/ para proteger role='trainer')

## Endpoints No-CRUD Implementados
- POST /auth/register/ (con IsStaffOrTrainer para trainer)
- POST /auth/login/ (httpOnly cookies)
- POST /auth/logout/ (blacklist + clear cookies)
- POST /auth/token/refresh/
- GET /api/members/{id}/dashboard-summary/
- POST /api/members/{id}/activate/
- GET /api/trainer/gym-overview/
- GET /api/plans/{id}/today-workout/
- GET /api/plans/{id}/weekly-view/
- POST /api/workout-sessions/
- PATCH /api/workout-sessions/{id}/complete/
- POST /api/exercise-logs/bulk/ (atómica)
- GET /api/members/{id}/progress-by-exercise/{exercise_id}/
- POST /api/attendance/check-in/ (throttle 30/min, bloqueo por mora)
- POST /api/alerts/{id}/resolve/
- GET/POST /api/notifications/
- GET /api/members/?search=&payment_status=&inactivity=
- GET /api/charts/{chart_type}/ (5 tipos, cache 6h, PNG en MEDIA_ROOT)
- POST /api/ai-chat/ (20 msgs/día miembros, sin límite trainers)

## Tareas Celery Beat (3)
- `check_member_inactivity` → 08:00 diario
- `check_upcoming_payments` → 09:00 diario
- `check_overdue_payments` → 09:30 diario

## Lo Implementado (2026-03-04)
### Fase 1: Docker
- Dockerfile, docker-compose.yml (5 servicios: web, db, redis, celery, celerybeat)
- requirements.txt, .env, .env.example

### Fase 2: Modelos + Migraciones
- 24 modelos con todos los campos y validators especificados
- 25 relaciones con related_names correctos
- Signal post_save para crear MemberProfile/TrainerProfile

### Fase 3: Serializers + ViewSets + URLs + Permisos
- 5 permission classes en users/permissions.py
- Custom JWTCookieAuthentication
- Todos los ViewSets con filtrado por memberprofile cuando role=='member'
- Paginación global PAGE_SIZE=20
- drf-spectacular para documentación

### Fase 4: Celery Tasks + Beat
- 3 tareas con crontab correctos en gymhub/celery.py
- billing/tasks.py: check_upcoming_payments, check_overdue_payments
- alerts/tasks.py: check_member_inactivity

### Fase 5: Chat IA + Rate Limiting
- emergentintegrations LlmChat con soporte dual (EMERGENT_LLM_KEY / OPENAI_API_KEY)
- Límite 20 msgs/día para miembros, sin límite para trainers
- Fallback HTTP 200 para errores 429/500 de OpenAI
- AIChatMessage almacenado en DB con tokens_used estimado

### Fase 6: Charts + Media Config
- 5 tipos de gráficas con Matplotlib (PNG en MEDIA_ROOT/charts/)
- Cache Redis 6h por combinación de parámetros
- URL absoluta en respuesta

### Fase 7: Seed Data + Tests
- Management command `seed_data` con fechas relativas a date.today()
- 2 trainers + 20 miembros con estados de pago mixtos
- 5 training plans con WorkoutDays (A/B/C) y Exercises reales
- WorkoutSessions con progresión +2.5kg/semana (Press Banca: 40→60kg)
- 4 NutritionProfiles + 8 NutritionGuidelines (2 por tipo)
- 91 archivos Python con sintaxis validada

## Tests Pytest (8 archivos)
- test_auth.py: login cookies, logout blacklist, permisos
- test_checkin.py: 201/403/override/audit/throttle
- test_plans.py: rotación, sessions, bulk logs atómico
- test_ai_chat.py: límite diario, fallback, tokens_used
- test_charts.py: PNG, cache hit, URL absoluta, 400 sin exercise_id
- test_celery.py: tasks con mocking (send_mail)
- test_validators.py: Exercise validators

## Backlog / Próximas Fases
- P0: Frontend React (segunda conversación)
- P1: OAuth wearables (Fitbit/Garmin) — campo source ya preparado en ProgressLog
- P2: Multi-tenant, pagos automáticos, notificaciones push
- P2: Migración NutritionGuideline.goal_type a ManyToManyField si se necesita
