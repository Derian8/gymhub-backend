"""Cola transaccional de correo por HTTPS, compatible con Vercel y Celery."""
import base64
import json
import logging
import time
import uuid
from datetime import timedelta
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.mail import EmailMessage
from django.core.mail.backends.base import BaseEmailBackend
from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone

from .models import CorreoPendiente

logger = logging.getLogger(__name__)


class ResendEmailBackend(BaseEmailBackend):
    def send_messages(self, email_messages):
        cantidad = 0
        for mensaje in email_messages or []:
            destinatarios = mensaje.recipients()
            if not destinatarios:
                continue
            if settings.RESEND_MODO_DEMO:
                destinatarios = [settings.RESEND_DESTINATARIO_DEMO]
            contenido = {
                'from': mensaje.from_email,
                'to': destinatarios,
                'subject': mensaje.subject,
                'text': mensaje.body,
            }
            if mensaje.attachments:
                contenido['attachments'] = [
                    {'filename': nombre, 'content': base64.b64encode(
                        datos.encode() if isinstance(datos, str) else datos,
                    ).decode('ascii')}
                    for nombre, datos, _ in mensaje.attachments
                ]
            clave = mensaje.extra_headers.get('X-Pulso-Evento', str(uuid.uuid4()))
            correo, creado = CorreoPendiente.objects.get_or_create(
                clave=clave, defaults={'contenido': contenido},
            )
            if creado and clave.startswith('comprobante:'):
                # La cola se confirma junto con el pago; la red se usa después.
                transaction.on_commit(
                    lambda pk=correo.pk: procesar_correos(identificador=pk, limite=1),
                    robust=True,
                )
            cantidad += int(creado)
        return cantidad


def encolar_comprobante(pago):
    if not settings.RESEND_HABILITADO:
        return
    from .comprobantes import generar_comprobante

    usuario = pago.schedule.member.user
    mensaje = EmailMessage(
        subject='Comprobante de pago — PULSO',
        body=(f'Hola {usuario.get_full_name() or usuario.email},\n\n'
              f'Confirmamos tu pago de CRC {pago.amount}. '
              'Adjuntamos tu comprobante interno.\n\nGracias por entrenar con PULSO.'),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[usuario.email],
        headers={'X-Pulso-Evento': f'comprobante:{pago.pk}'},
    )
    mensaje.attach(f'comprobante-{pago.pk}.pdf', generar_comprobante(pago), 'application/pdf')
    mensaje.send()


@transaction.atomic
def _reservar_correo(identificador=None):
    """Confirma el primer intento y una reserva breve antes de usar la red."""
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_try_advisory_xact_lock(%s)', [71934022])
            if not cursor.fetchone()[0]:
                return None
    ahora = timezone.now()
    # Un pendiente con reserva futura está siendo enviado por otro proceso.
    if CorreoPendiente.objects.filter(
        estado='pendiente', intentos__gt=0, proximo_intento__gt=ahora,
    ).exists():
        return None
    for _ in range(10):
        consulta = CorreoPendiente.objects.select_for_update().filter(
            estado__in=['pendiente', 'fallido'],
        ).filter(Q(proximo_intento__isnull=True) | Q(proximo_intento__lte=ahora))
        if identificador is not None:
            consulta = consulta.filter(pk=identificador)
        correo = consulta.first()
        if correo is None:
            return None
        if correo.primer_intento and ahora - correo.primer_intento >= timedelta(hours=23):
            correo.estado = 'revisar'
            correo.ultimo_error = 'Ventana de idempotencia agotada; revisar en Resend.'
            correo.save()
            continue
        if settings.RESEND_MODO_DEMO and correo.contenido['to'] != [
            settings.RESEND_DESTINATARIO_DEMO,
        ]:
            correo.estado = 'revisar'
            correo.ultimo_error = 'Destinatario distinto del demo configurado.'
            correo.save()
            continue
        if CorreoPendiente.objects.filter(
            fecha_aceptacion__gte=ahora - timedelta(days=1),
        ).count() >= min(settings.RESEND_LIMITE_DIARIO, 90):
            return None
        if CorreoPendiente.objects.filter(
            fecha_aceptacion__gte=ahora - timedelta(days=31),
        ).count() >= 2700:
            return None
        correo.estado = 'pendiente'
        correo.intentos += 1
        correo.primer_intento = correo.primer_intento or ahora
        correo.proximo_intento = ahora + timedelta(minutes=2)
        correo.save()
        return correo
    return None


def procesar_correos(*, identificador=None, limite=10):
    if not settings.RESEND_HABILITADO or not settings.RESEND_API_KEY:
        return {'aceptados': 0}
    if settings.RESEND_MODO_DEMO and not settings.RESEND_DESTINATARIO_DEMO:
        logger.error('Configura RESEND_DESTINATARIO_DEMO antes de habilitar correos.')
        return {'aceptados': 0}
    aceptados = 0
    for indice in range(min(limite, 10)):
        if indice:
            time.sleep(0.6)
        correo = _reservar_correo(identificador)
        if correo is None:
            break
        solicitud = Request(
            'https://api.resend.com/emails',
            data=json.dumps(correo.contenido).encode('utf-8'),
            headers={
                'Authorization': f'Bearer {settings.RESEND_API_KEY}',
                'Content-Type': 'application/json',
                'User-Agent': 'PULSO/1.0',
                'Idempotency-Key': str(correo.identificador),
            }, method='POST',
        )
        # La reserva ya está confirmada: no mantener una transacción durante HTTP.
        consulta = CorreoPendiente.objects.filter(
            pk=correo.pk, estado='pendiente', intentos=correo.intentos,
        )
        try:
            with urlopen(solicitud, timeout=8) as respuesta:
                resultado = json.load(respuesta)
            if not isinstance(resultado, dict) or not (
                isinstance(resultado.get('id'), str) and resultado['id']
            ):
                raise ValueError('Respuesta sin identificador')
        except (HTTPError, URLError, OSError, ValueError) as error:
            codigo = getattr(error, 'code', None)
            reintentable = codigo in (None, 429) or (codigo and codigo >= 500)
            ultimo_error = (
                f'Resend HTTP {codigo}' if codigo
                else 'Fallo de red o respuesta inválida'
            )
            consulta.update(
                estado='fallido' if reintentable else 'revisar',
                ultimo_error=ultimo_error,
                proximo_intento=timezone.now() + timedelta(
                    minutes=min(2 ** correo.intentos, 60),
                ),
            )
            logger.warning('Correo %s pendiente de resolución: %s', correo.pk, ultimo_error)
            break
        aceptados += consulta.update(
            estado='aceptado', identificador_proveedor=resultado['id'],
            fecha_aceptacion=timezone.now(), ultimo_error='', proximo_intento=None,
        )
    return {'aceptados': aceptados}
