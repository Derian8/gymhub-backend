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
2. Dashboard Trainer (resumen general del gimnasio)
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
20. 404 Not Found

## Seguridad
- JWT httpOnly cookies (backend-managed)
- Auto-refresh de token con interceptor Axios
- ProtectedRoute por rol (trainer/member)
- PublicRoute con redirect para usuarios autenticados
- CSRF token en headers de requests

## Tests
- Testing completado al 95%: Login, routing, validación, dark mode, responsive

## Backlog / Próximas Fases
- P0: Conectar al backend Django real y verificar todos los flujos
- P1: Registro de nuevos miembros (formulario completo)
- P1: Vista de clases (GymClass)
- P1: Calendario de clases
- P2: Filtros avanzados en gráficas
- P2: Dashboard de Admin con más métricas
- P2: Edición de perfil de usuario
- P2: Exportar reportes (CSV/PDF)
- P3: OAuth wearables (campo source en ProgressLog)
- P3: Notificaciones push en tiempo real
