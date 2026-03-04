from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GymClassViewSet, ClassEnrollmentViewSet

router = DefaultRouter()
router.register(r'classes', GymClassViewSet, basename='gymclass')
router.register(r'class-enrollments', ClassEnrollmentViewSet, basename='class-enrollment')

urlpatterns = [
    path('', include(router.urls)),
]
