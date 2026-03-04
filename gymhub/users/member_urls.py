"""
URLs de miembros y trainer (prefix /api/)
Se incluyen desde gymhub/urls.py como: path('api/', include('users.member_urls'))
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MemberViewSet, TrainerOverviewView

router = DefaultRouter()
router.register(r'members', MemberViewSet, basename='member')

urlpatterns = [
    path('', include(router.urls)),
    path('trainer/gym-overview/', TrainerOverviewView.as_view(), name='trainer-overview'),
]
