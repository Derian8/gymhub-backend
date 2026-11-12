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

Las asignaciones de clientes, planes, clases, membresías, alertas y datos del
gimnasio apuntan directamente a cuentas administradoras. La migración
`0008_reemplazar_trainerprofile_por_administrador` traslada las referencias al
administrador correspondiente y elimina el modelo técnico anterior.

## Cuentas separadas

La pantalla **Usuarios y perfiles** muestra las cuentas registradas y su rol.
No permite agregar un perfil de cliente a una cuenta administradora. Para
registrar a un administrador como cliente, se debe crear una cuenta de cliente
independiente con credenciales propias.

API administrativa:

- `GET /api/admin/users/`
- `GET /api/administrators/` lista cuentas administradoras para asignaciones.
- Ya no existe un endpoint para convertir una cuenta administradora en cliente.
