"""
URLs de miembros y administración (prefix /api/)
Se incluyen desde gymhub/urls.py como: path('api/', include('users.member_urls'))
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AdminUserListView,
    MemberViewSet,
    PerfilGimnasioView,
    AdministradorListView,
    AdminOverviewView,
)

router = DefaultRouter()
router.register(r'members', MemberViewSet, basename='member')

urlpatterns = [
    path('', include(router.urls)),
    path('admin/gym-overview/', AdminOverviewView.as_view(), name='admin-overview'),
    path('admin/gym-profile/', PerfilGimnasioView.as_view(), name='admin-gym-profile'),
    path('administrators/', AdministradorListView.as_view(), name='administrator-list'),
    path('admin/users/', AdminUserListView.as_view(), name='admin-user-list'),
]
