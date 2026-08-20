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
    PlantillaEntrenamiento, PlantillaDiaEntrenamiento, PlantillaEjercicio, CatalogoEjercicio,
)
from .serializers import (
    TrainingPlanSerializer, WorkoutDaySerializer,
    ExerciseSerializer, TodayWorkoutSerializer, PlantillaEntrenamientoSerializer,
    CompleteTrainingPlanSerializer,
    GymMachineSerializer, CatalogoEjercicioSerializer,
)
from users.permissions import (
    IsTrainer,
    tiene_perfil_entrenador,
    usa_contexto_cliente,
)
from users.models import MemberProfile, TrainerProfile
from users.views import _get_trainer_profile


def get_today_workout_day(plan):
    """Resuelve el bloque semanal o el siguiente bloque del ciclo."""
    if not plan:
        return None
    if plan.modo_ejecucion == 'cycle':
        days = list(plan.workout_days.order_by('order', 'id'))
        if not days:
            return None
        return days[plan.indice_bloque_actual % len(days)]
    weekday = timezone.localdate().strftime('%a').lower()[:3]
    return plan.workout_days.filter(day_of_week=weekday).order_by('order', 'id').first()


def assert_plan_editable(plan):
    if plan.status != 'draft':
        raise ValidationError({
            'plan': 'Solo se editan borradores. Crea una revisión del plan publicado.',
        })


def assert_member_training_eligible(member):
    from billing.services import membership_access

    access = membership_access(member)
    if not access['allowed']:
        raise PermissionDenied({
            'error': 'El cliente está bloqueado. Contacta al administrador.',
            'commercial_status': 'bloqueado',
        })


def assert_member_routine_visible(member):
    assert_member_training_eligible(member)
    from attendance.models import Attendance

    if not Attendance.objects.filter(
        member=member,
        attendance_date=timezone.localdate(),
    ).exists():
        raise PermissionDenied({
            'error': 'Registra tu entrada con “Ver rutina” antes de consultar el entrenamiento.',
            'reason': 'entry_required',
        })


class TrainingPlanViewSet(viewsets.ModelViewSet):
    serializer_class = TrainingPlanSerializer
    lookup_value_regex = r'\d+'

    def get_queryset(self):
        user = self.request.user
        member_id = self.request.query_params.get('member')
        status_filter = self.request.query_params.get('status')
        goal_filter = self.request.query_params.get('goal')
        search = (self.request.query_params.get('search') or '').strip()
        if usa_contexto_cliente(self.request):
            assert_member_routine_visible(user.memberprofile)
            return TrainingPlan.objects.filter(member__user=user, status='active')
        queryset = TrainingPlan.objects.select_related('member__user', 'trainer__user').prefetch_related('workout_days').all()
        if not user.is_staff and tiene_perfil_entrenador(user):
            trainer_profile = _get_trainer_profile(user)
            queryset = queryset.filter(member__trainer_asignado=trainer_profile)
        elif not user.is_staff:
            return queryset.none()
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
            if not member.trainer_asignado:
                raise ValidationError({
                    'member': 'Asigna un instructor al cliente antes de crear su plan.',
                })
            return member.trainer_asignado
        return _get_trainer_profile(user)

    def _assert_member_allowed(self, member):
        user = self.request.user
        if user.is_staff:
            trainer_profile = self._get_plan_trainer(member)
            assert_member_training_eligible(member)
            return trainer_profile
        trainer_profile = _get_trainer_profile(user)
        if member.trainer_asignado_id != trainer_profile.id:
            raise PermissionDenied('Solo puedes crear planes para clientes asignados.')
        assert_member_training_eligible(member)
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
        trainer_profile = self._assert_member_allowed(member)
        serializer.save(trainer=trainer_profile, status='draft', is_active=False)

    def perform_update(self, serializer):
        member = serializer.instance.member
        self._assert_member_allowed(member)
        assert_plan_editable(serializer.instance)
        serializer.save(member=member, status='draft', is_active=False)

    def perform_destroy(self, instance):
        instance.delete()

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'create_complete', 'assign_template', 'duplicate', 'finish', 'archive', 'summary', 'create_revision', 'publish'):
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
        data = serializer.data
        data['descripcion_general'] = plan.notes
        data['modo_ejecucion'] = plan.modo_ejecucion
        if plan.modo_ejecucion == 'cycle':
            total = plan.workout_days.count()
            data['posicion_ciclo'] = plan.indice_bloque_actual % total + 1 if total else 0
            data['total_bloques_ciclo'] = total
        return Response(data)

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
        trainer_profile = plan.trainer if user.is_staff else _get_trainer_profile(user)
        if not user.is_staff and plan.member.trainer_asignado_id != trainer_profile.id:
            raise PermissionDenied('Solo puedes convertir en plantilla planes de clientes asignados.')

        nombre = request.data.get('nombre') or f'Plantilla — {plan.name}'
        descripcion = request.data.get('descripcion', '')
        nivel = request.data.get('nivel_adherencia_recomendado', 'medium')
        workout_days = list(plan.workout_days.prefetch_related('exercises').order_by('order'))
        if not workout_days or any(not day.exercises.all() for day in workout_days):
            raise ValidationError({
                'plan': 'Completa todos los días y ejercicios del plan antes de guardarlo como plantilla.',
            })

        with transaction.atomic():
            plantilla = PlantillaEntrenamiento.objects.create(
                trainer=trainer_profile,
                nombre=nombre,
                descripcion=descripcion,
                objetivo=plan.goal,
                nivel_adherencia_recomendado=nivel,
                dias_por_semana_sugeridos=plan.days_per_week,
                modo_ejecucion=plan.modo_ejecucion,
            )
            for day in workout_days:
                template_day = PlantillaDiaEntrenamiento.objects.create(
                    plantilla=plantilla,
                    nombre=day.name,
                    etiqueta_dia=day.day_label,
                    dia_semana=day.day_of_week if plan.modo_ejecucion == 'weekly' else None,
                    orden=day.order,
                )
                for exercise in day.exercises.order_by('order'):
                    PlantillaEjercicio.objects.create(
                        dia=template_day,
                        catalogo_ejercicio=exercise.catalogo_ejercicio,
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
        if not request.user.is_staff and tiene_perfil_entrenador(request.user):
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

    @action(detail=False, methods=['get'], url_path='reusable-sources')
    def reusable_sources(self, request):
        """Lista todos los planes visibles que pueden reutilizarse como fuente."""
        queryset = TrainingPlan.objects.select_related(
            'member__user', 'trainer__user',
        ).prefetch_related('workout_days').order_by('-id')
        if not request.user.is_staff:
            if not tiene_perfil_entrenador(request.user):
                return Response({'count': 0, 'next': None, 'previous': None, 'results': []})
            queryset = queryset.filter(member__trainer_asignado=_get_trainer_profile(request.user))

        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=False, methods=['post'], url_path='assign-template')
    def assign_template(self, request):
        """Asigna una plantilla o publica un borrador del cliente."""
        source_type = request.data.get('source_type', 'template')
        member_id = request.data.get('member_id')
        trainer_id = request.data.get('trainer_id')
        template_id = request.data.get('template_id')
        plan_id = request.data.get('plan_id')
        weeks_duration = request.data.get('weeks_duration', 8)
        start_date_value = request.data.get('start_date')

        errors = {}
        if not member_id:
            errors['member_id'] = 'Este campo es requerido.'
        if not trainer_id:
            errors['trainer_id'] = 'Este campo es requerido.'
        if source_type not in {'template', 'draft', 'plan'}:
            errors['source_type'] = 'El origen debe ser template, draft o plan.'
        if source_type == 'template' and not template_id:
            errors['template_id'] = 'Este campo es requerido.'
        if source_type in {'draft', 'plan'} and not plan_id:
            errors['plan_id'] = 'Este campo es requerido.'
        try:
            weeks_duration = int(weeks_duration)
            if not 1 <= weeks_duration <= 52:
                raise ValueError
        except (TypeError, ValueError):
            errors['weeks_duration'] = 'La duración debe estar entre 1 y 52 semanas.'
        if errors:
            raise ValidationError(errors)

        try:
            member = MemberProfile.objects.select_related('trainer_asignado').get(id=member_id, is_active=True)
        except MemberProfile.DoesNotExist as exc:
            raise ValidationError({'member_id': 'Cliente activo no encontrado.'}) from exc
        try:
            trainer = TrainerProfile.objects.select_related('user').get(
                id=trainer_id,
                user__is_active=True,
                user__is_staff=False,
                user__role='trainer',
            )
        except TrainerProfile.DoesNotExist as exc:
            raise ValidationError({'trainer_id': 'Entrenador activo no encontrado.'}) from exc
        template = None
        draft = None
        source_plan = None
        if source_type == 'template':
            try:
                template = PlantillaEntrenamiento.objects.prefetch_related(
                    'dias__ejercicios'
                ).get(id=template_id, esta_activa=True)
            except PlantillaEntrenamiento.DoesNotExist as exc:
                raise ValidationError({'template_id': 'Plantilla activa no encontrada.'}) from exc
        elif source_type == 'draft':
            try:
                draft = TrainingPlan.objects.prefetch_related(
                    'workout_days__exercises'
                ).get(id=plan_id, member=member, status='draft')
            except TrainingPlan.DoesNotExist as exc:
                raise ValidationError({'plan_id': 'Borrador del cliente no encontrado.'}) from exc
        else:
            try:
                source_plan = TrainingPlan.objects.select_related(
                    'member__trainer_asignado',
                ).prefetch_related(
                    'workout_days__exercises'
                ).get(id=plan_id)
            except TrainingPlan.DoesNotExist as exc:
                raise ValidationError({'plan_id': 'Plan reutilizable del cliente no encontrado.'}) from exc

        if not request.user.is_staff:
            own_trainer = _get_trainer_profile(request.user)
            if trainer.id != own_trainer.id or member.trainer_asignado_id != own_trainer.id:
                raise PermissionDenied('Solo puedes asignar planes a tus clientes.')
            if source_type == 'plan' and source_plan.member.trainer_asignado_id != own_trainer.id:
                raise PermissionDenied('Solo puedes reutilizar planes de tus clientes.')
        elif (
            member.trainer_asignado_id
            and member.trainer_asignado_id != trainer.id
            and request.data.get('confirm_trainer_change') is not True
        ):
            raise ValidationError({
                'confirm_trainer_change': 'Confirma explícitamente el cambio de entrenador.',
            })

        assert_member_training_eligible(member)
        if source_type == 'template':
            source_days = list(template.dias.order_by('orden').prefetch_related('ejercicios'))
            if not source_days or any(not list(day.ejercicios.all()) for day in source_days):
                raise ValidationError({'template_id': 'La plantilla debe tener días y ejercicios completos.'})
        else:
            plan_source = draft if source_type == 'draft' else source_plan
            source_days = list(plan_source.workout_days.order_by('order').prefetch_related('exercises'))
            if not source_days or any(not list(day.exercises.all()) for day in source_days):
                raise ValidationError({'plan_id': 'El plan debe tener días y ejercicios completos.'})

        today = timezone.localdate()
        active_plan = TrainingPlan.objects.filter(
            member=member, status='active'
        ).order_by('-start_date', '-id').first()
        if start_date_value:
            try:
                start_date = date.fromisoformat(start_date_value)
            except (TypeError, ValueError) as exc:
                raise ValidationError({'start_date': 'Fecha inválida.'}) from exc
        elif active_plan and active_plan.end_date and active_plan.end_date >= today:
            start_date = active_plan.end_date + timedelta(days=1)
        else:
            start_date = today

        if active_plan and active_plan.end_date and active_plan.end_date >= today:
            if active_plan.end_date > today + timedelta(days=14):
                raise ValidationError({'member_id': 'La rutina activa todavía no está próxima a vencer.'})
            if start_date <= active_plan.end_date:
                raise ValidationError({
                    'start_date': 'La nueva rutina debe iniciar después de la rutina vigente.',
                })

        scheduled_plans = TrainingPlan.objects.filter(
            member=member,
            status='scheduled',
            publicado_en__isnull=False,
        )
        if source_type == 'plan':
            scheduled_plans = scheduled_plans.exclude(id=source_plan.id)
        if scheduled_plans.exists():
            raise ValidationError({'member_id': 'El cliente ya tiene una rutina programada.'})

        status_value = 'active' if start_date <= today else 'scheduled'
        with transaction.atomic():
            if member.trainer_asignado_id != trainer.id:
                member.trainer_asignado = trainer
                member.save(update_fields=['trainer_asignado'])
            if status_value == 'active':
                TrainingPlan.objects.filter(member=member, status='active').update(
                    status='finished', is_active=False, finished_at=timezone.now(),
                )
            if source_type == 'draft':
                plan = TrainingPlan.objects.select_for_update().get(pk=draft.id)
                plan.trainer = trainer
                plan.start_date = start_date
                plan.end_date = start_date + timedelta(weeks=weeks_duration)
                plan.weeks_duration = weeks_duration
                plan.status = status_value
                plan.is_active = status_value == 'active'
                plan.publicado_en = timezone.now()
                plan.publicado_por = request.user
                plan.save(update_fields=[
                    'trainer', 'start_date', 'end_date', 'weeks_duration',
                    'status', 'is_active', 'publicado_en', 'publicado_por',
                ])
            elif source_type == 'plan':
                if source_plan.status == 'scheduled' and source_plan.member_id == member.id:
                    source_plan.status = 'archived'
                    source_plan.is_active = False
                    source_plan.archived_at = timezone.now()
                    source_plan.save(update_fields=['status', 'is_active', 'archived_at'])
                plan = TrainingPlan.objects.create(
                    member=member,
                    trainer=trainer,
                    name=f'{source_plan.name} — copia',
                    goal=source_plan.goal,
                    start_date=start_date,
                    weeks_duration=weeks_duration,
                    days_per_week=source_plan.days_per_week,
                    status=status_value,
                    is_active=status_value == 'active',
                    level=source_plan.level,
                    notes=source_plan.notes,
                    numero_version=(TrainingPlan.objects.filter(member=member).order_by('-numero_version', '-id').values_list('numero_version', flat=True).first() or 0) + 1,
                    plan_origen=source_plan,
                    modo_ejecucion=source_plan.modo_ejecucion,
                    indice_bloque_actual=source_plan.indice_bloque_actual,
                    publicado_en=timezone.now(),
                    publicado_por=request.user,
                )
                for source_day in source_days:
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
                            catalogo_ejercicio=source_exercise.catalogo_ejercicio,
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
            else:
                plan = TrainingPlan.objects.create(
                    member=member,
                    trainer=trainer,
                    name=f'{template.nombre} — {member.user.first_name or member.user.email}',
                    goal=template.objetivo,
                    start_date=start_date,
                    weeks_duration=weeks_duration,
                    days_per_week=template.dias_por_semana_sugeridos,
                    status=status_value,
                    is_active=status_value == 'active',
                    modo_ejecucion=template.modo_ejecucion,
                    publicado_en=timezone.now(),
                    publicado_por=request.user,
                )
                for template_day in source_days:
                    day = WorkoutDay.objects.create(
                        plan=plan,
                        name=template_day.nombre,
                        day_label=template_day.etiqueta_dia,
                        day_of_week=template_day.dia_semana if template.modo_ejecucion == 'weekly' else None,
                        order=template_day.orden,
                    )
                    for template_exercise in template_day.ejercicios.order_by('orden'):
                        Exercise.objects.create(
                            workout_day=day,
                            catalogo_ejercicio=template_exercise.catalogo_ejercicio,
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
        start_date = data['start_date']
        end_date = data['end_date']

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
                status='draft',
                level=data.get('level', 'intermediate'),
                notes=data.get('notes', ''),
                modo_ejecucion=data.get('modo_ejecucion', 'weekly'),
            )
            for day_data in data.get('days', []):
                exercises = day_data.pop('exercises', [])
                day = WorkoutDay.objects.create(plan=plan, **day_data)
                for exercise_data in exercises:
                    machine_id = exercise_data.pop('machine', None)
                    catalogo_id = exercise_data.pop('catalogo_ejercicio', None)
                    Exercise.objects.create(workout_day=day, machine_id=machine_id, catalogo_ejercicio_id=catalogo_id, **exercise_data)

        return Response(TrainingPlanSerializer(plan).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='create-revision')
    def create_revision(self, request, pk=None):
        source = self.get_object()
        assert_member_training_eligible(source.member)
        if source.status != 'active':
            raise ValidationError({'plan': 'Solo un plan publicado puede originar una revisión.'})
        existing = TrainingPlan.objects.filter(
            member=source.member,
            status='draft',
            plan_origen=source,
        ).order_by('-id').first()
        if existing:
            return Response(TrainingPlanSerializer(existing).data)
        with transaction.atomic():
            draft = TrainingPlan.objects.create(
                member=source.member,
                trainer=source.trainer,
                name=source.name,
                goal=source.goal,
                start_date=timezone.localdate(),
                weeks_duration=source.weeks_duration,
                days_per_week=source.days_per_week,
                status='draft',
                level=source.level,
                notes=source.notes,
                numero_version=source.numero_version + 1,
                plan_origen=source,
                modo_ejecucion=source.modo_ejecucion,
                indice_bloque_actual=source.indice_bloque_actual,
            )
            for source_day in source.workout_days.order_by('order'):
                day = WorkoutDay.objects.create(
                    plan=draft,
                    name=source_day.name,
                    day_label=source_day.day_label,
                    day_of_week=source_day.day_of_week,
                    order=source_day.order,
                )
                for exercise in source_day.exercises.order_by('order'):
                    Exercise.objects.create(
                        workout_day=day,
                        catalogo_ejercicio=exercise.catalogo_ejercicio,
                        name=exercise.name,
                        muscle_group=exercise.muscle_group,
                        exercise_type=exercise.exercise_type,
                        sets=exercise.sets,
                        reps_range=exercise.reps_range,
                        target_minutes=exercise.target_minutes,
                        machine=exercise.machine,
                        weight_suggestion_kg=exercise.weight_suggestion_kg,
                        rest_seconds=exercise.rest_seconds,
                        technique_notes=exercise.technique_notes,
                        order=exercise.order,
                    )
        return Response(TrainingPlanSerializer(draft).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='publish')
    def publish(self, request, pk=None):
        plan = self.get_object()
        assert_member_training_eligible(plan.member)
        assert_plan_editable(plan)
        days = plan.workout_days.prefetch_related('exercises').all()
        if not days:
            raise ValidationError({'days': 'Agrega al menos un día antes de publicar.'})
        if any(not day.exercises.exists() for day in days):
            raise ValidationError({'days': 'Cada día debe tener al menos un ejercicio.'})
        with transaction.atomic():
            plan = TrainingPlan.objects.select_for_update().get(pk=plan.pk)
            current = TrainingPlan.objects.select_for_update().filter(
                member=plan.member,
                status='active',
            ).exclude(pk=plan.pk).order_by('-numero_version', '-id').first()
            if current:
                current.status = 'finished'
                current.is_active = False
                current.finished_at = timezone.now()
                current.save(update_fields=['status', 'is_active', 'finished_at'])
                plan.numero_version = max(plan.numero_version, current.numero_version + 1)
                plan.plan_origen = plan.plan_origen or current
            plan.status = 'active'
            plan.is_active = True
            plan.publicado_en = timezone.now()
            plan.publicado_por = request.user
            plan.save(update_fields=[
                'status', 'is_active', 'publicado_en', 'publicado_por',
                'numero_version', 'plan_origen', 'end_date',
            ])
        return Response(TrainingPlanSerializer(plan).data)

    @action(detail=True, methods=['post'], url_path='duplicate')
    def duplicate(self, request, pk=None):
        source = self.get_object()
        assert_member_training_eligible(source.member)
        name = request.data.get('name') or f'{source.name} (copia)'
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
                status='draft',
                level=source.level,
                notes=source.notes,
                numero_version=source.numero_version + 1,
                plan_origen=source,
                modo_ejecucion=source.modo_ejecucion,
                indice_bloque_actual=source.indice_bloque_actual,
            )
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
                        catalogo_ejercicio=source_exercise.catalogo_ejercicio,
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
        if usa_contexto_cliente(self.request):
            assert_member_routine_visible(user.memberprofile)
            queryset = WorkoutDay.objects.filter(plan__member__user=user, plan__status='active')
            if plan_id:
                queryset = queryset.filter(plan_id=plan_id)
            return queryset
        queryset = WorkoutDay.objects.select_related('plan__member__trainer_asignado').all()
        if not user.is_staff and tiene_perfil_entrenador(user):
            trainer_profile = _get_trainer_profile(user)
            queryset = queryset.filter(plan__member__trainer_asignado=trainer_profile)
        elif not user.is_staff:
            return queryset.none()
        if plan_id:
            queryset = queryset.filter(plan_id=plan_id)
        return queryset

    def perform_create(self, serializer):
        plan = serializer.validated_data['plan']
        assert_plan_editable(plan)
        user = self.request.user
        if not user.is_staff:
            trainer_profile = _get_trainer_profile(user)
            if plan.member.trainer_asignado_id != trainer_profile.id:
                raise PermissionDenied('Solo puedes editar días de clientes asignados.')
        assert_member_training_eligible(plan.member)
        serializer.save()

    def perform_update(self, serializer):
        assert_plan_editable(serializer.instance.plan)
        assert_member_training_eligible(serializer.instance.plan.member)
        serializer.save()

    def perform_destroy(self, instance):
        assert_plan_editable(instance.plan)
        assert_member_training_eligible(instance.plan.member)
        instance.delete()

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsTrainer()]
        return [IsAuthenticated()]


class GymMachineViewSet(viewsets.ModelViewSet):
    serializer_class = GymMachineSerializer

    def get_queryset(self):
        queryset = GymMachine.objects.all()
        if usa_contexto_cliente(self.request):
            return queryset.filter(is_active=True)
        return queryset

    def get_permissions(self):
        return [IsAuthenticated()]

    def _validate_manager(self):
        user = self.request.user
        if not user.is_staff and not tiene_perfil_entrenador(user):
            raise PermissionDenied('Solo trainers o staff pueden modificar máquinas del gimnasio.')

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
        if usa_contexto_cliente(self.request):
            assert_member_routine_visible(user.memberprofile)
            return Exercise.objects.filter(
                workout_day__plan__member__user=user,
                workout_day__plan__status='active',
            )
        queryset = Exercise.objects.select_related('workout_day__plan__member__trainer_asignado').all()
        if not user.is_staff and tiene_perfil_entrenador(user):
            trainer_profile = _get_trainer_profile(user)
            queryset = queryset.filter(workout_day__plan__member__trainer_asignado=trainer_profile)
        elif not user.is_staff:
            return queryset.none()
        return queryset

    def perform_create(self, serializer):
        workout_day = serializer.validated_data['workout_day']
        assert_plan_editable(workout_day.plan)
        user = self.request.user
        if not user.is_staff:
            trainer_profile = _get_trainer_profile(user)
            if workout_day.plan.member.trainer_asignado_id != trainer_profile.id:
                raise PermissionDenied('Solo puedes editar ejercicios de clientes asignados.')
        assert_member_training_eligible(workout_day.plan.member)
        serializer.save()

    def perform_update(self, serializer):
        assert_plan_editable(serializer.instance.workout_day.plan)
        assert_member_training_eligible(serializer.instance.workout_day.plan.member)
        serializer.save()

    def perform_destroy(self, instance):
        assert_plan_editable(instance.workout_day.plan)
        assert_member_training_eligible(instance.workout_day.plan.member)
        instance.delete()

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsTrainer()]
        return [IsAuthenticated()]


class PlantillaEntrenamientoViewSet(viewsets.ModelViewSet):
    serializer_class = PlantillaEntrenamientoSerializer
    permission_classes = [IsAuthenticated, IsTrainer]

    def get_queryset(self):
        trainer_profile = _get_trainer_profile(self.request.user)
        queryset = PlantillaEntrenamiento.objects.prefetch_related(
            'dias__ejercicios'
        )
        if self.request.user.is_staff:
            return queryset.order_by('nombre', 'id')
        return queryset.filter(Q(trainer=trainer_profile) | Q(es_compartida=True)).order_by('nombre', 'id')

    def _assert_can_edit(self, plantilla):
        if not self.request.user.is_staff and plantilla.trainer_id != _get_trainer_profile(self.request.user).id:
            raise PermissionDenied('Solo puedes editar tus propias plantillas.')

    def perform_create(self, serializer):
        serializer.save(trainer=_get_trainer_profile(self.request.user))

    def perform_update(self, serializer):
        self._assert_can_edit(serializer.instance)
        serializer.save(trainer=_get_trainer_profile(self.request.user))

    def perform_destroy(self, instance):
        self._assert_can_edit(instance)
        instance.delete()

    @action(detail=True, methods=['post'], url_path='refresh-from-plan')
    def refresh_from_plan(self, request, pk=None):
        plantilla = self.get_object()
        self._assert_can_edit(plantilla)
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
                    dia_semana=day.day_of_week if plan.modo_ejecucion == 'weekly' else None,
                    orden=day.order,
                )
                for exercise in day.exercises.order_by('order'):
                    PlantillaEjercicio.objects.create(
                        dia=template_day,
                        catalogo_ejercicio=exercise.catalogo_ejercicio,
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
        assert_member_training_eligible(member)

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
                status='draft',
                is_active=False,
                modo_ejecucion=plantilla.modo_ejecucion,
            )

            for index, template_day in enumerate(plantilla.dias.order_by('orden')):
                day = WorkoutDay.objects.create(
                    plan=plan,
                    name=template_day.nombre,
                    day_label=template_day.etiqueta_dia,
                    day_of_week=template_day.dia_semana if plantilla.modo_ejecucion == 'weekly' else None,
                    order=template_day.orden,
                )
                for template_exercise in template_day.ejercicios.order_by('orden'):
                    Exercise.objects.create(
                        workout_day=day,
                        catalogo_ejercicio=template_exercise.catalogo_ejercicio,
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


class CatalogoEjercicioViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CatalogoEjercicioSerializer
    permission_classes = [IsAuthenticated, IsTrainer]

    def get_queryset(self):
        queryset = CatalogoEjercicio.objects.filter(esta_activo=True)
        search = (self.request.query_params.get('search') or '').strip()
        for field in ('categoria', 'equipo', 'parte_cuerpo'):
            value = self.request.query_params.get(field)
            if value:
                queryset = queryset.filter(**{field: value})
        if search:
            queryset = queryset.filter(Q(nombre__icontains=search) | Q(musculo_objetivo__icontains=search))
        return queryset.order_by('nombre', 'id')
