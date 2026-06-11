# Documentación Del Proyecto

## Índice
- [`../RUNBOOK.md`](/mnt/c/dev/proyectos/proyectoappgym/RUNBOOK.md): fuente principal de operación, soporte, recuperación y validación de entrega.
- [`ARQUITECTURA.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/ARQUITECTURA.md): visión técnica del backend, roles, dominios y flujo general.
- [`AUDITORIA_FUNCIONAL_Y_PRODUCTO.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/AUDITORIA_FUNCIONAL_Y_PRODUCTO.md): auditoría profunda por dominio con objetivos de negocio, riesgos y roadmap de mejora.
- [`MODULOS_Y_API.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/MODULOS_Y_API.md): inventario funcional por app, entidades principales y rutas expuestas.
- [`OPERACION.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/OPERACION.md): puesta en marcha local, dependencias, pruebas y consideraciones operativas.
- [`AVANCE_DEPLOY.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/AVANCE_DEPLOY.md): estado actual del deploy en Supabase/Vercel, validaciones y limitaciones.
- [`DEUDA_TECNICA.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/DEUDA_TECNICA.md): deuda técnica identificada, prioridad, impacto y recomendaciones.
- [`MVP_FUNCIONAL.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/MVP_FUNCIONAL.md): definición operativa del producto mínimo viable, rutas activas y alcance por rol.
- [`QA_MVP.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/QA_MVP.md): matriz manual de validación por rol y ruta del MVP.
- [`RECOMENDACIONES_GYM.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/RECOMENDACIONES_GYM.md): mejoras priorizadas para operación diaria de gimnasio, miembros, entrenadores y administración.
- [`RELEASE_CHECKLIST.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/RELEASE_CHECKLIST.md): checklist de validación para staging, producción local y entregas.
- [`SUPABASE_VERCEL.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/SUPABASE_VERCEL.md): credenciales requeridas y flujo de conexión con Supabase PostgreSQL y Vercel.

## Resumen
Este repositorio contiene el backend de GymHub, una API para gestión de miembros, entrenadores, clases, planes de entrenamiento, asistencia, progreso, facturación, nutrición, alertas, gráficas y chat con IA.

La aplicación está organizada como un proyecto Django modular dentro de [`gymhub/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub), con autenticación JWT en cookies httpOnly, PostgreSQL como base de datos principal, Redis como broker/cache y Celery para tareas programadas.

Para operación diaria y entregas, prioriza [`RUNBOOK.md`](/mnt/c/dev/proyectos/proyectoappgym/RUNBOOK.md). Los documentos de `docs/` complementan ese flujo con detalle técnico.

## Convenciones
- Código Python bajo `PEP 8`.
- Código nuevo y modelo de datos nuevo en español cuando no rompa compatibilidad.
- Nombres internos en `snake_case`; clases en `PascalCase`.
- Toda nueva documentación técnica debe actualizar este índice si agrega archivos en `docs/`.
