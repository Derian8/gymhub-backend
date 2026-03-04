from django.contrib import admin
from .models import GymClass, ClassEnrollment


@admin.register(GymClass)
class GymClassAdmin(admin.ModelAdmin):
    list_display = ('name', 'trainer', 'schedule', 'max_capacity', 'current_enrolled', 'status')
    list_filter = ('status',)


@admin.register(ClassEnrollment)
class ClassEnrollmentAdmin(admin.ModelAdmin):
    list_display = ('member', 'gym_class', 'enrolled_at', 'attended')
