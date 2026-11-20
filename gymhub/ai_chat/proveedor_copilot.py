"""Ejecuta Copilot en un proceso aislado con plazo y herramientas acotadas."""

import json
import logging
import os
import signal
from pathlib import Path
import subprocess
import sys
import tempfile

from django.conf import settings

logger = logging.getLogger(__name__)


def consultar_copilot(prompt, herramientas=None, declaraciones=None):
    clave = getattr(settings, 'COPILOT_GITHUB_TOKEN', '')
    if not clave:
        raise ValueError('Copilot no está configurado.')
    # El runtime no recibe credenciales de base de datos ni acceso al proyecto.
    entorno = {
        nombre: valor for nombre, valor in os.environ.items()
        if nombre in ('PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR',
                      'SSL_CERT_FILE', 'LD_LIBRARY_PATH', 'LANG')
    }
    entorno['COPILOT_GITHUB_TOKEN'] = clave
    # Vercel añade dependencias al sys.path del proceso web; sus subprocesos
    # necesitan esas mismas rutas para importar el SDK instalado por el build.
    entorno['PYTHONPATH'] = os.pathsep.join(ruta for ruta in sys.path if ruta)
    entorno['COPILOT_CLI_EXTRACT_DIR'] = str(Path(tempfile.gettempdir()) / 'pulso-copilot-runtime-1.0.35')
    cuerpo = {
        'prompt': prompt,
        'modelo': 'auto',
        'herramientas': herramientas or {},
        'declaraciones': declaraciones or [],
    }
    try:
        proceso = subprocess.Popen(
            [sys.executable, str(Path(__file__).with_name('copilot_ejecutor.py'))],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            encoding='utf-8',
            env=entorno,
            start_new_session=os.name != 'nt',
        )
        try:
            salida_texto, _ = proceso.communicate(
                json.dumps(cuerpo, ensure_ascii=False, default=str),
                timeout=getattr(settings, 'COPILOT_TIMEOUT_SECONDS', 45),
            )
        except subprocess.TimeoutExpired:
            if os.name == 'nt':
                subprocess.run(['taskkill', '/PID', str(proceso.pid), '/T', '/F'],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
            else:
                try:
                    os.killpg(proceso.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            proceso.kill()
            proceso.communicate()
            raise
        salida = json.loads(salida_texto)
        if proceso.returncode or not salida.get('respuesta'):
            tipo = salida.get('error', 'SinRespuesta')
            if isinstance(tipo, str) and tipo.isidentifier():
                logger.warning('Copilot runtime no disponible (%s, errno=%s, archivo=%s).',
                               tipo, salida.get('errno'), salida.get('archivo'))
            raise ValueError('Copilot no produjo una respuesta.')
        return salida['respuesta'], salida.get('consultados', [])
    except (subprocess.TimeoutExpired, OSError, ValueError):
        # No propagar stderr, cuerpos HTTP ni argumentos que contengan el token.
        raise ValueError('Copilot no disponible; usar proveedor de respaldo.') from None
