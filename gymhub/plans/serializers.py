from rest_framework import serializers
from .models import TrainingPlan, WorkoutDay, Exercise


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


class TodayWorkoutSerializer(serializers.ModelSerializer):
    exercises = ExerciseSerializer(many=True, read_only=True)

    class Meta:
        model = WorkoutDay
        fields = ('id', 'name', 'day_label', 'exercises')
