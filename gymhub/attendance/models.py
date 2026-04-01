from django.db import models
from django.utils import timezone


class Attendance(models.Model):
    member = models.ForeignKey(
        'users.MemberProfile',
        on_delete=models.CASCADE,
        related_name='attendances'
    )
    gym_class = models.ForeignKey(
        'classes.GymClass',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='attendances'
    )
    checked_in_by = models.ForeignKey(
        'users.User',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='checked_in_attendances'
    )
    check_in_time = models.DateTimeField(default=timezone.now)
    is_manual_override = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-check_in_time']
        indexes = [
            models.Index(fields=['member', 'check_in_time']),
            models.Index(fields=['checked_in_by', 'check_in_time']),
        ]

    def __str__(self):
        return f"{self.member} @ {self.check_in_time.date()}"
