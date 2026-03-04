from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ProgressLog, WorkoutSession, ExerciseLog
from .serializers import (
    ProgressLogSerializer, WorkoutSessionSerializer,
    CreateWorkoutSessionSerializer, CompleteWorkoutSessionSerializer,
    BulkExerciseLogSerializer, ExerciseLogSerializer
)
from users.permissions import IsTrainer


class ProgressLogViewSet(viewsets.ModelViewSet):
    serializer_class = ProgressLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'member':
            return ProgressLog.objects.filter(member__user=user)
        return ProgressLog.objects.all()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == 'member':
            serializer.save(member=user.memberprofile)
        else:
            serializer.save()


class WorkoutSessionViewSet(viewsets.ModelViewSet):
    """
    POST /api/workout-sessions/ — Crea sesión.
    PATCH /api/workout-sessions/{id}/complete/ — Marca como completada.
    """
    serializer_class = WorkoutSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'member':
            return WorkoutSession.objects.filter(member__user=user)
        return WorkoutSession.objects.all()

    def create(self, request, *args, **kwargs):
        input_ser = CreateWorkoutSessionSerializer(data=request.data)
        if not input_ser.is_valid():
            return Response(input_ser.errors, status=status.HTTP_400_BAD_REQUEST)

        workout_day_id = input_ser.validated_data['workout_day_id']
        attendance_id = input_ser.validated_data.get('attendance_id')

        from plans.models import WorkoutDay
        from attendance.models import Attendance

        try:
            workout_day = WorkoutDay.objects.get(id=workout_day_id)
        except WorkoutDay.DoesNotExist:
            return Response({'error': 'WorkoutDay no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        attendance = None
        if attendance_id:
            try:
                attendance = Attendance.objects.get(id=attendance_id)
            except Attendance.DoesNotExist:
                pass

        user = request.user
        if user.role == 'member':
            member = user.memberprofile
        else:
            member_id = request.data.get('member_id')
            if not member_id:
                return Response({'error': 'Se requiere member_id.'}, status=status.HTTP_400_BAD_REQUEST)
            from users.models import MemberProfile
            try:
                member = MemberProfile.objects.get(id=member_id)
            except MemberProfile.DoesNotExist:
                return Response({'error': 'Miembro no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        session = WorkoutSession.objects.create(
            member=member,
            workout_day=workout_day,
            attendance=attendance,
        )
        return Response(WorkoutSessionSerializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path='complete')
    def complete(self, request, pk=None):
        """PATCH /api/workout-sessions/{id}/complete/"""
        session = self.get_object()
        if session.is_completed:
            return Response({'error': 'La sesión ya fue completada.'}, status=status.HTTP_400_BAD_REQUEST)

        ser = CompleteWorkoutSessionSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        session.is_completed = True
        session.completed_at = timezone.now()
        if ser.validated_data.get('overall_feeling'):
            session.overall_feeling = ser.validated_data['overall_feeling']
        if ser.validated_data.get('trainer_notes'):
            session.trainer_notes = ser.validated_data['trainer_notes']
        session.save()

        return Response(WorkoutSessionSerializer(session).data)


class BulkExerciseLogView(APIView):
    """POST /api/exercise-logs/bulk/ — Registra múltiples logs en transacción atómica."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = BulkExerciseLogSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        session_id = ser.validated_data['session_id']
        logs_data = ser.validated_data['logs']

        try:
            session = WorkoutSession.objects.get(id=session_id)
        except WorkoutSession.DoesNotExist:
            return Response({'error': 'Sesión no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        # Verificar que el miembro es el dueño (o es trainer)
        user = request.user
        if user.role == 'member' and session.member.user != user:
            return Response({'error': 'No tienes permiso para esta sesión.'}, status=status.HTTP_403_FORBIDDEN)

        from plans.models import Exercise

        with transaction.atomic():
            created_logs = []
            for log_data in logs_data:
                exercise_id = log_data.pop('exercise_id')
                try:
                    exercise = Exercise.objects.get(id=exercise_id)
                except Exercise.DoesNotExist:
                    raise Exception(f'Ejercicio {exercise_id} no encontrado.')

                log = ExerciseLog.objects.create(
                    session=session,
                    exercise=exercise,
                    **log_data
                )
                created_logs.append(log)

        return Response(
            ExerciseLogSerializer(created_logs, many=True).data,
            status=status.HTTP_201_CREATED
        )
