from rest_framework import serializers
from .models import InactivityAlert, Notification


class InactivityAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = InactivityAlert
        fields = (
            'id', 'member', 'created_at', 'last_checkin_date',
            'days_inactive', 'resolved', 'resolved_by', 'resolved_at'
        )
        read_only_fields = ('id', 'created_at', 'resolved_by', 'resolved_at')


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ('id', 'user', 'message', 'type', 'read', 'created_at')
        read_only_fields = ('id', 'created_at', 'user')
