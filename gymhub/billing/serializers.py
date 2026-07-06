from rest_framework import serializers
from .models import MembershipPlan, MemberSubscription, PaymentSchedule, PaymentRecord, PaymentMethod, PaymentInstruction
from .services import default_grace_days, membership_access


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
    plan_detail = MembershipPlanSerializer(source='plan', read_only=True)
    access_allowed = serializers.SerializerMethodField()
    days_overdue = serializers.SerializerMethodField()

    class Meta:
        model = MemberSubscription
        fields = (
            'id', 'member', 'plan', 'plan_detail', 'trainer',
            'agreed_price', 'start_date', 'next_billing_date',
            'recurrence_type', 'grace_period_days',
            'auto_generate_next', 'is_active', 'status',
            'renewal_date', 'cancellation_date',
            'cancellation_reason', 'commercial_notes',
            'current_period_start', 'current_period_end',
            'access_allowed', 'days_overdue',
        )
        read_only_fields = (
            'trainer', 'next_billing_date', 'recurrence_type',
            'grace_period_days', 'renewal_date',
            'current_period_start', 'current_period_end',
        )

    def get_access_allowed(self, obj):
        return membership_access(obj.member)['allowed']

    def get_days_overdue(self, obj):
        return membership_access(obj.member)['days_overdue']


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
            'receipt_issued_at', 'receipt_number', 'notes',
            'days_overdue', 'plan_name'
        )

    def get_days_overdue(self, obj):
        from django.utils import timezone
        today = timezone.localdate()
        if obj.status in ('pending', 'late') and obj.schedule.due_date < today:
            return (today - obj.schedule.due_date).days
        return 0

    def get_plan_name(self, obj):
        plan = obj.schedule.resolved_plan
        return plan.name if plan else None

    def get_receipt_number(self, obj):
        if not obj.receipt_issued_at:
            return None
        return f"REC-{obj.receipt_issued_at:%Y%m%d}-{obj.id}"


class PaymentInstructionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentInstruction
        fields = ('id', 'plan', 'title', 'steps_text', 'bank_info', 'qr_image')
