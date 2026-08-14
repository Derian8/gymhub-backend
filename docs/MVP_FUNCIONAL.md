# MVP Funcional

## Objetivo
Congelar una versión funcional y demostrable de GymHub sin abrir nuevas features fuera del flujo principal. Este documento define qué sí forma parte del MVP operativo actual y cómo debe comportarse por rol.

## Flujo Principal Obligatorio
`administrador registra y cobra -> asigna entrenador -> entrenador publica rutina -> cliente pulsa Ver rutina -> sistema valida y registra entrada -> administrador controla ingresos y accesos`

## Roles Del MVP
- `member`: usa su membresía, entrenamiento, plan, registros, progreso y perfil.
- `trainer`: consulta únicamente clientes asignados, crea rutinas y registra progreso. Solo ve el estado comercial sanitizado.
- `staff/superuser`: es Administrador; controla clientes, pagos, accesos, alertas, bajas y reportes.

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
  - `/members`
  - `/members/:id`
- Trainer:
  - `/dashboard/trainer`
  - `/plans`
  - `/plans/:id`
- Administrador:
  - `/dashboard/admin`
  - `/members/new`
  - `/attendance`
  - `/billing`
  - `/reports`
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
- El cliente solo obtiene la rutina después de validar membresía y registrar la entrada mediante `Ver rutina`.
- El entrenador no recibe montos, referencias, comprobantes ni historial financiero.
- La demo puede recorrerse sin pasos manuales fuera de `seed_data` y login.
