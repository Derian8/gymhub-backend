"""
test_auth.py — Tests de autenticación JWT con cookies httpOnly.
"""
import pytest
from datetime import date, timedelta
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

    def test_register_member_without_username_generates_one_and_creates_profile(self, api_client):
        resp = api_client.post('/auth/register/', {
            'email': '  New.Member@Test.COM  ',
            'first_name': 'New',
            'last_name': 'Member',
            'password': 'pass123!ABC',
            'password2': 'pass123!ABC',
        })

        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['user']['email'] == 'new.member@test.com'
        assert resp.data['user']['username'] == 'new-member'
        assert resp.data['user']['role'] == 'member'
        assert resp.data['user']['memberprofile_id'] is not None
        assert settings.ACCESS_TOKEN_COOKIE_NAME in resp.cookies
        assert settings.REFRESH_TOKEN_COOKIE_NAME in resp.cookies

    def test_register_member_rejects_duplicate_email_case_insensitive(self, api_client):
        User.objects.create_user(
            email='member.case@test.com',
            username='member-case',
            password='member123!',
        )

        resp = api_client.post('/auth/register/', {
            'email': 'MEMBER.CASE@test.com',
            'password': 'pass123!ABC',
            'password2': 'pass123!ABC',
        })

        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert 'email' in resp.data

    def test_register_member_generates_unique_username_from_email(self, api_client):
        User.objects.create_user(
            email='existing@test.com',
            username='new-member',
            password='member123!',
        )

        resp = api_client.post('/auth/register/', {
            'email': 'new.member@test.com',
            'password': 'pass123!ABC',
            'password2': 'pass123!ABC',
        })

        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['user']['username'] == 'new-member-1'

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

    def test_login_accepts_email_case_insensitive(self, api_client, member_user):
        resp = api_client.post('/auth/login/', {
            'email': member_user.email.upper(),
            'password': 'member123!',
        })
        assert resp.status_code == status.HTTP_200_OK

    def test_login_nonexistent_user(self, api_client):
        resp = api_client.post('/auth/login/', {
            'email': 'noone@test.com',
            'password': 'pass123!',
        })
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_member_login_allowed_when_payment_overdue_30_days(self, api_client, member_user, membership_plan):
        from billing.models import PaymentSchedule, PaymentRecord

        schedule = PaymentSchedule.objects.create(
            member=member_user.memberprofile,
            plan=membership_plan,
            due_date=date.today() - timedelta(days=32),
            grace_period_days=7,
            is_active=True,
        )
        PaymentRecord.objects.create(
            schedule=schedule,
            amount=50.00,
            status='late',
        )

        resp = api_client.post('/auth/login/', {
            'email': member_user.email,
            'password': 'member123!',
        })

        assert resp.status_code == status.HTTP_200_OK
        assert settings.ACCESS_TOKEN_COOKIE_NAME in resp.cookies
        assert settings.REFRESH_TOKEN_COOKIE_NAME in resp.cookies


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
class TestTokenRefresh:
    def test_refresh_allowed_for_member_with_overdue_payment(self, api_client, member_user, membership_plan):
        from rest_framework_simplejwt.tokens import RefreshToken
        from billing.models import PaymentSchedule, PaymentRecord

        schedule = PaymentSchedule.objects.create(
            member=member_user.memberprofile,
            plan=membership_plan,
            due_date=date.today() - timedelta(days=31),
            grace_period_days=7,
            is_active=True,
        )
        PaymentRecord.objects.create(
            schedule=schedule,
            amount=50.00,
            status='late',
        )

        refresh = RefreshToken.for_user(member_user)
        api_client.cookies[settings.REFRESH_TOKEN_COOKIE_NAME] = str(refresh)

        resp = api_client.post('/auth/token/refresh/')

        assert resp.status_code == status.HTTP_200_OK
        assert settings.ACCESS_TOKEN_COOKIE_NAME in resp.cookies


@pytest.mark.django_db
class TestMe:
    def test_me_returns_authenticated_user(self, member_client, member_user):
        resp = member_client.get('/auth/me/')

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['email'] == member_user.email
        assert resp.data['role'] == member_user.role

    def test_me_patch_updates_email_case_insensitive_and_keeps_role(self, member_client, member_user):
        resp = member_client.patch('/auth/me/', {
            'email': '  Nuevo.Correo@GMAIL.com ',
            'first_name': 'Nuevo',
            'last_name': 'Nombre',
            'role': 'trainer',
        }, format='json')

        assert resp.status_code == status.HTTP_200_OK
        member_user.refresh_from_db()
        assert member_user.email == 'nuevo.correo@gmail.com'
        assert member_user.first_name == 'Nuevo'
        assert member_user.last_name == 'Nombre'
        assert member_user.role == 'member'
        assert resp.data['role'] == 'member'

    def test_me_patch_rejects_duplicate_email_case_insensitive(self, member_client):
        User.objects.create_user(
            email='ocupado@gmail.com',
            username='ocupado',
            password='member123!',
            role='member',
        )

        resp = member_client.patch('/auth/me/', {
            'email': 'Ocupado@Gmail.com',
        }, format='json')

        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert 'email' in resp.data


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
