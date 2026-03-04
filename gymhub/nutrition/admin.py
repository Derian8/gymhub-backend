from django.contrib import admin
from .models import NutritionProfile, NutritionGuideline, PlanNutritionLink


@admin.register(NutritionProfile)
class NutritionProfileAdmin(admin.ModelAdmin):
    list_display = ('training_plan', 'goal_type', 'calorie_range_min', 'calorie_range_max')


@admin.register(NutritionGuideline)
class NutritionGuidelineAdmin(admin.ModelAdmin):
    list_display = ('title', 'goal_type')
    list_filter = ('goal_type',)


@admin.register(PlanNutritionLink)
class PlanNutritionLinkAdmin(admin.ModelAdmin):
    list_display = ('plan', 'guideline', 'priority_order')
