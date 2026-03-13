# Arquitectura Del Sistema

## Visión General
GymHub es una API backend monolítica y modular desarrollada con Django 5 y Django REST Framework. El sistema se ejecuta principalmente con Docker Compose y distribuye responsabilidades en apps de dominio.

## Componentes Principales
- API web Django/DRF: expone autenticación, CRUDs, acciones de negocio y documentación OpenAPI.
- PostgreSQL: persistencia transaccional principal.
- Redis: broker/result backend de Celery y caché de Django.
- Celery worker: ejecuta tareas asíncronas.
- Celery Beat: agenda tareas recurrentes de pagos e inactividad.
- Matplotlib: genera gráficas PNG bajo `MEDIA_ROOT`.
- Integración IA: usa `OPENAI_API_KEY` o `EMERGENT_LLM_KEY`.

## Estructura De Alto Nivel
- [`gymhub/gymhub/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/gymhub): configuración, `urls.py`, ASGI/WSGI y Celery.
- [`gymhub/users/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/users): usuarios, perfiles, permisos, autenticación JWT por cookie.
- [`gymhub/classes/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/classes): clases del gimnasio e inscripciones.
- [`gymhub/plans/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/plans): planes, días de entrenamiento y ejercicios.
- [`gymhub/attendance/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/attendance): asistencia y check-in.
- [`gymhub/progress/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/progress): logs de progreso, sesiones y ejercicios realizados.
- [`gymhub/alerts/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/alerts): alertas de inactividad y notificaciones.
- [`gymhub/billing/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/billing): planes de membresía, cronogramas y registros de pago.
- [`gymhub/nutrition/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/nutrition): perfiles y guías nutricionales.
- [`gymhub/ai_chat/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/ai_chat): historial y generación de respuestas IA.
- [`gymhub/charts/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/charts): generación de gráficas.

## Roles De Usuario
- `member`: consume su propio perfil, asistencia, progreso, planes y chat IA.
- `trainer`: administra miembros, clases, planes, alertas, pagos y vistas globales.
- `staff/superuser`: hereda capacidades administrativas desde Django.

## Flujo General De Negocio
1. Un usuario se registra o inicia sesión mediante JWT con cookies httpOnly.
2. Un trainer o staff crea planes, clases y configuraciones de pago.
3. El miembro realiza check-in, consume su entrenamiento del día y registra sesiones.
4. El sistema actualiza progreso, genera alertas y expone gráficas.
5. Celery procesa pagos próximos, pagos vencidos y alertas programadas.

## Dependencias Entre Dominios
- `users` es el centro de identidad; casi todos los módulos dependen de `MemberProfile` o `TrainerProfile`.
- `plans` alimenta `progress` y `nutrition`.
- `attendance` alimenta `alerts`, `charts` y validaciones de negocio.
- `billing` afecta check-in, dashboard y alertas.
- `ai_chat` consume contexto desde `billing`, `attendance`, `progress` y `plans`.

## Puntos Operativos Importantes
- La API principal está montada bajo `/api/`.
- La autenticación está bajo `/auth/`.
- Swagger está en `/api/docs/`.
- En `DEBUG`, Django sirve archivos estáticos y media directamente.
