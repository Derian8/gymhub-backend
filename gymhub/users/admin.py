from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, MemberProfile, TrainerProfile, AuditLog, ConfiguracionSistema


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'username', 'role', 'is_staff', 'is_active')
    list_filter = ('role', 'is_staff', 'is_active')
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Rol', {'fields': ('role',)}),
    )


@admin.register(MemberProfile)
class MemberProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'membership_plan', 'join_date', 'is_active')
    list_filter = ('is_active', 'membership_plan')
    search_fields = ('user__email', 'user__first_name', 'user__last_name')


@admin.register(TrainerProfile)
class TrainerProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'specialization', 'certification')
    search_fields = ('user__email', 'specialization')


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'action_type', 'target_model', 'target_id', 'created_at')
    list_filter = ('action_type', 'target_model')
    readonly_fields = ('details', 'created_at',)


@admin.register(ConfiguracionSistema)
class ConfiguracionSistemaAdmin(admin.ModelAdmin):
    list_display = ('exigir_cambio_contrasena_cliente', 'actualizado_en')
    fields = ('exigir_cambio_contrasena_cliente',)

    def has_add_permission(self, request):
        return not ConfiguracionSistema.objects.exists() and super().has_add_permission(request)
