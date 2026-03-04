from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProgressLogViewSet, WorkoutSessionViewSet, BulkExerciseLogView

router = DefaultRouter()
router.register(r'progress-logs', ProgressLogViewSet, basename='progress-log')
router.register(r'workout-sessions', WorkoutSessionViewSet, basename='workout-session')

urlpatterns = [
    path('', include(router.urls)),
    path('exercise-logs/bulk/', BulkExerciseLogView.as_view(), name='exercise-logs-bulk'),
]
