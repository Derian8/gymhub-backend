"""
URLs de miembros y trainer (prefix /api/)
Se incluyen desde gymhub/urls.py como: path('api/', include('users.member_urls'))
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AdminUserListView,
    HabilitarInstructorClienteView,
    MemberViewSet,
    PerfilGimnasioView,
    TrainerListView,
    TrainerOverviewView,
)

router = DefaultRouter()
router.register(r'members', MemberViewSet, basename='member')

urlpatterns = [
    path('', include(router.urls)),
    path('trainer/gym-overview/', TrainerOverviewView.as_view(), name='trainer-overview'),
    path('trainer/gym-profile/', PerfilGimnasioView.as_view(), name='gym-profile'),
    path('trainers/', TrainerListView.as_view(), name='trainer-list'),
    path('admin/users/', AdminUserListView.as_view(), name='admin-user-list'),
    path(
        'trainers/<int:pk>/enable-client-profile/',
        HabilitarInstructorClienteView.as_view(),
        name='trainer-enable-client-profile',
    ),
]
