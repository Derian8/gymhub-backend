from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

SOURCE_CHOICES = [
    ('manual', 'Manual'),
    ('fitbit_export', 'Fitbit Export'),
    ('garmin_export', 'Garmin Export'),
]

FEELING_CHOICES = [(i, str(i)) for i in range(1, 6)]


class ProgressLog(models.Model):
    member = models.ForeignKey(
        'users.MemberProfile',
        on_delete=models.CASCADE,
        related_name='progress_logs'
    )
    recorded_at = models.DateTimeField(auto_now_add=True)
    weight_kg = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0)])
    body_fat_pct = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(100)])
    muscle_mass_kg = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0)])
    waist_cm = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0)])
    notes = models.TextField(blank=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='manual')

    class Meta:
        ordering = ['-recorded_at']
        indexes = [
            models.Index(fields=['member', 'recorded_at']),
        ]

    def __str__(self):
        return f"{self.member} — {self.recorded_at.date()}"


class WorkoutSession(models.Model):
    member = models.ForeignKey(
        'users.MemberProfile',
        on_delete=models.CASCADE,
        related_name='workout_sessions'
    )
    workout_day = models.ForeignKey(
        'plans.WorkoutDay',
        on_delete=models.CASCADE,
        related_name='sessions'
    )
    attendance = models.ForeignKey(
        'attendance.Attendance',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='sessions'
    )
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    overall_feeling = models.PositiveSmallIntegerField(
        null=True, blank=True,
        choices=FEELING_CHOICES,
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    is_completed = models.BooleanField(default=False)
    trainer_notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['member', 'is_completed', 'started_at']),
            models.Index(fields=['workout_day', 'started_at']),
        ]

    def __str__(self):
        return f"{self.member} — {self.workout_day} @ {self.started_at.date()}"


class ExerciseLog(models.Model):
    session = models.ForeignKey(
        WorkoutSession,
        on_delete=models.CASCADE,
        related_name='exercise_logs'
    )
    exercise = models.ForeignKey(
        'plans.Exercise',
        on_delete=models.CASCADE,
        related_name='logs'
    )
    sets_completed = models.PositiveIntegerField(default=0)
    reps_completed = models.PositiveIntegerField(default=0)
    minutes_completed = models.PositiveIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(0)]
    )
    weight_used_kg = models.FloatField(
        null=True, blank=True,
        validators=[MinValueValidator(0)]
    )
    rpe = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(10)]
    )
    notes = models.TextField(blank=True)

    def __str__(self):
        if self.minutes_completed is not None:
            return f"{self.exercise.name} — {self.minutes_completed} min"
        return f"{self.exercise.name} — {self.sets_completed}×{self.reps_completed} @ {self.weight_used_kg}kg"
