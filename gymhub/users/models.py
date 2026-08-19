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
    requiere_cambio_contrasena = models.BooleanField(default=False)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return f"{self.email} ({self.role})"


class ConfiguracionSistema(models.Model):
    """Configuración global editable desde administración."""

    exigir_cambio_contrasena_cliente = models.BooleanField(default=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'configuracion_sistema'

    def __str__(self):
        return 'Configuración del sistema'

    @classmethod
    def principal(cls):
        config, _ = cls.objects.get_or_create(pk=1)
        return config


def requiere_cambio_contrasena_efectivo(user):
    if getattr(user, 'role', None) == 'member' and not ConfiguracionSistema.principal().exigir_cambio_contrasena_cliente:
        return False
    return bool(getattr(user, 'requiere_cambio_contrasena', False))


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
    join_date = models.DateField(default=timezone.localdate)
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


class PerfilGimnasio(models.Model):
    entrenador = models.OneToOneField(
        TrainerProfile,
        on_delete=models.CASCADE,
        related_name='perfil_gimnasio',
    )
    nombre = models.CharField(max_length=200, default='Mi gimnasio')
    logo = models.ImageField(upload_to='logos_gimnasios/', null=True, blank=True)
    telefono = models.CharField(max_length=30, blank=True)
    correo = models.EmailField(blank=True)
    direccion = models.TextField(blank=True)
    moneda = models.CharField(max_length=3, default='CRC', editable=False)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'perfiles_gimnasio'

    def __str__(self):
        return self.nombre


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
