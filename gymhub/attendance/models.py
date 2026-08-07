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
    attendance_date = models.DateField(default=timezone.localdate)
    check_out_time = models.DateTimeField(null=True, blank=True)
    is_manual_override = models.BooleanField(default=False)
    es_excepcion_comercial = models.BooleanField(default=False)
    motivo_excepcion = models.CharField(max_length=500, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-check_in_time']
        constraints = [
            models.UniqueConstraint(
                fields=['member', 'attendance_date'],
                name='attendance_unique_member_day',
            ),
        ]
        indexes = [
            models.Index(fields=['member', 'check_in_time']),
            models.Index(fields=['checked_in_by', 'check_in_time']),
        ]

    def __str__(self):
        return f"{self.member} @ {self.check_in_time.date()}"

    @property
    def duration_minutes(self):
        if not self.check_out_time:
            return None
        return max(0, int((self.check_out_time - self.check_in_time).total_seconds() // 60))
