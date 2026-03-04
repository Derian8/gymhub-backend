from django.db import models
from django.utils import timezone

ROLE_CHOICES = [
    ('user', 'User'),
    ('assistant', 'Assistant'),
]


class AIChatMessage(models.Model):
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
