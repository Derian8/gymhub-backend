from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers
from users.permissions import usa_contexto_cliente
from .models import (
    TrainingPlan, WorkoutDay, Exercise, GymMachine,
    PlantillaEntrenamiento, PlantillaDiaEntrenamiento, PlantillaEjercicio, CatalogoEjercicio,
)


class CatalogoEjercicioSerializer(serializers.ModelSerializer):
    class Meta:
        model = CatalogoEjercicio
        fields = (
            'id', 'identificador_origen', 'nombre', 'categoria', 'parte_cuerpo',
            'equipo', 'musculo_objetivo', 'grupo_muscular', 'musculos_secundarios',
            'grupo_muscular_plan', 'maquina_recomendada',
            'instrucciones_es', 'pasos_es', 'imagen_url', 'animacion_url',
            'atribucion_media', 'version_origen', 'esta_activo',
            'es_catalogo_base',
        )


class GymMachineSerializer(serializers.ModelSerializer):
    class Meta:
        model = GymMachine
        fields = ('id', 'name', 'category', 'notes', 'is_active', 'es_catalogo_base')


class ExerciseSerializer(serializers.ModelSerializer):
    machine_detail = GymMachineSerializer(source='machine', read_only=True)
    catalogo_detalle = CatalogoEjercicioSerializer(source='catalogo_ejercicio', read_only=True)
    previous_log = serializers.SerializerMethodField()
    imagen_visual_url = serializers.SerializerMethodField()

    def validate(self, attrs):
        exercise_type = attrs.get('exercise_type', getattr(self.instance, 'exercise_type', 'strength'))
        sets = attrs.get('sets', getattr(self.instance, 'sets', None))
        reps_range = attrs.get('reps_range', getattr(self.instance, 'reps_range', ''))
        target_minutes = attrs.get('target_minutes', getattr(self.instance, 'target_minutes', None))

        if exercise_type == 'timed':
            if not target_minutes:
                raise serializers.ValidationError({'target_minutes': 'Este campo es requerido para ejercicios por tiempo.'})
            if sets is not None:
                raise serializers.ValidationError({'sets': 'Los ejercicios por tiempo no usan series.'})
            if reps_range:
                raise serializers.ValidationError({'reps_range': 'Los ejercicios por tiempo no usan repeticiones.'})
        else:
            if not sets:
                raise serializers.ValidationError({'sets': 'Este campo es requerido para ejercicios de fuerza.'})
            if not reps_range:
                raise serializers.ValidationError({'reps_range': 'Este campo es requerido para ejercicios de fuerza.'})
            if target_minutes is not None:
                raise serializers.ValidationError({'target_minutes': 'Los ejercicios de fuerza no usan minutos objetivo.'})

        actualiza_referencia = any(field in attrs for field in ('name', 'catalogo_ejercicio', 'imagen_referencia_url'))
        catalogo = attrs.get('catalogo_ejercicio', getattr(self.instance, 'catalogo_ejercicio', None))
        imagen_personalizada = attrs.get('imagen_referencia_url', getattr(self.instance, 'imagen_referencia_url', ''))
        if isinstance(catalogo, int):
            tiene_imagen_catalogo = CatalogoEjercicio.objects.filter(id=catalogo).exclude(imagen_url='', animacion_url='').exists()
        else:
            tiene_imagen_catalogo = bool(catalogo and (catalogo.animacion_url or catalogo.imagen_url))
        if actualiza_referencia and not imagen_personalizada and not (
            tiene_imagen_catalogo
        ):
            raise serializers.ValidationError({
                'imagen_referencia_url': 'Selecciona un ejercicio del catálogo con imagen o indica una URL HTTPS de referencia.',
            })
        return attrs

    def validate_imagen_referencia_url(self, value):
        if value and not value.startswith('https://'):
            raise serializers.ValidationError('La imagen de referencia debe usar una URL HTTPS.')
        return value

    class Meta:
        model = Exercise
        fields = (
            'id', 'workout_day', 'catalogo_ejercicio', 'catalogo_detalle', 'name', 'muscle_group', 'exercise_type',
            'sets', 'reps_range', 'target_minutes', 'machine', 'machine_detail',
            'weight_suggestion_kg', 'weight_suggestion_unit', 'rest_seconds', 'technique_notes', 'order',
            'imagen_referencia_url', 'imagen_visual_url', 'previous_log',
        )

    def get_imagen_visual_url(self, obj):
        if obj.imagen_referencia_url:
            return obj.imagen_referencia_url
        if obj.catalogo_ejercicio:
            return obj.catalogo_ejercicio.animacion_url or obj.catalogo_ejercicio.imagen_url
        return ''

    def get_previous_log(self, obj):
        member = self.context.get('member')
        if not member:
            request = self.context.get('request')
            if request and usa_contexto_cliente(request):
                member = getattr(request.user, 'memberprofile', None)
        if not member:
            return None

        from progress.models import ExerciseLog

        previous = (
            ExerciseLog.objects
            .filter(
                exercise=obj,
                session__member=member,
                session__is_completed=True,
            )
            .exclude(session__completed_at__date=timezone.localdate())
            .select_related('session')
            .order_by('-session__completed_at', '-session__started_at', '-id')
            .first()
        )
        if not previous:
            return None

        weight_delta = None
        if obj.weight_suggestion_kg is not None and previous.weight_used_kg is not None:
            weight_delta = round(obj.weight_suggestion_kg - previous.weight_used_kg, 1)

        return {
            'session_id': previous.session_id,
            'date': previous.session.completed_at.date().isoformat() if previous.session.completed_at else previous.session.started_at.date().isoformat(),
            'sets_completed': previous.sets_completed,
            'reps_completed': previous.reps_completed,
            'minutes_completed': previous.minutes_completed,
            'weight_used_kg': previous.weight_used_kg,
            'rpe': previous.rpe,
            'weight_delta_kg': weight_delta,
        }


class WorkoutDaySerializer(serializers.ModelSerializer):
    exercises = ExerciseSerializer(many=True, read_only=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        plan = attrs.get('plan', getattr(self.instance, 'plan', None))
        day_of_week = attrs.get('day_of_week', getattr(self.instance, 'day_of_week', None))

        if plan and day_of_week:
            duplicated = WorkoutDay.objects.filter(plan=plan, day_of_week=day_of_week)
            if self.instance:
                duplicated = duplicated.exclude(pk=self.instance.pk)
            if duplicated.exists():
                raise serializers.ValidationError({
                    'day_of_week': 'Ya existe un bloque asignado para este día de la semana en el plan.'
                })

        return attrs

    class Meta:
        model = WorkoutDay
        fields = ('id', 'plan', 'name', 'day_label', 'day_of_week', 'order', 'exercises')


class WorkoutDayBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutDay
        fields = ('id', 'name', 'day_label', 'day_of_week', 'order')


class TrainingPlanSerializer(serializers.ModelSerializer):
    workout_days = WorkoutDayBriefSerializer(many=True, read_only=True)
    member_name = serializers.SerializerMethodField()
    member_email = serializers.EmailField(source='member.user.email', read_only=True)
    member_photo = serializers.ImageField(source='member.photo', read_only=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        start_date = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end_date = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        weeks_duration = attrs.get('weeks_duration', getattr(self.instance, 'weeks_duration', None))
        status = attrs.get('status', getattr(self.instance, 'status', None))
        is_active = attrs.get('is_active', getattr(self.instance, 'is_active', None))

        if start_date and weeks_duration and not end_date:
            attrs['end_date'] = start_date + timedelta(weeks=weeks_duration)
        if start_date and attrs.get('end_date') and attrs['end_date'] < start_date:
            raise serializers.ValidationError({'end_date': 'La fecha final no puede ser anterior a la fecha inicial.'})
        if status == 'active':
            attrs['is_active'] = True
        elif status in {'draft', 'scheduled', 'finished', 'archived'}:
            attrs['is_active'] = False
        if status and status != 'active' and is_active:
            raise serializers.ValidationError({'is_active': 'Solo los planes activos pueden tener is_active=True.'})
        return attrs

    class Meta:
        model = TrainingPlan
        fields = (
            'id', 'member', 'trainer', 'name', 'goal',
            'start_date', 'end_date', 'weeks_duration',
            'days_per_week', 'is_active', 'status', 'level', 'notes',
            'archived_at', 'finished_at', 'workout_days',
            'member_name', 'member_email', 'member_photo',
            'numero_version', 'publicado_en', 'publicado_por', 'plan_origen',
            'modo_ejecucion', 'indice_bloque_actual',
        )
        read_only_fields = (
            'trainer', 'archived_at', 'finished_at', 'numero_version',
            'publicado_en', 'publicado_por', 'plan_origen',
        )

    def get_member_name(self, obj):
        return obj.member.user.get_full_name() or obj.member.user.email


class NestedExerciseInputSerializer(serializers.Serializer):
    catalogo_ejercicio = serializers.IntegerField(required=False, allow_null=True)
    imagen_referencia_url = serializers.URLField(required=False, allow_blank=True)
    name = serializers.CharField(max_length=200)
    muscle_group = serializers.ChoiceField(choices=Exercise._meta.get_field('muscle_group').choices)
    exercise_type = serializers.ChoiceField(choices=Exercise._meta.get_field('exercise_type').choices, default='strength')
    sets = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=20)
    reps_range = serializers.CharField(required=False, allow_blank=True, max_length=10)
    target_minutes = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=600)
    machine = serializers.IntegerField(required=False, allow_null=True)
    weight_suggestion_kg = serializers.FloatField(required=False, allow_null=True, min_value=0)
    weight_suggestion_unit = serializers.ChoiceField(
        choices=Exercise._meta.get_field('weight_suggestion_unit').choices,
        default='kg',
    )
    rest_seconds = serializers.IntegerField(default=60, min_value=1, max_value=600)
    technique_notes = serializers.CharField(required=False, allow_blank=True)
    order = serializers.IntegerField(default=0, min_value=0)

    def validate(self, attrs):
        attrs = ExerciseSerializer().validate(attrs)
        image_url = attrs.get('imagen_referencia_url', '')
        if image_url and not image_url.startswith('https://'):
            raise serializers.ValidationError({'imagen_referencia_url': 'La imagen de referencia debe usar una URL HTTPS.'})
        catalogo_id = attrs.get('catalogo_ejercicio')
        if catalogo_id and not CatalogoEjercicio.objects.filter(id=catalogo_id).exists():
            raise serializers.ValidationError({
                'catalogo_ejercicio': 'El ejercicio seleccionado ya no existe en el catálogo.',
            })
        machine_id = attrs.get('machine')
        if machine_id and not GymMachine.objects.filter(id=machine_id).exists():
            raise serializers.ValidationError({
                'machine': 'La máquina seleccionada ya no existe en el catálogo del gimnasio.',
            })
        tiene_imagen_catalogo = bool(catalogo_id) and CatalogoEjercicio.objects.filter(
            id=catalogo_id,
        ).exclude(imagen_url='', animacion_url='').exists()
        if not image_url and not tiene_imagen_catalogo:
            raise serializers.ValidationError({
                'imagen_referencia_url': 'Selecciona un ejercicio del catálogo con imagen o indica una URL HTTPS de referencia.',
            })
        return attrs


class NestedWorkoutDayInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    day_label = serializers.ChoiceField(choices=WorkoutDay._meta.get_field('day_label').choices)
    day_of_week = serializers.ChoiceField(choices=WorkoutDay._meta.get_field('day_of_week').choices, required=False, allow_null=True)
    order = serializers.IntegerField(default=0, min_value=0)
    exercises = NestedExerciseInputSerializer(many=True, required=False)


class DuplicateWorkoutDaySerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    day_label = serializers.ChoiceField(choices=WorkoutDay._meta.get_field('day_label').choices)
    day_of_week = serializers.ChoiceField(
        choices=WorkoutDay._meta.get_field('day_of_week').choices,
        required=False,
        allow_null=True,
    )


class CompleteTrainingPlanSerializer(serializers.Serializer):
    member = serializers.IntegerField()
    name = serializers.CharField(max_length=200)
    goal = serializers.ChoiceField(choices=TrainingPlan._meta.get_field('goal').choices)
    start_date = serializers.DateField()
    end_date = serializers.DateField(required=False, allow_null=True)
    weeks_duration = serializers.IntegerField(min_value=1, max_value=52, default=8)
    days_per_week = serializers.IntegerField(min_value=1, max_value=7, default=3)
    status = serializers.ChoiceField(choices=TrainingPlan._meta.get_field('status').choices, default='draft')
    level = serializers.ChoiceField(choices=TrainingPlan._meta.get_field('level').choices, default='intermediate')
    notes = serializers.CharField(required=False, allow_blank=True)
    modo_ejecucion = serializers.ChoiceField(choices=('weekly', 'cycle'), default='weekly')
    conflict_strategy = serializers.ChoiceField(
        choices=('keep', 'replace_active', 'schedule_after_active'),
        default='keep',
    )
    days = NestedWorkoutDayInputSerializer(many=True, required=False)

    def validate(self, attrs):
        start_date = attrs['start_date']
        weeks_duration = attrs.get('weeks_duration') or 8
        end_date = attrs.get('end_date') or start_date + timedelta(weeks=weeks_duration)
        if end_date < start_date:
            raise serializers.ValidationError({'end_date': 'La fecha final no puede ser anterior a la fecha inicial.'})
        attrs['end_date'] = end_date

        day_weekdays = [day.get('day_of_week') for day in attrs.get('days', []) if day.get('day_of_week')]
        if attrs.get('modo_ejecucion') == 'weekly' and (
            len(day_weekdays) != len(attrs.get('days', [])) or len(day_weekdays) != len(set(day_weekdays))
        ):
            raise serializers.ValidationError({'days': 'No puedes repetir el mismo día real de la semana dentro del plan.'})
        if attrs.get('status') in {'active', 'scheduled'}:
            days = attrs.get('days', [])
            if not days or any(not day.get('exercises') for day in days):
                raise serializers.ValidationError({
                    'days': 'Agrega al menos un ejercicio en cada día antes de activar o programar la rutina.',
                })
        return attrs


class TodayWorkoutSerializer(serializers.ModelSerializer):
    exercises = serializers.SerializerMethodField()
    today_session_id = serializers.SerializerMethodField()
    today_session_completed = serializers.SerializerMethodField()
    today_session_started = serializers.SerializerMethodField()
    progreso_sesion = serializers.SerializerMethodField()

    def _get_member(self):
        member = self.context.get('member')
        if member:
            return member

        request = self.context.get('request')
        if request and usa_contexto_cliente(request):
            return getattr(request.user, 'memberprofile', None)
        return None

    def _get_today_session(self, obj):
        cache = getattr(self, '_today_session_cache', None)
        if cache is None:
            cache = {}
            self._today_session_cache = cache

        if obj.pk in cache:
            return cache[obj.pk]

        member = self._get_member()
        if not member:
            cache[obj.pk] = None
            return None

        from progress.models import WorkoutSession

        session = WorkoutSession.objects.filter(
            member=member,
            workout_day=obj,
            started_at__date=timezone.localdate(),
        ).order_by('-started_at', '-id').first()
        cache[obj.pk] = session
        return session

    def get_today_session_id(self, obj):
        session = self._get_today_session(obj)
        return session.id if session else None

    def get_today_session_completed(self, obj):
        session = self._get_today_session(obj)
        return bool(session and session.is_completed)

    def get_today_session_started(self, obj):
        session = self._get_today_session(obj)
        return bool(session and not session.is_completed)

    def get_progreso_sesion(self, obj):
        session = self._get_today_session(obj)
        total = obj.exercises.count()
        if not session:
            return {'total': total, 'realizados': 0, 'omitidos': 0, 'pendientes': total, 'ejercicios': []}

        from progress.models import ExerciseLog
        estados = {}
        for log in ExerciseLog.objects.filter(session=session).order_by('exercise_id', '-id'):
            estados.setdefault(log.exercise_id, log.estado)
        realizados = sum(estado == 'realizado' for estado in estados.values())
        omitidos = sum(estado == 'omitido' for estado in estados.values())
        return {
            'total': total,
            'realizados': realizados,
            'omitidos': omitidos,
            'pendientes': max(total - len(estados), 0),
            'ejercicios': [
                {'exercise_id': exercise_id, 'estado': estado}
                for exercise_id, estado in estados.items()
            ],
        }

    def get_exercises(self, obj):
        return ExerciseSerializer(
            obj.exercises.all(),
            many=True,
            context={**self.context, 'member': self._get_member()},
        ).data

    class Meta:
        model = WorkoutDay
        fields = (
            'id', 'name', 'day_label', 'day_of_week', 'exercises',
            'today_session_id', 'today_session_completed', 'today_session_started',
            'progreso_sesion',
        )


class PlantillaEjercicioSerializer(serializers.ModelSerializer):
    catalogo_detalle = CatalogoEjercicioSerializer(source='catalogo_ejercicio', read_only=True)
    class Meta:
        model = PlantillaEjercicio
        fields = (
            'id', 'dia', 'catalogo_ejercicio', 'catalogo_detalle', 'nombre', 'grupo_muscular', 'tipo_ejercicio', 'series',
            'rango_repeticiones', 'minutos_objetivo', 'peso_sugerido_kg', 'unidad_peso_sugerido', 'descanso_segundos',
            'notas_tecnicas', 'orden', 'imagen_referencia_url',
        )


class PlantillaDiaEntrenamientoSerializer(serializers.ModelSerializer):
    ejercicios = PlantillaEjercicioSerializer(many=True, read_only=True)

    class Meta:
        model = PlantillaDiaEntrenamiento
        fields = ('id', 'plantilla', 'nombre', 'etiqueta_dia', 'dia_semana', 'orden', 'ejercicios')


class PlantillaEntrenamientoSerializer(serializers.ModelSerializer):
    dias = PlantillaDiaEntrenamientoSerializer(many=True, read_only=True)
    trainer_nombre = serializers.SerializerMethodField()

    class Meta:
        model = PlantillaEntrenamiento
        fields = (
            'id', 'trainer', 'trainer_nombre', 'nombre', 'descripcion',
            'objetivo', 'nivel_adherencia_recomendado', 'dias_por_semana_sugeridos',
            'es_compartida', 'modo_ejecucion',
            'esta_activa', 'creada_en', 'dias',
        )
        read_only_fields = ('trainer', 'creada_en')

    def get_trainer_nombre(self, obj):
        return obj.trainer.user.get_full_name() or obj.trainer.user.email
