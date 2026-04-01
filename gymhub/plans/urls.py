from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TrainingPlanViewSet, WorkoutDayViewSet, ExerciseViewSet, PlantillaEntrenamientoViewSet

router = DefaultRouter()
router.register(r'plans', TrainingPlanViewSet, basename='plan')
router.register(r'workout-days', WorkoutDayViewSet, basename='workout-day')
router.register(r'exercises', ExerciseViewSet, basename='exercise')
router.register(r'plan-templates', PlantillaEntrenamientoViewSet, basename='plan-template')

urlpatterns = [
    path('', include(router.urls)),
]
