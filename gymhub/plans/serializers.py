from rest_framework import serializers
from .models import (
    TrainingPlan, WorkoutDay, Exercise,
    PlantillaEntrenamiento, PlantillaDiaEntrenamiento, PlantillaEjercicio,
)


class ExerciseSerializer(serializers.ModelSerializer):
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
            'sets', 'reps_range', 'target_minutes', 'weight_suggestion_kg',
            'rest_seconds', 'technique_notes', 'order'
        )


class WorkoutDaySerializer(serializers.ModelSerializer):
    exercises = ExerciseSerializer(many=True, read_only=True)

    class Meta:
        model = WorkoutDay
        fields = ('id', 'plan', 'name', 'day_label', 'order', 'exercises')


class WorkoutDayBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutDay
        fields = ('id', 'name', 'day_label', 'order')


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

    class Meta:
        model = WorkoutDay
        fields = ('id', 'name', 'day_label', 'exercises')


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
