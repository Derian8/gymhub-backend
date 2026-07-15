from rest_framework import serializers
from .models import InactivityAlert, InactivityAlertContact, Notification
from .services import alert_context


class InactivityAlertSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    member_email = serializers.SerializerMethodField()
    member_phone = serializers.SerializerMethodField()
    member_photo = serializers.SerializerMethodField()
    membership_status = serializers.SerializerMethodField()
    membership_name = serializers.SerializerMethodField()
    membership_end_date = serializers.SerializerMethodField()
    weekly_attendance_average = serializers.SerializerMethodField()
    priority = serializers.SerializerMethodField()
    last_contact = serializers.SerializerMethodField()
    latest_note = serializers.SerializerMethodField()
    recommended_action = serializers.SerializerMethodField()
    whatsapp_url = serializers.SerializerMethodField()

    class Meta:
        model = InactivityAlert
        fields = (
            'id', 'member', 'created_at', 'last_checkin_date',
            'days_inactive', 'status', 'resolved', 'resolved_by', 'resolved_at',
            'status_changed_by', 'status_changed_at', 'status_change_reason',
            'reopened_at', 'member_name', 'member_email', 'member_phone',
            'member_photo', 'membership_status', 'membership_name',
            'membership_end_date', 'weekly_attendance_average', 'priority',
            'last_contact', 'latest_note', 'recommended_action', 'whatsapp_url',
        )
        read_only_fields = (
            'id', 'created_at', 'resolved_by', 'resolved_at',
            'status_changed_by', 'status_changed_at', 'status_change_reason',
            'reopened_at',
        )

    def _alert_ctx(self, obj):
        if not hasattr(self, '_alert_context_cache'):
            self._alert_context_cache = {}
        if obj.id not in self._alert_context_cache:
            self._alert_context_cache[obj.id] = alert_context(obj)
        return self._alert_context_cache[obj.id]

    def get_member_name(self, obj):
        return self._alert_ctx(obj)['member_name']

    def get_member_email(self, obj):
        return self._alert_ctx(obj)['member_email']

    def get_member_phone(self, obj):
        return self._alert_ctx(obj)['member_phone']

    def get_member_photo(self, obj):
        return self._alert_ctx(obj)['member_photo']

    def get_membership_status(self, obj):
        return self._alert_ctx(obj)['membership_status']

    def get_membership_name(self, obj):
        return self._alert_ctx(obj)['membership_name']

    def get_membership_end_date(self, obj):
        return self._alert_ctx(obj)['membership_end_date']

    def get_weekly_attendance_average(self, obj):
        return self._alert_ctx(obj)['weekly_attendance_average']

    def get_priority(self, obj):
        return self._alert_ctx(obj)['priority']

    def get_last_contact(self, obj):
        return self._alert_ctx(obj)['last_contact']

    def get_latest_note(self, obj):
        return self._alert_ctx(obj)['latest_note']

    def get_recommended_action(self, obj):
        return self._alert_ctx(obj)['recommended_action']

    def get_whatsapp_url(self, obj):
        return self._alert_ctx(obj)['whatsapp_url']


class InactivityAlertContactSerializer(serializers.ModelSerializer):
    trainer_name = serializers.SerializerMethodField()

    class Meta:
        model = InactivityAlertContact
        fields = (
            'id', 'member', 'trainer', 'trainer_name', 'alert', 'contacted_at',
            'method', 'result', 'note', 'next_follow_up_date', 'created_at',
        )
        read_only_fields = ('id', 'member', 'trainer', 'trainer_name', 'alert', 'created_at')

    def get_trainer_name(self, obj):
        return obj.trainer.user.get_full_name() or obj.trainer.user.email


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ('id', 'user', 'message', 'type', 'read', 'created_at')
        read_only_fields = ('id', 'created_at', 'user')
