from django.contrib import admin
from .models import Attendance


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ('member', 'check_in_time', 'gym_class', 'is_manual_override')
    list_filter = ('is_manual_override',)
    date_hierarchy = 'check_in_time'
