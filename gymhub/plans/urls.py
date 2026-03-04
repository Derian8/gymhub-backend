from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TrainingPlanViewSet, WorkoutDayViewSet, ExerciseViewSet

router = DefaultRouter()
router.register(r'plans', TrainingPlanViewSet, basename='plan')
router.register(r'workout-days', WorkoutDayViewSet, basename='workout-day')
router.register(r'exercises', ExerciseViewSet, basename='exercise')

urlpatterns = [
    path('', include(router.urls)),
]
