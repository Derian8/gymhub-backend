from datetime import date, timedelta
import time

import pytest
from freezegun import freeze_time
from rest_framework.throttling import SimpleRateThrottle

from billing.models import MemberSubscription, PaymentRecord
from billing.services import initialize_subscription, membership_access


@pytest.fixture(autouse=True)
def reloj_throttle(monkeypatch):
    # Congelar también las fixtures: el JWT debe emitirse en el mismo reloj
    # que la petición, incluso al ejecutar estas pruebas en otra fecha/hora.
    with freeze_time('2026-11-19 18:00:00'):
        monkeypatch.setattr(SimpleRateThrottle, 'timer', staticmethod(time.time))
        yield


@pytest.fixture
def crear_cobro(member_profile, trainer_profile):
    def crear(inicio, tolerancia=7):
        suscripcion = MemberSubscription.objects.create(
            member=member_profile, trainer=trainer_profile,
            membership_name='Mensual', agreed_price='12000',
            start_date=inicio, next_billing_date=inicio,
            recurrence_type='monthly', grace_period_days=tolerancia,
            auto_generate_next=True, status='pending',
        )
        _, cobro = initialize_subscription(suscripcion)
        return suscripcion, cobro
    return crear


@pytest.mark.django_db
@freeze_time('2026-11-19 18:00:00')
@pytest.mark.parametrize(('inicio', 'inicio_esperado', 'fin_esperado'), [
    (date(2026, 11, 16), date(2026, 11, 16), date(2026, 12, 15)),
    (date(2026, 10, 5), date(2026, 11, 19), date(2026, 12, 18)),
    (date(2026, 11, 25), date(2026, 11, 19), date(2026, 12, 18)),
])
def test_cobrar_confirma_vigencia_y_acceso_inmediatamente(
    admin_client, member_profile, crear_cobro,
    inicio, inicio_esperado, fin_esperado,
):
    suscripcion, cobro = crear_cobro(inicio)
    vista = admin_client.get(f'/api/payment-records/{cobro.pk}/').data
    assert vista['vigencia_pago']['inicio'] == inicio_esperado.isoformat()
    assert vista['vigencia_pago']['fin'] == fin_esperado.isoformat()

    respuesta = admin_client.post(f'/api/payment-records/{cobro.pk}/mark-paid/', {
        'method': 'sinpe', 'payment_reference': 'SINPE-123',
    })
    assert respuesta.status_code == 200
    assert respuesta.data['receipt_number']
    assert respuesta.data['membresia_confirmada']['can_check_in'] is True
    assert respuesta.data['membresia_confirmada']['estado_cliente'] == 'membresia_activa'
    suscripcion.refresh_from_db()
    assert suscripcion.current_period_start == inicio_esperado
    assert suscripcion.current_period_end == fin_esperado
    assert membership_access(member_profile)['allowed'] is True
    assert PaymentRecord.objects.filter(
        schedule__subscription=suscripcion, status='pending',
        schedule__period_start=fin_esperado + timedelta(days=1),
    ).count() == 1
    repetido = admin_client.post(f'/api/payment-records/{cobro.pk}/mark-paid/')
    assert repetido.status_code == 400
    assert PaymentRecord.objects.filter(schedule__subscription=suscripcion).count() == 2


@pytest.mark.django_db
@freeze_time('2026-11-19 18:00:00')
def test_pago_anticipado_conserva_dias_pagados(admin_client, member_profile, crear_cobro):
    suscripcion, cobro = crear_cobro(date(2026, 11, 1))
    assert admin_client.post(f'/api/payment-records/{cobro.pk}/mark-paid/').status_code == 200
    siguiente = PaymentRecord.objects.get(schedule__subscription=suscripcion, status='pending')
    respuesta = admin_client.post(f'/api/payment-records/{siguiente.pk}/mark-paid/')
    assert respuesta.status_code == 200
    suscripcion.refresh_from_db()
    assert suscripcion.current_period_start == date(2026, 12, 19)
    assert suscripcion.current_period_end == date(2027, 1, 18)
    assert membership_access(member_profile)['allowed'] is True


@pytest.mark.django_db
@freeze_time('2026-11-19 18:00:00')
def test_saldar_deuda_no_activa_periodos_antiguos(admin_client, crear_cobro):
    suscripcion, cobro = crear_cobro(date(2026, 9, 1))
    respuesta = admin_client.post(f'/api/payment-records/{cobro.pk}/mark-paid/', {
        'aplicacion': 'deuda',
    })
    assert respuesta.status_code == 200
    assert respuesta.data['status'] == 'paid'
    assert respuesta.data['membresia_confirmada']['can_check_in'] is False
    suscripcion.refresh_from_db()
    assert suscripcion.current_period_end is None
    renovacion = admin_client.post(f'/api/member-memberships/{suscripcion.pk}/renew/')
    assert renovacion.status_code == 200
    assert PaymentRecord.objects.filter(
        schedule__subscription=suscripcion, status='pending',
    ).exists()


@pytest.mark.django_db
@freeze_time('2026-11-19 18:00:00')
@pytest.mark.parametrize('datos', [
    {'method': 'sinpe'}, {'aplicacion': 'incorrecta'},
])
def test_error_no_guarda_pago_ni_activa(admin_client, crear_cobro, datos):
    suscripcion, cobro = crear_cobro(date(2026, 10, 1))
    respuesta = admin_client.post(f'/api/payment-records/{cobro.pk}/mark-paid/', datos)
    assert respuesta.status_code == 400
    cobro.refresh_from_db()
    suscripcion.refresh_from_db()
    assert cobro.status == 'pending'
    assert cobro.receipt_issued_at is None
    assert suscripcion.current_period_end is None


@pytest.mark.django_db
def test_no_reactiva_un_perfil_dado_de_baja(admin_client, member_profile, crear_cobro):
    _, cobro = crear_cobro(date(2026, 10, 1))
    member_profile.is_active = False
    member_profile.save(update_fields=['is_active'])
    respuesta = admin_client.post(f'/api/payment-records/{cobro.pk}/mark-paid/')
    assert respuesta.status_code == 400
    cobro.refresh_from_db()
    assert cobro.status == 'pending'
