from django.contrib import admin
from .models import InactivityAlert, Notification


@admin.register(InactivityAlert)
class InactivityAlertAdmin(admin.ModelAdmin):
    list_display = ('member', 'days_inactive', 'resolved', 'created_at')
    list_filter = ('resolved',)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'type', 'read', 'created_at')
    list_filter = ('type', 'read')
