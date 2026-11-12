import pytest
from django.utils import timezone
from rest_framework import status

from users.models import MemberProfile
from users.permissions import tiene_perfil_cliente
from users.serializers import UserSerializer


@pytest.mark.django_db
def test_administrator_with_legacy_member_data_exposes_admin_only(
    trainer_user,
    trainer_profile,
):
    MemberProfile.objects.create(
        user=trainer_user,
        trainer_asignado=trainer_profile,
    )

    data = UserSerializer(trainer_user).data

    assert data['memberprofile_id'] is None
    assert 'trainerprofile_id' not in data
    assert data['perfiles_disponibles'] == ['administrador']
    assert data['contexto_predeterminado'] == 'administrador'
    assert not tiene_perfil_cliente(trainer_user)


@pytest.mark.django_db
def test_admin_assignment_catalog_contains_user_accounts(
    admin_client,
    admin_user,
    trainer_user,
):
    response = admin_client.get('/api/administrators/')

    assert response.status_code == status.HTTP_200_OK
    assert {item['id'] for item in response.data} == {admin_user.id, trainer_user.id}
    assert all('user' in item for item in response.data)


@pytest.mark.django_db
def test_administrator_account_cannot_be_demoted_to_client(trainer_user):
    trainer_user.role = 'member'
    trainer_user.is_staff = False
    trainer_user.save()
    trainer_user.refresh_from_db()

    assert trainer_user.role == 'admin'
    assert trainer_user.is_staff is True


@pytest.mark.django_db
def test_removed_admin_to_client_conversion_endpoint_is_not_available(
    admin_client,
    trainer_profile,
):
    response = admin_client.post(
        f'/api/trainers/{trainer_profile.id}/enable-client-profile/',
        {},
        format='json',
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_administrator_scope_self_does_not_limit_admin_access(
    trainer_client,
    trainer_user,
    trainer_profile,
    member_profile,
):
    from progress.models import ProgressLog

    own_log = ProgressLog.objects.create(
        member=MemberProfile.objects.create(
            user=trainer_user,
            trainer_asignado=trainer_profile,
        ),
        recorded_at=timezone.now(),
        weight_kg=75,
    )
    client_log = ProgressLog.objects.create(
        member=member_profile,
        recorded_at=timezone.now(),
        weight_kg=68,
    )

    response = trainer_client.get('/api/progress-logs/?scope=self')

    assert response.status_code == status.HTTP_200_OK
    results = response.data.get('results', response.data)
    assert {item['id'] for item in results} == {own_log.id, client_log.id}
