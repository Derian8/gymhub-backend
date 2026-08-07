from rest_framework import serializers
from .models import MembershipPlan, MemberSubscription, PaymentSchedule, PaymentRecord, PaymentMethod, PaymentInstruction
from .services import default_grace_days, membership_access, membership_summary, refresh_membership_status


class MembershipPlanSerializer(serializers.ModelSerializer):
    trainer_nombre = serializers.SerializerMethodField()

    class Meta:
        model = MembershipPlan
        fields = (
            'id', 'trainer', 'trainer_nombre', 'name', 'description',
            'price', 'recurrence_type', 'grace_period_days',
            'features', 'is_active',
        )

    def validate(self, attrs):
        recurrence_type = attrs.get(
            'recurrence_type',
            getattr(self.instance, 'recurrence_type', 'monthly'),
        )
        if 'grace_period_days' not in attrs and self.instance is None:
            attrs['grace_period_days'] = default_grace_days(recurrence_type)
        return attrs

    def get_trainer_nombre(self, obj):
        if not obj.trainer_id:
            return None
        return obj.trainer.user.get_full_name() or obj.trainer.user.email


class MemberSubscriptionSerializer(serializers.ModelSerializer):
    access_allowed = serializers.SerializerMethodField()
    days_overdue = serializers.SerializerMethodField()

    class Meta:
        model = MemberSubscription
        fields = (
            'id', 'member', 'plan', 'membership_name', 'description', 'trainer',
            'agreed_price', 'start_date', 'next_billing_date',
            'recurrence_type', 'grace_period_days',
            'auto_generate_next', 'is_active', 'status',
            'renewal_date', 'cancellation_date',
            'cancellation_reason', 'commercial_notes',
            'motivo_ajuste_precio',
            'current_period_start', 'current_period_end',
            'access_allowed', 'days_overdue',
        )
        read_only_fields = (
            'trainer', 'next_billing_date', 'renewal_date',
            'current_period_start', 'current_period_end',
        )
        extra_kwargs = {
            'plan': {'required': False, 'allow_null': True},
            'membership_name': {'required': False, 'allow_blank': True},
        }

    def get_access_allowed(self, obj):
        return membership_access(obj.member)['allowed']

    def get_days_overdue(self, obj):
        return membership_access(obj.member)['days_overdue']


class MemberMembershipSerializer(serializers.ModelSerializer):
    membership_plan = serializers.PrimaryKeyRelatedField(
        source='plan',
        queryset=MembershipPlan.objects.all(),
        required=False,
        allow_null=True,
    )
    plan_name = serializers.CharField(source='membership_name', read_only=True)
    membership_name = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    end_date = serializers.DateField(source='current_period_end', read_only=True)
    auto_renew = serializers.BooleanField(source='auto_generate_next', required=False)
    cancelled_at = serializers.DateField(source='cancellation_date', read_only=True)
    notes = serializers.CharField(source='commercial_notes', required=False, allow_blank=True)
    days_remaining = serializers.SerializerMethodField()
    can_check_in = serializers.SerializerMethodField()
    next_payment = serializers.SerializerMethodField()
    last_payment = serializers.SerializerMethodField()

    class Meta:
        model = MemberSubscription
        fields = (
            'id', 'member', 'membership_plan', 'plan_name', 'membership_name',
            'description', 'start_date', 'end_date', 'agreed_price', 'status',
            'auto_renew', 'created_at', 'updated_at', 'cancelled_at', 'notes',
            'motivo_ajuste_precio',
            'days_remaining', 'can_check_in', 'next_payment', 'last_payment',
            'recurrence_type', 'grace_period_days',
        )
        read_only_fields = (
            'id', 'end_date', 'created_at', 'updated_at', 'cancelled_at',
            'days_remaining', 'can_check_in', 'next_payment', 'last_payment',
        )
        extra_kwargs = {
            'agreed_price': {'required': False},
            'recurrence_type': {'required': False},
            'grace_period_days': {'required': False},
        }

    def validate(self, attrs):
        attrs = super().validate(attrs)
        member = attrs.get('member') or getattr(self.instance, 'member', None)
        plan = attrs.get('plan') or getattr(self.instance, 'plan', None)
        if self.instance is None and not plan:
            if not attrs.get('membership_name', '').strip():
                raise serializers.ValidationError({'membership_name': 'Escribe el nombre de la membresía.'})
            if attrs.get('agreed_price') in (None, ''):
                raise serializers.ValidationError({'agreed_price': 'Escribe el precio acordado.'})
        agreed_price = attrs.get('agreed_price', getattr(self.instance, 'agreed_price', None))
        adjustment_reason = attrs.get(
            'motivo_ajuste_precio',
            getattr(self.instance, 'motivo_ajuste_precio', ''),
        ).strip()
        if plan and agreed_price is not None and agreed_price != plan.price and not adjustment_reason:
            raise serializers.ValidationError({
                'motivo_ajuste_precio': 'Explica por qué el precio difiere del catálogo.',
            })
        if self.instance is None and member:
            existing = MemberSubscription.objects.filter(
                member=member,
                is_active=True,
                status__in=['pending', 'active', 'expiring', 'suspended'],
            )
            if existing.exists():
                raise serializers.ValidationError({'member': 'El miembro ya tiene una membresía operativa.'})
        request = self.context.get('request')
        if request and request.user.role == 'trainer' and not request.user.is_staff:
            trainer = request.user.trainerprofile
            if member and member.trainer_asignado_id != trainer.id:
                raise serializers.ValidationError({'member': 'Solo puedes administrar miembros asignados.'})
            if plan and plan.trainer_id and plan.trainer_id != trainer.id:
                raise serializers.ValidationError({'membership_plan': 'Solo puedes usar tus propios planes.'})
        return attrs

    def create(self, validated_data):
        plan = validated_data.get('plan')
        if plan:
            validated_data.setdefault('membership_name', plan.name)
            validated_data.setdefault('description', plan.description)
            validated_data.setdefault('agreed_price', plan.price)
            validated_data.setdefault('recurrence_type', plan.recurrence_type)
            validated_data.setdefault('grace_period_days', plan.grace_period_days)
        return super().create(validated_data)

    def get_days_remaining(self, obj):
        refresh_membership_status(obj)
        return obj.days_remaining

    def get_can_check_in(self, obj):
        return membership_access(obj.member)['allowed']

    def get_next_payment(self, obj):
        return membership_summary(obj.member)['next_payment']

    def get_last_payment(self, obj):
        return membership_summary(obj.member)['last_payment']


class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = ('id', 'member', 'type', 'details', 'is_default', 'is_active')
        extra_kwargs = {
            'member': {'required': False},
        }


class PaymentScheduleSerializer(serializers.ModelSerializer):
    subscription_detail = MemberSubscriptionSerializer(source='subscription', read_only=True)

    class Meta:
        model = PaymentSchedule
        fields = (
            'id', 'member', 'subscription', 'subscription_detail', 'plan', 'due_date',
            'period_start', 'period_end',
            'recurrence_type', 'grace_period_days',
            'auto_generate_next', 'is_active'
        )


class PaymentRecordSerializer(serializers.ModelSerializer):
    days_overdue = serializers.SerializerMethodField()
    due_date = serializers.DateField(source='schedule.due_date', read_only=True)
    subscription_id = serializers.IntegerField(source='schedule.subscription_id', read_only=True)
    plan_name = serializers.SerializerMethodField()
    receipt_number = serializers.SerializerMethodField()

    class Meta:
        model = PaymentRecord
        fields = (
            'id', 'schedule', 'subscription_id', 'due_date', 'amount', 'paid_at',
            'status', 'method_used', 'payment_reference',
            'metodo_registrado', 'registrado_por',
            'receipt_issued_at', 'receipt_number', 'notes',
            'days_overdue', 'plan_name'
        )
        read_only_fields = (
            'paid_at', 'receipt_issued_at', 'metodo_registrado', 'registrado_por',
        )

    def get_days_overdue(self, obj):
        from django.utils import timezone
        today = timezone.localdate()
        if obj.status in ('pending', 'late') and obj.schedule.due_date < today:
            return (today - obj.schedule.due_date).days
        return 0

    def get_plan_name(self, obj):
        return obj.schedule.resolved_membership_name

    def get_receipt_number(self, obj):
        if not obj.receipt_issued_at:
            return None
        return f"REC-{obj.receipt_issued_at:%Y%m%d}-{obj.id}"


class PaymentInstructionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentInstruction
        fields = ('id', 'plan', 'title', 'steps_text', 'bank_info', 'qr_image')
