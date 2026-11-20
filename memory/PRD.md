# PRD — GymHub Frontend

## Fecha: 2026-03-13

## Descripción del Proyecto
Frontend SPA completo para el sistema de gestión de gimnasio GymHub. Construido sobre el backend Django existente con autenticación JWT httpOnly cookies.

## Stack Técnico
- **Frontend**: Vite 5 + React 18 + TypeScript
- **Estilos**: Tailwind CSS 3 + fuentes Barlow Condensed / Manrope
- **Estado**: Zustand (auth + theme)
- **Data Fetching**: TanStack Query v5
- **Formularios**: React Hook Form + Zod
- **HTTP**: Axios con interceptores (auto-refresh JWT)
- **Rutas**: React Router v6
- **Gráficas**: Recharts
- **UI**: Lucide-react icons, Sonner toasts
- **Tema**: Dark/Light toggle con persistencia en localStorage

## Arquitectura
```
/app/frontend/src/
├── modules/
│   ├── auth/          (login, hooks, api)
│   ├── dashboard/     (trainer + member dashboards)
│   ├── members/       (lista, detalle, activación)
│   ├── plans/         (lista, detalle, hoy, entrenamiento)
│   ├── attendance/    (check-in + historial)
│   ├── alerts/        (lista + resolver)
│   ├── billing/       (pagos, planes membresía)
│   ├── nutrition/     (perfiles + guías)
│   ├── progress/      (logs + sesiones)
│   ├── charts/        (gráficas backend + recharts)
│   ├── ai-chat/       (chat IA con historial)
│   └── profile/       (perfil usuario)
├── layouts/
│   ├── AppLayout.tsx   (sidebar + topbar + outlet)
│   ├── AuthLayout.tsx  (split screen login)
│   ├── Sidebar.tsx     (nav por rol, colapso)
│   └── Topbar.tsx      (theme toggle, notificaciones)
├── shared/
│   ├── api/client.ts   (axios + interceptores JWT refresh)
│   ├── types/          (TypeScript types)
│   ├── store/          (Zustand authStore)
│   ├── hooks/          (useAuth)
│   ├── constants/      (queryKeys)
│   ├── lib/utils.ts    (formatDate, cn, etc.)
│   └── components/     (Skeleton, UI, RouteGuards)
└── App.tsx             (rutas con ProtectedRoute/PublicRoute)
```

## Pantallas Implementadas (20)
1. Login
2. Dashboard Administrador (ingresos, accesos y cartera)
3. Dashboard Entrenador (rutinas y progreso técnico)
3. Dashboard Miembro (progreso, plan, pagos)
4. Lista de Miembros (filtros, búsqueda, paginación)
5. Detalle de Miembro (info + activación)
6. Activación de Miembro (con selección de plan)
7. Lista de Planes de Entrenamiento
8. Detalle de Plan + Vista Semanal
9. Entrenamiento de Hoy (registro en vivo)
10. Registro de Sesión (con logs de ejercicios)
11. Check-in de Asistencia
12. Historial de Asistencia
13. Vista de Progreso (logs físicos + sesiones + chart)
14. Gráficas (backend PNG + recharts)
15. Alertas de Inactividad + Resolución
16. Billing/Pagos (registros + planes de membresía)
17. Nutrición (perfiles + guías)
18. Chat IA (con historial + límite diario)
19. Perfil de Usuario
20. Reportes administrativos (pantalla, PDF y CSV)
21. 404 Not Found

## Seguridad
- JWT httpOnly cookies (backend-managed)
- Auto-refresh de token con interceptor Axios
- ProtectedRoute por capacidad (admin/trainer/member/operator)
- PublicRoute con redirect para usuarios autenticados
- CSRF token en headers de requests

## Tests
- Testing completado al 95%: Login, routing, validación, dark mode, responsive

## Rutinas, ejercicios e historial

- El administrador gestiona rutinas en una lista con búsqueda, objetivo, estado y acciones para editar, consultar clientes, asignar y desactivar. Crear y editar usan páginas propias.
- Los ejercicios reutilizables viven en una sección propia dentro de Rutinas. Su ficha de catálogo contiene nombre, músculo, equipo, instrucciones y medios. La rutina define la prescripción concreta: días, series, repeticiones, tiempo y descansos.
- Desactivar una rutina o ejercicio impide nuevas asignaciones desde esa fuente. Los planes ya asignados siguen disponibles.
- Asignar una rutina crea un plan independiente y conserva una copia de los datos de cada ejercicio. Los cambios de biblioteca y catálogo afectan a las asignaciones futuras. Un cambio para un cliente concreto requiere una revisión explícita de su plan.
- Cada sesión conserva una copia del nombre del plan, el día y los ejercicios al iniciarse. El historial mensual muestra decisiones Realizado/Omitir, prescripción y tipo de cierre. Al completar una sesión, el histórico queda cerrado.
- La creación y edición de rutinas siguen un asistente de cuatro pasos: objetivo, modalidad, ejercicios por bloque y revisión. El objetivo ofrece sugerencias del catálogo con imagen según categoría o grupo muscular; el instructor decide qué incluir y ajusta la prescripción.
- La modalidad flexible recorre bloques A → B → C sin día fijo. La semanal muestra días sugeridos, pero una ausencia tampoco salta bloques. Cada cliente retoma una sesión pendiente o recibe el bloque siguiente al último completado.
- Los ejercicios por tiempo admiten rondas y duración de trabajo en segundos, además de descanso en segundos. El cliente ve un ejercicio a la vez y un temporizador de preparación, trabajo y descanso que puede pausar. Realizado u Omitir sigue siendo una decisión explícita y se registra de inmediato.

## Backlog / Próximas Fases
- P0 completado: Recorrido transaccional de API contra Supabase para registro, pago, comprobante, acceso y reportes
- P0 completado: Registro comercial de clientes con membresía, primer pago obligatorio, acceso y comprobante
- P0 completado: Separación administrador/entrenador y aislamiento financiero
- P0 completado: Acceso a rutina con validación de membresía y registro de entrada
- P0 completado: Reportes comerciales y de accesos en pantalla, PDF y CSV
- P0 pendiente: Validar cron de vencimientos y mora en el deployment final
- P1 pendiente: Agregar reversión auditable de pagos sin editar el registro original
- P1 pendiente: Conciliación bancaria y reversión contable formal
- P0 pendiente: Ejecutar el E2E visual en el dominio final con administrador, entrenador y cliente
- P1 pendiente: Confirmar e implementar hasta dos planes de entrenamiento simultáneos por cliente, principal y secundario
- P1: Vista de clases (GymClass)
- P1: Calendario de clases
- P2: Filtros avanzados en gráficas
- P2: Edición de perfil de usuario
- P3: OAuth wearables (campo source en ProgressLog)
- P3: Notificaciones push en tiempo real

### Estados en la lista de clientes

La lista usa una clasificacion comercial exclusiva, calculada en cada consulta:

- Membresia activa: periodo pagado vigente, incluido su ultimo dia.
- Membresia inactiva: periodo vencido hasta 30 dias, sin periodo pagado
  o sin membresia asignada; incluye las membresias suspendidas.
- Cliente inactivo: mas de 30 dias desde el vencimiento, o baja manual del perfil.

Un cobro futuro pendiente no desactiva un periodo ya pagado. Registrar una
renovacion con periodo vigente devuelve al cliente a membresia activa, salvo
que exista una baja manual. La clasificacion no modifica la cuenta de acceso
ni elimina datos historicos. El listado filtra con `estado_cliente` y devuelve
ese mismo estado para sus etiquetas; los filtros de cobros de facturacion
mantienen su uso independiente.

## Ejecución de rutinas del cliente

Con una entrada de hoy sin salida registrada, «Mi entrenamiento» permite seguir
el siguiente bloque del plan o elegir una rutina libre. El administrador habilita
esta última opción con «Disponible como rutina libre para clientes» al editar la
rutina; las existentes permanecen privadas hasta habilitarlas explícitamente.
La ejecución libre se guarda en el historial sin adelantar el plan asignado.

El administrador configura series, repeticiones o segundos de trabajo, descanso
entre series y descanso opcional entre ejercicios. El cliente ve la demostración
antes de comenzar cada ejercicio. En fuerza confirma «Serie completada»; en tiempo
el reloj avanza por preparación, trabajo y descanso. Puede pausar, saltar descansos,
omitir series o ejercicios y finalizar con confirmación sin perder lo realizado.
El historial distingue trabajo completo, parcial y omitido. Las repeticiones
prescritas no se presentan como una medición real del cliente.

Cada transición se guarda en el servidor con revisión e identificador de petición.
Al ocultar la página se solicita pausa; al recuperar un reloj activo se pausa antes
de mostrarlo. Una interrupción brusca conserva la última transición confirmada;
la aplicación no da por hechas varias series mientras estuvo suspendida.
Se requiere conexión para confirmar y avanzar; un fallo permite reintentar el mismo
registro sin duplicarlo. Las sesiones conservan su prescripción al iniciarse.

Antes de desplegar el frontend, aplicar las migraciones de `plans` y `progress`
con `manage.py migrate`. Los endpoints nuevos son `GET/POST /api/entrenamiento-cliente/`
y `POST /api/entrenamiento-cliente/{id}/accion/`. La consulta y las acciones se
limitan al cliente autenticado. La salida del gimnasio se registra por separado.
