from rest_framework import serializers
from .models import Attendance


class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = (
            'id', 'member', 'gym_class', 'checked_in_by',
            'check_in_time', 'is_manual_override', 'notes'
        )
        read_only_fields = ('id', 'check_in_time', 'is_manual_override', 'checked_in_by')


class CheckInSerializer(serializers.Serializer):
    gym_class_id = serializers.IntegerField(required=False, allow_null=True)
    trainer_override = serializers.BooleanField(default=False)
