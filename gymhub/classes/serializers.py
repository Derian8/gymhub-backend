from rest_framework import serializers
from .models import GymClass, ClassEnrollment


class GymClassSerializer(serializers.ModelSerializer):
    trainer_name = serializers.SerializerMethodField()

    class Meta:
        model = GymClass
        fields = (
            'id', 'trainer', 'trainer_name', 'name',
            'schedule', 'max_capacity', 'current_enrolled', 'status'
        )

    def get_trainer_name(self, obj):
        return obj.trainer.user.get_full_name() or obj.trainer.user.email


class ClassEnrollmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassEnrollment
        fields = ('id', 'member', 'gym_class', 'enrolled_at', 'attended')
        read_only_fields = ('id', 'enrolled_at')
