#!/bin/bash
# run_tests.sh — Ejecuta los tests pytest dentro del contenedor Docker
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DOCKER_BIN="docker"

if ! docker ps >/dev/null 2>&1; then
  DOCKER_BIN="/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"
fi

echo "========================================"
echo "  GymHub Backend — Ejecutando Tests     "
echo "========================================"

cd "${PROJECT_ROOT}"

echo "Usando settings_test con SQLite en memoria"
"${DOCKER_BIN}" compose run --rm --no-deps \
  -e DJANGO_SETTINGS_MODULE=gymhub.settings_test \
  backend python manage.py migrate --settings=gymhub.settings_test --noinput

# Ejecutar los tests
echo "Ejecutando tests..."
"${DOCKER_BIN}" compose run --rm --no-deps \
  -e DJANGO_SETTINGS_MODULE=gymhub.settings_test \
  backend pytest tests/ -v --tb=short "$@"

echo "========================================"
echo "  Tests completados                      "
echo "========================================"
