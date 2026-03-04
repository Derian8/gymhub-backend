from django.contrib import admin
from .models import AIChatMessage


@admin.register(AIChatMessage)
class AIChatMessageAdmin(admin.ModelAdmin):
    list_display = ('member', 'role', 'created_at', 'tokens_used')
    list_filter = ('role',)
    readonly_fields = ('created_at', 'tokens_used')
