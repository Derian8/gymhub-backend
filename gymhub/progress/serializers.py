from rest_framework import serializers
from .models import ProgressLog, WorkoutSession, ExerciseLog


class ProgressLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgressLog
        fields = (
            'id', 'member', 'recorded_at', 'weight_kg', 'height_cm',
            'body_fat_pct', 'muscle_mass_kg', 'waist_cm',
            'notes', 'source'
        )
        read_only_fields = ('id',)


class ExerciseLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExerciseLog
        fields = (
            'id', 'session', 'exercise', 'sets_completed',
            'reps_completed', 'minutes_completed', 'weight_used_kg', 'rpe', 'notes'
        )
        read_only_fields = ('id',)


class ExerciseLogInputSerializer(serializers.Serializer):
    exercise_id = serializers.IntegerField()
    sets_completed = serializers.IntegerField(min_value=0, required=False)
    reps_completed = serializers.IntegerField(min_value=0, required=False)
    minutes_completed = serializers.IntegerField(min_value=0, required=False)
    weight_used_kg = serializers.FloatField(required=False, allow_null=True)
    rpe = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=10)
    notes = serializers.CharField(required=False, allow_blank=True)


class BulkExerciseLogSerializer(serializers.Serializer):
    session_id = serializers.IntegerField()
    logs = ExerciseLogInputSerializer(many=True)


class WorkoutSessionSerializer(serializers.ModelSerializer):
    exercise_logs = ExerciseLogSerializer(many=True, read_only=True)

    class Meta:
        model = WorkoutSession
        fields = (
            'id', 'member', 'workout_day', 'attendance',
            'started_at', 'completed_at', 'overall_feeling',
            'is_completed', 'trainer_notes', 'exercise_logs'
        )
        read_only_fields = ('id', 'started_at', 'completed_at', 'is_completed')


class CreateWorkoutSessionSerializer(serializers.Serializer):
    workout_day_id = serializers.IntegerField()
    attendance_id = serializers.IntegerField(required=False, allow_null=True)


class CompleteWorkoutSessionSerializer(serializers.Serializer):
    overall_feeling = serializers.IntegerField(required=False, min_value=1, max_value=5)
    trainer_notes = serializers.CharField(required=False, allow_blank=True)
