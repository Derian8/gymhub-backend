from datetime import timedelta
from hashlib import sha256

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from attendance.models import Attendance, TokenAccesoQr


@pytest.mark.django_db
def test_qr_funciona_sin_cache_y_solo_una_vez(member_profile, admin_user, mocker):
    mocker.patch('billing.services.membership_access', return_value={'allowed': True, 'reason': 'active'})
    cliente = APIClient()
    cliente.force_authenticate(member_profile.user)
    respuesta = cliente.get('/api/attendance/qr-token/')
    assert respuesta.status_code == 200
    token = respuesta.data['token']
    registro = TokenAccesoQr.objects.get()
    assert registro.resumen == sha256(token.encode()).hexdigest()
    assert registro.resumen != token
    cache.clear()
    administrador = APIClient()
    administrador.force_authenticate(admin_user)
    entrada = administrador.post('/api/attendance/check-in/', {'qr_token': token})
    assert entrada.status_code == 201
    registro.refresh_from_db()
    assert registro.consumido_en is not None
    repetida = administrador.post('/api/attendance/check-in/', {'qr_token': token})
    assert repetida.status_code == 400
    assert Attendance.objects.filter(member=member_profile).count() == 1


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
