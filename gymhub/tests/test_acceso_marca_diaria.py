from datetime import date

import pytest
from django.utils import timezone
from freezegun import freeze_time

from attendance.models import Attendance


@pytest.fixture
def acceso_vigente(mocker, member_client, member_profile):
    member_client.force_authenticate(user=member_profile.user)
    mocker.patch('attendance.views.MemberRoutineEntryView.throttle_classes', [])
    mocker.patch('billing.services.membership_access', return_value={
        'allowed': True, 'reason': None, 'days_overdue': 0,
    })
    mocker.patch('users.services.get_active_prescription', return_value={})


@pytest.mark.django_db
@freeze_time('2026-11-12 18:00:00+00:00')
def test_abrir_rutina_reutiliza_marca_del_dia(member_client, member_profile, acceso_vigente):
    marca = Attendance.objects.create(member=member_profile)
    for _ in range(3):
        respuesta = member_client.post('/api/member/ver-rutina/', {})
        assert respuesta.status_code == 200
        assert respuesta.data['attendance']['id'] == marca.id
        assert respuesta.data['attendance_created'] is False
    assert Attendance.objects.filter(member=member_profile).count() == 1


@pytest.mark.django_db
@freeze_time('2026-11-13 05:59:59+00:00')
def test_marca_sigue_valida_hasta_medianoche_costa_rica(member_client, member_profile, acceso_vigente):
    marca = Attendance.objects.create(member=member_profile, attendance_date=date(2026, 11, 12))
    respuesta = member_client.post('/api/member/ver-rutina/', {})
    assert respuesta.status_code == 200
    assert respuesta.data['attendance']['id'] == marca.id
    with freeze_time('2026-11-13 06:00:00+00:00'):
        respuesta = member_client.post('/api/member/ver-rutina/', {})
        assert respuesta.status_code == 403
        assert respuesta.data['attendance_required'] is True
    assert Attendance.objects.filter(member=member_profile).count() == 1


@pytest.mark.django_db
@freeze_time('2026-11-12 18:00:00+00:00')
def test_marca_de_hoy_sigue_valida_despues_de_salida(member_client, member_profile, acceso_vigente):
    marca = Attendance.objects.create(member=member_profile, check_out_time=timezone.now())
    respuesta = member_client.post('/api/member/ver-rutina/', {})
    assert respuesta.status_code == 200
    assert respuesta.data['attendance']['id'] == marca.id


@pytest.mark.django_db
@freeze_time('2026-11-12 18:00:00+00:00')
def test_no_crea_marca_al_intentar_ver_ejercicios_sin_entrada(member_client, member_profile, acceso_vigente):
    respuesta = member_client.post('/api/member/ver-rutina/', {})
    assert respuesta.status_code == 403
    assert respuesta.data['attendance_required'] is True
    assert not Attendance.objects.filter(member=member_profile).exists()
