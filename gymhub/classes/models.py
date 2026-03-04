from django.db import models


class GymClass(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('cancelled', 'Cancelled'),
    ]
    trainer = models.ForeignKey(
        'users.TrainerProfile',
        on_delete=models.CASCADE,
        related_name='classes'
    )
    name = models.CharField(max_length=200)
    schedule = models.DateTimeField()
    max_capacity = models.PositiveIntegerField(default=20)
    current_enrolled = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')

    class Meta:
        verbose_name = 'Class'
        verbose_name_plural = 'Classes'

    def __str__(self):
        return f"{self.name} — {self.schedule}"


class ClassEnrollment(models.Model):
    member = models.ForeignKey(
        'users.MemberProfile',
        on_delete=models.CASCADE,
        related_name='enrollments'
    )
    gym_class = models.ForeignKey(
        GymClass,
        on_delete=models.CASCADE,
        related_name='enrollments'
    )
    enrolled_at = models.DateTimeField(auto_now_add=True)
    attended = models.BooleanField(default=False)

    class Meta:
        unique_together = ('member', 'gym_class')

    def __str__(self):
        return f"{self.member} → {self.gym_class}"
