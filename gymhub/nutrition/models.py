from django.db import models

GOAL_TYPE_CHOICES = [
    ('fat_loss', 'Fat Loss'),
    ('muscle_gain', 'Muscle Gain'),
    ('endurance', 'Endurance'),
    ('maintenance', 'Maintenance'),
]


class NutritionProfile(models.Model):
    training_plan = models.OneToOneField(
        'plans.TrainingPlan',
        on_delete=models.CASCADE,
        related_name='nutrition_profile'
    )
    goal_type = models.CharField(max_length=20, choices=GOAL_TYPE_CHOICES)
    calorie_range_min = models.PositiveIntegerField(default=1800)
    calorie_range_max = models.PositiveIntegerField(default=2200)
    protein_focus = models.CharField(max_length=200, blank=True)
    carb_strategy = models.CharField(max_length=200, blank=True)
    hydration_recommendation = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return f"Nutrition({self.goal_type}) — {self.training_plan}"


class NutritionGuideline(models.Model):
    """
    goal_type actúa como FK lógica (CharField con choices).
    Si en el futuro un guideline aplica a múltiples goals, migrar a ManyToManyField(choices).
    """
    goal_type = models.CharField(max_length=20, choices=GOAL_TYPE_CHOICES)
    title = models.CharField(max_length=200)
    description = models.TextField()
    recommended_foods = models.TextField(blank=True)
    foods_to_limit = models.TextField(blank=True)
    timing_suggestions = models.TextField(blank=True)

    def __str__(self):
        return f"Guideline({self.goal_type}): {self.title}"


class PlanNutritionLink(models.Model):
    plan = models.ForeignKey(
        'plans.TrainingPlan',
        on_delete=models.CASCADE,
        related_name='nutrition_links'
    )
    guideline = models.ForeignKey(
        NutritionGuideline,
        on_delete=models.CASCADE,
        related_name='plan_links'
    )
    priority_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['priority_order']
        unique_together = ('plan', 'guideline')

    def __str__(self):
        return f"{self.plan} → {self.guideline}"


class PlantillaNutricion(models.Model):
    NIVEL_ADHERENCIA_CHOICES = [
        ('low', 'Baja adherencia'),
        ('medium', 'Adherencia media'),
        ('high', 'Alta adherencia'),
    ]

    trainer = models.ForeignKey(
        'users.TrainerProfile',
        on_delete=models.CASCADE,
        related_name='plantillas_nutricion'
    )
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    goal_type = models.CharField(max_length=20, choices=GOAL_TYPE_CHOICES)
    nivel_adherencia_recomendado = models.CharField(
        max_length=10,
        choices=NIVEL_ADHERENCIA_CHOICES,
        default='medium'
    )
    calorie_range_min = models.PositiveIntegerField(default=1800)
    calorie_range_max = models.PositiveIntegerField(default=2200)
    protein_focus = models.CharField(max_length=200, blank=True)
    carb_strategy = models.CharField(max_length=200, blank=True)
    hydration_recommendation = models.CharField(max_length=200, blank=True)
    esta_activa = models.BooleanField(default=True)
    creada_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nombre', 'id']
        db_table = 'plantillas_nutricion'

    def __str__(self):
        return self.nombre
