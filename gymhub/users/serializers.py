from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.text import slugify
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
    username = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=150,
        validators=User._meta.get_field('username').validators,
    )
    role = serializers.ChoiceField(choices=User.ROLE_CHOICES, default='member')
    password = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('email', 'username', 'first_name', 'last_name', 'role', 'password', 'password2')

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('Ya existe un usuario con este email.')
        return email

    def validate_username(self, value):
        username = value.strip()
        if username and User.objects.filter(username=username).exists():
            raise serializers.ValidationError('Ya existe un usuario con este username.')
        return username

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password2'):
            raise serializers.ValidationError({'password': 'Las contraseñas no coinciden.'})
        return attrs

    def _generate_unique_username(self, email):
        local_part = email.split('@', 1)[0]
        base = slugify(local_part.replace('.', '-').replace('_', '-')) or 'member'
        base = base[:140]
        candidate = base
        suffix = 1

        while User.objects.filter(username=candidate).exists():
            suffix_text = f'-{suffix}'
            candidate = f'{base[:150 - len(suffix_text)]}{suffix_text}'
            suffix += 1

        return candidate

    def create(self, validated_data):
        password = validated_data.pop('password')
        username = validated_data.get('username', '').strip()
        if not username:
            validated_data['username'] = self._generate_unique_username(validated_data['email'])
        else:
            validated_data['username'] = username
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        return value.strip().lower()


class MeUpdateSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=150,
        validators=User._meta.get_field('username').validators,
    )

    class Meta:
        model = User
        fields = ('email', 'username', 'first_name', 'last_name')

    def validate_email(self, value):
        email = value.strip().lower()
        qs = User.objects.filter(email__iexact=email).exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError('Ya existe un usuario con este email.')
        return email

    def validate_username(self, value):
        username = value.strip()
        if username:
            qs = User.objects.filter(username=username).exclude(id=self.instance.id)
            if qs.exists():
                raise serializers.ValidationError('Ya existe un usuario con este username.')
        return username


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
    membresia_actual = serializers.SerializerMethodField()

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
            'suscripcion_activa_id', 'precio_suscripcion_actual', 'membresia_actual',
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

    def _active_subscription(self, obj):
        if not hasattr(self, '_subscription_cache'):
            self._subscription_cache = {}
        if obj.id in self._subscription_cache:
            return self._subscription_cache[obj.id]

        prefetched_subscriptions = getattr(obj, '_prefetched_objects_cache', {}).get('subscriptions')
        if prefetched_subscriptions is not None:
            active_subscriptions = [
                subscription
                for subscription in prefetched_subscriptions
                if subscription.is_active
            ]
            subscription = sorted(
                active_subscriptions,
                key=lambda item: (item.start_date, item.id),
                reverse=True,
            )[0] if active_subscriptions else None
        else:
            subscription = obj.subscriptions.select_related('plan').filter(
                is_active=True,
            ).order_by('-start_date', '-id').first()

        self._subscription_cache[obj.id] = subscription
        return subscription

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
        subscription = self._active_subscription(obj)
        return subscription.id if subscription else None

    def get_precio_suscripcion_actual(self, obj):
        subscription = self._active_subscription(obj)
        return str(subscription.agreed_price) if subscription else None

    def get_membresia_actual(self, obj):
        subscription = self._active_subscription(obj)
        if not subscription:
            return None

        risk = self._risk(obj)
        today = timezone.localdate()
        access_allowed = False
        access_reason = 'payment_required'
        if obj.is_active and subscription.status not in ('suspended', 'cancelled') and subscription.current_period_end:
            if today <= subscription.current_period_end:
                access_allowed = True
                access_reason = None
            else:
                days_after_period = (today - subscription.current_period_end).days
                access_allowed = days_after_period <= subscription.grace_period_days
                access_reason = None if access_allowed else 'payment_overdue'
        elif not obj.is_active:
            access_reason = 'member_inactive'

        return {
            'subscription_id': subscription.id,
            'plan_id': subscription.plan_id,
            'plan_name': subscription.plan.name,
            'agreed_price': str(subscription.agreed_price),
            'recurrence_type': subscription.recurrence_type,
            'status': subscription.status,
            'is_active': subscription.is_active,
            'start_date': subscription.start_date.isoformat() if subscription.start_date else None,
            'next_billing_date': subscription.next_billing_date.isoformat() if subscription.next_billing_date else None,
            'renewal_date': subscription.renewal_date.isoformat() if subscription.renewal_date else None,
            'current_period_start': subscription.current_period_start.isoformat() if subscription.current_period_start else None,
            'current_period_end': subscription.current_period_end.isoformat() if subscription.current_period_end else None,
            'grace_period_days': subscription.grace_period_days,
            'payment_status': risk['payment_status'],
            'days_until_due': risk['days_until_due'],
            'days_overdue': risk['days_overdue'],
            'access_allowed': access_allowed,
            'access_reason': access_reason,
        }


class TrainerProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = TrainerProfile
        fields = ('id', 'user', 'specialization', 'bio', 'certification')
        read_only_fields = ('id', 'user')


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ('id', 'user', 'action_type', 'target_model', 'target_id', 'ip_address', 'details', 'created_at')
        read_only_fields = ('id', 'created_at')
