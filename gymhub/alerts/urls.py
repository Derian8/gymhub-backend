from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    InactivityAlertViewSet,
    MembersWithoutInactivityAlertsView,
    NotificationViewSet,
)

router = DefaultRouter()
router.register(r'alerts', InactivityAlertViewSet, basename='alert')
router.register(r'admin/inactivity-alerts', InactivityAlertViewSet, basename='admin-inactivity-alert')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path(
        'admin/members-without-alerts/',
        MembersWithoutInactivityAlertsView.as_view(),
        name='admin-members-without-alerts',
    ),
    path('', include(router.urls)),
]
