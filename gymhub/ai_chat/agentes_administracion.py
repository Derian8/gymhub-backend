import json
import logging
from urllib import error, request

from django.conf import settings

from users.services import get_admin_overview

logger = logging.getLogger(__name__)

_DECLARACIONES_HERRAMIENTAS = [
    {
        'name': 'consultar_cobranza',
        'description': 'Consulta cobros vencidos, próximos y la tasa de mora del gimnasio.',
        'parameters': {'type': 'OBJECT', 'properties': {}},
    },
    {
        'name': 'consultar_retencion',
        'description': 'Consulta señales agregadas de inactividad, riesgo y alertas abiertas.',
        'parameters': {'type': 'OBJECT', 'properties': {}},
    },
    {
        'name': 'consultar_entrenamiento',
        'description': 'Consulta cobertura de rutinas, prescripciones y sesiones recientes.',
        'parameters': {'type': 'OBJECT', 'properties': {}},
    },
    {
        'name': 'consultar_crecimiento',
        'description': 'Consulta miembros activos, altas nuevas e ingresos del gimnasio.',
        'parameters': {'type': 'OBJECT', 'properties': {}},
    },
]


def generar_analisis_administrativo(usuario, pregunta):
    """Coordina agentes especialistas de solo lectura con respaldo por reglas."""
    resumen = get_admin_overview(usuario)
    agentes = _construir_agentes(resumen)
    respuesta_reglas = _resumir_por_reglas(agentes)
    api_key = getattr(settings, 'GEMINI_API_KEY', '')

    if not api_key or getattr(settings, 'AI_PROVIDER', '') != 'gemini_hybrid':
        return _resultado(respuesta_reglas, agentes, [], 'rules', None)

    try:
        respuesta, consultados = _consultar_gemini(pregunta, resumen, api_key)
        return _resultado(respuesta, agentes, consultados, 'gemini', None)
    except error.HTTPError as exc:
        # No registrar cuerpo ni URL del proveedor para evitar filtrar credenciales.
        logger.info('Gemini no disponible para agentes administrativos (HTTP %s).', exc.code)
        return _resultado(respuesta_reglas, agentes, [], 'rules', exc.code)
    except (error.URLError, TimeoutError, OSError, ValueError, KeyError, IndexError, TypeError, json.JSONDecodeError):
        logger.info('No se pudo generar análisis Gemini para agentes administrativos.')
        return _resultado(respuesta_reglas, agentes, [], 'rules', None)


def _construir_agentes(resumen):
    mora = resumen.get('payments_overdue', 0)
    vencen = resumen.get('payments_due_soon', 0)
    riesgo = len(resumen.get('miembros_en_riesgo', []))
    inactivos = resumen.get('members_inactive_30d', 0)
    alertas = resumen.get('pending_alerts', 0)
    sin_plan = resumen.get('members_without_active_plan', 0)
    prescripciones_incompletas = resumen.get('incomplete_prescriptions', 0)
    progreso_pendiente = resumen.get('members_without_progress_recently', 0)

    return [
        {
            'id': 'cobranza',
            'nombre': 'Cobranza',
            'prioridad': 'alta' if mora else 'media' if vencen else 'normal',
            'hallazgo': f'{mora} cobros vencidos, {vencen} por vencer y {resumen.get("late_rate_pct", 0)}% de mora.',
            'siguiente_paso': 'Revisar pagos vencidos y contactar a quienes deben renovar.' if mora or vencen else 'Mantener seguimiento de los próximos vencimientos.',
        },
        {
            'id': 'retencion',
            'nombre': 'Retención',
            'prioridad': 'alta' if alertas or inactivos else 'media' if riesgo else 'normal',
            'hallazgo': f'{inactivos} miembros sin asistencia en 30 días, {alertas} alertas abiertas y {riesgo} en la lista de mayor riesgo.',
            'siguiente_paso': 'Priorizar contacto y registrar resultado del seguimiento.' if alertas or inactivos or riesgo else 'La asistencia no muestra alertas agregadas prioritarias.',
        },
        {
            'id': 'entrenamiento',
            'nombre': 'Entrenamiento',
            'prioridad': 'alta' if sin_plan else 'media' if prescripciones_incompletas or progreso_pendiente else 'normal',
            'hallazgo': f'{sin_plan} miembros sin rutina activa, {prescripciones_incompletas} prescripciones incompletas y {progreso_pendiente} sin progreso reciente.',
            'siguiente_paso': 'Completar primero rutinas faltantes y prescripciones incompletas.' if sin_plan or prescripciones_incompletas else 'Actualizar mediciones y revisar sesiones recientes.',
        },
        {
            'id': 'crecimiento',
            'nombre': 'Crecimiento',
            'prioridad': 'normal',
            'hallazgo': f'{resumen.get("new_members_this_month", 0)} altas este mes; ingresos registrados {resumen.get("revenue_this_month", 0)} y MRR estimado {resumen.get("estimated_mrr", 0)}.',
            'siguiente_paso': 'Comparar altas e ingresos con el mes anterior para medir tendencia.',
        },
    ]


def _resumir_por_reglas(agentes):
    urgentes = [agente for agente in agentes if agente['prioridad'] == 'alta']
    seleccionados = urgentes or agentes[:2]
    return ' '.join(
        f"{agente['nombre']}: {agente['hallazgo']} Siguiente paso: {agente['siguiente_paso']}"
        for agente in seleccionados
    )


def _resultado(respuesta, agentes, consultados, fuente, codigo_error):
    return {
        'respuesta': respuesta,
        'agentes': agentes,
        'agentes_consultados': consultados,
        'fuente': fuente,
        'respaldo_activo': fuente == 'rules',
        'codigo_proveedor': codigo_error,
    }


def _consultar_gemini(pregunta, resumen, api_key):
    model = getattr(settings, 'GEMINI_MODEL', 'gemini-3.8-flash')
    herramientas = {
        'consultar_cobranza': lambda: {
            'cobros_vencidos': resumen.get('payments_overdue', 0),
            'proximos_vencimientos': resumen.get('payments_due_soon', 0),
            'miembros_en_mora': resumen.get('members_in_mora', 0),
            'tasa_mora_pct': resumen.get('late_rate_pct', 0),
            'recaudacion_esperada': resumen.get('expected_revenue_this_month', 0),
        },
        'consultar_retencion': lambda: {
            'miembros_inactivos_30_dias': resumen.get('members_inactive_30d', 0),
            'alertas_abiertas': resumen.get('pending_alerts', 0),
            'miembros_en_riesgo': len(resumen.get('miembros_en_riesgo', [])),
        },
        'consultar_entrenamiento': lambda: {
            'miembros_sin_rutina_activa': resumen.get('members_without_active_plan', 0),
            'prescripciones_incompletas': resumen.get('incomplete_prescriptions', 0),
            'sin_progreso_reciente': resumen.get('members_without_progress_recently', 0),
            'sesiones_completadas_esta_semana': resumen.get('sessions_completed_this_week', 0),
        },
        'consultar_crecimiento': lambda: {
            'miembros_activos': resumen.get('total_active_members', 0),
            'altas_este_mes': resumen.get('new_members_this_month', 0),
            'ingresos_este_mes': resumen.get('revenue_this_month', 0),
            'mrr_estimado': resumen.get('estimated_mrr', 0),
            'asistencias_hoy': resumen.get('checked_in_today', 0),
        },
    }
    prompt = f"""Eres el coordinador de cuatro agentes especialistas para administrar un gimnasio.
Responde en español, en máximo 5 puntos breves y accionables.
Usa las herramientas para consultar hechos actuales antes de recomendar; consulta solo las áreas relacionadas con la pregunta.
No inventes cifras ni atribuyas causalidad. Distingue hechos de recomendaciones.
Las herramientas son solo de lectura: no cambies pagos, membresías, rutinas ni datos de miembros.
Los resultados contienen agregados y no incluyen nombres, correos ni datos personales.

Pregunta del administrador: {pregunta}
"""
    contenidos = [{'role': 'user', 'parts': [{'text': prompt}]}]
    consultados = []

    for _ in range(3):
        cuerpo = {
            'contents': contenidos,
            'tools': [{'functionDeclarations': _DECLARACIONES_HERRAMIENTAS}],
            'toolConfig': {'functionCallingConfig': {'mode': 'AUTO'}},
            'generationConfig': {'temperature': 0.2, 'maxOutputTokens': 450},
        }
        req = request.Request(
            f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
            data=json.dumps(cuerpo).encode('utf-8'),
            headers={'Content-Type': 'application/json', 'x-goog-api-key': api_key},
            method='POST',
        )
        with request.urlopen(req, timeout=20) as response:
            salida = json.loads(response.read().decode('utf-8'))

        candidato = salida.get('candidates', [{}])[0]
        contenido_modelo = candidato.get('content', {})
        llamadas = [parte['functionCall'] for parte in contenido_modelo.get('parts', []) if 'functionCall' in parte]
        if not llamadas:
            texto = '\n'.join(
                parte.get('text', '') for parte in contenido_modelo.get('parts', [])
            ).strip()
            if texto:
                return texto, list(dict.fromkeys(consultados))
            break

        contenidos.append(contenido_modelo)
        respuestas = []
        for llamada in llamadas:
            nombre = llamada.get('name', '')
            herramienta = herramientas.get(nombre)
            resultado = herramienta() if herramienta else {'error': 'herramienta_no_disponible'}
            if herramienta and nombre not in consultados:
                consultados.append(nombre)
            respuestas.append({
                'functionResponse': {
                    'name': nombre,
                    'response': resultado,
                },
            })
        contenidos.append({'role': 'user', 'parts': respuestas})

    raise ValueError('Gemini no produjo una respuesta final.')
