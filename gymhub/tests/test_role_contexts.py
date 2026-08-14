import pytest
from django.utils import timezone
from rest_framework import status

from users.models import MemberProfile
from users.serializers import UserSerializer


@pytest.mark.django_db
def test_instructor_client_exposes_both_profiles_and_defaults_to_instructor(
    trainer_user,
    trainer_profile,
):
    member = MemberProfile.objects.create(
        user=trainer_user,
        trainer_asignado=trainer_profile,
    )

    data = UserSerializer(trainer_user).data

    assert data['trainerprofile_id'] == trainer_profile.id
    assert data['memberprofile_id'] == member.id
    assert data['perfiles_disponibles'] == ['instructor', 'cliente']
    assert data['contexto_predeterminado'] == 'instructor'


@pytest.mark.django_db
def test_admin_enables_existing_instructor_as_client_with_first_payment(
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

    assert response.status_code == status.HTTP_201_CREATED
    trainer_user.refresh_from_db()
    assert trainer_user.role == 'trainer'
    assert response.data['user']['perfiles_disponibles'] == [
        'instructor',
        'cliente',
    ]
    assert response.data['member']['trainer_asignado'] == trainer_profile.id
    assert response.data['payment']['status'] == 'paid'
    assert response.data['payment']['paid_at'] is not None


@pytest.mark.django_db
def test_instructor_client_scope_self_never_exposes_assigned_clients_progress(
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
    assert [item['id'] for item in results] == [own_log.id]
    assert assigned_log.id not in {item['id'] for item in results}


@pytest.mark.django_db
def test_instructor_cannot_enable_its_own_client_profile(
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
