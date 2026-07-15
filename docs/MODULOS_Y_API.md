# Módulos Y API

## Usuarios
Entidades principales:
- `User`
- `MemberProfile`
- `TrainerProfile`
- `AuditLog`

Rutas principales:
- `POST /auth/register/`
- `POST /auth/login/`
- `POST /auth/logout/`
- `POST /auth/token/refresh/`
- `GET /auth/me/`
- REST `/api/members/`
- `GET /api/members/{id}/dashboard-summary/`
- `POST /api/members/{id}/activate/`
- `GET /api/members/{id}/progress-by-exercise/{exercise_id}/`
- `GET /api/trainer/gym-overview/`

## Clases
Entidades principales:
- `GymClass`
- `ClassEnrollment`

Rutas principales:
- REST `/api/classes/`
- REST `/api/class-enrollments/`

## Planes
Entidades principales:
- `TrainingPlan`
- `WorkoutDay`
- `Exercise`

Rutas principales:
- REST `/api/plans/`
- REST `/api/workout-days/`
- REST `/api/exercises/`
- `GET /api/plans/{id}/today-workout/`
- `GET /api/plans/{id}/weekly-view/`

## Asistencia
Entidad principal:
- `Attendance`

Rutas principales:
- REST `/api/attendance/`
- `POST /api/attendance/check-in/`

## Progreso
Entidades principales:
- `ProgressLog`
- `WorkoutSession`
- `ExerciseLog`

Rutas principales:
- REST `/api/progress-logs/`
- REST `/api/workout-sessions/`
- `PATCH /api/workout-sessions/{id}/complete/`
- `POST /api/exercise-logs/bulk/`

## Alertas
Entidades principales:
- `InactivityAlert`
- `InactivityAlertContact`
- `MemberJustifiedAbsence`
- `Notification`

Rutas principales:
- REST `/api/trainer/inactivity-alerts/`
- `GET /api/trainer/inactivity-alerts/summary/`
- `POST /api/trainer/inactivity-alerts/{id}/start-follow-up/`
- `POST /api/trainer/inactivity-alerts/{id}/resolve/`
- `POST /api/trainer/inactivity-alerts/{id}/dismiss/`
- `POST /api/trainer/inactivity-alerts/{id}/reopen/`
- `GET|POST /api/trainer/inactivity-alerts/{id}/contacts/`
- `GET /api/trainer/members-without-alerts/`
- REST `/api/alerts/` (compatibilidad)
- REST `/api/notifications/`
- `POST /api/notifications/mark-all-read/`
- `POST /api/notifications/{id}/mark-read/`

Estados de alerta:
- `new`: alerta nueva sin gestión.
- `in_follow_up`: trainer ya inició seguimiento.
- `resolved`: caso cerrado.
- `dismissed`: descartada con motivo.

La prioridad de inactividad se calcula desde los días sin asistir: baja 5-7, media 8-14, alta 15-21 y urgente desde 22 días cuando la membresía sigue activa y no hay contacto reciente.

## Facturación
Entidades principales:
- `MembershipPlan`
- `MemberSubscription` (membresía individual del miembro; expuesta también como member membership)
- `PaymentSchedule`
- `PaymentRecord`
- `PaymentMethod`
- `PaymentInstruction`

Rutas principales:
- REST `/api/membership-plans/`
- REST `/api/member-memberships/`
- `POST /api/member-memberships/{id}/renew/`
- `POST /api/member-memberships/{id}/suspend/`
- `POST /api/member-memberships/{id}/cancel/`
- `GET /api/member-memberships/expiring/`
- `GET /api/member-memberships/expired/`
- REST `/api/member-subscriptions/` (compatibilidad)
- REST `/api/payment-schedules/`
- REST `/api/payment-records/`
- `POST /api/payment-records/{id}/mark-paid/`
- REST `/api/payment-methods/`
- REST `/api/payment-instructions/`
- `GET /api/my-membership/`
- `GET /api/members/{id}/membership-summary/`

Estados de membresía:
- `pending`: creada, esperando primer pago.
- `active`: vigente y habilitada para check-in.
- `expiring`: vence en `MEMBERSHIP_EXPIRING_DAYS` días o menos.
- `expired`: vencida; bloquea check-in.
- `suspended`: pausa manual; bloquea check-in.
- `cancelled`: cancelada e inactiva.

Tareas programadas:
- `billing.tasks.run_daily_membership_maintenance`
- `billing.tasks.check_membership_status_alerts`
- `billing.tasks.check_upcoming_payments`
- `billing.tasks.check_overdue_payments`

## Nutrición
Entidades principales:
- `NutritionProfile`
- `NutritionGuideline`
- `PlanNutritionLink`

Rutas principales:
- REST `/api/nutrition-profiles/`
- REST `/api/nutrition-guidelines/`
- REST `/api/plan-nutrition-links/`

## Chat IA
Entidad principal:
- `AIChatMessage`

Rutas principales:
- `POST /api/ai-chat/`
- `GET /api/ai-chat/history/`

## Gráficas
Tipos observados:
- `attendance_monthly`
- `retention_rate`
- `payment_status`
- `physical_progress`
- `exercise_progression`

Ruta principal:
- `GET /api/charts/{chart_type}/`

## Cobertura De Pruebas Actual
Pruebas existentes en [`gymhub/tests/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/tests):
- autenticación
- chat IA
- tareas Celery de pagos
- check-in
- gráficas
- planes y sesiones
- validadores de ejercicios

Áreas sin cobertura visible:
- clases
- alertas y notificaciones
- nutrición
- vistas CRUD de facturación
- permisos finos sobre varios endpoints
