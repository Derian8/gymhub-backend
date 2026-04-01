from django.db import models
from django.core.validators import (
    MinValueValidator, MaxValueValidator, RegexValidator
)

GOAL_CHOICES = [
    ('fat_loss', 'Fat Loss'),
    ('muscle_gain', 'Muscle Gain'),
    ('endurance', 'Endurance'),
    ('flexibility', 'Flexibility'),
    ('maintenance', 'Maintenance'),
    ('general', 'General'),
]

MUSCLE_GROUP_CHOICES = [
    ('chest', 'Chest'),
    ('back', 'Back'),
    ('shoulders', 'Shoulders'),
    ('biceps', 'Biceps'),
    ('triceps', 'Triceps'),
    ('legs', 'Legs'),
    ('glutes', 'Glutes'),
    ('core', 'Core'),
    ('full_body', 'Full Body'),
    ('cardio', 'Cardio'),
]

DAY_LABEL_CHOICES = [
    ('A', 'Day A'),
    ('B', 'Day B'),
    ('C', 'Day C'),
    ('D', 'Day D'),
]


class TrainingPlan(models.Model):
    member = models.ForeignKey(
        'users.MemberProfile',
        on_delete=models.CASCADE,
        related_name='plans'
    )
    trainer = models.ForeignKey(
        'users.TrainerProfile',
        on_delete=models.CASCADE,
        related_name='created_plans'
    )
    name = models.CharField(max_length=200)
    goal = models.CharField(max_length=20, choices=GOAL_CHOICES, default='general')
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    weeks_duration = models.PositiveIntegerField(default=8)
    days_per_week = models.PositiveIntegerField(
        default=3,
        validators=[MinValueValidator(1), MaxValueValidator(7)]
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.name} ({self.member})"


class WorkoutDay(models.Model):
    plan = models.ForeignKey(
        TrainingPlan,
        on_delete=models.CASCADE,
        related_name='workout_days'
    )
    name = models.CharField(max_length=200)
    day_label = models.CharField(max_length=1, choices=DAY_LABEL_CHOICES)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"Día {self.day_label}: {self.name}"


class Exercise(models.Model):
    workout_day = models.ForeignKey(
        WorkoutDay,
        on_delete=models.CASCADE,
        related_name='exercises'
    )
    name = models.CharField(max_length=200)
    muscle_group = models.CharField(max_length=20, choices=MUSCLE_GROUP_CHOICES)
    sets = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(20)]
    )
    reps_range = models.CharField(
        max_length=10,
        validators=[
            RegexValidator(
                r'^\d{1,3}(-\d{1,3})?$',
                'Formato válido: 8 o 8-12'
            )
        ]
    )
    weight_suggestion_kg = models.FloatField(
        null=True, blank=True,
        validators=[MinValueValidator(0)]
    )
    rest_seconds = models.PositiveIntegerField(
        default=60,
        validators=[MaxValueValidator(600)]
    )
    technique_notes = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.name} ({self.muscle_group}) — {self.sets}×{self.reps_range}"


class PlantillaEntrenamiento(models.Model):
    NIVEL_ADHERENCIA_CHOICES = [
        ('low', 'Baja adherencia'),
        ('medium', 'Adherencia media'),
        ('high', 'Alta adherencia'),
    ]

    trainer = models.ForeignKey(
        'users.TrainerProfile',
        on_delete=models.CASCADE,
        related_name='plantillas_entrenamiento'
    )
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    objetivo = models.CharField(max_length=20, choices=GOAL_CHOICES, default='general')
    nivel_adherencia_recomendado = models.CharField(
        max_length=10,
        choices=NIVEL_ADHERENCIA_CHOICES,
        default='medium'
    )
    dias_por_semana_sugeridos = models.PositiveIntegerField(default=3)
    esta_activa = models.BooleanField(default=True)
    creada_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nombre', 'id']
        db_table = 'plantillas_entrenamiento'

    def __str__(self):
        return self.nombre


class PlantillaDiaEntrenamiento(models.Model):
    plantilla = models.ForeignKey(
        PlantillaEntrenamiento,
        on_delete=models.CASCADE,
        related_name='dias'
    )
    nombre = models.CharField(max_length=200)
    etiqueta_dia = models.CharField(max_length=1, choices=DAY_LABEL_CHOICES)
    orden = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['orden', 'id']
        db_table = 'plantillas_dias_entrenamiento'

    def __str__(self):
        return f'{self.plantilla.nombre} · {self.etiqueta_dia}'


class PlantillaEjercicio(models.Model):
    dia = models.ForeignKey(
        PlantillaDiaEntrenamiento,
        on_delete=models.CASCADE,
        related_name='ejercicios'
    )
    nombre = models.CharField(max_length=200)
    grupo_muscular = models.CharField(max_length=20, choices=MUSCLE_GROUP_CHOICES)
    series = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(20)]
    )
    rango_repeticiones = models.CharField(
        max_length=10,
        validators=[
            RegexValidator(
                r'^\d{1,3}(-\d{1,3})?$',
                'Formato válido: 8 o 8-12'
            )
        ]
    )
    peso_sugerido_kg = models.FloatField(
        null=True, blank=True,
        validators=[MinValueValidator(0)]
    )
    descanso_segundos = models.PositiveIntegerField(
        default=60,
        validators=[MaxValueValidator(600)]
    )
    notas_tecnicas = models.TextField(blank=True)
    orden = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['orden', 'id']
        db_table = 'plantillas_ejercicios'

    def __str__(self):
        return self.nombre
