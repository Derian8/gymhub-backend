from django.contrib import admin
from .models import ProgressLog, WorkoutSession, ExerciseLog


@admin.register(ProgressLog)
class ProgressLogAdmin(admin.ModelAdmin):
    list_display = ('member', 'recorded_at', 'weight_kg', 'body_fat_pct', 'source')


@admin.register(WorkoutSession)
class WorkoutSessionAdmin(admin.ModelAdmin):
    list_display = ('member', 'workout_day', 'started_at', 'is_completed')


@admin.register(ExerciseLog)
class ExerciseLogAdmin(admin.ModelAdmin):
    list_display = ('exercise', 'session', 'sets_completed', 'reps_completed', 'weight_used_kg', 'rpe')
