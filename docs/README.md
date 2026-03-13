# Documentación Del Proyecto

## Índice
- [`ARQUITECTURA.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/ARQUITECTURA.md): visión técnica del backend, roles, dominios y flujo general.
- [`MODULOS_Y_API.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/MODULOS_Y_API.md): inventario funcional por app, entidades principales y rutas expuestas.
- [`OPERACION.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/OPERACION.md): puesta en marcha local, dependencias, pruebas y consideraciones operativas.
- [`DEUDA_TECNICA.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/DEUDA_TECNICA.md): deuda técnica identificada, prioridad, impacto y recomendaciones.

## Resumen
Este repositorio contiene el backend de GymHub, una API para gestión de miembros, entrenadores, clases, planes de entrenamiento, asistencia, progreso, facturación, nutrición, alertas, gráficas y chat con IA.

La aplicación está organizada como un proyecto Django modular dentro de [`gymhub/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub), con autenticación JWT en cookies httpOnly, PostgreSQL como base de datos principal, Redis como broker/cache y Celery para tareas programadas.

## Convenciones
- Código Python bajo `PEP 8`.
- Código nuevo y modelo de datos nuevo en español cuando no rompa compatibilidad.
- Nombres internos en `snake_case`; clases en `PascalCase`.
- Toda nueva documentación técnica debe actualizar este índice si agrega archivos en `docs/`.
