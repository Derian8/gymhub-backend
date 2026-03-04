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
