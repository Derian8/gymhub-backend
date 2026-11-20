"""PDF compartido por la descarga autenticada y el correo de pago."""
import io

from django.utils import timezone
from reportlab.pdfgen import canvas


def generar_comprobante(pago):
    if pago.status != 'paid' or not pago.receipt_issued_at or not pago.paid_at:
        raise ValueError('El comprobante requiere un pago confirmado.')
    entrenador = pago.schedule.member.trainer_asignado
    gimnasio = getattr(entrenador, 'perfil_gimnasio', None) if entrenador else None
    usuario = pago.schedule.member.user
    archivo = io.BytesIO()
    pdf = canvas.Canvas(archivo, invariant=1)
    filas = [
        (gimnasio.nombre if gimnasio else 'PULSO', 16),
        ('Comprobante interno de pago', 14),
        (f'Comprobante: REC-{pago.receipt_issued_at:%Y%m%d}-{pago.pk}', 10),
        (f'Miembro: {usuario.get_full_name() or usuario.email}', 10),
        (f'Concepto: {pago.schedule.resolved_membership_name or "Membresía"}', 10),
        (f'Monto: CRC {pago.amount}', 10),
        (f'Método: {pago.get_metodo_registrado_display() or "No indicado"}', 10),
        (f'Referencia: {pago.payment_reference or "No aplica"}', 10),
        (f'Fecha: {timezone.localtime(pago.paid_at):%d/%m/%Y %H:%M}', 10),
        ('Este comprobante es de control interno y no constituye factura electrónica.', 9),
    ]
    posicion = 800
    for texto, tamano in filas:
        pdf.setFont('Helvetica-Bold' if tamano >= 14 else 'Helvetica', tamano)
        pdf.drawString(55, posicion, texto)
        posicion -= 32 if tamano >= 14 else 22
    if gimnasio:
        contacto = ' · '.join(filter(None, [
            gimnasio.telefono, gimnasio.correo, gimnasio.direccion,
        ]))
        pdf.drawString(55, posicion - 10, contacto[:100])
    pdf.showPage()
    pdf.save()
    return archivo.getvalue()
