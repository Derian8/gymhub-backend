from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ProgressLog, WorkoutSession, ExerciseLog
from .services import build_member_physical_summary, user_can_manage_member_progress
from .serializers import (
    ProgressLogSerializer, WorkoutSessionSerializer,
    CreateWorkoutSessionSerializer, CompleteWorkoutSessionSerializer,
    BulkExerciseLogSerializer, ExerciseLogSerializer
)


class ProgressLogViewSet(viewsets.ModelViewSet):
    serializer_class = ProgressLogSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        if user.role == 'member':
            return ProgressLog.objects.filter(member__user=user)
        queryset = ProgressLog.objects.select_related('member__user').order_by('-recorded_at', '-id')
        if user.is_staff:
            member_id = self.request.query_params.get('member_id')
            return queryset.filter(member_id=member_id) if member_id else queryset

        try:
            trainer_profile = user.trainerprofile
        except ObjectDoesNotExist:
            return ProgressLog.objects.none()
        queryset = queryset.filter(member__trainer_asignado=trainer_profile)
        member_id = self.request.query_params.get('member_id')
        if member_id:
            queryset = queryset.filter(member_id=member_id)
        return queryset

    def _resolve_target_member(self, request):
        user = request.user
        if user.role == 'member':
            return user.memberprofile

        member_id = request.data.get('member') or request.data.get('member_id')
        if not member_id:
            raise ValidationError({'member': 'Este campo es requerido.'})

        from users.models import MemberProfile

        try:
            member = MemberProfile.objects.get(id=member_id)
        except MemberProfile.DoesNotExist as exc:
            raise ValidationError({'member': 'Miembro no encontrado.'}) from exc

        if not user_can_manage_member_progress(user, member):
            raise PermissionDenied('Solo puedes registrar progreso físico de clientes asignados a ti.')

        return member

    def list(self, request, *args, **kwargs):
        if request.user.role == 'member':
            return super().list(request, *args, **kwargs)
        if not request.user.is_staff and not request.query_params.get('member_id'):
            return Response(
                {'error': 'Se requiere member_id para consultar progreso físico como trainer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        member = self._resolve_target_member(self.request)
        user = self.request.user
        if user.role == 'member':
            raise PermissionDenied('Solo el trainer puede registrar mediciones físicas.')
        source = serializer.validated_data.get('source')
        serializer.save(member=member, source=source or 'manual')

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        user = request.user
        if user.role == 'member':
            return Response({'error': 'No puedes editar mediciones físicas.'}, status=status.HTTP_403_FORBIDDEN)
        if not user_can_manage_member_progress(user, instance.member):
            raise PermissionDenied('Solo puedes editar progreso físico de clientes asignados a ti.')

        payload = request.data.copy()
        payload['member'] = instance.member_id
        serializer = self.get_serializer(instance, data=payload, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='member-summary')
    def member_summary(self, request):
        from users.models import MemberProfile

        if request.user.role == 'member':
            member = request.user.memberprofile
        else:
            member_id = request.query_params.get('member_id')
            if not member_id:
                return Response({'error': 'Se requiere member_id.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                member = MemberProfile.objects.get(id=member_id)
            except MemberProfile.DoesNotExist:
                return Response({'error': 'Miembro no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
            if not user_can_manage_member_progress(request.user, member):
                raise PermissionDenied('No tienes permiso para consultar este resumen físico.')

        return Response(build_member_physical_summary(member))


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

        existing_session = WorkoutSession.objects.filter(
            member=member,
            workout_day=workout_day,
            started_at__date=timezone.localdate(),
        ).order_by('-started_at', '-id').first()

        if existing_session:
            if existing_session.is_completed:
                return Response(
                    {
                        'error': (
                            'La rutina de hoy ya fue completada. '
                            'Podras volver a realizarla cuando este dia corresponda otra vez.'
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(WorkoutSessionSerializer(existing_session).data, status=status.HTTP_200_OK)

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
                    raise ValidationError({
                        'logs': [f'Ejercicio {exercise_id} no encontrado.']
                    })

                if exercise.workout_day_id != session.workout_day_id:
                    raise ValidationError({
                        'logs': [f'El ejercicio {exercise_id} no pertenece a la sesión indicada.']
                    })

                if exercise.exercise_type == 'timed':
                    if 'minutes_completed' not in log_data:
                        raise ValidationError({
                            'logs': [f'El ejercicio {exercise_id} requiere minutes_completed.']
                        })
                    log_data['sets_completed'] = 0
                    log_data['reps_completed'] = 0
                    log_data['weight_used_kg'] = None
                else:
                    if user.role == 'member':
                        repeticiones_objetivo = 0
                        reps_range = (exercise.reps_range or '').split('-')[0].strip()
                        if reps_range.isdigit():
                            repeticiones_objetivo = int(reps_range)
                        log_data['sets_completed'] = exercise.sets
                        log_data['reps_completed'] = repeticiones_objetivo
                    elif 'sets_completed' not in log_data or 'reps_completed' not in log_data:
                        raise ValidationError({
                            'logs': ['Series y repeticiones son requeridas para registros operativos del trainer.']
                        })

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
