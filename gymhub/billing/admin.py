from django.contrib import admin
from .models import MembershipPlan, PaymentSchedule, PaymentRecord, PaymentMethod, PaymentInstruction
from .models import CorreoPendiente


@admin.register(CorreoPendiente)
class CorreoPendienteAdmin(admin.ModelAdmin):
    list_display = (
        'clave', 'estado', 'intentos', 'fecha_creacion', 'fecha_aceptacion',
        'identificador_proveedor', 'ultimo_error',
    )
    list_filter = ('estado',)
    search_fields = ('clave', 'identificador_proveedor')
    # El panel muestra seguimiento, sin exponer mensajes ni adjuntos financieros.
    exclude = ('contenido',)
    readonly_fields = (
        'clave', 'identificador', 'estado', 'intentos', 'primer_intento',
        'proximo_intento', 'identificador_proveedor', 'ultimo_error',
        'fecha_creacion', 'fecha_aceptacion',
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(MembershipPlan)
class MembershipPlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'price', 'recurrence_type', 'grace_period_days')


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
