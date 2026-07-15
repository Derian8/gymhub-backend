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

ALERT_STATUS_CHOICES = [
    ('new', 'New'),
    ('in_follow_up', 'In follow-up'),
    ('resolved', 'Resolved'),
    ('dismissed', 'Dismissed'),
]

CONTACT_METHOD_CHOICES = [
    ('whatsapp', 'WhatsApp'),
    ('call', 'Call'),
    ('email', 'Email'),
    ('in_person', 'In person'),
]

OPEN_ALERT_STATUSES = ['new', 'in_follow_up']


class InactivityAlert(models.Model):
    member = models.ForeignKey(
        'users.MemberProfile',
        on_delete=models.CASCADE,
        related_name='inactivity_alerts'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    last_checkin_date = models.DateField(null=True, blank=True)
    days_inactive = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=20,
        choices=ALERT_STATUS_CHOICES,
        default='new',
    )
    resolved = models.BooleanField(default=False)
    resolved_by = models.ForeignKey(
        'users.User',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='resolved_alerts'
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    status_changed_by = models.ForeignKey(
        'users.User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='inactivity_alert_status_changes',
    )
    status_changed_at = models.DateTimeField(null=True, blank=True)
    status_change_reason = models.CharField(max_length=255, blank=True)
    reopened_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['member', 'resolved', 'created_at']),
            models.Index(fields=['member', 'status', 'created_at']),
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['last_checkin_date']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['member'],
                condition=Q(status__in=OPEN_ALERT_STATUSES),
                name='uniq_open_inactivity_alert_per_member',
            ),
        ]

    @property
    def is_open(self):
        return self.status in OPEN_ALERT_STATUSES

    def save(self, *args, **kwargs):
        if self.resolved and self.status not in {'resolved', 'dismissed'}:
            self.status = 'resolved'
        if self.status == 'resolved':
            self.resolved = True
        elif self.status in {'new', 'in_follow_up', 'dismissed'}:
            self.resolved = False
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Alert: {self.member} — {self.days_inactive} días inactivo"


class InactivityAlertContact(models.Model):
    member = models.ForeignKey(
        'users.MemberProfile',
        on_delete=models.CASCADE,
        related_name='inactivity_contacts',
    )
    trainer = models.ForeignKey(
        'users.TrainerProfile',
        on_delete=models.CASCADE,
        related_name='inactivity_contacts',
    )
    alert = models.ForeignKey(
        InactivityAlert,
        on_delete=models.CASCADE,
        related_name='contacts',
    )
    contacted_at = models.DateTimeField(default=timezone.now)
    method = models.CharField(max_length=20, choices=CONTACT_METHOD_CHOICES)
    result = models.CharField(max_length=200)
    note = models.TextField(blank=True)
    next_follow_up_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-contacted_at', '-id']
        indexes = [
            models.Index(fields=['member', 'contacted_at']),
            models.Index(fields=['trainer', 'contacted_at']),
            models.Index(fields=['alert', 'contacted_at']),
        ]

    def __str__(self):
        return f"Contact: {self.member} — {self.method} @ {self.contacted_at.date()}"


class MemberJustifiedAbsence(models.Model):
    member = models.ForeignKey(
        'users.MemberProfile',
        on_delete=models.CASCADE,
        related_name='justified_absences',
    )
    trainer = models.ForeignKey(
        'users.TrainerProfile',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='justified_absences',
    )
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-start_date', '-id']
        indexes = [
            models.Index(fields=['member', 'is_active', 'start_date', 'end_date']),
        ]

    def __str__(self):
        return f"Absence: {self.member} {self.start_date} - {self.end_date}"


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
