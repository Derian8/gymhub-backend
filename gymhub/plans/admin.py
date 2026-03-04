from django.contrib import admin
from .models import TrainingPlan, WorkoutDay, Exercise


@admin.register(TrainingPlan)
class TrainingPlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'member', 'trainer', 'goal', 'start_date', 'is_active')
    list_filter = ('goal', 'is_active')


@admin.register(WorkoutDay)
class WorkoutDayAdmin(admin.ModelAdmin):
    list_display = ('name', 'plan', 'day_label', 'order')


@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ('name', 'workout_day', 'muscle_group', 'sets', 'reps_range')
