from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import MemberProfile, TrainerProfile, AuditLog
from .services import get_member_prescription_status, get_member_risk_snapshot

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
    trainer_asignado = serializers.IntegerField(source='trainer_asignado_id', read_only=True)
    trainer_asignado_nombre = serializers.SerializerMethodField()
    riesgo_adherencia = serializers.SerializerMethodField()
    nivel_riesgo = serializers.SerializerMethodField()
    motivos_riesgo = serializers.SerializerMethodField()
    days_since_last_checkin = serializers.SerializerMethodField()
    days_since_last_session = serializers.SerializerMethodField()
    days_since_last_progress = serializers.SerializerMethodField()
    estado_prescripcion = serializers.SerializerMethodField()
    tiene_plan_activo = serializers.SerializerMethodField()
    prescripcion_lista_para_member = serializers.SerializerMethodField()
    suscripcion_activa_id = serializers.SerializerMethodField()
    precio_suscripcion_actual = serializers.SerializerMethodField()

    class Meta:
        model = MemberProfile
        fields = (
            'id', 'user', 'email', 'full_name',
            'membership_plan', 'phone', 'birth_date',
            'emergency_contact', 'join_date', 'is_active', 'photo',
            'trainer_asignado', 'trainer_asignado_nombre',
            'riesgo_adherencia', 'nivel_riesgo', 'motivos_riesgo',
            'days_since_last_checkin', 'days_since_last_session', 'days_since_last_progress',
            'estado_prescripcion', 'tiene_plan_activo', 'prescripcion_lista_para_member',
            'suscripcion_activa_id', 'precio_suscripcion_actual',
        )
        read_only_fields = ('id', 'user', 'email', 'full_name')

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.email

    def get_trainer_asignado_nombre(self, obj):
        if not obj.trainer_asignado:
            return None
        return obj.trainer_asignado.user.get_full_name() or obj.trainer_asignado.user.email

    def _risk(self, obj):
        if not hasattr(self, '_risk_cache'):
            self._risk_cache = {}
        if obj.id not in self._risk_cache:
            self._risk_cache[obj.id] = get_member_risk_snapshot(obj)
        return self._risk_cache[obj.id]

    def _prescription(self, obj):
        if not hasattr(self, '_prescription_cache'):
            self._prescription_cache = {}
        if obj.id not in self._prescription_cache:
            self._prescription_cache[obj.id] = get_member_prescription_status(obj)
        return self._prescription_cache[obj.id]

    def get_riesgo_adherencia(self, obj):
        return self._risk(obj)['riesgo_adherencia']

    def get_nivel_riesgo(self, obj):
        return self._risk(obj)['nivel_riesgo']

    def get_motivos_riesgo(self, obj):
        return self._risk(obj)['motivos_riesgo']

    def get_days_since_last_checkin(self, obj):
        return self._risk(obj)['days_since_last_checkin']

    def get_days_since_last_session(self, obj):
        return self._risk(obj)['days_since_last_session']

    def get_days_since_last_progress(self, obj):
        return self._risk(obj)['days_since_last_progress']

    def get_estado_prescripcion(self, obj):
        return self._prescription(obj)['estado']

    def get_tiene_plan_activo(self, obj):
        return self._prescription(obj)['tiene_plan_activo']

    def get_prescripcion_lista_para_member(self, obj):
        return self._prescription(obj)['esta_lista_para_member']

    def get_suscripcion_activa_id(self, obj):
        subscription = obj.subscriptions.filter(is_active=True).order_by('-id').first()
        return subscription.id if subscription else None

    def get_precio_suscripcion_actual(self, obj):
        subscription = obj.subscriptions.filter(is_active=True).order_by('-id').first()
        return str(subscription.agreed_price) if subscription else None


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
