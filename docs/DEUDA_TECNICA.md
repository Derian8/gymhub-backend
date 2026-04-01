# Deuda Técnica

## Resumen Ejecutivo
La base funcional ya es operable en desarrollo y en producción local, con smoke test del MVP, migraciones versionadas y cobertura útil en backend y frontend. La deuda principal ahora está en endurecimiento final para despliegue real, cobertura medible con umbrales formales y cierre de infraestructura externa para staging.

## Prioridad Alta

### 1. Configuración aún permisiva para despliegue real
Evidencia:
- El flujo `--prod` está validado para producción local, pero [`.env.prod.example`](/mnt/c/dev/proyectos/proyectoappgym/.env.prod.example) conserva cookies inseguras y `SECURE_SSL_REDIRECT=False` para no romper pruebas locales.
- [`gymhub/gymhub/settings.py`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/gymhub/settings.py) ya advierte cuando `DEBUG=False` convive con flags inseguros.

Impacto:
- Riesgo de desplegar con valores pensados para validación local.
- Cookies y redirección HTTPS podrían quedar abiertas por error humano.

Acción recomendada:
- Definir un `.env` real por entorno.
- Activar `AUTH_COOKIE_SECURE`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` y `SECURE_SSL_REDIRECT` en staging/producción.
- Reemplazar `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS` por dominios reales.

### 2. Manejo amplio de excepciones aún no eliminado por completo
Evidencia:
- Ya se corrigieron capturas genéricas triviales y se dejó logging contextual en rutas críticas.
- Los errores aún controlados de forma amplia deben quedar acotados a integraciones externas o librerías que no expongan taxonomía estable de excepciones.

Impacto:
- Algunos errores reales todavía pueden degradarse a respuestas opacas.
- Observabilidad desigual según el módulo.

Acción recomendada:
- Revisar el resto de `views.py`, tareas y utilidades por módulo.
- Reemplazar capturas genéricas restantes por excepciones específicas cuando el dominio sí las conozca.
- Mantener logging contextual en dominios críticos y sanitizar respuestas de error hacia el cliente.

### 3. Validación end-to-end aún incompleta
Evidencia:
- Existe `gym-smoke` para validar el MVP por rol y pruebas frontend por módulos críticos.
- No hay todavía una suite browser E2E dedicada con Playwright o equivalente.

Impacto:
- Riesgo de regresiones en navegación real, cookies, rendering y redirecciones completas.
- Parte de la calidad aún depende de pruebas por componente y smoke HTTP.

Acción recomendada:
- Añadir flujos E2E para `login`, `dashboard`, `members`, `check-in`, `today workout`, `billing` y `alerts`.

## Prioridad Media

### 4. Documentación operativa incompleta
Evidencia:
- La fuente principal ahora debe vivir en `README` y `RUNBOOK.md`.
- Las guías secundarias del backend y `docs/` deben mantenerse sincronizadas cuando cambien scripts o modos de arranque.

Impacto:
- Onboarding más lento.
- Riesgo de configuración incorrecta.

Acción recomendada:
- Consolidar la entrada principal en la raíz del repo.
- Mantener sincronizadas la documentación raíz y la del backend.

### 5. Cobertura de pruebas desigual
Evidencia:
- Hay pruebas backend para `auth`, `ai_chat`, `check-in`, `plans`, `celery`, `charts`, `classes`, `alerts`, `nutrition` y vistas críticas de `billing`.
- Hay pruebas frontend para guards, auth, dashboards, members, billing, alerts, plans, nutrition, progress, charts, ai-chat, profile y check-in.

Impacto:
- Sigue faltando medir cobertura total y fijar umbral mínimo.
- Aún no hay pruebas E2E reales de navegador.

Acción recomendada:
- Medir cobertura backend/frontend.
- Fijar umbral mínimo por módulo y agregar E2E críticos.

### 6. Inconsistencia de idioma en el dominio
Evidencia:
- Se definió como regla usar español en código nuevo, pero el backend actual expone módulos y entidades en inglés como `users`, `plans`, `attendance`, `WorkoutSession`, `PaymentRecord`.

Impacto:
- Aumenta la carga cognitiva.
- Complica estandarización futura de backend, frontend y base de datos.

Acción recomendada:
- Definir estrategia de transición por capas.
- Mantener compatibilidad externa mientras se normalizan nombres internos nuevos.

## Prioridad Baja

### 7. Acoplamiento entre vistas y lógica de negocio
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
1. Endurecer configuración para staging/producción real.
2. Cerrar `except Exception` restantes y mejorar observabilidad.
3. Añadir pruebas E2E del MVP.
4. Mantener sincronizadas documentación raíz, backend y checklist de release.
5. Extraer lógica de negocio acoplada a vistas.
6. Diseñar plan gradual de normalización de nombres al español.
