import csv
import io
from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Sum
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from attendance.models import Attendance
from users.models import AuditLog, MemberProfile, PerfilGimnasio
from users.permissions import IsAdministrator

from .models import MemberSubscription, PaymentRecord, SeguimientoCobro
from .services import membership_access


def _serializar_cobro_operativo(pago, hoy):
    cliente = pago.schedule.member
    return {
        'payment_id': pago.id,
        'member_id': cliente.id,
        'member_name': cliente.user.get_full_name() or cliente.user.email,
        'amount': str(pago.amount),
        'due_date': pago.schedule.due_date.isoformat(),
        'days_overdue': max(0, (hoy - pago.schedule.due_date).days),
        'days_until_due': max(0, (pago.schedule.due_date - hoy).days),
    }


def _primer_cobro_por_cliente(queryset, hoy, limite=8):
    items = []
    clientes_vistos = set()
    for pago in queryset:
        cliente_id = pago.schedule.member_id
        if cliente_id in clientes_vistos:
            continue
        clientes_vistos.add(cliente_id)
        items.append(_serializar_cobro_operativo(pago, hoy))
        if len(items) >= limite:
            break
    return items


def _datos_dashboard_administrador():
    """Resumen operativo actual; no depende del periodo de los reportes."""
    from plans.models import TrainingPlan

    hoy = timezone.localdate()
    inicio_mes = hoy.replace(day=1)
    fin_cobros_proximos = hoy + timedelta(days=7)
    fin_rutinas_proximas = hoy + timedelta(days=14)

    clientes = list(
        MemberProfile.objects.select_related('user', 'trainer_asignado__user')
        .filter(is_active=True)
        .order_by('user__first_name', 'user__last_name', 'id')
    )
    clientes_con_cobro_vencido = set(
        PaymentRecord.objects.filter(
            schedule__member__in=clientes,
            status__in=['pending', 'late'],
            schedule__due_date__lt=hoy,
        ).values_list('schedule__member_id', flat=True)
    )
    clientes_al_dia = []
    acceso_por_cliente = {}
    for cliente in clientes:
        acceso = membership_access(cliente)
        acceso_por_cliente[cliente.id] = acceso
        if acceso['allowed'] and cliente.id not in clientes_con_cobro_vencido:
            clientes_al_dia.append(cliente)

    cobros_vencidos = PaymentRecord.objects.select_related(
        'schedule__member__user'
    ).filter(
        schedule__member__in=clientes,
        status__in=['pending', 'late'],
        schedule__due_date__lt=hoy,
    ).order_by('schedule__due_date', 'id')
    cobros_proximos = PaymentRecord.objects.select_related(
        'schedule__member__user'
    ).filter(
        schedule__member__in=clientes,
        status='pending',
        schedule__due_date__gte=hoy,
        schedule__due_date__lte=fin_cobros_proximos,
    ).order_by('schedule__due_date', 'id')
    pagos_mes = PaymentRecord.objects.filter(
        status='paid', paid_at__date__gte=inicio_mes, paid_at__date__lte=hoy,
    )

    planes_activos = TrainingPlan.objects.select_related(
        'member__user', 'trainer__user'
    ).filter(member__in=clientes, status='active')
    clientes_con_rutina = set(planes_activos.values_list('member_id', flat=True))
    sin_rutina = [cliente for cliente in clientes if cliente.id not in clientes_con_rutina]
    rutinas_proximas = planes_activos.filter(
        end_date__gte=hoy,
        end_date__lte=fin_rutinas_proximas,
    ).order_by('end_date', 'id')

    total_clientes = len(clientes)
    total_al_dia = len(clientes_al_dia)
    return {
        'generated_at': timezone.now().isoformat(),
        'commercial': {
            'current_clients': total_al_dia,
            'current_clients_pct': round((total_al_dia / total_clientes) * 100, 1) if total_clientes else 0,
            'active_clients': total_clientes,
            'collected_this_month': str(pagos_mes.aggregate(total=Sum('amount'))['total'] or Decimal('0')),
            'due_soon_count': cobros_proximos.count(),
            'due_soon_amount': str(cobros_proximos.aggregate(total=Sum('amount'))['total'] or Decimal('0')),
            'overdue_count': cobros_vencidos.count(),
            'overdue_amount': str(cobros_vencidos.aggregate(total=Sum('amount'))['total'] or Decimal('0')),
        },
        'payments': {
            'overdue': _primer_cobro_por_cliente(cobros_vencidos, hoy),
            'due_soon': _primer_cobro_por_cliente(cobros_proximos, hoy),
            'current': [
                {
                    'member_id': cliente.id,
                    'member_name': cliente.user.get_full_name() or cliente.user.email,
                    'access_allowed': True,
                }
                for cliente in clientes_al_dia[:8]
            ],
        },
        'training': {
            'without_routine_count': len(sin_rutina),
            'without_routine': [
                {
                    'member_id': cliente.id,
                    'member_name': cliente.user.get_full_name() or cliente.user.email,
                    'trainer_id': cliente.trainer_asignado_id,
                    'trainer_name': (
                        cliente.trainer_asignado.user.get_full_name()
                        or cliente.trainer_asignado.user.email
                    ) if cliente.trainer_asignado else None,
                    'can_publish': bool(acceso_por_cliente[cliente.id]['allowed']),
                }
                for cliente in sin_rutina[:8]
            ],
            'ending_soon_count': rutinas_proximas.count(),
            'ending_soon': [
                {
                    'plan_id': plan.id,
                    'member_id': plan.member_id,
                    'member_name': plan.member.user.get_full_name() or plan.member.user.email,
                    'plan_name': plan.name,
                    'end_date': plan.end_date.isoformat(),
                    'days_until_end': (plan.end_date - hoy).days,
                    'trainer_id': plan.trainer_id,
                    'trainer_name': plan.trainer.user.get_full_name() or plan.trainer.user.email,
                    'can_publish': bool(acceso_por_cliente[plan.member_id]['allowed']),
                }
                for plan in rutinas_proximas[:8]
            ],
        },
    }


def _periodo(request):
    hoy = timezone.localdate()
    inicio = parse_date(request.query_params.get('fecha_inicio', '')) or hoy.replace(day=1)
    fin = parse_date(request.query_params.get('fecha_fin', '')) or hoy
    if inicio > fin:
        raise ValueError('La fecha inicial no puede ser posterior a la fecha final.')
    return inicio, fin


def _datos_reporte(inicio, fin):
    pagos = PaymentRecord.objects.select_related(
        'schedule__member__user', 'schedule__subscription', 'registrado_por'
    ).filter(schedule__due_date__range=(inicio, fin)).exclude(status='void')
    pagos_cobrados = PaymentRecord.objects.select_related(
        'schedule__member__user', 'schedule__subscription', 'registrado_por'
    ).filter(status='paid', paid_at__date__range=(inicio, fin))
    asistencias = Attendance.objects.select_related(
        'member__user', 'checked_in_by'
    ).filter(attendance_date__range=(inicio, fin))

    total_cobrado = pagos_cobrados.aggregate(total=Sum('amount'))['total'] or Decimal('0')
    total_esperado = pagos.aggregate(total=Sum('amount'))['total'] or Decimal('0')
    total_pendiente = pagos.filter(status='pending').aggregate(total=Sum('amount'))['total'] or Decimal('0')
    total_vencido = pagos.filter(status='late').aggregate(total=Sum('amount'))['total'] or Decimal('0')

    clientes = MemberProfile.objects.select_related('user').prefetch_related('subscriptions')
    bloqueados = []
    por_vencer = []
    for cliente in clientes.filter(is_active=True):
        access = membership_access(cliente)
        subscription = cliente.subscriptions.filter(is_active=True).order_by('-start_date', '-id').first()
        if not access['allowed']:
            bloqueados.append(cliente.id)
        elif subscription and subscription.status == 'expiring':
            por_vencer.append(cliente.id)

    alertas = []
    clientes_alertados = set()
    vencidos = PaymentRecord.objects.select_related(
        'schedule__member__user'
    ).filter(status='late').order_by('schedule__member_id', '-schedule__due_date', '-id')
    for pago in vencidos:
        cliente = pago.schedule.member
        if cliente.id in clientes_alertados:
            continue
        clientes_alertados.add(cliente.id)
        seguimiento = SeguimientoCobro.objects.filter(
            cliente=cliente,
            estado__in=['nuevo', 'en_seguimiento'],
        ).first()
        alertas.append({
            'payment_id': pago.id,
            'member_id': cliente.id,
            'member_name': cliente.user.get_full_name() or cliente.user.email,
            'amount': str(pago.amount),
            'due_date': pago.schedule.due_date.isoformat(),
            'days_overdue': max(0, (timezone.localdate() - pago.schedule.due_date).days),
            'follow_up_id': seguimiento.id if seguimiento else None,
            'follow_up_status': seguimiento.estado if seguimiento else 'nuevo',
        })
        if len(alertas) == 50:
            break

    entradas_diarias = list(
        asistencias.values('attendance_date')
        .annotate(total=Count('id'), clientes=Count('member_id', distinct=True))
        .order_by('attendance_date')
    )
    for item in entradas_diarias:
        item['date'] = item.pop('attendance_date').isoformat()

    metodos = list(
        pagos_cobrados.values('metodo_registrado')
        .annotate(total=Sum('amount'), cantidad=Count('id'))
        .order_by('metodo_registrado')
    )
    for item in metodos:
        item['method'] = item.pop('metodo_registrado') or 'sin_indicar'
        item['total'] = str(item['total'] or 0)

    intentos_rechazados = AuditLog.objects.filter(
        action_type='ROUTINE_ACCESS_DENIED',
        created_at__date__range=(inicio, fin),
    ).count()

    return {
        'period': {'start_date': inicio.isoformat(), 'end_date': fin.isoformat()},
        'commercial': {
            'collected': str(total_cobrado),
            'expected': str(total_esperado),
            'pending': str(total_pendiente),
            'overdue': str(total_vencido),
            'payments_count': pagos_cobrados.count(),
            'active_memberships': MemberSubscription.objects.filter(
                is_active=True, status__in=['active', 'expiring']
            ).count(),
            'cancelled_memberships': MemberSubscription.objects.filter(
                cancellation_date__range=(inicio, fin)
            ).count(),
            'new_members': MemberProfile.objects.filter(join_date__range=(inicio, fin)).count(),
            'blocked_clients': len(bloqueados),
            'expiring_clients': len(por_vencer),
            'by_method': metodos,
        },
        'access': {
            'entries': asistencias.count(),
            'entries_today': Attendance.objects.filter(attendance_date=timezone.localdate()).count(),
            'unique_clients': asistencias.values('member_id').distinct().count(),
            'currently_inside': Attendance.objects.filter(
                attendance_date=timezone.localdate(), check_out_time__isnull=True
            ).count(),
            'check_outs': asistencias.filter(check_out_time__isnull=False).count(),
            'exceptions': asistencias.filter(es_excepcion_comercial=True).count(),
            'denied_attempts': intentos_rechazados,
            'daily': entradas_diarias,
        },
        'alerts': alertas,
    }


class AdminReportOverviewView(APIView):
    permission_classes = [IsAuthenticated, IsAdministrator]

    def get(self, request):
        try:
            inicio, fin = _periodo(request)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(_datos_reporte(inicio, fin))


class AdminDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsAdministrator]

    def get(self, request):
        return Response(_datos_dashboard_administrador())


class AdminReportExportView(APIView):
    permission_classes = [IsAuthenticated, IsAdministrator]

    def get(self, request):
        try:
            inicio, fin = _periodo(request)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        formato = request.query_params.get('formato', 'pdf').lower()
        if formato == 'csv':
            return self._csv(request, inicio, fin)
        if formato == 'pdf':
            return self._pdf(inicio, fin)
        return Response({'error': 'Formato no soportado.'}, status=status.HTTP_400_BAD_REQUEST)

    def _csv(self, request, inicio, fin):
        seccion = request.query_params.get('seccion', 'pagos')
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="reporte-{seccion}-{inicio}-{fin}.csv"'
        response.write('\ufeff')
        writer = csv.writer(response)
        if seccion == 'pagos':
            writer.writerow(['fecha_pago', 'cliente', 'correo', 'concepto', 'monto', 'metodo', 'referencia', 'estado'])
            queryset = PaymentRecord.objects.select_related(
                'schedule__member__user', 'schedule__subscription'
            ).filter(status='paid', paid_at__date__range=(inicio, fin)).order_by('paid_at', 'id')
            for pago in queryset:
                usuario = pago.schedule.member.user
                writer.writerow([
                    timezone.localtime(pago.paid_at).isoformat(),
                    usuario.get_full_name() or usuario.email,
                    usuario.email,
                    pago.schedule.resolved_membership_name or 'Membresía',
                    pago.amount,
                    pago.metodo_registrado,
                    pago.payment_reference,
                    pago.status,
                ])
        elif seccion == 'accesos':
            writer.writerow(['fecha', 'entrada', 'salida', 'cliente', 'correo', 'excepcion', 'motivo'])
            queryset = Attendance.objects.select_related('member__user').filter(
                attendance_date__range=(inicio, fin)
            ).order_by('check_in_time', 'id')
            for entrada in queryset:
                usuario = entrada.member.user
                writer.writerow([
                    entrada.attendance_date,
                    timezone.localtime(entrada.check_in_time).isoformat(),
                    timezone.localtime(entrada.check_out_time).isoformat() if entrada.check_out_time else '',
                    usuario.get_full_name() or usuario.email,
                    usuario.email,
                    'sí' if entrada.es_excepcion_comercial else 'no',
                    entrada.motivo_excepcion,
                ])
        else:
            return Response({'error': 'Sección no soportada.'}, status=status.HTTP_400_BAD_REQUEST)
        return response

    def _pdf(self, inicio, fin):
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

        data = _datos_reporte(inicio, fin)
        buffer = io.BytesIO()
        document = SimpleDocTemplate(buffer, pagesize=A4, title='Reporte administrativo GymHub')
        styles = getSampleStyleSheet()
        perfil = PerfilGimnasio.objects.first()
        story = [
            Paragraph(perfil.nombre if perfil else 'GymHub', styles['Title']),
            Paragraph('Reporte administrativo interno', styles['Heading2']),
            Paragraph(f'Período: {inicio:%d/%m/%Y} al {fin:%d/%m/%Y}', styles['Normal']),
            Spacer(1, 16),
            Paragraph('Resumen comercial', styles['Heading2']),
            Table([
                ['Cobrado', 'Esperado', 'Pendiente', 'Vencido'],
                [
                    f"CRC {data['commercial']['collected']}",
                    f"CRC {data['commercial']['expected']}",
                    f"CRC {data['commercial']['pending']}",
                    f"CRC {data['commercial']['overdue']}",
                ],
            ]),
            Spacer(1, 16),
            Paragraph('Accesos', styles['Heading2']),
            Table([
                ['Entradas', 'Clientes únicos', 'Salidas', 'Excepciones', 'Intentos rechazados'],
                [
                    data['access']['entries'], data['access']['unique_clients'],
                    data['access']['check_outs'], data['access']['exceptions'],
                    data['access']['denied_attempts'],
                ],
            ]),
            Spacer(1, 20),
            Paragraph('Documento de control interno; no constituye factura electrónica.', styles['Italic']),
        ]
        for item in story:
            if isinstance(item, Table):
                item.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#111827')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('PADDING', (0, 0), (-1, -1), 7),
                ]))
        document.build(story)
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="reporte-administrativo-{inicio}-{fin}.pdf"'
        return response
