from rest_framework import serializers
from .models import Attendance


class AttendanceSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    member_email = serializers.EmailField(source='member.user.email', read_only=True)
    checked_in_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = (
            'id', 'member', 'gym_class', 'checked_in_by',
            'member_name', 'member_email', 'checked_in_by_name',
            'attendance_date', 'check_in_time', 'check_out_time',
            'duration_minutes', 'is_manual_override', 'notes',
            'es_excepcion_comercial', 'motivo_excepcion',
        )
        read_only_fields = (
            'id', 'attendance_date', 'check_in_time', 'check_out_time',
            'duration_minutes', 'is_manual_override', 'checked_in_by',
            'member_name', 'member_email', 'checked_in_by_name',
            'es_excepcion_comercial', 'motivo_excepcion',
        )

    def get_member_name(self, obj):
        return obj.member.user.get_full_name() or obj.member.user.email

    def get_checked_in_by_name(self, obj):
        if not obj.checked_in_by:
            return None
        return obj.checked_in_by.get_full_name() or obj.checked_in_by.email


class CheckInSerializer(serializers.Serializer):
    member_id = serializers.IntegerField(required=False)
    gym_class_id = serializers.IntegerField(required=False, allow_null=True)
    trainer_override = serializers.BooleanField(default=False)
    override_reason = serializers.CharField(required=False, allow_blank=True, max_length=500)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)
