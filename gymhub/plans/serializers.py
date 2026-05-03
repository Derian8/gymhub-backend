from django.utils import timezone
from rest_framework import serializers
from .models import (
    TrainingPlan, WorkoutDay, Exercise, GymMachine,
    PlantillaEntrenamiento, PlantillaDiaEntrenamiento, PlantillaEjercicio,
)


class GymMachineSerializer(serializers.ModelSerializer):
    class Meta:
        model = GymMachine
        fields = ('id', 'name', 'category', 'notes', 'is_active')


class ExerciseSerializer(serializers.ModelSerializer):
    machine_detail = GymMachineSerializer(source='machine', read_only=True)

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

        return attrs

    class Meta:
        model = Exercise
        fields = (
            'id', 'workout_day', 'name', 'muscle_group', 'exercise_type',
            'sets', 'reps_range', 'target_minutes', 'machine', 'machine_detail',
            'weight_suggestion_kg', 'rest_seconds', 'technique_notes', 'order'
        )


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

    class Meta:
        model = TrainingPlan
        fields = (
            'id', 'member', 'trainer', 'name', 'goal',
            'start_date', 'end_date', 'weeks_duration',
            'days_per_week', 'is_active', 'workout_days'
        )
        read_only_fields = ('trainer',)


class TodayWorkoutSerializer(serializers.ModelSerializer):
    exercises = ExerciseSerializer(many=True, read_only=True)
    today_session_id = serializers.SerializerMethodField()
    today_session_completed = serializers.SerializerMethodField()
    today_session_started = serializers.SerializerMethodField()

    def _get_member(self):
        member = self.context.get('member')
        if member:
            return member

        request = self.context.get('request')
        if request and getattr(request.user, 'role', None) == 'member':
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

    class Meta:
        model = WorkoutDay
        fields = (
            'id', 'name', 'day_label', 'day_of_week', 'exercises',
            'today_session_id', 'today_session_completed', 'today_session_started',
        )


class PlantillaEjercicioSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlantillaEjercicio
        fields = (
            'id', 'dia', 'nombre', 'grupo_muscular', 'tipo_ejercicio', 'series',
            'rango_repeticiones', 'minutos_objetivo', 'peso_sugerido_kg', 'descanso_segundos',
            'notas_tecnicas', 'orden',
        )


class PlantillaDiaEntrenamientoSerializer(serializers.ModelSerializer):
    ejercicios = PlantillaEjercicioSerializer(many=True, read_only=True)

    class Meta:
        model = PlantillaDiaEntrenamiento
        fields = ('id', 'plantilla', 'nombre', 'etiqueta_dia', 'orden', 'ejercicios')


class PlantillaEntrenamientoSerializer(serializers.ModelSerializer):
    dias = PlantillaDiaEntrenamientoSerializer(many=True, read_only=True)
    trainer_nombre = serializers.SerializerMethodField()

    class Meta:
        model = PlantillaEntrenamiento
        fields = (
            'id', 'trainer', 'trainer_nombre', 'nombre', 'descripcion',
            'objetivo', 'nivel_adherencia_recomendado', 'dias_por_semana_sugeridos',
            'esta_activa', 'creada_en', 'dias',
        )
        read_only_fields = ('trainer', 'creada_en')

    def get_trainer_nombre(self, obj):
        return obj.trainer.user.get_full_name() or obj.trainer.user.email
