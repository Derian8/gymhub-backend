from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AttendanceViewSet, CheckInView, MemberRoutineEntryView

router = DefaultRouter()
router.register(r'attendance', AttendanceViewSet, basename='attendance')

urlpatterns = [
    path('attendance/check-in/', CheckInView.as_view(), name='attendance-check-in'),
    path('member/ver-rutina/', MemberRoutineEntryView.as_view(), name='member-routine-entry'),
    path('', include(router.urls)),
]
