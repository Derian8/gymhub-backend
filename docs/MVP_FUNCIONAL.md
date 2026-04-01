# MVP Funcional

## Objetivo
Congelar una versión funcional y demostrable de GymHub sin abrir nuevas features fuera del flujo principal. Este documento define qué sí forma parte del MVP operativo actual y cómo debe comportarse por rol.

## Flujo Principal Obligatorio
`login -> dashboard por rol -> miembros -> planes -> asistencia -> progreso -> pagos -> alertas -> nutrición -> chat IA -> perfil`

## Roles Del MVP
- `member`: usa su dashboard, plan, check-in, progreso, pagos, nutrición, chat IA y perfil.
- `trainer`: usa dashboard global, miembros, planes, asistencia, alertas, facturación, nutrición, gráficas, chat IA y perfil.
- `staff/superuser`: se trata como capacidad administrativa equivalente a `trainer` dentro del frontend.

## Rutas Del MVP
- Públicas:
  - `/login`
- Miembro:
  - `/dashboard/member`
  - `/plans/my`
  - `/plans/:id`
  - `/plans/:id/today`
  - `/attendance/check-in`
  - `/progress`
  - `/sessions`
  - `/billing`
  - `/nutrition`
  - `/ai-chat`
  - `/profile`
- Trainer o staff:
  - `/dashboard/trainer`
  - `/members`
  - `/members/:id`
  - `/plans`
  - `/plans/:id`
  - `/attendance`
  - `/alerts`
  - `/billing`
  - `/nutrition`
  - `/charts`
  - `/ai-chat`
  - `/profile`

## Fuera Del MVP
- `/calendar` queda fuera del producto actual. No debe aparecer en navegación ni contarse como funcionalidad pendiente inmediata.
- Cualquier feature nueva que no apoye el flujo principal queda postergada a una fase posterior.

## Criterio De Listo
- La navegación por rol no muestra placeholders.
- Ninguna ruta del MVP expone vistas inconsistentes con el rol.
- El frontend usa contratos reales del backend y estados claros de carga, vacío y error.
- La demo puede recorrerse sin pasos manuales fuera de `seed_data` y login.
