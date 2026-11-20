"""Proceso privado del SDK: entrada y salida JSON, sin acceso al checkout."""

import asyncio
import json
import logging
import os
from pathlib import Path
import sys
import tempfile


async def ejecutar(cuerpo):
    from copilot import CopilotClient
    from copilot.tools import Tool, ToolResult

    consultados = []
    herramientas = []
    for declaracion in cuerpo['declaraciones']:
        nombre = declaracion['name']
        if nombre not in cuerpo['herramientas']:
            continue

        async def consultar(invocacion, nombre=nombre):
            if nombre not in consultados:
                consultados.append(nombre)
            return ToolResult(text_result_for_llm=json.dumps(
                cuerpo['herramientas'][nombre], ensure_ascii=False,
            ))

        herramientas.append(Tool(
            name=nombre,
            description=declaracion['description'],
            parameters={'type': 'object', 'properties': {}, 'additionalProperties': False},
            handler=consultar,
            skip_permission=True,
        ))

    def denegar_permiso(solicitud, contexto):
        return {'kind': 'denied-no-approval-rule-and-could-not-request-from-user'}

    with tempfile.TemporaryDirectory(prefix='pulso-copilot-') as directorio:
        cliente = CopilotClient(
            github_token=os.environ['COPILOT_GITHUB_TOKEN'],
            use_logged_in_user=False,
            working_directory=directorio,
            base_directory=str(Path(directorio) / 'estado'),
            mode='empty',
            log_level='none',
        )
        try:
            await cliente.start()
            sesion = await cliente.create_session(
                model=cuerpo['modelo'],
                tools=herramientas,
                available_tools=[herramienta.name for herramienta in herramientas],
                on_permission_request=denegar_permiso,
                working_directory=directorio,
                enable_config_discovery=False,
                enable_session_store=False,
                enable_skills=False,
                enable_host_git_operations=False,
            )
            respuesta = await sesion.send_and_wait(cuerpo['prompt'], timeout=30)
            texto = respuesta.data.content if respuesta else ''
            if not texto or (herramientas and not consultados):
                raise ValueError('Respuesta sin hechos consultados.')
            return {'respuesta': texto, 'consultados': consultados}
        finally:
            await cliente.stop()


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    logging.disable(logging.CRITICAL)
    try:
        datos = asyncio.run(ejecutar(json.load(sys.stdin)))
        print(json.dumps(datos))
    except Exception as exc:
        print(json.dumps({
            'error': type(exc).__name__,
            'errno': exc.errno if isinstance(exc, OSError) else None,
            'archivo': Path(exc.filename).name if isinstance(exc, OSError) and exc.filename else None,
        }))
        sys.exit(1)
