import json
import logging
from dataclasses import dataclass
from typing import Optional
from urllib import error, request

from django.conf import settings

logger = logging.getLogger(__name__)


INTENT_WORKOUT = 'workout'
INTENT_ADHERENCE = 'adherence'
INTENT_NUTRITION = 'nutrition'
INTENT_PAYMENT = 'payment'
INTENT_CLIENT_MESSAGE = 'client_message'
INTENT_GENERAL = 'general'

SUPPORTED_ENGINE_MODES = ('deterministic', 'local_hybrid')


@dataclass
class ChatGenerationResult:
    content: str
    engine_mode: str
    local_llm_used: bool
    response_source: str
    sendable: bool = False
    message_text: str = ''
    priority_detected: str = ''


def get_engine_mode():
    mode = getattr(settings, 'AI_PROVIDER', 'deterministic')
    if mode not in SUPPORTED_ENGINE_MODES:
        return 'deterministic'
    return mode


def get_local_backend():
    return getattr(settings, 'AI_LOCAL_BACKEND', 'ollama')


def get_local_model():
    return getattr(settings, 'AI_LOCAL_MODEL', 'llama3.2:3b')


def get_local_base_url():
    return getattr(settings, 'AI_LOCAL_BASE_URL', 'http://host.docker.internal:11434')


def get_local_timeout_ms():
    return getattr(settings, 'AI_LOCAL_TIMEOUT_MS', 2500)


def is_local_llm_configured():
    return get_local_backend() == 'ollama' and bool(get_local_model()) and bool(get_local_base_url())


def is_local_llm_available():
    if get_engine_mode() != 'local_hybrid' or not is_local_llm_configured():
        return False

    try:
        req = request.Request(
            f"{get_local_base_url().rstrip('/')}/api/tags",
            method='GET',
        )
        with request.urlopen(req, timeout=get_local_timeout_ms() / 1000) as response:
            return response.status == 200
    except (error.URLError, TimeoutError, OSError, ValueError):
        return False


def detect_intent(message, mode):
    content = (message or '').lower()

    if mode == 'trainer_member' and any(keyword in content for keyword in ('mensaje', 'whatsapp', 'escribe', 'comunicar', 'decirle')):
        return INTENT_CLIENT_MESSAGE
    if any(keyword in content for keyword in ('pago', 'mora', 'factura', 'cobro', 'venc', 'deuda')):
        return INTENT_PAYMENT
    if any(keyword in content for keyword in ('nutri', 'comida', 'diet', 'prote', 'calor', 'hidrat', 'alimento')):
        return INTENT_NUTRITION
    if any(keyword in content for keyword in ('adher', 'constan', 'motiv', 'disciplina', 'retomar', 'racha')):
        return INTENT_ADHERENCE
    if any(keyword in content for keyword in ('rutina', 'entren', 'sesi', 'ejercicio', 'plan', 'hoy', 'foco')):
        return INTENT_WORKOUT
    return INTENT_GENERAL


def build_deterministic_response(mode, member, summary, prescription_status, user_message):
    intent = detect_intent(user_message, mode)
    if mode == 'trainer_member':
        return _build_trainer_response(member, summary, prescription_status, intent)
    return {
        'content': _build_member_response(summary, prescription_status, intent),
        'sendable': False,
        'message_text': '',
        'priority_detected': '',
    }


def generate_chat_response(mode, member, summary, prescription_status, transcript, user_message):
    deterministic_response = build_deterministic_response(
        mode=mode,
        member=member,
        summary=summary,
        prescription_status=prescription_status,
        user_message=user_message,
    )
    deterministic_content = deterministic_response['content']
    engine_mode = get_engine_mode()
    if engine_mode != 'local_hybrid':
        return ChatGenerationResult(
            content=deterministic_content,
            engine_mode='deterministic',
            local_llm_used=False,
            response_source='rules',
            sendable=deterministic_response['sendable'],
            message_text=deterministic_response['message_text'],
            priority_detected=deterministic_response['priority_detected'],
        )

    rewritten = _rewrite_with_local_llm(
        mode=mode,
        member=member,
        summary=summary,
        transcript=transcript,
        user_message=user_message,
        deterministic_response=deterministic_content,
    )
    if rewritten:
        return ChatGenerationResult(
            content=rewritten,
            engine_mode='local_hybrid',
            local_llm_used=True,
            response_source='local_model',
            sendable=deterministic_response['sendable'],
            message_text=deterministic_response['message_text'],
            priority_detected=deterministic_response['priority_detected'],
        )

    return ChatGenerationResult(
        content=deterministic_content,
        engine_mode='local_hybrid',
        local_llm_used=False,
        response_source='rules',
        sendable=deterministic_response['sendable'],
        message_text=deterministic_response['message_text'],
        priority_detected=deterministic_response['priority_detected'],
    )


def _build_member_response(summary, prescription_status, intent):
    payment_text = _payment_guidance(summary)
    prescription_text = _prescription_guidance(prescription_status)
    risk_text = _risk_sentence(summary)

    if intent == INTENT_NUTRITION:
        nutrition_goal = summary['nutrition_goal'] or 'un objetivo nutricional visible'
        return (
            f"Prioridad de hoy: alinea tu alimentación con {nutrition_goal}.\n\n"
            f"Contexto: {summary['resumen_hoy']} {risk_text} {payment_text}\n\n"
            f"Siguiente paso: mantén una comida simple y consistente antes o después de entrenar, y recuerda que {prescription_text}."
        )
    if intent == INTENT_PAYMENT:
        return (
            f"Prioridad de hoy: evita que el estado de pago afecte tu constancia.\n\n"
            f"Contexto: {payment_text} {summary['resumen_hoy']}\n\n"
            f"Siguiente paso: regulariza o confirma tu pago y luego ejecuta esta acción concreta: {summary['siguiente_accion']}"
        )
    if intent == INTENT_ADHERENCE:
        return (
            f"Prioridad de hoy: recuperar consistencia con una acción medible.\n\n"
            f"Contexto: {risk_text} {summary['resumen_hoy']} {prescription_text}.\n\n"
            f"Siguiente paso: haz hoy exactamente esto: {summary['siguiente_accion']}"
        )
    if intent == INTENT_WORKOUT:
        return (
            f"Prioridad de hoy: {summary['siguiente_accion']}\n\n"
            f"Contexto: {summary['resumen_hoy']} {risk_text}\n\n"
            f"Siguiente paso: completa tu sesión o check-in hoy y vuelve a la app para registrar el avance. Además, {prescription_text}."
        )
    return (
        f"Prioridad de hoy: {summary['siguiente_accion']}\n\n"
        f"Contexto: {summary['resumen_hoy']} {risk_text} {payment_text}\n\n"
        f"Siguiente paso: mantén una acción simple y concreta hoy. {prescription_text}."
    )


def _build_trainer_response(member, summary, prescription_status, intent):
    payment_text = _payment_guidance(summary)
    prescription_text = _prescription_guidance(prescription_status)
    risk_reasons = ', '.join(summary['riesgo_personal']['reasons']) or 'sin alertas críticas'
    client_name = member.user.get_full_name() or member.user.email
    priority = _detect_trainer_priority(summary)

    if intent == INTENT_CLIENT_MESSAGE:
        message_text = _build_client_message(summary, priority, prescription_text)
        return (
            {
                'content': (
                    f"Lectura del caso: {client_name} tiene riesgo {summary['riesgo_personal']['level']} por {risk_reasons}.\n\n"
                    f"Prioridad detectada: {_priority_label(priority)}.\n\n"
                    f"Acción recomendada: pide una acción mínima hoy y valida si {prescription_text.lower()}.\n\n"
                    f"Mensaje sugerido: {message_text}"
                ),
                'sendable': True,
                'message_text': message_text,
                'priority_detected': priority,
            }
        )
    if intent == INTENT_PAYMENT:
        return {
            'content': (
                f"Lectura del caso: el bloqueo operativo principal es financiero; {payment_text.lower()}.\n\n"
                f"Acción recomendada: separa conversación de cobro y conversación de adherencia, pero cierra ambas hoy.\n\n"
                f"Mensaje sugerido: Quiero ayudarte a mantener tu ritmo sin fricción. Revisemos tu pago pendiente y luego te dejo una acción simple para que no pierdas continuidad."
            ),
            'sendable': False,
            'message_text': '',
            'priority_detected': priority,
        }
    if intent == INTENT_NUTRITION:
        nutrition_goal = summary['nutrition_goal'] or 'un objetivo nutricional no configurado todavía'
        return {
            'content': (
                f"Lectura del caso: el contexto nutricional visible apunta a {nutrition_goal}, con señales: {risk_reasons}.\n\n"
                f"Acción recomendada: entrega una indicación simple, medible y fácil de cumplir hoy; evita complejidad si {prescription_text.lower()}.\n\n"
                f"Mensaje sugerido: Hoy enfócate en una comida alineada con tu objetivo y en completar la acción principal del día: {summary['siguiente_accion'].lower()}"
            ),
            'sendable': False,
            'message_text': '',
            'priority_detected': priority,
        }
    return {
        'content': (
            f"Lectura del caso: {client_name} tiene riesgo {summary['riesgo_personal']['level']} por {risk_reasons}.\n\n"
            f"Acción recomendada: prioriza {summary['siguiente_accion'].lower()} y verifica si {prescription_text.lower()}; además {payment_text.lower()}.\n\n"
            f"Mensaje sugerido: Hoy necesito que nos enfoquemos en un solo paso: {summary['siguiente_accion'].lower()} Si lo confirmas, te ajusto el siguiente movimiento para que recuperes consistencia."
        ),
        'sendable': False,
        'message_text': '',
        'priority_detected': priority,
    }


def _detect_trainer_priority(summary):
    payment_status = summary['payment_status']
    if payment_status == 'late':
        return INTENT_PAYMENT
    if payment_status == 'pending':
        return INTENT_PAYMENT
    risk_level = summary['riesgo_personal']['level']
    reasons = ' '.join(summary['riesgo_personal']['reasons']).lower()
    if risk_level == 'high' or 'inasistencia' in reasons or summary['inactivity_alert']:
        return INTENT_ADHERENCE
    if summary['today_has_workout'] or summary['active_plan']:
        return INTENT_WORKOUT
    return INTENT_NUTRITION


def _priority_label(priority):
    labels = {
        INTENT_PAYMENT: 'pago',
        INTENT_ADHERENCE: 'adherencia',
        INTENT_WORKOUT: 'rutina',
        INTENT_NUTRITION: 'nutrición',
    }
    return labels.get(priority, 'seguimiento')


def _build_client_message(summary, priority, prescription_text):
    if priority == INTENT_PAYMENT:
        return (
            "Necesito que hoy regularices tu pago pendiente para que no sigas sumando fricción en tu proceso. "
            "En cuanto lo confirmes, te dejo el siguiente paso más simple para retomar el ritmo."
        )
    if priority == INTENT_ADHERENCE:
        return (
            f"Hoy no quiero que intentes hacerlo perfecto; quiero que cumplas una sola acción concreta: {summary['siguiente_accion'].lower()} "
            "Respóndeme apenas lo hagas o si necesitas que te la simplifique."
        )
    if priority == INTENT_WORKOUT:
        return (
            f"Tu prioridad de hoy es {summary['siguiente_accion'].lower()} Ya tienes una base disponible en la app; "
            f"solo necesito que completes ese paso y me confirmes cómo te fue. Además, recuerda que {prescription_text.lower()}."
        )
    return (
        f"Hoy enfócate en mejorar una sola cosa: {summary['siguiente_accion'].lower()} "
        "No busques hacerlo complejo; prefiero consistencia y una mejora concreta desde hoy."
    )


def _payment_guidance(summary):
    payment_status = summary['payment_status']
    if payment_status == 'late':
        return 'Hay mora activa y eso puede frenar la adherencia.'
    if payment_status == 'pending':
        return 'Hay un pago pendiente que conviene resolver pronto.'
    if payment_status == 'paid':
        return 'No hay fricción de pago visible en este momento.'
    return 'No hay datos de pago suficientes en la app.'


def _prescription_guidance(prescription_status):
    estado = prescription_status['estado']
    if estado == 'lista':
        return 'la prescripción ya está lista para ejecutarse'
    if estado == 'incompleta':
        return 'la prescripción todavía está incompleta para el member'
    return 'todavía no hay un plan activo publicado'


def _risk_sentence(summary):
    reasons = ', '.join(summary['riesgo_personal']['reasons']) or 'sin alertas críticas'
    return (
        f"El nivel de riesgo actual es {summary['riesgo_personal']['level']} "
        f"con estas señales: {reasons}."
    )


def _rewrite_with_local_llm(mode, member, summary, transcript, user_message, deterministic_response):
    if not is_local_llm_configured():
        return None

    payload = {
        'model': get_local_model(),
        'stream': False,
        'prompt': _build_local_prompt(mode, member, summary, transcript, user_message, deterministic_response),
    }

    try:
        req = request.Request(
            f"{get_local_base_url().rstrip('/')}/api/generate",
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST',
        )
        with request.urlopen(req, timeout=get_local_timeout_ms() / 1000) as response:
            if response.status != 200:
                return None
            body = json.loads(response.read().decode('utf-8'))
            text = (body.get('response') or '').strip()
            return text or None
    except (error.URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError):
        logger.info('No se pudo usar LLM local para ai_chat', exc_info=True)
        return None


def _build_local_prompt(mode, member, summary, transcript, user_message, deterministic_response):
    role = 'trainer' if mode == 'trainer_member' else 'miembro'
    return f"""Reescribe la respuesta base para GymHub.
Reglas:
- Responde en español.
- No inventes datos.
- Conserva todos los hechos de la respuesta base.
- Mantén el tono accionable y profesional.
- Máximo 3 bloques cortos.

Rol activo: {role}
Miembro: {member.user.get_full_name() or member.user.email}
Resumen de hoy: {summary['resumen_hoy']}
Siguiente acción: {summary['siguiente_accion']}
Historial reciente:
{transcript}

Mensaje del usuario:
{user_message}

Respuesta base:
{deterministic_response}
"""
