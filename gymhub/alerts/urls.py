from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InactivityAlertViewSet, NotificationViewSet

router = DefaultRouter()
router.register(r'alerts', InactivityAlertViewSet, basename='alert')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path('', include(router.urls)),
]
