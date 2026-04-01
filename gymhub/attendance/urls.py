from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AttendanceViewSet, CheckInView

router = DefaultRouter()
router.register(r'attendance', AttendanceViewSet, basename='attendance')

urlpatterns = [
    path('attendance/check-in/', CheckInView.as_view(), name='attendance-check-in'),
    path('', include(router.urls)),
]
