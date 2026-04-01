from django.db import models
from django.utils import timezone

ROLE_CHOICES = [
    ('user', 'User'),
    ('assistant', 'Assistant'),
]

CHAT_MODE_CHOICES = [
    ('member', 'Member'),
    ('trainer_member', 'Trainer Member'),
]


class AIChatConversation(models.Model):
    member = models.ForeignKey(
        'users.MemberProfile',
        on_delete=models.CASCADE,
        related_name='chat_conversations'
    )
    usuario = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='ai_chat_conversations'
    )
    modo = models.CharField(max_length=30, choices=CHAT_MODE_CHOICES)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-updated_at', '-created_at']
        unique_together = ('member', 'usuario', 'modo')

    def __str__(self):
        return f"{self.usuario_id}:{self.member_id}:{self.modo}"


class AIChatMessage(models.Model):
    conversation = models.ForeignKey(
        'ai_chat.AIChatConversation',
        on_delete=models.CASCADE,
        related_name='messages',
        null=True,
        blank=True,
    )
    member = models.ForeignKey(
        'users.MemberProfile',
        on_delete=models.CASCADE,
        related_name='chat_messages'
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)
    tokens_used = models.IntegerField(default=0)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.member} [{self.role}] @ {self.created_at}"
