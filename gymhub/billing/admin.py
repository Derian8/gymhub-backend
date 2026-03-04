from django.contrib import admin
from .models import MembershipPlan, PaymentSchedule, PaymentRecord, PaymentMethod, PaymentInstruction


@admin.register(MembershipPlan)
class MembershipPlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'price_monthly', 'duration_months')


@admin.register(PaymentSchedule)
class PaymentScheduleAdmin(admin.ModelAdmin):
    list_display = ('member', 'plan', 'due_date', 'is_active')
    list_filter = ('is_active', 'recurrence_type')


@admin.register(PaymentRecord)
class PaymentRecordAdmin(admin.ModelAdmin):
    list_display = ('schedule', 'amount', 'status', 'paid_at')
    list_filter = ('status',)


@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = ('member', 'type', 'is_default', 'is_active')


@admin.register(PaymentInstruction)
class PaymentInstructionAdmin(admin.ModelAdmin):
    list_display = ('plan', 'title')
