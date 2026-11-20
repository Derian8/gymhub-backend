from datetime import timedelta
from hashlib import sha256

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient
from freezegun import freeze_time

from attendance.models import Attendance, CredencialAccesoQr, TokenAccesoQr


@pytest.mark.django_db
def test_qr_fijo_valida_estado_real_del_cliente_y_suscripcion(member_profile, admin_user, membership_plan):
    from billing.models import MemberSubscription

    member_profile.is_active = True
    member_profile.save(update_fields=['is_active'])
    hoy = timezone.localdate()
    suscripcion = MemberSubscription.objects.create(
        member=member_profile, plan=membership_plan,
        trainer=member_profile.trainer_asignado,
        membership_name=membership_plan.name, agreed_price=membership_plan.price,
        start_date=hoy, current_period_start=hoy,
        current_period_end=hoy + timedelta(days=30),
        next_billing_date=hoy + timedelta(days=31),
        recurrence_type='monthly', is_active=True, status='active',
    )
    cliente = APIClient()
    cliente.force_authenticate(member_profile.user)
    token = cliente.get('/api/attendance/qr-token/').data['token']
    assert cliente.post('/api/attendance/check-in/', {'qr_token': token}).status_code == 403
    administrador = APIClient()
    administrador.force_authenticate(admin_user)
    assert administrador.post('/api/attendance/check-in/', {'qr_token': token}).status_code == 201
    suscripcion.current_period_end = hoy - timedelta(days=1)
    suscripcion.save(update_fields=['current_period_end'])
    assert administrador.post('/api/attendance/check-in/', {'qr_token': token}).status_code == 403
    assert cliente.get('/api/attendance/qr-token/').data['token'] == token


@pytest.mark.django_db
def test_qr_fijo_funciona_sin_cache_y_no_duplica_entrada(member_profile, admin_user, mocker):
    mocker.patch('billing.services.membership_access', return_value={'allowed': True, 'reason': 'active'})
    cliente = APIClient()
    cliente.force_authenticate(member_profile.user)
    respuesta = cliente.get('/api/attendance/qr-token/')
    assert respuesta.status_code == 200
    token = respuesta.data['token']
    assert str(CredencialAccesoQr.objects.get().codigo) == token
    assert respuesta.data['expires_at'] is None
    assert cliente.get('/api/attendance/qr-token/').data['token'] == token
    cache.clear()
    administrador = APIClient()
    administrador.force_authenticate(admin_user)
    entrada = administrador.post('/api/attendance/check-in/', {'qr_token': token})
    assert entrada.status_code == 201
    repetida = administrador.post('/api/attendance/check-in/', {'qr_token': token})
    assert repetida.status_code == 200
    assert repetida.data['entrada_ya_registrada'] is True
    assert Attendance.objects.filter(member=member_profile).count() == 1
    with freeze_time(timezone.now() + timedelta(days=1)):
        assert cliente.get('/api/attendance/qr-token/').data['token'] == token
        assert administrador.post('/api/attendance/check-in/', {'qr_token': token}).status_code == 201
    assert Attendance.objects.filter(member=member_profile).count() == 2


@pytest.mark.django_db
def test_regenerar_qr_revoca_copias_y_exige_administrador(member_profile, admin_user):
    cliente = APIClient()
    cliente.force_authenticate(member_profile.user)
    anterior = cliente.get('/api/attendance/qr-token/').data['token']
    ruta = f'/api/attendance/clientes/{member_profile.id}/regenerar-qr/'
    assert APIClient().post(ruta).status_code in (401, 403)
    assert cliente.post(ruta).status_code == 403
    administrador = APIClient()
    administrador.force_authenticate(admin_user)
    assert administrador.post(ruta).status_code == 200
    actual = cliente.get('/api/attendance/qr-token/').data['token']
    assert actual != anterior
    assert CredencialAccesoQr.objects.count() == 1
    assert administrador.post('/api/attendance/check-in/', {'qr_token': anterior}).status_code == 400
    assert not Attendance.objects.exists()


@pytest.mark.django_db
def test_qr_fijo_revalida_membresia_sin_invalidarse(member_profile, admin_user, mocker):
    cliente = APIClient()
    cliente.force_authenticate(member_profile.user)
    token = cliente.get('/api/attendance/qr-token/').data['token']
    administrador = APIClient()
    administrador.force_authenticate(admin_user)
    acceso = mocker.patch('billing.services.membership_access', return_value={
        'allowed': False, 'reason': 'payment_overdue', 'days_overdue': 3,
    })
    respuesta = administrador.post('/api/attendance/check-in/', {'qr_token': token})
    assert respuesta.status_code == 403
    assert respuesta.data['blocked'] is True
    assert not Attendance.objects.exists()
    acceso.return_value = {'allowed': True, 'reason': None, 'days_overdue': 0}
    assert administrador.post('/api/attendance/check-in/', {'qr_token': token}).status_code == 201
    acceso.return_value = {'allowed': False, 'reason': 'member_inactive', 'days_overdue': 0}
    assert administrador.post('/api/attendance/check-in/', {'qr_token': token}).status_code == 403


@pytest.mark.django_db
def test_qr_temporal_anterior_sigue_siendo_de_un_uso(member_profile, admin_user, mocker):
    mocker.patch('billing.services.membership_access', return_value={'allowed': True})
    TokenAccesoQr.objects.create(
        resumen=sha256(b'temporal').hexdigest(), cliente=member_profile,
        vence_en=timezone.now() + timedelta(seconds=60),
    )
    administrador = APIClient()
    administrador.force_authenticate(admin_user)
    assert administrador.post('/api/attendance/check-in/', {'qr_token': 'temporal'}).status_code == 201
    assert administrador.post('/api/attendance/check-in/', {'qr_token': 'temporal'}).status_code == 400


@pytest.mark.django_db
def test_qr_vencido_no_registra_entrada(member_profile, admin_user):
    TokenAccesoQr.objects.create(
        resumen=sha256(b'vencido').hexdigest(), cliente=member_profile,
        vence_en=timezone.now() - timedelta(seconds=1),
    )
    administrador = APIClient()
    administrador.force_authenticate(admin_user)
    respuesta = administrador.post('/api/attendance/check-in/', {'qr_token': 'vencido'})
    assert respuesta.status_code == 400
    assert not Attendance.objects.exists()


@pytest.mark.django_db
def test_solo_cliente_puede_emitir_qr(admin_user):
    cliente = APIClient()
    assert cliente.get('/api/attendance/qr-token/').status_code in (401, 403)
    cliente.force_authenticate(admin_user)
    assert cliente.get('/api/attendance/qr-token/').status_code == 403


@pytest.mark.django_db
def test_cron_limpia_tokens_y_ejecuta_inactividad(settings, mocker, member_profile):
    settings.CRON_SECRET = 'secreto-prueba'
    TokenAccesoQr.objects.create(
        resumen=sha256(b'vencido').hexdigest(), cliente=member_profile,
        vence_en=timezone.now() - timedelta(seconds=1),
    )
    inactividad = mocker.patch('alerts.tasks.check_member_inactivity', return_value={'alerts_created': 2})
    respuesta = APIClient().get(
        '/api/internal/daily-membership-maintenance/',
        HTTP_AUTHORIZATION='Bearer secreto-prueba',
    )
    assert respuesta.status_code == 200
    assert respuesta.data['qr_tokens_deleted'] == 1
    assert respuesta.data['inactivity_alerts_created'] == 2
    inactividad.assert_called_once()
