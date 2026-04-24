from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


class User(AbstractUser):
    ROLE_CHOICES = [
        ('member', 'Member'),
        ('trainer', 'Trainer'),
    ]
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='member')

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return f"{self.email} ({self.role})"


class MemberProfile(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='memberprofile'
    )
    trainer_asignado = models.ForeignKey(
        'users.TrainerProfile',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='clientes',
    )
    membership_plan = models.ForeignKey(
        'billing.MembershipPlan',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='members'
    )
    phone = models.CharField(max_length=20, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    emergency_contact = models.CharField(max_length=200, blank=True)
    join_date = models.DateField(default=timezone.now)
    is_active = models.BooleanField(default=True)
    photo = models.ImageField(upload_to='member_photos/', null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['trainer_asignado', 'is_active']),
            models.Index(fields=['membership_plan', 'is_active']),
            models.Index(fields=['join_date']),
        ]

    def __str__(self):
        return f"Member: {self.user.get_full_name() or self.user.email}"


class TrainerProfile(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='trainerprofile'
    )
    specialization = models.CharField(max_length=200, blank=True)
    bio = models.TextField(blank=True)
    certification = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return f"Trainer: {self.user.get_full_name() or self.user.email}"


class AuditLog(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='audit_logs'
    )
    action_type = models.CharField(max_length=100)
    target_model = models.CharField(max_length=100)
    target_id = models.CharField(max_length=100)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.action_type} by {self.user.email} at {self.created_at}"
