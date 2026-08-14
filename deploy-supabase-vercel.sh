#!/usr/bin/env bash
set -Eeuo pipefail

DIRECTORIO_RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHIVO_ENTORNO_LOCAL="${DIRECTORIO_RAIZ}/.env"
ARCHIVO_ENTORNO_DEPLOY="${DIRECTORIO_RAIZ}/.env.supabase-vercel.local"
DIRECTORIO_BACKEND="${DIRECTORIO_RAIZ}/gymhub"

EJECUTAR_MIGRACIONES=true
DESPLEGAR_BACKEND=true
DESPLEGAR_FRONTEND=true
VALIDAR_PUBLICACION=true
SIMULAR=false
ETAPA_ACTUAL="preparación"

mostrar_ayuda() {
  cat <<'EOF'
Uso: ./deploy-supabase-vercel.sh [opciones]

Automatiza el despliegue de GymHub en este orden:
  1. valida Django, detecta modelos sin migración y muestra el plan
  2. aplica y audita las migraciones en Supabase
  3. despliega el backend en Vercel
  4. comprueba la salud del backend
  5. despliega el frontend en Vercel
  6. valida frontend, backend, Supabase y rewrites públicos

Opciones:
  --dry-run           Muestra las acciones sin modificar Supabase ni Vercel.
  --sin-migraciones   No ejecuta migraciones ni auditoría de esquema.
  --sin-backend       No despliega el backend.
  --sin-frontend      No despliega el frontend.
  --sin-validacion    Omite las comprobaciones HTTP posteriores.
  -h, --help          Muestra esta ayuda.

Configuración:
  .env                            Variables locales requeridas por Django.
  .env.supabase-vercel.local      Credenciales privadas de Supabase y Vercel.
  GYMHUB_PYTHON                    Python alternativo para ejecutar manage.py.

Ejemplos:
  ./deploy-supabase-vercel.sh --dry-run
  ./deploy-supabase-vercel.sh
  ./deploy-supabase-vercel.sh --sin-migraciones
  ./deploy-supabase-vercel.sh --sin-frontend
EOF
}

fallar() {
  echo "[ERROR] $*" >&2
  exit 1
}

registrar_error() {
  local codigo="$?"
  echo "[ERROR] Falló la etapa: ${ETAPA_ACTUAL}." >&2
  exit "${codigo}"
}

trap registrar_error ERR

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      SIMULAR=true
      ;;
    --sin-migraciones)
      EJECUTAR_MIGRACIONES=false
      ;;
    --sin-backend)
      DESPLEGAR_BACKEND=false
      ;;
    --sin-frontend)
      DESPLEGAR_FRONTEND=false
      ;;
    --sin-validacion)
      VALIDAR_PUBLICACION=false
      ;;
    -h|--help)
      mostrar_ayuda
      exit 0
      ;;
    *)
      fallar "Opción desconocida: $1. Usa --help para consultar las opciones."
      ;;
  esac
  shift
done

[[ -f "${ARCHIVO_ENTORNO_DEPLOY}" ]] || \
  fallar "Falta ${ARCHIVO_ENTORNO_DEPLOY}."

# La configuración local aporta variables de Django; el archivo privado de deploy
# se carga después para que sus credenciales de producción tengan precedencia.
if [[ -f "${ARCHIVO_ENTORNO_LOCAL}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ARCHIVO_ENTORNO_LOCAL}"
  set +a
fi

set -a
# shellcheck disable=SC1090
source "${ARCHIVO_ENTORNO_DEPLOY}"
set +a

if [[ "${EJECUTAR_MIGRACIONES}" == true ]]; then
  URL_BASE_DATOS_MIGRACIONES="${SUPABASE_POOLER_DATABASE_URL:-${DATABASE_URL:-}}"
  [[ -n "${URL_BASE_DATOS_MIGRACIONES}" ]] || \
    fallar "Falta SUPABASE_POOLER_DATABASE_URL o DATABASE_URL para migrar Supabase."

  DJANGO_SECRET_KEY="${DJANGO_SECRET_KEY:-${VERCEL_BACKEND_DJANGO_SECRET_KEY:-}}"
  [[ -n "${DJANGO_SECRET_KEY}" ]] || \
    fallar "Falta DJANGO_SECRET_KEY o VERCEL_BACKEND_DJANGO_SECRET_KEY."

  if [[ -n "${GYMHUB_PYTHON:-}" ]]; then
    PYTHON_DJANGO="${GYMHUB_PYTHON}"
  elif [[ -x "${DIRECTORIO_RAIZ}/.venv/bin/python" ]]; then
    PYTHON_DJANGO="${DIRECTORIO_RAIZ}/.venv/bin/python"
  else
    PYTHON_DJANGO="$(command -v python3 || true)"
  fi
  [[ -n "${PYTHON_DJANGO}" && -x "${PYTHON_DJANGO}" ]] || \
    fallar "No se encontró un Python ejecutable para Django."
fi

if [[ "${DESPLEGAR_BACKEND}" == true || "${DESPLEGAR_FRONTEND}" == true ]]; then
  : "${VERCEL_TOKEN:?Falta VERCEL_TOKEN}"
  : "${VERCEL_TEAM_ID:?Falta VERCEL_TEAM_ID}"
fi
if [[ "${DESPLEGAR_BACKEND}" == true ]]; then
  : "${VERCEL_BACKEND_PROJECT_ID:?Falta VERCEL_BACKEND_PROJECT_ID}"
  : "${VERCEL_BACKEND_PROJECT_NAME:?Falta VERCEL_BACKEND_PROJECT_NAME}"
  [[ -x "${DIRECTORIO_RAIZ}/deploy-vercel-backend" ]] || \
    fallar "deploy-vercel-backend no existe o no es ejecutable."
fi
if [[ "${DESPLEGAR_FRONTEND}" == true ]]; then
  : "${VERCEL_PROJECT_ID:?Falta VERCEL_PROJECT_ID}"
  : "${VITE_API_TIMEOUT_MS:?Falta VITE_API_TIMEOUT_MS}"
  [[ -x "${DIRECTORIO_RAIZ}/deploy-vercel-frontend" ]] || \
    fallar "deploy-vercel-frontend no existe o no es ejecutable."
fi
if [[ "${VALIDAR_PUBLICACION}" == true && "${SIMULAR}" == false ]]; then
  command -v curl >/dev/null 2>&1 || fallar "Falta la dependencia curl."
  [[ -x "${DIRECTORIO_RAIZ}/gym-connection-check" ]] || \
    fallar "gym-connection-check no existe o no es ejecutable."
fi

mostrar_comando() {
  printf '  +'
  printf ' %q' "$@"
  printf '\n'
}

ejecutar() {
  mostrar_comando "$@"
  if [[ "${SIMULAR}" == false ]]; then
    "$@"
  fi
}

ejecutar_django() {
  mostrar_comando "${PYTHON_DJANGO}" manage.py "$@"
  if [[ "${SIMULAR}" == false ]]; then
    (
      cd "${DIRECTORIO_BACKEND}"
      DATABASE_URL="${URL_BASE_DATOS_MIGRACIONES}" \
      DB_CONN_MAX_AGE="0" \
      DB_DISABLE_SERVER_SIDE_CURSORS="True" \
      REDIS_URL="locmem://" \
      DJANGO_SECRET_KEY="${DJANGO_SECRET_KEY}" \
      "${PYTHON_DJANGO}" manage.py "$@"
    )
  fi
}

esperar_backend() {
  local url_backend="${BACKEND_PUBLIC_URL:-https://proyectoappgym-backend.vercel.app}"
  local url_salud="${url_backend%/}/health/ready/"
  local intento

  echo "==> Esperando que el backend quede saludable"
  for intento in {1..12}; do
    if curl -fsS --connect-timeout 10 --max-time 30 "${url_salud}" >/dev/null; then
      echo "Backend saludable: ${url_salud}"
      return 0
    fi
    if [[ "${intento}" -lt 12 ]]; then
      echo "  Intento ${intento}/12; reintentando en 5 segundos..."
      sleep 5
    fi
  done

  fallar "El backend no quedó saludable después del despliegue: ${url_salud}"
}

echo "GymHub · despliegue Supabase + Vercel"
if [[ "${SIMULAR}" == true ]]; then
  echo "Modo simulación: no se modificarán servicios externos."
fi

if [[ "${EJECUTAR_MIGRACIONES}" == true ]]; then
  ETAPA_ACTUAL="validación de Django"
  echo "==> Validando configuración de Django"
  ejecutar_django check

  ETAPA_ACTUAL="consistencia de migraciones"
  echo "==> Comprobando que los modelos tengan migraciones versionadas"
  ejecutar_django makemigrations --check --dry-run

  ETAPA_ACTUAL="plan de migraciones"
  echo "==> Revisando migraciones destinadas a Supabase"
  ejecutar_django migrate --plan

  ETAPA_ACTUAL="migraciones de Supabase"
  echo "==> Aplicando migraciones en Supabase"
  ejecutar_django migrate --noinput

  ETAPA_ACTUAL="auditoría del esquema de Supabase"
  echo "==> Auditando el esquema de Supabase"
  ejecutar_django auditar_esquema
else
  echo "==> Migraciones omitidas"
fi

if [[ "${DESPLEGAR_BACKEND}" == true ]]; then
  ETAPA_ACTUAL="despliegue del backend"
  echo "==> Desplegando backend en Vercel"
  ejecutar "${DIRECTORIO_RAIZ}/deploy-vercel-backend"

  if [[ "${VALIDAR_PUBLICACION}" == true && "${SIMULAR}" == false ]]; then
    ETAPA_ACTUAL="salud del backend"
    esperar_backend
  fi
else
  echo "==> Despliegue del backend omitido"
fi

if [[ "${DESPLEGAR_FRONTEND}" == true ]]; then
  ETAPA_ACTUAL="despliegue del frontend"
  echo "==> Desplegando frontend en Vercel"
  ejecutar "${DIRECTORIO_RAIZ}/deploy-vercel-frontend"
else
  echo "==> Despliegue del frontend omitido"
fi

if [[ "${VALIDAR_PUBLICACION}" == true ]]; then
  ETAPA_ACTUAL="validación pública"
  echo "==> Validando servicios públicos"
  if [[ "${SIMULAR}" == true ]]; then
    mostrar_comando "${DIRECTORIO_RAIZ}/gym-connection-check"
  else
    FRONTEND_URL="${FRONTEND_PUBLIC_URL:-https://proyectoappgym-frontend.vercel.app}" \
    BACKEND_URL="${BACKEND_PUBLIC_URL:-https://proyectoappgym-backend.vercel.app}" \
      "${DIRECTORIO_RAIZ}/gym-connection-check"
  fi
else
  echo "==> Validación pública omitida"
fi

ETAPA_ACTUAL="finalización"
echo
if [[ "${SIMULAR}" == true ]]; then
  echo "Simulación completada. Ejecuta sin --dry-run para publicar."
else
  echo "Proceso de despliegue completado."
fi
