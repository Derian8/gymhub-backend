from rest_framework import serializers
from .models import NutritionProfile, NutritionGuideline, PlanNutritionLink


class NutritionGuidelineSerializer(serializers.ModelSerializer):
    class Meta:
        model = NutritionGuideline
        fields = (
            'id', 'goal_type', 'title', 'description',
            'recommended_foods', 'foods_to_limit', 'timing_suggestions'
        )


class NutritionProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = NutritionProfile
        fields = (
            'id', 'training_plan', 'goal_type',
            'calorie_range_min', 'calorie_range_max',
            'protein_focus', 'carb_strategy', 'hydration_recommendation'
        )


class PlanNutritionLinkSerializer(serializers.ModelSerializer):
    guideline = NutritionGuidelineSerializer(read_only=True)
    guideline_id = serializers.PrimaryKeyRelatedField(
        queryset=NutritionGuideline.objects.all(), source='guideline', write_only=True
    )

    class Meta:
        model = PlanNutritionLink
        fields = ('id', 'plan', 'guideline', 'guideline_id', 'priority_order')
