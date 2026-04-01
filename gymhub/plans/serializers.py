from rest_framework import serializers
from .models import (
    TrainingPlan, WorkoutDay, Exercise,
    PlantillaEntrenamiento, PlantillaDiaEntrenamiento, PlantillaEjercicio,
)


class ExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        fields = (
            'id', 'workout_day', 'name', 'muscle_group',
            'sets', 'reps_range', 'weight_suggestion_kg',
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
            'id', 'dia', 'nombre', 'grupo_muscular', 'series',
            'rango_repeticiones', 'peso_sugerido_kg', 'descanso_segundos',
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
