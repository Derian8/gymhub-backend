from rest_framework import serializers

from .models import AIChatConversation, AIChatMessage


class AIChatMessageSerializer(serializers.ModelSerializer):
    conversation_id = serializers.IntegerField(read_only=True)
    mode = serializers.CharField(source='conversation.modo', read_only=True)

    class Meta:
        model = AIChatMessage
        fields = (
            'id',
            'member',
            'conversation_id',
            'mode',
            'role',
            'content',
            'created_at',
            'tokens_used',
        )
        read_only_fields = ('id', 'member', 'conversation_id', 'mode', 'role', 'created_at', 'tokens_used')


class AIChatConversationSerializer(serializers.ModelSerializer):
    member_id = serializers.IntegerField(read_only=True)
    usuario_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = AIChatConversation
        fields = ('id', 'member_id', 'usuario_id', 'modo', 'created_at', 'updated_at')
        read_only_fields = fields


class AIChatInputSerializer(serializers.Serializer):
    message = serializers.CharField(min_length=1, max_length=2000)
    member_id = serializers.IntegerField(required=False, min_value=1)
    conversation_id = serializers.IntegerField(required=False, min_value=1)


class AIChatSendMessageSerializer(serializers.Serializer):
    member_id = serializers.IntegerField(min_value=1)
    message_text = serializers.CharField(min_length=1, max_length=2000)
    conversation_id = serializers.IntegerField(required=False, min_value=1)
    source_message_id = serializers.IntegerField(required=False, min_value=1)


class AIChatContextSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=['member', 'trainer_member'])
    conversation_id = serializers.IntegerField(allow_null=True)
    limit = serializers.IntegerField(allow_null=True)
    remaining_messages = serializers.IntegerField(allow_null=True)
    requires_member_selection = serializers.BooleanField(default=False)
    fallback_available = serializers.BooleanField(default=True)
    engine_mode = serializers.CharField()
    local_llm_available = serializers.BooleanField(default=False)
    response_source = serializers.CharField()
    suggested_prompts = serializers.ListField(child=serializers.CharField())
    sendable = serializers.BooleanField(default=False, required=False)
    message_text = serializers.CharField(default='', required=False)
    priority_detected = serializers.CharField(default='', required=False)
    intent_detected = serializers.CharField(default='', required=False)
    member = serializers.DictField(required=False, allow_null=True)
    summary = serializers.DictField(required=False, allow_null=True)
    analysis_context = serializers.DictField(required=False, allow_null=True)
    trainer_assistant = serializers.DictField(required=False, allow_null=True)
