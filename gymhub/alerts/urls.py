from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    InactivityAlertViewSet,
    MembersWithoutInactivityAlertsView,
    NotificationViewSet,
)

router = DefaultRouter()
router.register(r'alerts', InactivityAlertViewSet, basename='alert')
router.register(r'trainer/inactivity-alerts', InactivityAlertViewSet, basename='trainer-inactivity-alert')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path(
        'trainer/members-without-alerts/',
        MembersWithoutInactivityAlertsView.as_view(),
        name='trainer-members-without-alerts',
    ),
    path('', include(router.urls)),
]
