#!/bin/bash
# run_tests.sh — Ejecuta los tests pytest dentro del contenedor Docker
set -e

echo "========================================"
echo "  GymHub Backend — Ejecutando Tests     "
echo "========================================"

# Asegurarse de que los servicios están corriendo
docker-compose up -d db redis

# Esperar a que la base de datos esté lista
echo "Esperando a que la base de datos esté lista..."
sleep 5

# Ejecutar migraciones en modo test
docker-compose run --rm web sh -c "
  python manage.py migrate --settings=gymhub.settings_test --noinput 2>/dev/null || true
"

# Ejecutar los tests
echo "Ejecutando tests..."
docker-compose run --rm \
  -e DJANGO_SETTINGS_MODULE=gymhub.settings_test \
  web pytest tests/ -v --tb=short "$@"

echo "========================================"
echo "  Tests completados                      "
echo "========================================"
