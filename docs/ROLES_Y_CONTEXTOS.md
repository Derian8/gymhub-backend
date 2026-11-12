# Roles y contextos

GymHub expone dos roles de cuenta:

- **Administrador** (`role=admin`, `is_staff=True`): control completo de los
  módulos administrativos y técnicos del sistema.
- **Cliente** (`role=member`): acceso a su rutina, progreso, datos personales y
  membresía.

Los roles son excluyentes. Una cuenta administradora solo tiene el contexto
**Administrador** y no puede convertirse en cliente. Una persona que necesite
usar el sistema como cliente debe tener una cuenta de cliente independiente.
Los perfiles y registros históricos ya asociados a cuentas administrativas se
conservan durante la migración, pero no habilitan el contexto Cliente ni se
exponen como un perfil disponible en la identidad de esa cuenta.

`TrainerProfile` queda como vínculo técnico para asignaciones de clientes,
planes, clases y datos del gimnasio; ya no concede un rol ni permisos por sí
mismo. La migración `0007_simplificar_roles_administrador_cliente` convierte
las cuentas de instructor existentes en administradores, conserva sus perfiles
técnicos y agrega el perfil técnico a las cuentas administrativas que lo
necesitan.

## Cuentas separadas

La pantalla **Usuarios y perfiles** muestra las cuentas registradas y su rol.
No permite agregar un perfil de cliente a una cuenta administradora. Para
registrar a un administrador como cliente, se debe crear una cuenta de cliente
independiente con credenciales propias.

API administrativa:

- `GET /api/admin/users/`
- `POST /api/trainers/{trainer_id}/enable-client-profile/` se conserva por
  compatibilidad, pero rechaza cuentas administrativas con HTTP 403.
