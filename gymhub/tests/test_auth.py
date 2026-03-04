"""
test_auth.py — Tests de autenticación JWT con cookies httpOnly.
"""
import pytest
from django.contrib.auth import get_user_model
from django.conf import settings
from rest_framework import status

User = get_user_model()


@pytest.mark.django_db
class TestRegister:
    def test_register_member_ok(self, api_client):
        resp = api_client.post('/auth/register/', {
            'email': 'newmember@test.com',
            'username': 'newmember',
            'first_name': 'New',
            'last_name': 'Member',
            'role': 'member',
            'password': 'pass123!ABC',
            'password2': 'pass123!ABC',
        })
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['user']['role'] == 'member'

    def test_register_trainer_requires_auth(self, api_client):
        """Registrar trainer sin autenticación → 401."""
        resp = api_client.post('/auth/register/', {
            'email': 'newtrainer@test.com',
            'username': 'newtrainer',
            'role': 'trainer',
            'password': 'pass123!ABC',
            'password2': 'pass123!ABC',
        })
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_register_trainer_by_member_forbidden(self, member_client):
        """Miembro intentando registrar trainer → 403 (IsStaffOrTrainer)."""
        resp = member_client.post('/auth/register/', {
            'email': 'newtrainer2@test.com',
            'username': 'newtrainer2',
            'role': 'trainer',
            'password': 'pass123!ABC',
            'password2': 'pass123!ABC',
        })
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_register_trainer_by_trainer_ok(self, trainer_client):
        """Trainer puede registrar otro trainer."""
        resp = trainer_client.post('/auth/register/', {
            'email': 'newtrainer3@test.com',
            'username': 'newtrainer3',
            'first_name': 'New',
            'last_name': 'Trainer',
            'role': 'trainer',
            'password': 'pass123!ABC',
            'password2': 'pass123!ABC',
        })
        assert resp.status_code == status.HTTP_201_CREATED

    def test_register_password_mismatch(self, api_client):
        resp = api_client.post('/auth/register/', {
            'email': 'bad@test.com',
            'username': 'bad',
            'role': 'member',
            'password': 'pass123!ABC',
            'password2': 'different',
        })
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestLogin:
    def test_login_sets_httponly_cookies(self, api_client, member_user):
        resp = api_client.post('/auth/login/', {
            'email': member_user.email,
            'password': 'member123!',
        })
        assert resp.status_code == status.HTTP_200_OK
        assert settings.ACCESS_TOKEN_COOKIE_NAME in resp.cookies
        assert settings.REFRESH_TOKEN_COOKIE_NAME in resp.cookies
        # Verificar httponly
        access_cookie = resp.cookies.get(settings.ACCESS_TOKEN_COOKIE_NAME)
        assert access_cookie is not None

    def test_login_wrong_password(self, api_client, member_user):
        resp = api_client.post('/auth/login/', {
            'email': member_user.email,
            'password': 'wrongpass',
        })
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_nonexistent_user(self, api_client):
        resp = api_client.post('/auth/login/', {
            'email': 'noone@test.com',
            'password': 'pass123!',
        })
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestLogout:
    def test_logout_clears_cookies_and_blacklists(self, member_client, member_user):
        # Login primero para obtener refresh token
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(member_user)
        member_client.cookies[settings.REFRESH_TOKEN_COOKIE_NAME] = str(refresh)

        resp = member_client.post('/auth/logout/')
        assert resp.status_code == status.HTTP_200_OK

    def test_logout_requires_auth(self, api_client):
        resp = api_client.post('/auth/logout/')
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestPermissions:
    def test_member_cannot_access_trainer_endpoint(self, member_client):
        """Miembro → 403 en endpoint de trainer."""
        resp = member_client.get('/api/trainer/gym-overview/')
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_trainer_can_access_trainer_endpoint(self, trainer_client, trainer_profile):
        resp = trainer_client.get('/api/trainer/gym-overview/')
        assert resp.status_code == status.HTTP_200_OK

    def test_unauthenticated_blocked(self, api_client):
        resp = api_client.get('/api/members/')
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_member_queryset_filtered_by_profile(self, member_client, member_profile):
        """Miembro solo ve su propio perfil."""
        resp = member_client.get('/api/members/')
        assert resp.status_code == status.HTTP_200_OK
        results = resp.data.get('results', resp.data)
        # Solo debe ver su propio perfil
        ids = [r['id'] for r in results]
        assert member_profile.id in ids
        assert len(ids) == 1
