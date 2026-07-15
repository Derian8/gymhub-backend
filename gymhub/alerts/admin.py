from django.contrib import admin
from .models import InactivityAlert, InactivityAlertContact, MemberJustifiedAbsence, Notification


@admin.register(InactivityAlert)
class InactivityAlertAdmin(admin.ModelAdmin):
    list_display = ('member', 'days_inactive', 'status', 'last_checkin_date', 'created_at')
    list_filter = ('status', 'resolved')
    search_fields = ('member__user__first_name', 'member__user__last_name', 'member__user__email')


@admin.register(InactivityAlertContact)
class InactivityAlertContactAdmin(admin.ModelAdmin):
    list_display = ('member', 'trainer', 'method', 'result', 'contacted_at')
    list_filter = ('method',)
    search_fields = ('member__user__first_name', 'member__user__last_name', 'member__user__email', 'result')


@admin.register(MemberJustifiedAbsence)
class MemberJustifiedAbsenceAdmin(admin.ModelAdmin):
    list_display = ('member', 'trainer', 'start_date', 'end_date', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('member__user__first_name', 'member__user__last_name', 'member__user__email', 'reason')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'type', 'read', 'created_at')
    list_filter = ('type', 'read')
