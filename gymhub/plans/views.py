from datetime import date, timedelta
from django.db import transaction
from django.db.models import Q
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
    CompleteTrainingPlanSerializer,
    GymMachineSerializer,
)
from users.permissions import IsTrainer
from users.models import MemberProfile
from users.views import _get_trainer_profile


def get_today_workout_day(plan):
    """Retorna el WorkoutDay correspondiente al día real de la semana."""
    if not plan:
        return None
    weekday = timezone.localdate().strftime('%a').lower()[:3]
    return plan.workout_days.filter(day_of_week=weekday).order_by('order', 'id').first()


class TrainingPlanViewSet(viewsets.ModelViewSet):
    serializer_class = TrainingPlanSerializer
    lookup_value_regex = r'\d+'

    def get_queryset(self):
        user = self.request.user
        member_id = self.request.query_params.get('member')
        status_filter = self.request.query_params.get('status')
        goal_filter = self.request.query_params.get('goal')
        search = (self.request.query_params.get('search') or '').strip()
        if user.role == 'member' and not user.is_staff:
            return TrainingPlan.objects.filter(member__user=user)
        queryset = TrainingPlan.objects.select_related('member__user', 'trainer__user').prefetch_related('workout_days').all()
        if user.role == 'trainer' and not user.is_staff:
            trainer_profile = _get_trainer_profile(user)
            queryset = queryset.filter(member__trainer_asignado=trainer_profile)
        if member_id:
            queryset = queryset.filter(member_id=member_id)
        if status_filter and status_filter != 'all':
            queryset = queryset.filter(status=status_filter)
        if goal_filter and goal_filter != 'all':
            queryset = queryset.filter(goal=goal_filter)
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(goal__icontains=search)
                | Q(member__user__first_name__icontains=search)
                | Q(member__user__last_name__icontains=search)
                | Q(member__user__email__icontains=search)
            )
        return queryset

    def _get_plan_trainer(self, member):
        user = self.request.user
        if user.is_staff:
            return member.trainer_asignado or _get_trainer_profile(user)
        return _get_trainer_profile(user)

    def _assert_member_allowed(self, member):
        user = self.request.user
        if user.is_staff:
            return member.trainer_asignado or _get_trainer_profile(user)
        trainer_profile = _get_trainer_profile(user)
        if member.trainer_asignado_id != trainer_profile.id:
            raise PermissionDenied('Solo puedes crear planes para clientes asignados.')
        return trainer_profile

    def _deactivate_other_plans(self, member, current_plan):
        now = timezone.now()
        TrainingPlan.objects.filter(member=member, status='active').exclude(id=current_plan.id).update(
            is_active=False,
            status='finished',
            finished_at=now,
        )

    def perform_create(self, serializer):
        member = serializer.validated_data['member']
        user = self.request.user
        trainer_profile = _get_trainer_profile(user)
        if not user.is_staff and member.trainer_asignado_id != trainer_profile.id:
            raise PermissionDenied('Solo puedes crear planes para clientes asignados.')
        plan = serializer.save(trainer=trainer_profile)
        if plan.is_active:
            TrainingPlan.objects.filter(member=member, status='active').exclude(id=plan.id).update(
                is_active=False,
                status='finished',
                finished_at=timezone.now(),
            )

    def perform_update(self, serializer):
        user = self.request.user
        trainer_profile = _get_trainer_profile(user)
        member = serializer.instance.member
        if not user.is_staff and member.trainer_asignado_id != trainer_profile.id:
            raise PermissionDenied('Solo puedes editar planes de clientes asignados.')
        plan = serializer.save()
        if plan.is_active:
            TrainingPlan.objects.filter(member=member, status='active').exclude(id=plan.id).update(
                is_active=False,
                status='finished',
                finished_at=timezone.now(),
            )

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'create_complete', 'duplicate', 'finish', 'archive', 'summary'):
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

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        queryset = self.get_queryset()
        today = timezone.localdate()
        soon = today + timedelta(days=14)
        members_qs = MemberProfile.objects.select_related('user', 'trainer_asignado')
        if request.user.role == 'trainer' and not request.user.is_staff:
            members_qs = members_qs.filter(trainer_asignado=_get_trainer_profile(request.user))
        active_member_ids = TrainingPlan.objects.filter(
            member__in=members_qs,
            status='active',
        ).values_list('member_id', flat=True)
        return Response({
            'active': queryset.filter(status='active').count(),
            'draft': queryset.filter(status='draft').count(),
            'ending_soon': queryset.filter(status='active', end_date__gte=today, end_date__lte=soon).count(),
            'members_without_active_plan': members_qs.exclude(id__in=active_member_ids).count(),
        })

    @action(detail=False, methods=['post'], url_path='create-complete')
    def create_complete(self, request):
        serializer = CompleteTrainingPlanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            member = MemberProfile.objects.select_related('trainer_asignado').get(id=data['member'])
        except MemberProfile.DoesNotExist as exc:
            raise ValidationError({'member': 'Miembro no encontrado.'}) from exc

        trainer_profile = self._assert_member_allowed(member)
        active_plan = TrainingPlan.objects.filter(member=member, status='active').order_by('-start_date', '-id').first()
        conflict_strategy = data.get('conflict_strategy', 'keep')
        requested_status = data['status']

        if active_plan and requested_status == 'active' and conflict_strategy == 'keep':
            raise ValidationError({
                'member': 'Este miembro ya tiene un plan activo. Elige reemplazarlo o programar el nuevo plan.',
            })

        start_date = data['start_date']
        end_date = data['end_date']
        status_value = requested_status
        if active_plan and requested_status == 'active' and conflict_strategy == 'schedule_after_active':
            start_date = (active_plan.end_date or active_plan.start_date) + timedelta(days=1)
            end_date = start_date + timedelta(weeks=data['weeks_duration'])
            status_value = 'scheduled'

        with transaction.atomic():
            plan = TrainingPlan.objects.create(
                member=member,
                trainer=trainer_profile,
                name=data['name'],
                goal=data['goal'],
                start_date=start_date,
                end_date=end_date,
                weeks_duration=data['weeks_duration'],
                days_per_week=data['days_per_week'],
                status=status_value,
                level=data.get('level', 'intermediate'),
                notes=data.get('notes', ''),
            )
            if plan.status == 'active' and conflict_strategy == 'replace_active':
                self._deactivate_other_plans(member, plan)

            for day_data in data.get('days', []):
                exercises = day_data.pop('exercises', [])
                day = WorkoutDay.objects.create(plan=plan, **day_data)
                for exercise_data in exercises:
                    machine_id = exercise_data.pop('machine', None)
                    Exercise.objects.create(workout_day=day, machine_id=machine_id, **exercise_data)

        return Response(TrainingPlanSerializer(plan).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='duplicate')
    def duplicate(self, request, pk=None):
        source = self.get_object()
        name = request.data.get('name') or f'{source.name} (copia)'
        status_value = request.data.get('status') or 'draft'
        start_date = request.data.get('start_date')
        if start_date:
            try:
                start_date = date.fromisoformat(start_date)
            except ValueError as exc:
                raise ValidationError({'start_date': 'Fecha inválida.'}) from exc
        else:
            start_date = timezone.localdate()

        with transaction.atomic():
            plan = TrainingPlan.objects.create(
                member=source.member,
                trainer=source.trainer,
                name=name,
                goal=source.goal,
                start_date=start_date,
                weeks_duration=source.weeks_duration,
                days_per_week=source.days_per_week,
                status=status_value,
                level=source.level,
                notes=source.notes,
            )
            if plan.status == 'active':
                self._deactivate_other_plans(source.member, plan)
            for source_day in source.workout_days.order_by('order'):
                day = WorkoutDay.objects.create(
                    plan=plan,
                    name=source_day.name,
                    day_label=source_day.day_label,
                    day_of_week=source_day.day_of_week,
                    order=source_day.order,
                )
                for source_exercise in source_day.exercises.order_by('order'):
                    Exercise.objects.create(
                        workout_day=day,
                        name=source_exercise.name,
                        muscle_group=source_exercise.muscle_group,
                        exercise_type=source_exercise.exercise_type,
                        sets=source_exercise.sets,
                        reps_range=source_exercise.reps_range,
                        target_minutes=source_exercise.target_minutes,
                        machine=source_exercise.machine,
                        weight_suggestion_kg=source_exercise.weight_suggestion_kg,
                        rest_seconds=source_exercise.rest_seconds,
                        technique_notes=source_exercise.technique_notes,
                        order=source_exercise.order,
                    )

        return Response(TrainingPlanSerializer(plan).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='finish')
    def finish(self, request, pk=None):
        plan = self.get_object()
        plan.status = 'finished'
        plan.is_active = False
        plan.finished_at = timezone.now()
        plan.save(update_fields=['status', 'is_active', 'finished_at', 'end_date'])
        return Response(TrainingPlanSerializer(plan).data)

    @action(detail=True, methods=['post'], url_path='archive')
    def archive(self, request, pk=None):
        plan = self.get_object()
        plan.status = 'archived'
        plan.is_active = False
        plan.archived_at = timezone.now()
        plan.save(update_fields=['status', 'is_active', 'archived_at', 'end_date'])
        return Response(TrainingPlanSerializer(plan).data)


class WorkoutDayViewSet(viewsets.ModelViewSet):
    serializer_class = WorkoutDaySerializer

    def get_queryset(self):
        user = self.request.user
        plan_id = self.request.query_params.get('plan')
        if user.role == 'member' and not user.is_staff:
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
        if self.request.user.role == 'member' and not self.request.user.is_staff:
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
        if user.role == 'member' and not user.is_staff:
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
                status='active',
            )
            TrainingPlan.objects.filter(member=member, status='active').exclude(id=plan.id).update(
                is_active=False,
                status='finished',
                finished_at=timezone.now(),
            )

            weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
            for index, template_day in enumerate(plantilla.dias.order_by('orden')):
                day = WorkoutDay.objects.create(
                    plan=plan,
                    name=template_day.nombre,
                    day_label=template_day.etiqueta_dia,
                    day_of_week=weekdays[index % len(weekdays)],
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
