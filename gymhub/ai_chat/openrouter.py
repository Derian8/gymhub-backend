"""Acceso a modelos gratuitos de OpenRouter desde el servidor."""

import json
from urllib import request

from django.conf import settings


def consultar_openrouter(mensajes, herramientas=None, exigir_herramienta=False):
    clave = getattr(settings, 'OPENROUTER_API_KEY', '')
    modelo = getattr(settings, 'OPENROUTER_MODEL', 'openrouter/free')
    if not clave:
        raise ValueError('OpenRouter no está configurado.')
    # La demo nunca debe seleccionar un modelo de pago accidentalmente.
    if modelo != 'openrouter/free' and not modelo.endswith(':free'):
        raise ValueError('La demo requiere un modelo gratuito de OpenRouter.')
    cuerpo = {
        'model': modelo,
        'messages': mensajes,
        'max_tokens': 600,
        'temperature': 0.2,
        'reasoning': {'enabled': False},
    }
    if herramientas:
        cuerpo['tools'] = herramientas
        cuerpo['tool_choice'] = 'required' if exigir_herramienta else 'auto'
    solicitud = request.Request(
        'https://openrouter.ai/api/v1/chat/completions',
        data=json.dumps(cuerpo).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {clave}',
        },
        method='POST',
    )
    with request.urlopen(solicitud, timeout=20) as respuesta:
        salida = json.loads(respuesta.read().decode('utf-8'))
    if salida.get('error'):
        raise ValueError('OpenRouter no pudo generar la respuesta.')
    return salida['choices'][0]['message']
