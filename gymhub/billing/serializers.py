from rest_framework import serializers
from .models import MembershipPlan, PaymentSchedule, PaymentRecord, PaymentMethod, PaymentInstruction


class MembershipPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = MembershipPlan
        fields = ('id', 'name', 'description', 'price_monthly', 'duration_months', 'features')


class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = ('id', 'member', 'type', 'details', 'is_default', 'is_active')


class PaymentScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentSchedule
        fields = (
            'id', 'member', 'plan', 'due_date',
            'recurrence_type', 'grace_period_days',
            'auto_generate_next', 'is_active'
        )


class PaymentRecordSerializer(serializers.ModelSerializer):
    days_overdue = serializers.SerializerMethodField()
    due_date = serializers.DateField(source='schedule.due_date', read_only=True)

    class Meta:
        model = PaymentRecord
        fields = (
            'id', 'schedule', 'due_date', 'amount', 'paid_at',
            'status', 'method_used', 'notes', 'days_overdue'
        )

    def get_days_overdue(self, obj):
        from datetime import date
        if obj.status in ('pending', 'late') and obj.schedule.due_date < date.today():
            return (date.today() - obj.schedule.due_date).days
        return 0


class PaymentInstructionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentInstruction
        fields = ('id', 'plan', 'title', 'steps_text', 'bank_info', 'qr_image')
