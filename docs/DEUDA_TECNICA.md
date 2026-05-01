# Deuda Técnica

## Resumen Ejecutivo
La base funcional ya es operable en desarrollo, producción local y un primer despliegue real en Supabase/Vercel. El frontend esta publicado en `https://proyectoappgym-frontend.vercel.app`, el backend API en `https://proyectoappgym-backend.vercel.app` y PostgreSQL vive en Supabase. Las migraciones y `seed_data` ya fueron ejecutados contra Supabase, y el login real contra el backend desplegado devuelve `HTTP 200` con cookies JWT.

La deuda principal ya no es conectar infraestructura base, sino cerrar operación de producción: workers Celery/Beat, Redis gestionado, almacenamiento persistente de media, rotación de secretos, QA end-to-end y hardening final de dominios/cookies.

## Prioridad Alta

### 0. Historial de migraciones desalineado con la base real
Evidencia:
- `plans.0005` y `progress.0004` aparecen como aplicadas en Django.
- La base real en Supabase no tenía:
  - `plans_workoutday.day_of_week`
  - tabla `plans_gymmachine`
  - `plans_exercise.machine_id`
  - `progress_progresslog.height_cm`
- Esto provocó `500` reales en:
  - `/api/trainer/gym-overview/`
  - `/api/charts/overview/`
  - `/api/members/`
- La reparación del 2026-04-30 se aplicó manualmente sobre Supabase con SQL idempotente.

Impacto:
- Producción puede romperse aunque `showmigrations` marque todo en verde.
- Nuevos entornos no tienen una ruta confiable si dependen solo del historial actual.

Acción recomendada:
- Corregir permisos de `gymhub/*/migrations/`.
- Crear migraciones formales de reparación para `plans` y `progress`.
- Verificar esquema real vs historial antes de futuros deploys.

### 1. Workers, scheduler y Redis no desplegados en producción
Evidencia:
- Vercel ejecuta el backend como runtime web serverless.
- El compose local conserva `redis`, `celery` y `celerybeat`, pero esos procesos no existen en Vercel.
- En Vercel backend se usa `REDIS_URL=locmem://` para que la API web funcione sin Redis externo.

Impacto:
- Tareas programadas de pagos, vencimientos e inactividad no corren automaticamente en produccion.
- Cache en memoria no es compartida ni persistente entre invocaciones serverless.

Acción recomendada:
- Definir Redis gestionado: Upstash, Redis Cloud, Railway Redis, Render Redis u otro.
- Desplegar `celery worker` y `celerybeat` en un runtime persistente, o reemplazar tareas recurrentes por cron/jobs compatibles con la plataforma elegida.
- Documentar claramente que Vercel cubre API web, no workers persistentes.

### 2. Almacenamiento media no persistente
Evidencia:
- Existen `ImageField` para fotos y QR.
- Las graficas se generan bajo `MEDIA_ROOT/charts`.
- Vercel no debe usarse como almacenamiento persistente de archivos generados.

Impacto:
- Fotos, QR o graficas generadas pueden perderse o no servirse correctamente en produccion.
- Funcionalidad de media puede comportarse diferente entre local y deploy.

Acción recomendada:
- Mover media a Supabase Storage, S3 compatible o proveedor equivalente.
- Adaptar `DEFAULT_FILE_STORAGE`/storages de Django.
- Ajustar URLs publicas o firmadas segun privacidad requerida.

### 3. Secretos compartidos durante preparacion
Evidencia:
- Token de Vercel y password de Supabase fueron compartidos durante la preparacion del deploy.
- Existen archivos locales ignorados por Git para credenciales, pero los secretos ya deben considerarse expuestos.

Impacto:
- Riesgo de uso no autorizado si esos secretos no se rotan antes de produccion formal.

Acción recomendada:
- Rotar `VERCEL_TOKEN`.
- Rotar password de Supabase PostgreSQL.
- Revisar variables en Vercel despues de rotacion.

### 4. QA end-to-end aún incompleta
Evidencia:
- Se valido login real contra backend Vercel y Supabase.
- No se ha ejecutado recorrido completo de navegador para todos los flujos MVP en los dominios finales.

Impacto:
- Riesgo de regresiones en navegacion real, cookies, rendering, rutas protegidas y flujos por rol.

Acción recomendada:
- Ejecutar QA manual sobre `https://proyectoappgym-frontend.vercel.app`.
- Añadir Playwright para `login`, `dashboard`, `members`, `check-in`, `today workout`, `billing`, `alerts`, `nutrition`, `charts` y `ai-chat`.
- Adaptar `gym-smoke` para aceptar backend desplegado y dominios finales.

## Prioridad Media

### 5. Documentación operativa incompleta
Evidencia:
- La fuente principal ahora debe vivir en `README` y `RUNBOOK.md`.
- Las guías secundarias del backend y `docs/` deben mantenerse sincronizadas cuando cambien scripts o modos de arranque.

Impacto:
- Onboarding más lento.
- Riesgo de configuración incorrecta.

Acción recomendada:
- Consolidar la entrada principal en la raíz del repo.
- Mantener sincronizadas la documentación raíz y la del backend.

### 6. Cobertura de pruebas desigual
Evidencia:
- Hay pruebas backend para `auth`, `ai_chat`, `check-in`, `plans`, `celery`, `charts`, `classes`, `alerts`, `nutrition` y vistas críticas de `billing`.
- Hay pruebas frontend para guards, auth, dashboards, members, billing, alerts, plans, nutrition, progress, charts, ai-chat, profile y check-in.

Impacto:
- Sigue faltando medir cobertura total y fijar umbral mínimo.
- Aún no hay pruebas E2E reales de navegador.

Acción recomendada:
- Medir cobertura backend/frontend.
- Fijar umbral mínimo por módulo y agregar E2E críticos.

### 7. Inconsistencia de idioma en el dominio
Evidencia:
- Se definió como regla usar español en código nuevo, pero el backend actual expone módulos y entidades en inglés como `users`, `plans`, `attendance`, `WorkoutSession`, `PaymentRecord`.

Impacto:
- Aumenta la carga cognitiva.
- Complica estandarización futura de backend, frontend y base de datos.

Acción recomendada:
- Definir estrategia de transición por capas.
- Mantener compatibilidad externa mientras se normalizan nombres internos nuevos.

## Prioridad Baja

### 8. Acoplamiento entre vistas y lógica de negocio
Evidencia:
- `ai_chat` importa lógica desde vistas de `plans`.
- Parte de la lógica de negocio sigue viviendo directamente en `views.py`.

Impacto:
- Reutilización limitada.
- Menor testabilidad unitaria.

Acción recomendada:
- Extraer servicios o casos de uso por dominio.
- Mantener vistas como capa HTTP delgada.

## Orden Recomendado De Ataque
1. Decidir estrategia para Redis/Celery/Beat fuera de Vercel.
2. Resolver media persistente con Supabase Storage/S3 compatible.
3. Rotar secretos de Supabase y Vercel.
4. Ejecutar QA completo en dominios finales y automatizar Playwright.
5. Mantener sincronizadas documentación raíz, backend y checklist de release.
6. Cerrar `except Exception` restantes y mejorar observabilidad.
7. Extraer lógica de negocio acoplada a vistas.
8. Diseñar plan gradual de normalización de nombres al español.
