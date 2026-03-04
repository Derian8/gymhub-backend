from rest_framework import serializers
from .models import AIChatMessage


class AIChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIChatMessage
        fields = ('id', 'member', 'role', 'content', 'created_at', 'tokens_used')
        read_only_fields = ('id', 'member', 'role', 'created_at', 'tokens_used')


class AIChatInputSerializer(serializers.Serializer):
    message = serializers.CharField(min_length=1, max_length=2000)
