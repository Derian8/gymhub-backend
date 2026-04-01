from django.contrib import admin
from .models import AIChatConversation, AIChatMessage


@admin.register(AIChatConversation)
class AIChatConversationAdmin(admin.ModelAdmin):
    list_display = ('id', 'usuario', 'member', 'modo', 'updated_at')
    list_filter = ('modo',)
    search_fields = ('usuario__email', 'member__user__email', 'member__user__first_name', 'member__user__last_name')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(AIChatMessage)
class AIChatMessageAdmin(admin.ModelAdmin):
    list_display = ('conversation', 'member', 'role', 'created_at', 'tokens_used')
    list_filter = ('role', 'conversation__modo')
    search_fields = ('member__user__email', 'conversation__usuario__email', 'content')
    readonly_fields = ('created_at', 'tokens_used')
