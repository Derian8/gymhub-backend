# Roles, perfiles y contextos

GymHub usa una sola cuenta por persona. Las capacidades se determinan por los
perfiles relacionados con el usuario, no únicamente por el campo histórico
`role`.

- **Administrador:** cuenta `is_staff`; consulta y opera módulos comerciales y
  técnicos. Solo dispone de contexto cliente si también tiene `MemberProfile`.
- **Instructor:** cuenta con `TrainerProfile`; administra clientes asignados,
  planes de entrenamiento y registros de progreso.
- **Cliente:** cuenta con `MemberProfile`; consulta su dashboard, rutina,
  progreso, información personal y membresía en modo de solo lectura.

Una cuenta puede tener `TrainerProfile` y `MemberProfile` al mismo tiempo. El
selector de la barra superior cambia el contexto activo sin mezclar menús ni
datos. En una cuenta instructor-cliente, un inicio de sesión nuevo abre el
contexto instructor. Las peticiones del contexto cliente incluyen `scope=self`
y el backend limita los resultados al `MemberProfile` de la cuenta.

## Habilitar un instructor como cliente

El administrador abre **Usuarios y perfiles**, elige un instructor y registra:

1. Instructor responsable (puede ser la misma persona).
2. Membresía activa.
3. Datos personales opcionales.
4. Método y referencia del primer pago.

La operación crea el perfil de cliente, la suscripción y el pago inicial dentro
de una transacción; el usuario conserva su perfil de instructor y su contraseña.

API administrativa:

- `GET /api/admin/users/`
- `POST /api/trainers/{trainer_id}/enable-client-profile/`
