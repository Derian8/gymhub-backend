# Deuda Técnica

## Resumen Ejecutivo
La base funcional está bien separada por dominios y tiene pruebas en áreas críticas, pero la madurez operativa todavía es baja. La deuda principal está en persistencia reproducible, endurecimiento de seguridad, manejo de errores, consistencia de nombres y cobertura desigual de pruebas.

## Prioridad Alta

### 1. Migraciones no versionadas
Evidencia:
- No existen directorios `migrations/` en las apps bajo [`gymhub/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub).

Impacto:
- No hay forma confiable de reconstruir la base de datos entre entornos.
- El esquema real puede divergir del código.

Acción recomendada:
- Generar y versionar migraciones por app.
- Definir política de cambios de esquema y revisión de migraciones.

### 2. Configuración insegura para despliegue
Evidencia:
- [`gymhub/Dockerfile`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/Dockerfile) mantiene un `CMD` con Gunicorn `--reload`, aunque el flujo Docker principal ahora arranca desde la raíz con `runserver` para desarrollo.
- Falta una separación explícita entre imágenes y comandos de desarrollo frente a producción.

Impacto:
- Superficie de ataque innecesaria.
- Riesgo de comportamiento inestable o consumo extra en producción.

Acción recomendada:
- Mantener `ALLOWED_HOSTS` parametrizado por entorno, como ya quedó en `settings.py`.
- Separar configuración de desarrollo y producción.
- Retirar `--reload` de cualquier imagen destinada a producción.

### 3. Manejo amplio y silencioso de excepciones
Evidencia:
- Capturas genéricas en autenticación, asistencia, planes, pagos, gráficas y chat IA.
- Casos visibles en [`gymhub/users/authentication.py`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/users/authentication.py), [`gymhub/ai_chat/views.py`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/ai_chat/views.py), [`gymhub/billing/tasks.py`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/billing/tasks.py), [`gymhub/attendance/views.py`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/attendance/views.py).

Impacto:
- Errores reales quedan ocultos.
- La observabilidad y el soporte operativo se degradan.

Acción recomendada:
- Reemplazar `except Exception` por excepciones específicas.
- Registrar contexto con logging estructurado.
- Responder códigos de error coherentes.

## Prioridad Media

### 4. Documentación operativa incompleta
Evidencia:
- El flujo operativo quedó dividido entre [`README.md`](/mnt/c/dev/proyectos/proyectoappgym/README.md), [`docs/OPERACION.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/OPERACION.md) y [`gymhub/README.md`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/README.md).
- El proyecto ya tiene `.env.example`, pero el README del backend todavía prioriza el compose legado dentro de `gymhub/`.

Impacto:
- Onboarding más lento.
- Riesgo de configuración incorrecta.

Acción recomendada:
- Consolidar la entrada principal en la raíz del repo.
- Mantener sincronizadas la documentación raíz y la del backend.

### 5. Cobertura de pruebas desigual
Evidencia:
- Existen pruebas para auth, IA, check-in, planes, Celery, charts y validadores.
- No se observan pruebas para `classes`, `alerts`, `nutrition` ni CRUDs completos de `billing`.

Impacto:
- Mayor riesgo de regresión en módulos no cubiertos.

Acción recomendada:
- Priorizar pruebas de permisos, filtros, acciones custom y tareas de alertas.
- Medir cobertura y fijar un umbral mínimo por módulo.

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

### 7. Script de pruebas frágil
Evidencia:
- [`gymhub/run_tests.sh`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/run_tests.sh) usa `sleep 5`.
- El mismo script oculta errores de migración con `2>/dev/null || true`.

Impacto:
- Falsos positivos.
- Diagnóstico más difícil cuando falla el entorno.

Acción recomendada:
- Esperar por healthchecks reales.
- No suprimir errores de migración.

### 8. Acoplamiento entre vistas y lógica de negocio
Evidencia:
- `ai_chat` importa lógica desde vistas de `plans`.
- Parte de la lógica de negocio vive directamente en `views.py`.

Impacto:
- Reutilización limitada.
- Menor testabilidad unitaria.

Acción recomendada:
- Extraer servicios o casos de uso por dominio.
- Mantener vistas como capa HTTP delgada.

## Orden Recomendado De Ataque
1. Versionar migraciones.
2. Endurecer configuración de despliegue.
3. Corregir manejo silencioso de errores y logging.
4. Crear `.env.example` y cerrar brechas de documentación operativa.
5. Ampliar pruebas en módulos sin cobertura.
6. Diseñar plan gradual de normalización de nombres al español.
