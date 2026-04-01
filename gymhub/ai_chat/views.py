import logging

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db import OperationalError, ProgrammingError
from django.db import IntegrityError
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from alerts.models import Notification
from users.models import MemberProfile
from users.services import (
    get_active_prescription,
    get_member_dashboard_summary,
    get_member_prescription_status,
)

from .engine import generate_chat_response, get_engine_mode, is_local_llm_available
from .models import AIChatConversation, AIChatMessage
from .serializers import AIChatContextSerializer, AIChatInputSerializer, AIChatMessageSerializer, AIChatSendMessageSerializer

logger = logging.getLogger(__name__)

SCHEMA_ERRORS = (ProgrammingError, OperationalError)


def _get_mode_for_user(user):
    if user.role == 'member':
        return 'member'
    if user.role == 'trainer' or user.is_staff:
        return 'trainer_member'
    return None


def _get_daily_limit(mode):
    if mode == 'trainer_member':
        return getattr(settings, 'AI_DAILY_LIMIT_TRAINER', 60)
    return getattr(settings, 'AI_DAILY_LIMIT_MEMBER', getattr(settings, 'AI_DAILY_LIMIT_PER_USER', 20))


def _get_history_window():
    return getattr(settings, 'AI_CHAT_HISTORY_WINDOW', 10)


def _serialize_member_context(member, summary, prescription_status):
    return {
        'id': member.id,
        'full_name': member.user.get_full_name() or member.user.email,
        'email': member.user.email,
        'riesgo_adherencia': summary['riesgo_personal']['score'],
        'nivel_riesgo': summary['riesgo_personal']['level'],
        'siguiente_accion': summary['siguiente_accion'],
        'estado_prescripcion': prescription_status['estado'],
        'trainer_asignado_nombre': (
            member.trainer_asignado.user.get_full_name()
            if member.trainer_asignado_id and member.trainer_asignado and member.trainer_asignado.user
            else None
        ),
    }


def _serialize_summary_context(summary, active_prescription):
    return {
        'active_plan_name': summary['active_plan']['name'] if summary['active_plan'] else None,
        'today_has_workout': summary['today_has_workout'],
        'resumen_hoy': summary['resumen_hoy'],
        'payment_status': summary['payment_status'],
        'nutrition_goal': summary['nutrition_goal'],
        'weekly_sessions_done': summary['weekly_sessions_done'],
        'streak_asistencia': summary['streak_asistencia'],
        'cumplimiento_semanal': summary['cumplimiento_semanal'],
        'inactivity_alert': summary['inactivity_alert'],
        'tiene_plan_activo': active_prescription['estado_prescripcion']['tiene_plan_activo'],
        'prescripcion_lista': active_prescription['estado_prescripcion']['esta_lista_para_member'],
    }


def _get_suggested_prompts(mode, summary):
    plan_name = summary['active_plan']['name'] if summary['active_plan'] else 'mi plan actual'
    if mode == 'trainer_member':
        return [
            'Resume el riesgo principal de este cliente y qué debo intervenir hoy.',
            'Escribe un mensaje corto para motivar a este cliente a retomar adherencia.',
            f'¿Qué ajuste táctico recomiendas para la próxima sesión de {plan_name}?',
            'Explícame cómo abordar nutrición y pagos sin generar fricción.',
        ]

    prompts = [
        f'¿Qué debería priorizar hoy en {plan_name}?',
        'Explícame mi siguiente acción en palabras simples.',
        '¿Cómo puedo mejorar mi adherencia esta semana?',
    ]
    if summary['nutrition_goal']:
        prompts.append('Dame una recomendación simple de nutrición para hoy.')
    return prompts


def _build_recent_transcript(conversation):
    window = _get_history_window()
    messages = list(conversation.messages.order_by('-created_at', '-id')[:window])
    messages.reverse()
    if not messages:
        return 'Sin historial reciente.'
    return '\n'.join(
        f"{'Usuario' if message.role == 'user' else 'Asistente'}: {message.content}"
        for message in messages
    )


def _count_messages_today(user, mode):
    today = timezone.localdate()
    query = AIChatMessage.objects.filter(
        conversation__usuario=user,
        role='user',
        created_at__date=today,
    )
    if mode == 'member':
        query = query.filter(conversation__modo='member')
    elif mode == 'trainer_member':
        query = query.filter(conversation__modo='trainer_member')
    return query.count()


def _remaining_messages(user, mode):
    limit = _get_daily_limit(mode)
    return max(limit - _count_messages_today(user, mode), 0), limit


def _resolve_member_for_request(user, member_id=None):
    mode = _get_mode_for_user(user)
    if mode == 'member':
        try:
            return user.memberprofile, mode, None
        except ObjectDoesNotExist:
            logger.warning('AI chat sin memberprofile para user_id=%s', user.id)
            return None, mode, Response({'error': 'Perfil de miembro no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    if mode != 'trainer_member':
        return None, None, Response({'error': 'Rol no permitido.'}, status=status.HTTP_403_FORBIDDEN)

    if not member_id:
        return None, mode, None

    try:
        member = MemberProfile.objects.select_related('user', 'trainer_asignado__user').get(id=member_id)
    except MemberProfile.DoesNotExist:
        return None, mode, Response({'error': 'Miembro no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    if user.is_staff:
        return member, mode, None

    try:
        trainer_profile = user.trainerprofile
    except ObjectDoesNotExist:
        return None, mode, Response({'error': 'Perfil de trainer no encontrado.'}, status=status.HTTP_403_FORBIDDEN)

    if member.trainer_asignado_id != trainer_profile.id:
        return None, mode, Response({'error': 'No puedes consultar este miembro.'}, status=status.HTTP_403_FORBIDDEN)

    return member, mode, None


def _get_conversation(user, member, mode, conversation_id=None):
    if conversation_id:
        try:
            return AIChatConversation.objects.select_related('member__user', 'usuario').get(
                id=conversation_id,
                usuario=user,
                member=member,
                modo=mode,
            )
        except AIChatConversation.DoesNotExist:
            return None

    conversation, _ = AIChatConversation.objects.get_or_create(
        usuario=user,
        member=member,
        modo=mode,
        defaults={'updated_at': timezone.now()},
    )
    return conversation


def _build_context_payload(user, member, mode, conversation):
    remaining, limit = _remaining_messages(user, mode)
    engine_mode = get_engine_mode()
    local_llm_available = is_local_llm_available()

    if member is None:
        payload = {
            'mode': mode,
            'conversation_id': None,
            'limit': limit,
            'remaining_messages': remaining,
            'requires_member_selection': True,
            'fallback_available': True,
            'engine_mode': engine_mode,
            'local_llm_available': local_llm_available,
            'response_source': 'rules',
            'suggested_prompts': [],
            'member': None,
            'summary': None,
        }
        return AIChatContextSerializer(payload).data

    summary = get_member_dashboard_summary(member)
    active_prescription = get_active_prescription(member)
    prescription_status = get_member_prescription_status(member)
    payload = {
        'mode': mode,
        'conversation_id': conversation.id if conversation else None,
        'limit': limit,
        'remaining_messages': remaining,
        'requires_member_selection': False,
        'fallback_available': True,
        'engine_mode': engine_mode,
        'local_llm_available': local_llm_available,
        'response_source': 'local_model' if local_llm_available and engine_mode == 'local_hybrid' else 'rules',
        'suggested_prompts': _get_suggested_prompts(mode, summary),
        'member': _serialize_member_context(member, summary, prescription_status),
        'summary': _serialize_summary_context(summary, active_prescription),
    }
    return AIChatContextSerializer(payload).data


def _build_degraded_context_payload(user, mode, member=None):
    remaining, limit = _remaining_messages(user, mode)
    payload = {
        'mode': mode,
        'conversation_id': None,
        'limit': limit,
        'remaining_messages': remaining,
        'requires_member_selection': mode == 'trainer_member' and member is None,
        'fallback_available': True,
        'engine_mode': get_engine_mode(),
        'local_llm_available': False,
        'response_source': 'rules',
        'suggested_prompts': [],
        'member': None,
        'summary': None,
    }
    return AIChatContextSerializer(payload).data


class AIChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        input_ser = AIChatInputSerializer(data=request.data)
        if not input_ser.is_valid():
            return Response(input_ser.errors, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        member_id = input_ser.validated_data.get('member_id')
        conversation_id = input_ser.validated_data.get('conversation_id')
        member, mode, error_response = _resolve_member_for_request(user, member_id)
        if error_response:
            return error_response
        if member is None:
            return Response(
                {'error': 'Selecciona un miembro para usar el copiloto IA.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        remaining, limit = _remaining_messages(user, mode)
        if remaining <= 0:
            return Response({
                'role': 'assistant',
                'content': 'Has alcanzado el límite diario.',
                'limit_reached': True,
                'remaining_messages': 0,
                'limit': limit,
                'mode': mode,
                'fallback_used': False,
                'engine_mode': get_engine_mode(),
                'local_llm_used': False,
                'response_source': 'rules',
            }, status=status.HTTP_200_OK)

        conversation = _get_conversation(user, member, mode, conversation_id)
        if conversation is None:
            return Response({'error': 'Conversación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        user_message = input_ser.validated_data['message']
        summary = get_member_dashboard_summary(member)
        prescription_status = get_member_prescription_status(member)

        AIChatMessage.objects.create(
            conversation=conversation,
            member=member,
            role='user',
            content=user_message,
            tokens_used=0,
        )
        AIChatConversation.objects.filter(id=conversation.id).update(updated_at=timezone.now())

        transcript = _build_recent_transcript(conversation)
        generation = generate_chat_response(
            mode=mode,
            member=member,
            summary=summary,
            prescription_status=prescription_status,
            transcript=transcript,
            user_message=user_message,
        )

        tokens_estimated = len(generation.content) // 4
        message = AIChatMessage.objects.create(
            conversation=conversation,
            member=member,
            role='assistant',
            content=generation.content,
            tokens_used=tokens_estimated,
        )
        AIChatConversation.objects.filter(id=conversation.id).update(updated_at=timezone.now())

        updated_remaining, _ = _remaining_messages(user, mode)
        return Response({
            'role': 'assistant',
            'content': generation.content,
            'tokens_used': tokens_estimated,
            'message_id': message.id,
            'conversation_id': conversation.id,
            'mode': mode,
            'fallback_used': generation.engine_mode == 'local_hybrid' and generation.response_source == 'rules',
            'engine_mode': generation.engine_mode,
            'local_llm_used': generation.local_llm_used,
            'response_source': generation.response_source,
            'sendable': generation.sendable,
            'message_text': generation.message_text,
            'priority_detected': generation.priority_detected,
            'suggested_prompts': _get_suggested_prompts(mode, summary),
            'remaining_messages': updated_remaining,
            'limit': limit,
        }, status=status.HTTP_200_OK)


class AIChatSendMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AIChatSendMessageSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        member_id = serializer.validated_data['member_id']
        member, mode, error_response = _resolve_member_for_request(request.user, member_id)
        if error_response:
            return error_response
        if mode != 'trainer_member' or member is None:
            return Response({'error': 'Solo trainers pueden enviar mensajes a miembros.'}, status=status.HTTP_403_FORBIDDEN)

        message_text = serializer.validated_data['message_text'].strip()
        conversation_id = serializer.validated_data.get('conversation_id')
        source_message_id = serializer.validated_data.get('source_message_id')

        dedupe_key = ''
        if source_message_id:
            dedupe_key = f'trainer_message:{request.user.id}:{member.id}:{source_message_id}'

        existing_notification = Notification.objects.filter(dedupe_key=dedupe_key).first() if dedupe_key else None
        if existing_notification:
            return Response({
                'sent': True,
                'already_sent': True,
                'notification_id': existing_notification.id,
                'message_text': existing_notification.message,
            }, status=status.HTTP_200_OK)

        try:
            notification = Notification.objects.create(
                user=member.user,
                message=message_text,
                type='trainer_message',
                dedupe_key=dedupe_key,
            )
        except IntegrityError:
            notification = Notification.objects.get(dedupe_key=dedupe_key)
            return Response({
                'sent': True,
                'already_sent': True,
                'notification_id': notification.id,
                'message_text': notification.message,
            }, status=status.HTTP_200_OK)

        if conversation_id:
            conversation = _get_conversation(request.user, member, mode, conversation_id)
            if conversation is not None:
                AIChatMessage.objects.create(
                    conversation=conversation,
                    member=member,
                    role='assistant',
                    content=f'Mensaje enviado al member: {message_text}',
                    tokens_used=0,
                )
                AIChatConversation.objects.filter(id=conversation.id).update(updated_at=timezone.now())

        return Response({
            'sent': True,
            'already_sent': False,
            'notification_id': notification.id,
            'message_text': notification.message,
        }, status=status.HTTP_200_OK)


class AIChatHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        member_id = request.query_params.get('member_id')
        member, mode, error_response = _resolve_member_for_request(request.user, member_id)
        if error_response:
            return error_response
        if member is None:
            return Response([], status=status.HTTP_200_OK)

        try:
            conversation = _get_conversation(request.user, member, mode)
            messages = conversation.messages.select_related('conversation').order_by('created_at', 'id')[:50]
            return Response(AIChatMessageSerializer(messages, many=True).data)
        except SCHEMA_ERRORS:
            logger.exception('AI chat history degradado por esquema desalineado')
            return Response([], status=status.HTTP_200_OK)


class AIChatContextView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        member_id = request.query_params.get('member_id')
        member, mode, error_response = _resolve_member_for_request(request.user, member_id)
        if error_response:
            return error_response

        try:
            conversation = _get_conversation(request.user, member, mode) if member is not None else None
            return Response(_build_context_payload(request.user, member, mode, conversation))
        except SCHEMA_ERRORS:
            logger.exception('AI chat context degradado por esquema desalineado')
            return Response(_build_degraded_context_payload(request.user, mode, member), status=status.HTTP_200_OK)
