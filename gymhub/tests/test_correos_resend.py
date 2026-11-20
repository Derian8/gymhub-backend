import base64
import io
import json
from datetime import timedelta
from urllib.error import HTTPError, URLError
from unittest.mock import patch

import pytest
from django.core.mail import EmailMessage
from django.db import transaction
from django.utils import timezone

from billing.correos import procesar_correos
from billing.models import CorreoPendiente, PaymentRecord, PaymentSchedule
from billing.services import mark_payment_paid


@pytest.fixture(autouse=True)
def configurar_resend(settings):
    settings.RESEND_HABILITADO = True
    settings.RESEND_API_KEY = 're_clave_ficticia'
    settings.RESEND_MODO_DEMO = True
    settings.RESEND_DESTINATARIO_DEMO = 'demo@example.com'
    settings.RESEND_LIMITE_DIARIO = 90
    settings.DEFAULT_FROM_EMAIL = 'PULSO <onboarding@resend.dev>'
    settings.EMAIL_BACKEND = 'billing.correos.ResendEmailBackend'


def encolar(clave='prueba:1'):
    EmailMessage(
        subject='Pago PULSO', body='Confirmación', to=['cliente@example.com'],
        headers={'X-Pulso-Evento': clave},
    ).send()
    return CorreoPendiente.objects.get(clave=clave)


def respuesta_correcta(simulador):
    simulador.return_value.__enter__.return_value = io.BytesIO(b'{"id":"correo-resend"}')


@pytest.mark.django_db
def test_destinatario_demo_y_peticion_idempotente():
    correo = encolar()
    with patch('billing.correos.urlopen') as solicitud:
        respuesta_correcta(solicitud)
        assert procesar_correos(limite=1) == {'aceptados': 1}
        peticion = solicitud.call_args.args[0]
        contenido = json.loads(peticion.data)
        assert contenido['to'] == ['demo@example.com']
        assert 'cliente@example.com' not in peticion.data.decode()
        assert peticion.get_header('Idempotency-key') == str(correo.identificador)
        assert solicitud.call_args.kwargs['timeout'] == 8
    correo.refresh_from_db()
    assert correo.estado == 'aceptado'
    assert correo.identificador_proveedor == 'correo-resend'
    with patch('billing.correos.urlopen') as solicitud:
        procesar_correos(limite=1)
        solicitud.assert_not_called()


@pytest.mark.django_db
def test_fallo_reintenta_misma_peticion_sin_perder_correo():
    correo = encolar()
    with patch('billing.correos.urlopen', side_effect=URLError('sin conexión')):
        assert procesar_correos(limite=1)['aceptados'] == 0
    correo.refresh_from_db()
    assert correo.estado == 'fallido'
    assert correo.intentos == 1
    with patch('billing.correos.urlopen') as solicitud:
        procesar_correos(limite=1)
        solicitud.assert_not_called()
        correo.proximo_intento = timezone.now() - timedelta(seconds=1)
        correo.save()
        respuesta_correcta(solicitud)
        procesar_correos(limite=1)
        assert solicitud.call_args.args[0].get_header('Idempotency-key') == str(correo.identificador)
        assert json.loads(solicitud.call_args.args[0].data) == correo.contenido


@pytest.mark.django_db
@pytest.mark.parametrize('codigo,estado', [(403, 'revisar'), (429, 'fallido'), (503, 'fallido')])
def test_clasifica_errores_sin_guardar_respuesta_sensible(codigo, estado):
    correo = encolar()
    error = HTTPError('https://api.resend.com/emails', codigo, 'secreto', {}, None)
    with patch('billing.correos.urlopen', side_effect=error):
        procesar_correos(limite=1)
    correo.refresh_from_db()
    assert correo.estado == estado
    assert 'secreto' not in correo.ultimo_error


@pytest.mark.django_db
def test_no_reenvia_fuera_de_ventana_idempotente():
    correo = encolar()
    correo.primer_intento = timezone.now() - timedelta(hours=23)
    correo.save()
    with patch('billing.correos.urlopen') as solicitud:
        procesar_correos(limite=1)
        solicitud.assert_not_called()
    correo.refresh_from_db()
    assert correo.estado == 'revisar'


@pytest.mark.django_db
def test_cuota_y_configuracion_impiden_envios(settings):
    correo = encolar()
    settings.RESEND_LIMITE_DIARIO = 0
    with patch('billing.correos.urlopen') as solicitud:
        procesar_correos(limite=1)
        settings.RESEND_LIMITE_DIARIO = 90
        settings.RESEND_API_KEY = ''
        procesar_correos(limite=1)
        solicitud.assert_not_called()
    correo.refresh_from_db()
    assert correo.intentos == 0


@pytest.mark.django_db
def test_cola_antigua_sin_respuesta_local_requiere_revision():
    correo = encolar()
    CorreoPendiente.objects.filter(pk=correo.pk).update(
        fecha_creacion=timezone.now() - timedelta(hours=24),
        primer_intento=timezone.now() - timedelta(hours=24),
    )
    with patch('billing.correos.urlopen') as solicitud:
        procesar_correos(limite=1)
        solicitud.assert_not_called()
    correo.refresh_from_db()
    assert correo.estado == 'revisar'


@pytest.mark.django_db
def test_correo_nunca_intentado_no_caduca_por_esperar_en_cola():
    correo = encolar()
    CorreoPendiente.objects.filter(pk=correo.pk).update(
        fecha_creacion=timezone.now() - timedelta(days=2),
    )
    with patch('billing.correos.urlopen') as solicitud:
        respuesta_correcta(solicitud)
        assert procesar_correos(limite=1)['aceptados'] == 1


@pytest.mark.django_db
def test_reserva_sobrevive_interrupcion_y_recupera_misma_clave():
    correo = encolar()
    # Simular muerte del worker, que no equivale a un error de HTTP recuperable.
    with patch('billing.correos.urlopen', side_effect=KeyboardInterrupt):
        with pytest.raises(KeyboardInterrupt):
            procesar_correos(limite=1)
    correo.refresh_from_db()
    assert correo.primer_intento is not None
    assert correo.intentos == 1
    with patch('billing.correos.urlopen') as solicitud:
        procesar_correos(limite=1)
        solicitud.assert_not_called()
        correo.proximo_intento = timezone.now() - timedelta(seconds=1)
        correo.save()
        respuesta_correcta(solicitud)
        assert procesar_correos(limite=1)['aceptados'] == 1
        assert solicitud.call_args.args[0].get_header('Idempotency-key') == str(
            correo.identificador,
        )


@pytest.mark.django_db
def test_limite_del_demo_no_se_puede_subir_a_mas_de_90(settings):
    settings.RESEND_LIMITE_DIARIO = 200
    ahora = timezone.now()
    CorreoPendiente.objects.bulk_create([
        CorreoPendiente(
            clave=f'aceptado:{indice}', contenido={}, estado='aceptado',
            fecha_aceptacion=ahora,
        ) for indice in range(90)
    ])
    correo = encolar()
    with patch('billing.correos.urlopen') as solicitud:
        procesar_correos(limite=1)
        solicitud.assert_not_called()
    correo.refresh_from_db()
    assert correo.intentos == 0


@pytest.mark.django_db
def test_rollback_descarta_cola_y_callback(django_capture_on_commit_callbacks):
    with patch('billing.correos.urlopen') as solicitud:
        with django_capture_on_commit_callbacks(execute=True):
            with pytest.raises(ValueError):
                with transaction.atomic():
                    encolar('comprobante:rollback')
                    raise ValueError('Revertir pago')
        solicitud.assert_not_called()
    assert not CorreoPendiente.objects.exists()


@pytest.mark.django_db
def test_pago_encola_pdf_una_vez_y_envia_tras_commit(
    member_profile, membership_plan, django_capture_on_commit_callbacks,
):
    calendario = PaymentSchedule.objects.create(
        member=member_profile, plan=membership_plan, due_date=timezone.localdate(),
    )
    pago = PaymentRecord.objects.create(schedule=calendario, amount='15000.00')
    with patch('billing.correos.urlopen') as solicitud:
        respuesta_correcta(solicitud)
        with django_capture_on_commit_callbacks(execute=True):
            mark_payment_paid(pago)
            mark_payment_paid(pago)
            solicitud.assert_not_called()
            correo = CorreoPendiente.objects.get(clave=f'comprobante:{pago.pk}')
            adjunto = correo.contenido['attachments'][0]
            assert base64.b64decode(adjunto['content']).startswith(b'%PDF-')
            assert correo.contenido['to'] == ['demo@example.com']
        assert solicitud.call_count == 1
    assert CorreoPendiente.objects.count() == 1


@pytest.mark.django_db
def test_pago_permanece_confirmado_si_resend_falla(
    member_profile, membership_plan, django_capture_on_commit_callbacks,
):
    calendario = PaymentSchedule.objects.create(
        member=member_profile, plan=membership_plan, due_date=timezone.localdate(),
    )
    pago = PaymentRecord.objects.create(schedule=calendario, amount='15000.00')
    with patch('billing.correos.urlopen', side_effect=URLError('sin red')):
        with django_capture_on_commit_callbacks(execute=True):
            mark_payment_paid(pago)
    pago.refresh_from_db()
    assert pago.status == 'paid'
    assert CorreoPendiente.objects.get().estado == 'fallido'


@pytest.mark.django_db
def test_reminder_permanece_reintentable_si_notificacion_ya_existe(
    member_profile, membership_plan, django_capture_on_commit_callbacks,
):
    from alerts.models import Notification
    from billing.tasks import check_upcoming_payments

    calendario = PaymentSchedule.objects.create(
        member=member_profile, plan=membership_plan,
        due_date=timezone.localdate() + timedelta(days=2),
    )
    PaymentRecord.objects.create(schedule=calendario, amount='15000.00')
    with django_capture_on_commit_callbacks(execute=True):
        check_upcoming_payments()
        check_upcoming_payments()
    assert Notification.objects.filter(user=member_profile.user, type='payment_due').count() == 1
    assert CorreoPendiente.objects.count() == 1
    with patch('billing.correos.urlopen') as solicitud:
        respuesta_correcta(solicitud)
        assert procesar_correos(limite=1)['aceptados'] == 1


@pytest.mark.django_db
def test_otro_cliente_no_puede_descargar_comprobante(
    member_client, trainer_user, membership_plan,
):
    from users.models import MemberProfile

    ajeno = MemberProfile.objects.create(user=trainer_user)
    calendario = PaymentSchedule.objects.create(
        member=ajeno, plan=membership_plan, due_date=timezone.localdate(),
    )
    pago = PaymentRecord.objects.create(
        schedule=calendario, amount='15000.00', status='paid',
        paid_at=timezone.now(), receipt_issued_at=timezone.now(),
    )
    assert member_client.get(f'/api/payment-records/{pago.pk}/receipt/').status_code == 404


@pytest.mark.django_db
def test_cliente_no_puede_ver_ni_procesar_correos(member_client):
    assert member_client.get('/api/admin/correos/').status_code == 403
    assert member_client.post('/api/admin/correos/').status_code == 403


@pytest.mark.django_db
def test_panel_no_expone_claves_ni_contenido(admin_client):
    encolar()
    respuesta = admin_client.get('/api/admin/correos/')
    assert respuesta.status_code == 200
    assert respuesta.data == {
        'configurado': True, 'modo_demo': True,
        'cantidades': {'pendiente': 1},
    }
    with patch('billing.correos.urlopen') as solicitud:
        respuesta_correcta(solicitud)
        respuesta = admin_client.post('/api/admin/correos/')
    assert respuesta.status_code == 200
    assert respuesta.data['aceptados'] == 1
    assert respuesta.data['cantidades'] == {'aceptado': 1}
    assert 're_clave_ficticia' not in str(respuesta.data)
    assert 'demo@example.com' not in str(respuesta.data)


@pytest.mark.django_db
def test_panel_informa_configuracion_incompleta(admin_client, settings):
    settings.RESEND_API_KEY = ''
    assert admin_client.get('/api/admin/correos/').data['configurado'] is False
    with patch('billing.correos.urlopen') as solicitud:
        assert admin_client.post('/api/admin/correos/').status_code == 503
        solicitud.assert_not_called()
