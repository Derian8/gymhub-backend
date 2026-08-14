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
- `POST /api/members/registro-con-pago/` (alta atómica de cliente, membresía y primer pago)
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
- `PlantillaEntrenamiento`

`TrainingPlan` mantiene compatibilidad con `is_active`, pero la administración nueva usa estados explícitos:
`draft`, `active`, `scheduled`, `finished`, `archived`.

Rutas principales:
- REST `/api/plans/`
- REST `/api/workout-days/`
- REST `/api/exercises/`
- `GET /api/plans/summary/`
- `POST /api/plans/create-complete/`
- `POST /api/plans/{id}/duplicate/`
- `POST /api/plans/{id}/finish/`
- `POST /api/plans/{id}/archive/`
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
- `POST /api/workout-sessions/{id}/progreso-ejercicio/`
- `POST /api/exercise-logs/bulk/`

### Ejecución guiada de rutina para clientes

Después de validar la membresía con **Ver rutina**, el cliente ve la descripción
general del bloque y pulsa **Iniciar rutina**. La pantalla muestra un único
ejercicio a la vez, con su prescripción, descanso, equipo e instrucciones.

- **Realizado** registra el ejercicio con el estado `realizado`.
- **Omitir** registra el ejercicio con el estado `omitido`.
- Cada decisión se persiste de inmediato en `ExerciseLog`, por lo que una
  recarga conserva el avance y muestra el siguiente ejercicio pendiente.
- Al resolver el último ejercicio, la sesión se completa automáticamente.
- **Finalizar rutina** solicita confirmación y cierra la sesión; los ejercicios
  pendientes se registran como `omitido`.

`POST /api/workout-sessions/{id}/progreso-ejercicio/` recibe
`exercise_id` y `estado` (`realizado` u `omitido`). Esta interacción simple es
para el cliente; el instructor conserva el registro técnico detallado y masivo.

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
- `GET /api/payment-records/` y `GET /api/payment-records/{id}/` (pagos inmutables)
- `POST /api/payment-records/{id}/mark-paid/`
- REST `/api/payment-methods/`
- REST `/api/payment-instructions/`
- `GET /api/my-membership/`
- `GET /api/members/{id}/membership-summary/`

El alta comercial principal se realiza en una sola transacción: crea el cliente, asigna una membresía de catálogo o personalizada, confirma el primer pago, activa el acceso y devuelve el comprobante interno. Si falla cualquier paso, no persiste un alta parcial.

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
- `AIChatConversation`

Rutas principales:
- `POST /api/ai-chat/`
- `GET /api/ai-chat/context/`
- `GET /api/ai-chat/history/`
- `POST /api/ai-chat/send-message/`

En modo trainer, `/api/ai-chat/context/?member_id={id}` construye un expediente automático del miembro con perfil, membresía, pagos, asistencia, rutina, ejercicios, progreso, medidas y alertas. La respuesta incluye `trainer_assistant` con estado general, insights detectados, preguntas rápidas, datos faltantes y dossier estructurado.

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
