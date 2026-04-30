from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TrainingPlanViewSet, WorkoutDayViewSet, ExerciseViewSet, PlantillaEntrenamientoViewSet, GymMachineViewSet

router = DefaultRouter()
router.register(r'plans', TrainingPlanViewSet, basename='plan')
router.register(r'workout-days', WorkoutDayViewSet, basename='workout-day')
router.register(r'exercises', ExerciseViewSet, basename='exercise')
router.register(r'gym-machines', GymMachineViewSet, basename='gym-machine')
router.register(r'plan-templates', PlantillaEntrenamientoViewSet, basename='plan-template')

urlpatterns = [
    path('', include(router.urls)),
]
