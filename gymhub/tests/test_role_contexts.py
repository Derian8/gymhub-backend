import pytest
from django.utils import timezone
from rest_framework import status

from users.models import MemberProfile
from users.permissions import tiene_perfil_cliente
from users.serializers import UserSerializer


@pytest.mark.django_db
def test_administrator_with_legacy_client_profile_exposes_admin_only(
    trainer_user,
    trainer_profile,
):
    member = MemberProfile.objects.create(
        user=trainer_user,
        trainer_asignado=trainer_profile,
    )

    data = UserSerializer(trainer_user).data

    assert data['trainerprofile_id'] == trainer_profile.id
    assert data['memberprofile_id'] is None
    assert data['perfiles_disponibles'] == ['administrador']
    assert data['contexto_predeterminado'] == 'administrador'
    assert not tiene_perfil_cliente(trainer_user)


@pytest.mark.django_db
def test_admin_cannot_convert_an_administrator_account_into_client(
    admin_client,
    trainer_user,
    trainer_profile,
    membership_plan,
):
    response = admin_client.post(
        f'/api/trainers/{trainer_profile.id}/enable-client-profile/',
        {
            'entrenador_asignado': trainer_profile.id,
            'telefono': '8888-0000',
            'tipo_membresia': 'catalogo',
            'plan_membresia': membership_plan.id,
            'renovacion_automatica': True,
            'metodo_pago': 'cash',
        },
        format='json',
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert 'no puede convertirse en cliente' in response.data['error']
    trainer_user.refresh_from_db()
    assert trainer_user.role == 'admin'
    assert trainer_user.is_staff is True
    assert not hasattr(trainer_user, 'memberprofile')


@pytest.mark.django_db
def test_administrator_account_cannot_be_demoted_to_client(trainer_user):
    trainer_user.role = 'member'
    trainer_user.is_staff = False
    trainer_user.save()
    trainer_user.refresh_from_db()

    assert trainer_user.role == 'admin'
    assert trainer_user.is_staff is True


@pytest.mark.django_db
def test_administrator_cannot_use_client_scope_for_legacy_member_profile(
    trainer_client,
    trainer_user,
    trainer_profile,
    member_profile,
):
    from progress.models import ProgressLog

    own_member = MemberProfile.objects.create(
        user=trainer_user,
        trainer_asignado=trainer_profile,
    )
    own_log = ProgressLog.objects.create(
        member=own_member,
        recorded_at=timezone.now(),
        weight_kg=75,
    )
    assigned_log = ProgressLog.objects.create(
        member=member_profile,
        recorded_at=timezone.now(),
        weight_kg=68,
    )

    response = trainer_client.get('/api/progress-logs/?scope=self')

    assert response.status_code == status.HTTP_200_OK
    results = response.data.get('results', response.data)
    assert {item['id'] for item in results} == {own_log.id, assigned_log.id}


@pytest.mark.django_db
def test_administrator_cannot_enable_its_own_client_profile(
    trainer_client,
    trainer_profile,
    membership_plan,
):
    response = trainer_client.post(
        f'/api/trainers/{trainer_profile.id}/enable-client-profile/',
        {
            'entrenador_asignado': trainer_profile.id,
            'tipo_membresia': 'catalogo',
            'plan_membresia': membership_plan.id,
            'renovacion_automatica': True,
            'metodo_pago': 'cash',
        },
        format='json',
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert not hasattr(trainer_profile.user, 'memberprofile')
