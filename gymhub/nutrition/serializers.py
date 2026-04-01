from rest_framework import serializers
from .models import NutritionProfile, NutritionGuideline, PlanNutritionLink, PlantillaNutricion


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


class PlantillaNutricionSerializer(serializers.ModelSerializer):
    trainer_nombre = serializers.SerializerMethodField()

    class Meta:
        model = PlantillaNutricion
        fields = (
            'id', 'trainer', 'trainer_nombre', 'nombre', 'descripcion',
            'goal_type', 'nivel_adherencia_recomendado',
            'calorie_range_min', 'calorie_range_max',
            'protein_focus', 'carb_strategy', 'hydration_recommendation',
            'esta_activa', 'creada_en',
        )
        read_only_fields = ('trainer', 'creada_en')

    def get_trainer_nombre(self, obj):
        return obj.trainer.user.get_full_name() or obj.trainer.user.email
