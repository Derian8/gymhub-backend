# MVP Funcional

## Objetivo
Congelar una versión funcional y demostrable de GymHub sin abrir nuevas features fuera del flujo principal. Este documento define qué sí forma parte del MVP operativo actual y cómo debe comportarse por rol.

## Flujo Principal Obligatorio
`login -> dashboard por rol -> miembros -> planes -> asistencia -> facturación -> perfil`

## Roles Del MVP
- `member`: usa su membresía, entrenamiento, plan, registros, progreso y perfil.
- `trainer`: usa dashboard global, miembros, planes, asistencia, facturación y perfil.
- `staff/superuser`: se trata como capacidad administrativa equivalente a `trainer` dentro del frontend.

## Rutas Del MVP
- Públicas:
  - `/login`
- Miembro:
  - `/membership`
  - `/today`
  - `/plans/my`
  - `/plans/:id`
  - `/plans/:id/today`
  - `/attendance/check-in`
  - `/records`
  - `/progress`
  - `/sessions`
  - `/profile`
- Trainer o staff:
  - `/dashboard/trainer`
  - `/members`
  - `/members/:id`
  - `/plans`
  - `/plans/:id`
  - `/attendance`
  - `/billing`
  - `/profile`

## Fuera Del MVP
- `/calendar` queda fuera del producto actual. No debe aparecer en navegación ni contarse como funcionalidad pendiente inmediata.
- Nutrición, alertas, mensajería, gráficas y Chat IA se conservan en backend y datos, pero no forman parte de la experiencia visible actual.
- Cualquier feature nueva que no apoye el flujo principal queda postergada a una fase posterior.

## Criterio De Listo
- La navegación por rol no muestra placeholders.
- Ninguna ruta del MVP expone vistas inconsistentes con el rol.
- El frontend usa contratos reales del backend y estados claros de carga, vacío y error.
- Un plan activo se considera listo cuando contiene al menos un día y un ejercicio; nutrición y guías son opcionales.
- La demo puede recorrerse sin pasos manuales fuera de `seed_data` y login.
