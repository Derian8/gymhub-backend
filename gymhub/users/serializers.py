from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import MemberProfile, TrainerProfile, AuditLog

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    memberprofile_id = serializers.SerializerMethodField()
    trainerprofile_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'email', 'username', 'first_name', 'last_name',
            'role', 'is_staff', 'memberprofile_id', 'trainerprofile_id'
        )
        read_only_fields = ('id', 'is_staff', 'memberprofile_id', 'trainerprofile_id')

    def get_memberprofile_id(self, obj):
        profile = getattr(obj, 'memberprofile', None)
        return profile.id if profile else None

    def get_trainerprofile_id(self, obj):
        profile = getattr(obj, 'trainerprofile', None)
        return profile.id if profile else None


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('email', 'username', 'first_name', 'last_name', 'role', 'password', 'password2')

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password2'):
            raise serializers.ValidationError({'password': 'Las contraseñas no coinciden.'})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class MemberProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = MemberProfile
        fields = (
            'id', 'user', 'email', 'full_name',
            'membership_plan', 'phone', 'birth_date',
            'emergency_contact', 'join_date', 'is_active', 'photo'
        )
        read_only_fields = ('id', 'user', 'email', 'full_name')

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.email


class TrainerProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = TrainerProfile
        fields = ('id', 'user', 'specialization', 'bio', 'certification')
        read_only_fields = ('id', 'user')


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ('id', 'user', 'action_type', 'target_model', 'target_id', 'ip_address', 'created_at')
        read_only_fields = ('id', 'created_at')
