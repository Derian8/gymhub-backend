from django.db import models
from django.db.models import Q
from django.utils import timezone

NOTIFICATION_TYPE_CHOICES = [
    ('inactivity', 'Inactivity'),
    ('payment_due', 'Payment Due'),
    ('payment_overdue', 'Payment Overdue'),
    ('plan_assigned', 'Plan Assigned'),
    ('trainer_message', 'Trainer Message'),
    ('system', 'System'),
]


class InactivityAlert(models.Model):
    member = models.ForeignKey(
        'users.MemberProfile',
        on_delete=models.CASCADE,
        related_name='inactivity_alerts'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    last_checkin_date = models.DateField(null=True, blank=True)
    days_inactive = models.PositiveIntegerField(default=0)
    resolved = models.BooleanField(default=False)
    resolved_by = models.ForeignKey(
        'users.User',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='resolved_alerts'
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['member', 'resolved', 'created_at']),
        ]

    def __str__(self):
        return f"Alert: {self.member} — {self.days_inactive} días inactivo"


class Notification(models.Model):
    user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    message = models.TextField()
    type = models.CharField(
        max_length=20,
        choices=NOTIFICATION_TYPE_CHOICES,
        default='system'
    )
    dedupe_key = models.CharField(max_length=120, blank=True, default='')
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'read', 'created_at']),
            models.Index(fields=['type', 'created_at']),
            models.Index(fields=['dedupe_key']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['dedupe_key'],
                condition=~Q(dedupe_key=''),
                name='uniq_notification_dedupe_key',
            ),
        ]

    def __str__(self):
        return f"Notif({self.type}) → {self.user.email}"
