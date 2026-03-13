# Repository Guidelines

## Estructura Del Proyecto
La aplicación principal vive en [`gymhub/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub). Ahí están `manage.py`, `docker-compose.yml`, `Dockerfile` y `requirements.txt`. La configuración Django está en [`gymhub/gymhub/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/gymhub), con pruebas en [`gymhub/gymhub/settings_test.py`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/gymhub/settings_test.py). Las pruebas compartidas están en [`gymhub/tests/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/tests). La documentación funcional vive en [`memory/PRD.md`](/mnt/c/dev/proyectos/proyectoappgym/memory/PRD.md).

## Comandos De Desarrollo
Ejecuta desde [`gymhub/`](/mnt/c/dev/proyectos/proyectoappgym/gymhub):

- `docker-compose up --build -d`: levanta PostgreSQL, Redis, Django y Celery.
- `docker-compose exec web python manage.py migrate`: aplica migraciones.
- `docker-compose exec web python manage.py seed_data`: carga datos base.
- `docker-compose exec web python manage.py createsuperuser`: crea un superusuario.
- `./run_tests.sh`: prepara servicios y ejecuta `pytest` con `gymhub.settings_test`.
- `docker-compose run --rm web pytest tests/ -v --tb=short`: ejecuta pruebas directamente.

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
Los secretos van en `gymhub/.env` y nunca deben versionarse. Si cambias variables de entorno, cookies de autenticación, tareas programadas o convención de nombres, actualiza también [`gymhub/README.md`](/mnt/c/dev/proyectos/proyectoappgym/gymhub/README.md).
