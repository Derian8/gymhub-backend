import asyncio
from datetime import date

from asgiref.sync import async_to_sync
from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AIChatMessage
from .serializers import AIChatInputSerializer, AIChatMessageSerializer
from users.permissions import IsTrainer


def _get_api_key():
    """Retorna la API key activa: OPENAI_API_KEY si está definida, si no EMERGENT_LLM_KEY."""
    openai_key = getattr(settings, 'OPENAI_API_KEY', '')
    if openai_key and openai_key.strip():
        return openai_key.strip()
    return getattr(settings, 'EMERGENT_LLM_KEY', '')


def _build_system_context(member, request_user):
    """Construye el contexto del sistema para el asistente IA."""
    from billing.models import PaymentRecord
    from attendance.models import Attendance
    from progress.models import WorkoutSession, ProgressLog
    from datetime import timedelta

    today = date.today()
    cutoff_30d = today - timedelta(days=30)

    # Role
    role_text = f"El usuario es un {'trainer' if request_user.role == 'trainer' else 'miembro'}."

    # Training plan activo
    active_plan = member.plans.filter(is_active=True).first()
    plan_text = "Sin plan activo."
    today_workout_text = "Sin entrenamiento para hoy."
    if active_plan:
        plan_text = f"Plan activo: '{active_plan.name}', objetivo: {active_plan.goal}."
        from plans.views import get_today_workout_day
        wd = get_today_workout_day(active_plan)
        if wd:
            exercises = ', '.join(e.name for e in wd.exercises.all())
            today_workout_text = f"Entrenamiento de hoy: {wd.name} ({wd.day_label}) — Ejercicios: {exercises}."

    # Última sesión
    last_session = WorkoutSession.objects.filter(
        member=member, is_completed=True
    ).first()
    session_text = "Sin sesiones completadas recientes."
    if last_session:
        session_text = f"Última sesión: {last_session.workout_day.name} el {last_session.completed_at.date() if last_session.completed_at else last_session.started_at.date()}."

    # Asistencias últimos 30 días
    att_30d = Attendance.objects.filter(
        member=member, check_in_time__date__gte=cutoff_30d
    ).count()
    att_text = f"Asistencias últimos 30 días: {att_30d}."

    # Estado de pago
    payment_record = PaymentRecord.objects.filter(
        schedule__member=member
    ).order_by('-schedule__due_date').first()
    payment_text = "Sin registros de pago."
    if payment_record:
        payment_text = f"Estado de pago: {payment_record.status}."

    # Objetivo nutricional
    nutrition_text = "Sin perfil nutricional."
    if active_plan:
        try:
            nutrition_text = f"Objetivo nutricional: {active_plan.nutrition_profile.goal_type}, {active_plan.nutrition_profile.calorie_range_min}-{active_plan.nutrition_profile.calorie_range_max} kcal."
        except Exception:
            pass

    return f"""Eres un asistente de fitness para un gimnasio. Responde siempre en español, de manera motivadora y profesional.

CONTEXTO DEL USUARIO:
{role_text}
{plan_text}
{today_workout_text}
{session_text}
{att_text}
{payment_text}
{nutrition_text}

Solo brinda consejos generales de fitness, nutrición y motivación. NO proporciones diagnósticos médicos ni consejos médicos específicos.
Sé conciso (máximo 3 párrafos cortos).
"""


async def _call_ai_async(api_key, session_id, system_message, model_name, user_content):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=system_message,
    ).with_model("openai", model_name)
    return await chat.send_message(UserMessage(text=user_content))


_call_ai = async_to_sync(_call_ai_async)


class AIChatView(APIView):
    """
    POST /api/ai-chat/
    Límite: 20 mensajes/día para miembros. Sin límite para trainers.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        input_ser = AIChatInputSerializer(data=request.data)
        if not input_ser.is_valid():
            return Response(input_ser.errors, status=status.HTTP_400_BAD_REQUEST)

        user_message = input_ser.validated_data['message']
        user = request.user

        # Obtener member profile
        if user.role == 'member':
            try:
                member = user.memberprofile
            except Exception:
                return Response({'error': 'Perfil de miembro no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        elif user.role == 'trainer':
            # Trainers pueden chatear como ellos mismos; necesitamos un member para el contexto
            # Si no hay member, creamos un contexto genérico
            member = None
        else:
            return Response({'error': 'Rol no permitido.'}, status=status.HTTP_403_FORBIDDEN)

        # Verificar límite diario (solo para miembros)
        daily_limit = settings.AI_DAILY_LIMIT_PER_USER
        if user.role == 'member' and member:
            today_count = AIChatMessage.objects.filter(
                member=member,
                role='user',
                created_at__date=date.today()
            ).count()

            if today_count >= daily_limit:
                return Response({
                    'role': 'assistant',
                    'content': 'Has alcanzado el límite diario.',
                    'limit_reached': True,
                }, status=status.HTTP_200_OK)

        # Si el trainer no tiene un member profile, retornar error
        if member is None:
            return Response({'error': 'Trainers necesitan un MemberProfile para usar el chat.'}, status=status.HTTP_400_BAD_REQUEST)

        # Construir contexto
        system_context = _build_system_context(member, user)
        model_name = settings.OPENAI_MODEL
        api_key = _get_api_key()
        session_id = f"gymhub_{member.id}_{date.today().isoformat()}"

        # Guardar mensaje del usuario
        AIChatMessage.objects.create(
            member=member,
            role='user',
            content=user_message,
            tokens_used=0,
        )

        # Llamar a la IA
        try:
            ai_response = _call_ai(
                api_key=api_key,
                session_id=session_id,
                system_message=system_context,
                model_name=model_name,
                user_content=user_message,
            )
            tokens_estimated = len(ai_response) // 4

            # Guardar respuesta
            msg = AIChatMessage.objects.create(
                member=member,
                role='assistant',
                content=ai_response,
                tokens_used=tokens_estimated,
            )
            return Response({
                'role': 'assistant',
                'content': ai_response,
                'tokens_used': tokens_estimated,
                'message_id': msg.id,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            error_str = str(e).lower()
            # Manejar errores de rate limit y errores del servidor
            if '429' in error_str or 'rate limit' in error_str or 'quota' in error_str:
                fallback_msg = 'El asistente está ocupado. Intenta en unos minutos.'
            elif '500' in error_str or 'server error' in error_str:
                fallback_msg = 'El asistente está ocupado. Intenta en unos minutos.'
            else:
                fallback_msg = 'El asistente está ocupado. Intenta en unos minutos.'

            AIChatMessage.objects.create(
                member=member,
                role='assistant',
                content=fallback_msg,
                tokens_used=0,
            )
            return Response({
                'role': 'assistant',
                'content': fallback_msg,
                'error': True,
            }, status=status.HTTP_200_OK)


class AIChatHistoryView(APIView):
    """GET /api/ai-chat/history/ — Historial de mensajes del miembro."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == 'member':
            try:
                member = user.memberprofile
            except Exception:
                return Response([], status=status.HTTP_200_OK)
        else:
            return Response({'error': 'Solo miembros pueden ver su historial.'}, status=status.HTTP_403_FORBIDDEN)

        messages = AIChatMessage.objects.filter(member=member).order_by('created_at')[:50]
        return Response(AIChatMessageSerializer(messages, many=True).data)
