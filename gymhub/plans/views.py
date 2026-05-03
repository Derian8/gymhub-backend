from datetime import date, timedelta
from django.db import transaction
from django.utils import timezone

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    TrainingPlan, WorkoutDay, Exercise, GymMachine,
    PlantillaEntrenamiento, PlantillaDiaEntrenamiento, PlantillaEjercicio,
)
from .serializers import (
    TrainingPlanSerializer, WorkoutDaySerializer,
    ExerciseSerializer, TodayWorkoutSerializer, PlantillaEntrenamientoSerializer,
    GymMachineSerializer,
)
from users.permissions import IsTrainer
from users.views import _get_trainer_profile


def get_today_workout_day(plan):
    """Retorna el WorkoutDay correspondiente al día real de la semana."""
    if not plan:
        return None
    weekday = timezone.localdate().strftime('%a').lower()[:3]
    return plan.workout_days.filter(day_of_week=weekday).order_by('order', 'id').first()


class TrainingPlanViewSet(viewsets.ModelViewSet):
    serializer_class = TrainingPlanSerializer

    def get_queryset(self):
        user = self.request.user
        member_id = self.request.query_params.get('member')
        if user.role == 'member':
            return TrainingPlan.objects.filter(member__user=user)
        queryset = TrainingPlan.objects.select_related('member__user', 'trainer__user').all()
        if user.role == 'trainer' and not user.is_staff:
            trainer_profile = _get_trainer_profile(user)
            queryset = queryset.filter(member__trainer_asignado=trainer_profile)
        if member_id:
            queryset = queryset.filter(member_id=member_id)
        return queryset

    def perform_create(self, serializer):
        member = serializer.validated_data['member']
        user = self.request.user
        trainer_profile = _get_trainer_profile(user)
        if not user.is_staff and member.trainer_asignado_id != trainer_profile.id:
            raise PermissionDenied('Solo puedes crear planes para clientes asignados.')
        plan = serializer.save(trainer=trainer_profile)
        if plan.is_active:
            TrainingPlan.objects.filter(member=member).exclude(id=plan.id).update(is_active=False)

    def perform_update(self, serializer):
        user = self.request.user
        trainer_profile = _get_trainer_profile(user)
        member = serializer.instance.member
        if not user.is_staff and member.trainer_asignado_id != trainer_profile.id:
            raise PermissionDenied('Solo puedes editar planes de clientes asignados.')
        plan = serializer.save()
        if plan.is_active:
            TrainingPlan.objects.filter(member=member).exclude(id=plan.id).update(is_active=False)

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsTrainer()]
        return [IsAuthenticated()]

    @action(detail=True, methods=['get'], url_path='today-workout')
    def today_workout(self, request, pk=None):
        """GET /api/plans/{id}/today-workout/"""
        plan = self.get_object()
        workout_day = get_today_workout_day(plan)
        if not workout_day:
            return Response(
                {'message': 'No hay entrenamiento programado para hoy.'},
                status=status.HTTP_200_OK
            )
        serializer = TodayWorkoutSerializer(workout_day, context={'request': request, 'member': plan.member})
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='weekly-view')
    def weekly_view(self, request, pk=None):
        """GET /api/plans/{id}/weekly-view/"""
        plan = self.get_object()
        workout_days = list(plan.workout_days.order_by('order'))

        if not workout_days:
            return Response({'week_days': []})

        from progress.models import WorkoutSession

        today = timezone.localdate()
        week_start = today - timedelta(days=today.weekday())
        result = []

        for i in range(7):
            day_date = week_start + timedelta(days=i)
            weekday = day_date.strftime('%a').lower()[:3]
            workout_day = next((day for day in workout_days if day.day_of_week == weekday), None)

            session = None
            is_completed = False
            if workout_day:
                session_qs = WorkoutSession.objects.filter(
                    member=plan.member,
                    workout_day=workout_day,
                    started_at__date=day_date
                ).first()
                if session_qs:
                    session = session_qs.id
                    is_completed = session_qs.is_completed

            result.append({
                'date': day_date,
                'workout_day_name': workout_day.name if workout_day else None,
                'workout_day_id': workout_day.id if workout_day else None,
                'day_of_week': weekday,
                'day_label': workout_day.day_label if workout_day else None,
                'has_workout': bool(workout_day),
                'is_rest_day': not bool(workout_day),
                'session_id': session,
                'is_completed': is_completed,
            })

        return Response({'week_days': result})

    @action(detail=True, methods=['post'], url_path='save-as-template')
    def save_as_template(self, request, pk=None):
        plan = self.get_object()
        user = request.user
        trainer_profile = _get_trainer_profile(user)
        if not user.is_staff and plan.member.trainer_asignado_id != trainer_profile.id:
            raise PermissionDenied('Solo puedes convertir en plantilla planes de clientes asignados.')

        nombre = request.data.get('nombre') or f'Plantilla — {plan.name}'
        descripcion = request.data.get('descripcion', '')
        nivel = request.data.get('nivel_adherencia_recomendado', 'medium')

        with transaction.atomic():
            plantilla = PlantillaEntrenamiento.objects.create(
                trainer=trainer_profile,
                nombre=nombre,
                descripcion=descripcion,
                objetivo=plan.goal,
                nivel_adherencia_recomendado=nivel,
                dias_por_semana_sugeridos=plan.days_per_week,
            )
            for day in plan.workout_days.order_by('order'):
                template_day = PlantillaDiaEntrenamiento.objects.create(
                    plantilla=plantilla,
                    nombre=day.name,
                    etiqueta_dia=day.day_label,
                    orden=day.order,
                )
                for exercise in day.exercises.order_by('order'):
                    PlantillaEjercicio.objects.create(
                        dia=template_day,
                        nombre=exercise.name,
                        grupo_muscular=exercise.muscle_group,
                        tipo_ejercicio=exercise.exercise_type,
                        series=exercise.sets,
                        rango_repeticiones=exercise.reps_range,
                        minutos_objetivo=exercise.target_minutes,
                        peso_sugerido_kg=exercise.weight_suggestion_kg,
                        descanso_segundos=exercise.rest_seconds,
                        notas_tecnicas=exercise.technique_notes,
                        orden=exercise.order,
                    )

        return Response(PlantillaEntrenamientoSerializer(plantilla).data, status=status.HTTP_201_CREATED)


class WorkoutDayViewSet(viewsets.ModelViewSet):
    serializer_class = WorkoutDaySerializer

    def get_queryset(self):
        user = self.request.user
        plan_id = self.request.query_params.get('plan')
        if user.role == 'member':
            queryset = WorkoutDay.objects.filter(plan__member__user=user)
            if plan_id:
                queryset = queryset.filter(plan_id=plan_id)
            return queryset
        queryset = WorkoutDay.objects.select_related('plan__member__trainer_asignado').all()
        if user.role == 'trainer' and not user.is_staff:
            trainer_profile = _get_trainer_profile(user)
            queryset = queryset.filter(plan__member__trainer_asignado=trainer_profile)
        if plan_id:
            queryset = queryset.filter(plan_id=plan_id)
        return queryset

    def perform_create(self, serializer):
        plan = serializer.validated_data['plan']
        user = self.request.user
        trainer_profile = _get_trainer_profile(user)
        if not user.is_staff and plan.member.trainer_asignado_id != trainer_profile.id:
            raise PermissionDenied('Solo puedes editar días de clientes asignados.')
        serializer.save()

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsTrainer()]
        return [IsAuthenticated()]


class GymMachineViewSet(viewsets.ModelViewSet):
    serializer_class = GymMachineSerializer

    def get_queryset(self):
        queryset = GymMachine.objects.all()
        if self.request.user.role == 'member':
            return queryset.filter(is_active=True)
        return queryset

    def get_permissions(self):
        return [IsAuthenticated()]

    def _validate_manager(self):
        user = self.request.user
        if not user.is_staff and user.role != 'trainer':
            raise PermissionDenied('Solo trainers o staff pueden modificar máquinas del gym.')

    def perform_create(self, serializer):
        self._validate_manager()
        serializer.save()

    def perform_update(self, serializer):
        self._validate_manager()
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        self._validate_manager()
        return super().destroy(request, *args, **kwargs)


class ExerciseViewSet(viewsets.ModelViewSet):
    serializer_class = ExerciseSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'member':
            return Exercise.objects.filter(workout_day__plan__member__user=user)
        queryset = Exercise.objects.select_related('workout_day__plan__member__trainer_asignado').all()
        if user.role == 'trainer' and not user.is_staff:
            trainer_profile = _get_trainer_profile(user)
            queryset = queryset.filter(workout_day__plan__member__trainer_asignado=trainer_profile)
        return queryset

    def perform_create(self, serializer):
        workout_day = serializer.validated_data['workout_day']
        user = self.request.user
        trainer_profile = _get_trainer_profile(user)
        if not user.is_staff and workout_day.plan.member.trainer_asignado_id != trainer_profile.id:
            raise PermissionDenied('Solo puedes editar ejercicios de clientes asignados.')
        serializer.save()

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsTrainer()]
        return [IsAuthenticated()]


class PlantillaEntrenamientoViewSet(viewsets.ModelViewSet):
    serializer_class = PlantillaEntrenamientoSerializer
    permission_classes = [IsAuthenticated, IsTrainer]

    def get_queryset(self):
        trainer_profile = _get_trainer_profile(self.request.user)
        return PlantillaEntrenamiento.objects.filter(trainer=trainer_profile).prefetch_related(
            'dias__ejercicios'
        ).order_by('nombre', 'id')

    def perform_create(self, serializer):
        serializer.save(trainer=_get_trainer_profile(self.request.user))

    def perform_update(self, serializer):
        serializer.save(trainer=_get_trainer_profile(self.request.user))

    @action(detail=True, methods=['post'], url_path='refresh-from-plan')
    def refresh_from_plan(self, request, pk=None):
        plantilla = self.get_object()
        trainer_profile = _get_trainer_profile(request.user)
        plan_id = request.data.get('plan_id')
        if not plan_id:
            raise ValidationError({'plan_id': 'Este campo es requerido.'})

        try:
            plan = TrainingPlan.objects.select_related('member__trainer_asignado').prefetch_related(
                'workout_days__exercises'
            ).get(id=plan_id)
        except TrainingPlan.DoesNotExist as exc:
            raise ValidationError({'plan_id': 'Plan no encontrado.'}) from exc

        if not request.user.is_staff and plan.member.trainer_asignado_id != trainer_profile.id:
            raise PermissionDenied('Solo puedes refrescar plantillas desde clientes asignados.')

        with transaction.atomic():
            plantilla.objetivo = plan.goal
            plantilla.dias_por_semana_sugeridos = plan.days_per_week
            plantilla.save(update_fields=['objetivo', 'dias_por_semana_sugeridos'])
            plantilla.dias.all().delete()

            for day in plan.workout_days.order_by('order'):
                template_day = PlantillaDiaEntrenamiento.objects.create(
                    plantilla=plantilla,
                    nombre=day.name,
                    etiqueta_dia=day.day_label,
                    orden=day.order,
                )
                for exercise in day.exercises.order_by('order'):
                    PlantillaEjercicio.objects.create(
                        dia=template_day,
                        nombre=exercise.name,
                        grupo_muscular=exercise.muscle_group,
                        tipo_ejercicio=exercise.exercise_type,
                        series=exercise.sets,
                        rango_repeticiones=exercise.reps_range,
                        minutos_objetivo=exercise.target_minutes,
                        peso_sugerido_kg=exercise.weight_suggestion_kg,
                        descanso_segundos=exercise.rest_seconds,
                        notas_tecnicas=exercise.technique_notes,
                        orden=exercise.order,
                    )

        return Response(PlantillaEntrenamientoSerializer(plantilla).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='apply')
    def apply(self, request, pk=None):
        plantilla = self.get_object()
        trainer_profile = _get_trainer_profile(request.user)
        member_id = request.data.get('member_id')
        start_date_value = request.data.get('start_date')
        if not member_id:
            raise ValidationError({'member_id': 'Este campo es requerido.'})

        from users.models import MemberProfile
        try:
            member = MemberProfile.objects.get(id=member_id)
        except MemberProfile.DoesNotExist as exc:
            raise ValidationError({'member_id': 'Miembro no encontrado.'}) from exc

        if not request.user.is_staff and member.trainer_asignado_id != trainer_profile.id:
            raise PermissionDenied('Solo puedes aplicar plantillas a clientes asignados.')

        if start_date_value:
            try:
                start_date_parsed = date.fromisoformat(start_date_value)
            except ValueError as exc:
                raise ValidationError({'start_date': 'Fecha inválida.'}) from exc
        else:
            start_date_parsed = date.today()

        with transaction.atomic():
            plan = TrainingPlan.objects.create(
                member=member,
                trainer=trainer_profile,
                name=f'{plantilla.nombre} — {member.user.first_name}',
                goal=plantilla.objetivo,
                start_date=start_date_parsed,
                weeks_duration=8,
                days_per_week=plantilla.dias_por_semana_sugeridos,
                is_active=True,
            )
            TrainingPlan.objects.filter(member=member).exclude(id=plan.id).update(is_active=False)

            for template_day in plantilla.dias.order_by('orden'):
                day = WorkoutDay.objects.create(
                    plan=plan,
                    name=template_day.nombre,
                    day_label=template_day.etiqueta_dia,
                    order=template_day.orden,
                )
                for template_exercise in template_day.ejercicios.order_by('orden'):
                    Exercise.objects.create(
                        workout_day=day,
                        name=template_exercise.nombre,
                        muscle_group=template_exercise.grupo_muscular,
                        exercise_type=template_exercise.tipo_ejercicio,
                        sets=template_exercise.series,
                        reps_range=template_exercise.rango_repeticiones,
                        target_minutes=template_exercise.minutos_objetivo,
                        weight_suggestion_kg=template_exercise.peso_sugerido_kg,
                        rest_seconds=template_exercise.descanso_segundos,
                        technique_notes=template_exercise.notas_tecnicas,
                        order=template_exercise.orden,
                    )

        return Response(TrainingPlanSerializer(plan).data, status=status.HTTP_201_CREATED)
