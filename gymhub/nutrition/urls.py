from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NutritionProfileViewSet, NutritionGuidelineViewSet, PlanNutritionLinkViewSet, PlantillaNutricionViewSet

router = DefaultRouter()
router.register(r'nutrition-profiles', NutritionProfileViewSet, basename='nutrition-profile')
router.register(r'nutrition-guidelines', NutritionGuidelineViewSet, basename='nutrition-guideline')
router.register(r'plan-nutrition-links', PlanNutritionLinkViewSet, basename='plan-nutrition-link')
router.register(r'nutrition-templates', PlantillaNutricionViewSet, basename='nutrition-template')

urlpatterns = [
    path('', include(router.urls)),
]
