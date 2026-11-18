# Plan de refactorización: rutinas y asignación

## Decisiones

1. La biblioteca muestra rutinas resumidas, con búsqueda, filtros y paginación del servidor. Sus acciones son editar, ver clientes asignados, activar o desactivar y asignar.
2. Crear y editar una rutina ocurre en una página. Los ejercicios reutilizables se gestionan desde «Gestionar ejercicios».
3. La asignación ocurre en una sola página, accesible desde la biblioteca, la lista de clientes y los planes asignados. Conserva el cliente o la rutina elegidos en la URL.
4. Antes de confirmar, la página consulta la membresía y los planes vigentes o programados. Una membresía bloqueada o una programación existente impide confirmar y explica el motivo.
5. Si hay un plan vigente, el administrador elige entre programar la nueva copia después de su fecha final o reemplazarlo hoy. El reemplazo finaliza el plan anterior sin borrar su historial. No hay límite arbitrario de 14 días para programar el siguiente.
6. Cada asignación guarda una copia del contenido y el origen de la plantilla. Los cambios posteriores en la biblioteca afectan a las próximas asignaciones; las copias y sesiones anteriores conservan su contenido.
7. La migración de planes anteriores relaciona con una plantilla solo las coincidencias únicas de nombre, objetivo, modo, días y ejercicios. Los casos ambiguos permanecen sin origen para evitar asociaciones incorrectas.

## Entrega

- Página única de asignación y rutas de entrada unificadas.
- Resumen paginado de rutinas y controles con áreas táctiles más amplias.
- Consulta previa de elegibilidad y reglas explícitas de programación o reemplazo.
- Migración conservadora para recuperar el origen de planes existentes.
- Ajustes de contraste y estado accesible de los filtros de asignaciones.

## Puesta en marcha

Aplicar las migraciones del backend antes de usar el nuevo frontend. La página de asignación requiere el endpoint `GET /api/plans/assignment-state/` y la lista resumida `GET /api/plan-templates/?resumen=1`.
