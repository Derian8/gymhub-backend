import json
import logging
from dataclasses import dataclass
from urllib import error, request

from django.conf import settings

logger = logging.getLogger(__name__)


INTENT_WORKOUT = 'workout'
INTENT_ADHERENCE = 'adherence'
INTENT_NUTRITION = 'nutrition'
INTENT_PAYMENT = 'payment'
INTENT_CLIENT_MESSAGE = 'client_message'
INTENT_FULL_ANALYSIS = 'full_analysis'
INTENT_PROGRESS = 'progress'
INTENT_ATTENDANCE = 'attendance'
INTENT_LAST_30_DAYS = 'last_30_days'
INTENT_RISKS = 'risks'
INTENT_NEXT_ACTION = 'next_action'
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
    intent_detected: str = ''


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

    if any(keyword in content for keyword in ('últimos 30', 'ultimos 30', '30 días', '30 dias')):
        return INTENT_LAST_30_DAYS
    if any(keyword in content for keyword in ('progreso', 'peso', 'medidas', 'medición', 'medicion', 'grasa', 'musculo', 'músculo')):
        return INTENT_PROGRESS
    if any(keyword in content for keyword in ('asistencia', 'asist', 'check-in', 'checkin', 'inactividad', 'constancia')):
        return INTENT_ATTENDANCE
    if any(keyword in content for keyword in ('riesgo', 'riesgos', 'alerta', 'alertas')):
        return INTENT_RISKS
    if any(keyword in content for keyword in ('qué debería hacer', 'que deberia hacer', 'debo hacer', 'siguiente paso', 'accion', 'acción')):
        return INTENT_NEXT_ACTION
    if any(keyword in content for keyword in (
        'analiza',
        'analisis',
        'análisis',
        'lectura del caso',
        'caso completo',
        'resume completo',
        'que esta pasando',
        'qué está pasando',
        'prioriza',
    )):
        return INTENT_FULL_ANALYSIS
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


def build_deterministic_response(mode, member, summary, prescription_status, analysis_context, user_message, trainer_assistant=None):
    intent = detect_intent(user_message, mode)
    if mode == 'trainer_member':
        return _build_trainer_response(member, summary, prescription_status, analysis_context, intent, trainer_assistant)
    return {
        'content': _build_member_response(summary, prescription_status, analysis_context, intent),
        'sendable': False,
        'message_text': '',
        'priority_detected': '',
        'intent_detected': intent,
    }


def generate_chat_response(mode, member, summary, prescription_status, analysis_context, transcript, user_message, trainer_assistant=None):
    deterministic_response = build_deterministic_response(
        mode=mode,
        member=member,
        summary=summary,
        prescription_status=prescription_status,
        analysis_context=analysis_context,
        user_message=user_message,
        trainer_assistant=trainer_assistant,
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
            intent_detected=deterministic_response['intent_detected'],
        )

    rewritten = _rewrite_with_local_llm(
        mode=mode,
        member=member,
        summary=summary,
        analysis_context=analysis_context,
        trainer_assistant=trainer_assistant,
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
            intent_detected=deterministic_response['intent_detected'],
        )

    return ChatGenerationResult(
        content=deterministic_content,
        engine_mode='local_hybrid',
        local_llm_used=False,
        response_source='rules',
        sendable=deterministic_response['sendable'],
        message_text=deterministic_response['message_text'],
        priority_detected=deterministic_response['priority_detected'],
        intent_detected=deterministic_response['intent_detected'],
    )


def _build_member_response(summary, prescription_status, analysis_context, intent):
    return _join_sections([
        ('Lectura del caso', _member_case_read(summary, analysis_context, intent)),
        ('Factores clave', _member_key_factors(summary, prescription_status, analysis_context, intent)),
        ('Riesgos o fricciones', _member_friction_points(summary, prescription_status, analysis_context)),
        ('Acción recomendada', _member_recommended_action(summary, analysis_context, intent)),
    ])


def _build_trainer_response(member, summary, prescription_status, analysis_context, intent, trainer_assistant=None):
    if trainer_assistant:
        return _build_trainer_assistant_response(member, summary, prescription_status, analysis_context, intent, trainer_assistant)

    client_name = member.user.get_full_name() or member.user.email
    priority = _detect_trainer_priority(summary)
    prescription_text = _prescription_guidance(prescription_status)

    if intent == INTENT_CLIENT_MESSAGE:
        message_text = _build_client_message(summary, priority, prescription_text)
        return {
            'content': _join_sections([
                ('Lectura del caso', _trainer_case_read(client_name, summary, analysis_context, INTENT_FULL_ANALYSIS)),
                ('Factores clave', _trainer_key_factors(summary, prescription_status, analysis_context, priority)),
                ('Riesgos o fricciones', _trainer_friction_points(summary, prescription_status, analysis_context, priority)),
                ('Acción recomendada', 'Pide una acción mínima hoy y confirma respuesta o bloqueo real del member.'),
                ('Mensaje sugerido', message_text),
            ]),
            'sendable': True,
            'message_text': message_text,
            'priority_detected': priority,
            'intent_detected': intent,
        }

    return {
        'content': _join_sections([
            ('Lectura del caso', _trainer_case_read(client_name, summary, analysis_context, intent)),
            ('Factores clave', _trainer_key_factors(summary, prescription_status, analysis_context, priority)),
            ('Riesgos o fricciones', _trainer_friction_points(summary, prescription_status, analysis_context, priority)),
            ('Acción recomendada', _trainer_recommended_action(summary, prescription_status, analysis_context, intent)),
        ]),
        'sendable': False,
        'message_text': '',
        'priority_detected': priority,
        'intent_detected': intent,
    }


def _build_trainer_assistant_response(member, summary, prescription_status, analysis_context, intent, trainer_assistant):
    client_name = member.user.get_full_name() or member.user.email
    dossier = trainer_assistant['dossier']
    priority = _detect_trainer_priority(summary)
    missing = trainer_assistant.get('missing_data') or []

    if _is_out_of_scope(intent, summary, analysis_context):
        return {
            'content': (
                'Alcance del asistente: Solo puedo analizar datos registrados en GymHub para este miembro. '
                f'Datos disponibles ahora: asistencia, membresía, pagos, rutina, progreso y alertas. '
                f'Datos faltantes: {", ".join(missing) if missing else "ninguno crítico"}.' 
            ),
            'sendable': False,
            'message_text': '',
            'priority_detected': priority,
            'intent_detected': intent,
        }

    if intent == INTENT_CLIENT_MESSAGE:
        message_text = _build_client_message(summary, priority, _prescription_guidance(prescription_status))
        content = _join_sections([
            ('Lectura del caso', _trainer_assistant_case_read(client_name, trainer_assistant)),
            ('Datos usados', _available_data_sentence(trainer_assistant)),
            ('Mensaje sugerido', message_text),
        ])
        return {
            'content': content,
            'sendable': True,
            'message_text': message_text,
            'priority_detected': priority,
            'intent_detected': intent,
        }

    section_builders = {
        INTENT_PROGRESS: _trainer_progress_read,
        INTENT_ATTENDANCE: _trainer_attendance_read,
        INTENT_WORKOUT: _trainer_training_read,
        INTENT_PAYMENT: _trainer_payment_read,
        INTENT_RISKS: _trainer_risk_read,
        INTENT_NEXT_ACTION: _trainer_next_action_read,
        INTENT_LAST_30_DAYS: _trainer_last_30_days_read,
        INTENT_FULL_ANALYSIS: _trainer_full_read,
        INTENT_GENERAL: _trainer_full_read,
        INTENT_NUTRITION: _trainer_full_read,
        INTENT_ADHERENCE: _trainer_attendance_read,
    }
    content = section_builders.get(intent, _trainer_full_read)(client_name, trainer_assistant, prescription_status)
    if missing:
        content = f"{content}\n\nInformación faltante: No hay datos suficientes de {', '.join(missing)}. No los voy a inventar."
    return {
        'content': content,
        'sendable': False,
        'message_text': '',
        'priority_detected': priority,
        'intent_detected': intent,
    }


def _is_out_of_scope(intent, summary, analysis_context):
    return False


def _available_data_sentence(trainer_assistant):
    missing = trainer_assistant.get('missing_data') or []
    if not missing:
        return 'Usé perfil, membresía, pagos, asistencia, rutina, sesiones, progreso y alertas registradas.'
    return f'Usé los datos disponibles en GymHub. Faltan registros de {", ".join(missing)}.'


def _status_label(status):
    return {
        'excellent': 'Excelente',
        'needs_follow_up': 'Requiere seguimiento',
        'immediate_attention': 'Atención inmediata',
    }.get(status, 'Requiere seguimiento')


def _trainer_assistant_case_read(client_name, trainer_assistant):
    insights = trainer_assistant['detected_insights']
    insight_text = '; '.join(item['title'] for item in insights[:4]) or 'sin señales críticas registradas'
    return (
        f"{client_name} tiene estado general {_status_label(trainer_assistant['overall_status'])}. "
        f"Lo detectado: {insight_text}."
    )


def _trainer_full_read(client_name, trainer_assistant, prescription_status):
    dossier = trainer_assistant['dossier']
    return _join_sections([
        ('Lectura del caso', _trainer_assistant_case_read(client_name, trainer_assistant)),
        ('Asistencia', _attendance_sentence(dossier)),
        ('Membresía y pagos', _payment_sentence(dossier)),
        ('Entrenamiento', _training_sentence(dossier)),
        ('Progreso', _progress_sentence(dossier)),
        ('Acción recomendada', _next_action_sentence(dossier, prescription_status)),
    ])


def _trainer_progress_read(client_name, trainer_assistant, prescription_status):
    dossier = trainer_assistant['dossier']
    return _join_sections([
        ('Progreso físico', _progress_sentence(dossier)),
        ('Entrenamiento registrado', _training_sentence(dossier)),
        ('Lectura', 'Si faltan mediciones o registros de carga, no hay base suficiente para afirmar progreso real.'),
    ])


def _trainer_attendance_read(client_name, trainer_assistant, prescription_status):
    dossier = trainer_assistant['dossier']
    return _join_sections([
        ('Asistencia', _attendance_sentence(dossier)),
        ('Riesgo de adherencia', _risk_sentence(dossier)),
        ('Acción recomendada', _next_action_sentence(dossier, prescription_status)),
    ])


def _trainer_training_read(client_name, trainer_assistant, prescription_status):
    dossier = trainer_assistant['dossier']
    return _join_sections([
        ('Rutina', _training_sentence(dossier)),
        ('Ejercicios destacados', _exercise_highlights_sentence(dossier)),
        ('Acción recomendada', _next_action_sentence(dossier, prescription_status)),
    ])


def _trainer_payment_read(client_name, trainer_assistant, prescription_status):
    dossier = trainer_assistant['dossier']
    return _join_sections([
        ('Membresía y pagos', _payment_sentence(dossier)),
        ('Acceso', f"Check-in permitido: {'sí' if dossier['membership']['can_check_in'] else 'no'}."),
        ('Acción recomendada', 'Si hay pago pendiente o vencido, resuelve esa fricción antes de exigir continuidad de entrenamiento.'),
    ])


def _trainer_risk_read(client_name, trainer_assistant, prescription_status):
    dossier = trainer_assistant['dossier']
    insights = trainer_assistant['detected_insights']
    risks = [item for item in insights if item['severity'] in {'critical', 'warning'}]
    risk_text = '; '.join(f"{item['title']}: {item['detail']}" for item in risks) or 'No hay riesgos críticos visibles con los datos actuales.'
    return _join_sections([
        ('Riesgos detectados', risk_text),
        ('Base de datos usada', _available_data_sentence(trainer_assistant)),
        ('Acción recomendada', _next_action_sentence(dossier, prescription_status)),
    ])


def _trainer_next_action_read(client_name, trainer_assistant, prescription_status):
    dossier = trainer_assistant['dossier']
    return _join_sections([
        ('Prioridad', _trainer_assistant_case_read(client_name, trainer_assistant)),
        ('Qué hacer', _next_action_sentence(dossier, prescription_status)),
    ])


def _trainer_last_30_days_read(client_name, trainer_assistant, prescription_status):
    dossier = trainer_assistant['dossier']
    return _join_sections([
        ('Últimos 30 días', (
            f"{dossier['attendance']['checkins_last_30_days']} asistencias, "
            f"{dossier['training']['completed_sessions_last_30_days']} sesiones completadas y "
            f"{dossier['payments']['pending_count']} pagos pendientes."
        )),
        ('Tendencia', _attendance_sentence(dossier)),
        ('Progreso', _progress_sentence(dossier)),
        ('Acción recomendada', _next_action_sentence(dossier, prescription_status)),
    ])


def _attendance_sentence(dossier):
    attendance = dossier['attendance']
    days = attendance['days_since_last_attendance']
    if days is None:
        return 'No hay asistencias registradas; no puedo evaluar frecuencia real.'
    trend = {
        'increasing': 'aumentó',
        'decreasing': 'disminuyó',
        'stable': 'se mantuvo estable',
    }.get(attendance['trend'], 'no tiene tendencia clara')
    return (
        f"Última asistencia hace {days} días. "
        f"Registró {attendance['checkins_last_30_days']} check-ins en 30 días "
        f"({attendance['weekly_average_last_30_days']} por semana); la frecuencia {trend} frente al periodo anterior."
    )


def _payment_sentence(dossier):
    membership = dossier['membership']
    payments = dossier['payments']
    plan = membership['plan_name'] or 'sin membresía registrada'
    status = membership['status'] or 'sin estado'
    days = membership['days_remaining']
    due_text = f"vence en {days} días" if days is not None else 'sin fecha de vencimiento visible'
    return (
        f"Membresía: {plan}, estado {status}, {due_text}. "
        f"Pagos pendientes: {payments['pending_count']}; vencidos: {payments['late_count']}."
    )


def _training_sentence(dossier):
    training = dossier['training']
    if not training['active_plan']:
        return 'No hay plan activo registrado; no puedo analizar rutina real.'
    return (
        f"Plan activo: {training['active_plan']['name']} con {training['days_count']} días y "
        f"{training['exercise_count']} ejercicios. Completó {training['completed_sessions_last_30_days']} sesiones en 30 días. "
        f"Sesión de hoy: {training['today_workout_name'] or 'sin sesión visible'}."
    )


def _exercise_highlights_sentence(dossier):
    highlights = dossier['training']['exercise_highlights']
    if not highlights:
        return 'No hay ejercicios registrados recientemente para comparar cargas, RPE o volumen.'
    return '; '.join(
        f"{item['name']} ({item['sessions']} sesiones, carga máx. {item['max_weight_kg'] or 'sin dato'} kg)"
        for item in highlights[:4]
    )


def _progress_sentence(dossier):
    progress = dossier['progress']['physical_summary']
    if progress['latest_log_id'] is None:
        return 'No hay medidas físicas registradas; no puedo afirmar cambios de peso o composición.'
    change = progress['weight_change_kg']
    change_text = f"cambio de {change} kg" if change is not None else 'sin comparación previa de peso'
    return (
        f"Última medición: {progress['latest_recorded_at']}. Peso actual {progress['current_weight_kg'] or 'sin dato'} kg, "
        f"{change_text}, cintura {progress['waist_cm'] or 'sin dato'} cm."
    )


def _risk_sentence(dossier):
    risk = dossier['summary']['riesgo_personal']
    reasons = ', '.join(risk['reasons']) or 'sin motivos registrados'
    return f"Riesgo {risk['level']} ({risk['score']}/100). Motivos: {reasons}."


def _next_action_sentence(dossier, prescription_status):
    if dossier['payments']['late_count']:
        return 'Primero regulariza el pago vencido y luego acuerda una acción mínima de retorno.'
    if dossier['alerts']['has_open_alert'] or (dossier['attendance']['days_since_last_attendance'] or 0) >= 15:
        return 'Contacta hoy, registra el contacto y acuerda una fecha concreta de regreso.'
    if not dossier['training']['active_plan'] or prescription_status['estado'] != 'lista':
        return 'Completa o actualiza la rutina antes de pedir ejecución.'
    if dossier['progress']['days_since_last_measurement'] is None or dossier['progress']['days_since_last_measurement'] >= 30:
        return 'Agenda una medición física para tener base objetiva de progreso.'
    return 'Mantén seguimiento semanal y refuerza la constancia actual.'


def _detect_trainer_priority(summary):
    payment_status = summary['payment_status']
    if payment_status in ('late', 'pending'):
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


def _payment_guidance(summary, analysis_context):
    payment_status = summary['payment_status']
    if payment_status == 'late':
        if analysis_context.get('days_overdue') is not None:
            return f"Hay mora activa desde hace {analysis_context['days_overdue']} días y eso puede frenar la adherencia."
        return 'Hay mora activa y eso puede frenar la adherencia.'
    if payment_status == 'pending':
        if analysis_context.get('days_until_due') is not None:
            return f"Hay un pago pendiente con vencimiento en {analysis_context['days_until_due']} días."
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


def _join_sections(sections):
    return '\n\n'.join(f'{title}: {content}' for title, content in sections if content)


def _member_case_read(summary, analysis_context, intent):
    if intent == INTENT_PAYMENT:
        return f"Tu caso hoy tiene una fricción financiera clara. {_payment_guidance(summary, analysis_context)}"
    if intent == INTENT_NUTRITION:
        nutrition_goal = summary['nutrition_goal'] or 'un objetivo nutricional todavía no configurado'
        return f"Tu progreso hoy depende de alinear entrenamiento y alimentación; el objetivo visible apunta a {nutrition_goal}."
    if analysis_context['today_has_workout']:
        return f"{summary['resumen_hoy']} La oportunidad principal está en ejecutar y registrar esa sesión."
    return f"{summary['resumen_hoy']} La prioridad hoy es sostener adherencia y evitar perder ritmo."


def _member_key_factors(summary, prescription_status, analysis_context, intent):
    factores = [
        f"Plan activo: {analysis_context['active_plan_name'] or 'sin plan activo'}",
        f"Riesgo actual: {analysis_context['risk_level']}",
        f"Señales visibles: {', '.join(analysis_context['risk_reasons']) or 'sin alertas críticas'}",
        f"Prescripción: {_prescription_guidance(prescription_status)}",
    ]
    if analysis_context['today_workout_name']:
        factores.append(f"Entrenamiento de hoy: {analysis_context['today_workout_name']}")
    if summary['cumplimiento_semanal'] is not None:
        factores.append(f"Cumplimiento semanal: {summary['cumplimiento_semanal']}%")
    if intent == INTENT_NUTRITION and summary['nutrition_goal']:
        factores.append(f"Objetivo nutricional: {summary['nutrition_goal']}")
    return ' | '.join(factores)


def _member_friction_points(summary, prescription_status, analysis_context):
    fricciones = []
    if summary['payment_status'] in ('pending', 'late'):
        fricciones.append(_payment_guidance(summary, analysis_context))
    if analysis_context['inactivity_alert']:
        fricciones.append('Hay una alerta de inactividad abierta.')
    if prescription_status['estado'] != 'lista':
        fricciones.append(_prescription_guidance(prescription_status).capitalize() + '.')
    if analysis_context['unread_notifications']:
        fricciones.append(f"Tienes {analysis_context['unread_notifications']} notificaciones sin revisar.")
    if not fricciones:
        fricciones.append('No hay bloqueos críticos visibles; la clave es ejecutar una acción concreta hoy.')
    return ' '.join(fricciones)


def _member_recommended_action(summary, analysis_context, intent):
    if intent == INTENT_NUTRITION:
        nutrition_goal = summary['nutrition_goal'] or 'tu objetivo nutricional actual'
        return (
            f"Prioriza {summary['siguiente_accion'].lower()} y acompáñalo con una comida simple alineada con {nutrition_goal}. "
            "Después registra el avance en la app."
        )
    if intent == INTENT_PAYMENT:
        return f"Regulariza o confirma tu pago y luego ejecuta esta acción concreta: {summary['siguiente_accion']}"
    return (
        f"Haz hoy exactamente esto: {summary['siguiente_accion']} "
        "Si completas ese paso, empujas tu progreso sin depender de perfección."
    )


def _trainer_case_read(client_name, summary, analysis_context, intent):
    if intent == INTENT_PAYMENT:
        return f"El bloqueo principal de {client_name} hoy es financiero. {_payment_guidance(summary, analysis_context)}"
    if intent == INTENT_NUTRITION:
        nutrition_goal = summary['nutrition_goal'] or 'un objetivo nutricional no configurado todavía'
        return f"{client_name} necesita una indicación nutricional simple; el objetivo visible apunta a {nutrition_goal}."
    return (
        f"{client_name} tiene riesgo {summary['riesgo_personal']['level']} con estas señales: "
        f"{', '.join(summary['riesgo_personal']['reasons']) or 'sin alertas críticas'}."
    )


def _trainer_key_factors(summary, prescription_status, analysis_context, priority):
    factores = [
        f"Prioridad detectada: {_priority_label(priority)}",
        f"Plan activo: {analysis_context['active_plan_name'] or 'sin plan activo'}",
        f"Siguiente acción del member: {summary['siguiente_accion']}",
        f"Prescripción: {_prescription_guidance(prescription_status)}",
    ]
    if analysis_context['today_workout_name']:
        factores.append(f"Sesión de hoy: {analysis_context['today_workout_name']}")
    if summary['cumplimiento_semanal'] is not None:
        factores.append(f"Cumplimiento semanal: {summary['cumplimiento_semanal']}%")
    return ' | '.join(factores)


def _trainer_friction_points(summary, prescription_status, analysis_context, priority):
    fricciones = []
    if summary['payment_status'] in ('pending', 'late'):
        fricciones.append(_payment_guidance(summary, analysis_context))
    if analysis_context['inactivity_alert']:
        fricciones.append('La alerta de inactividad sigue abierta.')
    if prescription_status['estado'] != 'lista':
        fricciones.append(_prescription_guidance(prescription_status).capitalize() + '.')
    if not fricciones and priority == INTENT_ADHERENCE:
        fricciones.append('No hay bloqueo operativo severo; el riesgo es de consistencia.')
    if not fricciones:
        fricciones.append('No hay bloqueos críticos adicionales visibles en la app.')
    return ' '.join(fricciones)


def _trainer_recommended_action(summary, prescription_status, analysis_context, intent):
    if intent == INTENT_PAYMENT:
        return (
            "Separa conversación de cobro y conversación de adherencia, pero cierra ambas hoy. "
            "Primero resuelve el pago; luego deja una acción mínima para no perder continuidad."
        )
    if intent == INTENT_NUTRITION:
        return (
            f"Entrega una indicación simple y medible hoy, evita complejidad si {_prescription_guidance(prescription_status).lower()}. "
            f"Luego conecta esa indicación con {summary['siguiente_accion'].lower()}."
        )
    if intent == INTENT_FULL_ANALYSIS:
        return (
            f"Intervén hoy sobre {summary['siguiente_accion'].lower()} y valida si {_prescription_guidance(prescription_status).lower()}. "
            f"Si hay fricción adicional, ordénala en este orden: pago, adherencia y ajuste táctico."
        )
    return (
        f"Prioriza {summary['siguiente_accion'].lower()} y verifica si {_prescription_guidance(prescription_status).lower()}. "
        "Después decide si toca intervenir adherencia, pago o nutrición."
    )


def _rewrite_with_local_llm(mode, member, summary, analysis_context, trainer_assistant, transcript, user_message, deterministic_response):
    if not is_local_llm_configured():
        return None

    payload = {
        'model': get_local_model(),
        'stream': False,
        'prompt': _build_local_prompt(
            mode,
            member,
            summary,
            analysis_context,
            trainer_assistant,
            transcript,
            user_message,
            deterministic_response,
        ),
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


def _build_local_prompt(mode, member, summary, analysis_context, trainer_assistant, transcript, user_message, deterministic_response):
    role = 'trainer' if mode == 'trainer_member' else 'miembro'
    trainer_context = ''
    if trainer_assistant:
        trainer_context = f"""
Estado general trainer: {trainer_assistant['overall_status']}
Insights detectados: {json.dumps(trainer_assistant['detected_insights'], ensure_ascii=False)}
Datos faltantes: {', '.join(trainer_assistant['missing_data']) or 'ninguno'}
Expediente estructurado: {json.dumps(trainer_assistant['dossier'], ensure_ascii=False, default=str)[:6000]}
"""
    return f"""Reescribe la respuesta base para GymHub.
Reglas:
- Responde en español.
- No inventes datos.
- Conserva todos los hechos de la respuesta base.
- Mantén el tono accionable y profesional.
- Usa formato de diagnostico estructurado con bloques claros.
- Máximo 5 bloques cortos.
- Si falta información, dilo claramente.
- En modo trainer, responde solo sobre el miembro y los datos del sistema.

Rol activo: {role}
Miembro: {member.user.get_full_name() or member.user.email}
Intencion detectada: {detect_intent(user_message, mode)}
Resumen de hoy: {summary['resumen_hoy']}
Siguiente acción: {summary['siguiente_accion']}
Plan activo: {analysis_context['active_plan_name'] or 'sin plan activo'}
Entrenamiento de hoy: {analysis_context['today_workout_name'] or 'sin sesion visible'}
Estado de pago: {analysis_context['payment_status'] or 'sin datos'}
Razones de riesgo: {', '.join(analysis_context['risk_reasons']) or 'sin alertas criticas'}
Prescripcion: {analysis_context['prescription_status']}
{trainer_context}
Historial reciente:
{transcript}

Mensaje del usuario:
{user_message}

Respuesta base:
{deterministic_response}
"""
