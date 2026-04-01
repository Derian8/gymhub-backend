# Repository Guidelines

## Estructura Del Proyecto
La raíz del repositorio contiene la orquestación principal con [`docker-compose.yml`](/mnt/c/dev/proyectos/proyectoappgym/docker-compose.yml), los scripts [`gym-start`](/mnt/c/dev/proyectos/proyectoappgym/gym-start), [`gym-stop`](/mnt/c/dev/proyectos/proyectoappgym/gym-stop) y [`gym-log`](/mnt/c/dev/proyectos/proyectoappgym/gym-log), además de [`.env.example`](/mnt/c/dev/proyectos/proyectoappgym/.env.example). El backend Django vive en [`gymhub/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub) y el frontend Vite/React en [`frontend/`](/mnt/c/dev/proyectos/proyectoappgym/frontend). La configuración Django está en [`gymhub/gymhub/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/gymhub), con pruebas en [`gymhub/gymhub/settings_test.py`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/gymhub/settings_test.py). Las pruebas compartidas están en [`gymhub/tests/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/tests). La documentación funcional vive en [`memory/PRD.md`](/mnt/c/dev/proyectos/proyectoappgym/memory/PRD.md).

## Comandos De Desarrollo
Ejecuta desde la raíz del repositorio:

- `./gym-start`: levanta `frontend`, `backend`, `db`, `redis`, `celery` y `celerybeat`.
- `./gym-start --prod`: levanta el stack de producción local con Gunicorn y Nginx.
- `./gym-stop`: detiene los contenedores del proyecto.
- `./gym-log`: sigue logs en tiempo real.
- `./gym-smoke`: valida el MVP con usuarios demo y endpoints reales.
- `./gym-smoke --prod`: valida el stack de producción local.
- `docker compose exec backend python manage.py migrate`: aplica migraciones.
- `docker compose exec backend python manage.py seed_data`: carga datos base.
- `docker compose exec backend python manage.py createsuperuser`: crea un superusuario.
- `docker compose exec backend ./run_tests.sh`: ejecuta la suite backend en entorno de test.
- `docker compose exec backend pytest tests/ -v --tb=short`: ejecuta pruebas directamente.

## Reglas De Código Y Nombres
Python debe seguir `PEP 8`, con indentación de 4 espacios, `snake_case` para variables, funciones, archivos y módulos, y `PascalCase` solo para clases. El estándar del proyecto es usar español en nombres internos: variables, métodos, carpetas nuevas, tablas, columnas y relaciones. Ejemplos válidos: `fecha_nacimiento`, `esta_activo`, `planes_entrenamiento/`.

No mezcles inglés y español dentro del mismo dominio. Si una entidad se define como `usuario`, no debe aparecer luego como `user` en la lógica nueva. Excepción: se mantienen nombres exigidos por Django, DRF, librerías externas y compatibilidad con el backend actual, que ya contiene apps y modelos en inglés.

## Reglas De Base De Datos
Toda tabla nueva debe nombrarse en español y en `snake_case`: `usuarios`, `registros_asistencia`, `planes_entrenamiento`. Los campos también deben ir en español: `correo_electronico`, `fecha_creacion`, `fecha_vencimiento`, `usuario_id`. Los booleanos deben expresar estado, por ejemplo `esta_activo` o `tiene_membresia_vigente`.

## Pruebas
El proyecto usa `pytest`, `pytest-django`, `factory-boy`, `freezegun` y `pytest-mock`. Agrega pruebas en [`gymhub/tests/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/tests) con patrón `test_*.py`. Marca pruebas con base de datos usando `@pytest.mark.django_db` y cubre autenticación, permisos y reglas de negocio al cambiar endpoints, tareas o modelos.

## Commits Y Pull Requests
La historia actual no define una convención útil, así que usa mensajes imperativos y concretos como `Agrega pruebas de pagos vencidos`. Cada pull request debe incluir resumen breve, módulos afectados, evidencia de pruebas y ejemplos de entrada o salida si cambia comportamiento de API o UI.

## Configuración
Los secretos van en [`.env`](/mnt/c/dev/proyectos/proyectoappgym/.env) en la raíz y nunca deben versionarse. Si cambias variables de entorno, cookies de autenticación, tareas programadas o convención de nombres, actualiza también [`README.md`](/mnt/c/dev/proyectos/proyectoappgym/README.md), [`docs/OPERACION.md`](/mnt/c/dev/proyectos/proyectoappgym/docs/OPERACION.md) y [`gymhub/README.md`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/README.md).
