import io
import logging

from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import MembershipPlan, MemberSubscription, PaymentSchedule, PaymentRecord, PaymentMethod, PaymentInstruction, SeguimientoCobro
from .serializers import (
    MembershipPlanSerializer, PaymentScheduleSerializer,
    PaymentRecordSerializer, PaymentMethodSerializer, PaymentInstructionSerializer,
    MemberSubscriptionSerializer, MemberMembershipSerializer,
    SeguimientoCobroSerializer,
)
from .services import (
    cancel_membership, initialize_subscription, mark_payment_paid, membership_summary,
    period_end, renew_membership, resume_membership, suspend_membership,
    void_non_collectable_charges
)
from users.permissions import (
    IsAdministrator,
    tiene_perfil_entrenador,
    usa_contexto_cliente,
)
from users.audit import registrar_auditoria
from users.views import _get_trainer_profile

logger = logging.getLogger(__name__)

class MembershipPlanViewSet(viewsets.ModelViewSet):
    serializer_class = MembershipPlanSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = MembershipPlan.objects.select_related('trainer__user').all()
        if usa_contexto_cliente(self.request):
            try:
                trainer_profile = user.memberprofile.trainer_asignado
            except ObjectDoesNotExist:
                return MembershipPlan.objects.none()
            if trainer_profile:
                return queryset.filter(
                    Q(trainer=trainer_profile) | Q(trainer__isnull=True),
                    is_active=True,
                )
            return MembershipPlan.objects.none()
        if not user.is_staff and tiene_perfil_entrenador(user):
            return MembershipPlan.objects.none()
        return queryset

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsAdministrator()]
        return [IsAuthenticated()]

    @transaction.atomic
    def perform_create(self, serializer):
        serializer.save(trainer=serializer.validated_data.get('trainer'))

    @transaction.atomic
    def perform_update(self, serializer):
        plan = self.get_object()
        serializer.save(trainer=serializer.validated_data.get('trainer', plan.trainer))

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])


class MemberSubscriptionViewSet(viewsets.ModelViewSet):
    serializer_class = MemberSubscriptionSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsAdministrator()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        member_id = self.request.query_params.get('member')
        queryset = MemberSubscription.objects.select_related(
            'member__user', 'plan', 'trainer__user'
        ).all()
        if usa_contexto_cliente(self.request):
            queryset = queryset.filter(member__user=user)
        elif not user.is_staff and tiene_perfil_entrenador(user):
            return MemberSubscription.objects.none()
        elif not user.is_staff:
            return MemberSubscription.objects.none()
        if member_id:
            queryset = queryset.filter(member_id=member_id)
        return queryset

    def _resolve_subscription_owner(self, serializer):
        plan = serializer.validated_data.get('plan')
        member = serializer.validated_data['member']
        user = self.request.user
        return plan, member, (serializer.validated_data.get('trainer') or member.trainer_asignado)

    @transaction.atomic
    def perform_create(self, serializer):
        plan, member, trainer_profile = self._resolve_subscription_owner(serializer)
        if trainer_profile is None:
            raise ValidationError({'trainer': 'El miembro necesita un trainer asignado para crear membresía.'})
        MemberSubscription.objects.filter(member=member, is_active=True).update(is_active=False)
        PaymentSchedule.objects.filter(member=member, is_active=True).update(is_active=False)
        PaymentRecord.objects.filter(
            schedule__member=member,
            schedule__is_active=False,
            status__in=['pending', 'late'],
        ).update(
            status='void',
            notes='Cobro anulado automáticamente: se creó una nueva membresía para el miembro.',
        )
        start_date = serializer.validated_data['start_date']
        recurrence_type = serializer.validated_data.get(
            'recurrence_type',
            plan.recurrence_type if plan else 'monthly',
        )
        grace_period_days = serializer.validated_data.get(
            'grace_period_days',
            plan.grace_period_days if plan else 7,
        )
        subscription = serializer.save(
            trainer=trainer_profile,
            plan=plan,
            membership_name=serializer.validated_data.get('membership_name') or (plan.name if plan else 'Membresía'),
            description=serializer.validated_data.get('description') or (plan.description if plan else ''),
            recurrence_type=recurrence_type,
            grace_period_days=grace_period_days,
            next_billing_date=start_date,
            renewal_date=None,
            status='pending',
        )
        initialize_subscription(subscription)
        registrar_auditoria(
            self.request.user,
            'subscription_created',
            'MemberSubscription',
            subscription.id,
            request=self.request,
            details={
                'member_id': member.id,
                'plan_id': plan.id if plan else None,
                'membership_name': subscription.membership_name,
                'agreed_price': str(subscription.agreed_price),
                'status': subscription.status,
            },
        )

    @transaction.atomic
    def perform_update(self, serializer):
        subscription = self.get_object()
        user = self.request.user
        previous_values = {
            'agreed_price': str(subscription.agreed_price),
            'status': subscription.status,
            'is_active': subscription.is_active,
            'renewal_date': subscription.renewal_date.isoformat() if subscription.renewal_date else None,
            'cancellation_date': subscription.cancellation_date.isoformat() if subscription.cancellation_date else None,
        }
        target_plan = serializer.validated_data.get('plan', subscription.plan)
        recurrence_type = serializer.validated_data.get(
            'recurrence_type',
            target_plan.recurrence_type if target_plan else subscription.recurrence_type,
        )
        grace_period_days = serializer.validated_data.get(
            'grace_period_days',
            target_plan.grace_period_days if target_plan else subscription.grace_period_days,
        )
        updated = serializer.save(
            recurrence_type=recurrence_type,
            grace_period_days=grace_period_days,
        )
        if updated.is_active:
            MemberSubscription.objects.filter(member=updated.member).exclude(id=updated.id).update(is_active=False)
            PaymentSchedule.objects.filter(member=updated.member).exclude(subscription=updated).update(is_active=False)
        if updated.status == 'cancelled' or updated.cancellation_date:
            updated.status = 'cancelled'
            updated.is_active = False
            void_non_collectable_charges(updated)
        updated.save(update_fields=['status', 'is_active'])
        pending_schedules = PaymentSchedule.objects.filter(
            subscription=updated,
            records__status='pending',
        ).distinct()
        pending_schedules.update(
            plan=updated.plan,
            recurrence_type=updated.recurrence_type,
            grace_period_days=updated.grace_period_days,
            auto_generate_next=updated.auto_generate_next,
            is_active=updated.is_active,
        )
        for schedule in pending_schedules:
            if schedule.period_start:
                schedule.period_end = period_end(
                    schedule.period_start, updated.recurrence_type
                )
                schedule.save(update_fields=['period_end'])
        PaymentRecord.objects.filter(
            schedule__subscription=updated,
            status='pending',
        ).update(amount=updated.agreed_price)
        registrar_auditoria(
            self.request.user,
            'subscription_updated',
            'MemberSubscription',
            updated.id,
            request=self.request,
            details={
                'before': previous_values,
                'after': {
                    'agreed_price': str(updated.agreed_price),
                    'status': updated.status,
                    'is_active': updated.is_active,
                    'renewal_date': updated.renewal_date.isoformat() if updated.renewal_date else None,
                    'cancellation_date': updated.cancellation_date.isoformat() if updated.cancellation_date else None,
                },
            },
        )


class MemberMembershipViewSet(MemberSubscriptionViewSet):
    serializer_class = MemberMembershipSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        state = self.request.query_params.get('status')
        search = self.request.query_params.get('search')
        if state:
            queryset = queryset.filter(status=state)
        if search:
            queryset = queryset.filter(
                member__user__email__icontains=search
            ) | queryset.filter(member__user__first_name__icontains=search) | queryset.filter(member__user__last_name__icontains=search)
        return queryset.distinct()

    @transaction.atomic
    def perform_create(self, serializer):
        plan, member, trainer_profile = self._resolve_subscription_owner(serializer)
        if trainer_profile is None:
            raise ValidationError({'trainer': 'El miembro necesita un trainer asignado para crear membresía.'})
        if MemberSubscription.objects.filter(
            member=member,
            is_active=True,
            status__in=['pending', 'active', 'expiring', 'suspended'],
        ).exists():
            raise ValidationError({'member': 'El miembro ya tiene una membresía operativa.'})
        start_date = serializer.validated_data['start_date']
        recurrence_type = serializer.validated_data.get(
            'recurrence_type',
            plan.recurrence_type if plan else 'monthly',
        )
        grace_period_days = serializer.validated_data.get(
            'grace_period_days',
            plan.grace_period_days if plan else 7,
        )
        subscription = serializer.save(
            trainer=trainer_profile,
            plan=plan,
            membership_name=serializer.validated_data.get('membership_name') or (plan.name if plan else 'Membresía'),
            description=serializer.validated_data.get('description') or (plan.description if plan else ''),
            recurrence_type=recurrence_type,
            grace_period_days=grace_period_days,
            next_billing_date=start_date,
            renewal_date=None,
            status='pending',
            is_active=True,
        )
        initialize_subscription(subscription)
        registrar_auditoria(
            self.request.user,
            'membership_created',
            'MemberSubscription',
            subscription.id,
            request=self.request,
            details={'member_id': member.id, 'plan_id': plan.id if plan else None},
        )

    @action(detail=True, methods=['post'], url_path='renew')
    def renew(self, request, pk=None):
        subscription = self.get_object()
        start_date = request.data.get('start_date')
        if start_date:
            from datetime import date
            start_date = date.fromisoformat(start_date)
        try:
            subscription, schedule, record = renew_membership(subscription, start_date=start_date)
        except ValueError as exc:
            raise ValidationError({'membership': str(exc)}) from exc
        registrar_auditoria(
            request.user,
            'membership_renewed',
            'MemberSubscription',
            subscription.id,
            request=request,
            details={'schedule_id': schedule.id if schedule else None, 'record_id': record.id if record else None},
        )
        return Response(self.get_serializer(subscription).data)

    @action(detail=True, methods=['post'], url_path='suspend')
    def suspend(self, request, pk=None):
        reason = request.data.get('reason', '').strip()
        if not reason:
            raise ValidationError({'reason': 'Indica el motivo de la suspensión.'})
        subscription = suspend_membership(self.get_object(), reason=reason)
        registrar_auditoria(
            request.user,
            'membership_suspended',
            'MemberSubscription',
            subscription.id,
            request=request,
            details={'reason': reason},
        )
        return Response(self.get_serializer(subscription).data)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        reason = request.data.get('reason', '').strip()
        if not reason:
            raise ValidationError({'reason': 'Indica el motivo de la cancelación.'})
        subscription = cancel_membership(self.get_object(), reason=reason)
        registrar_auditoria(
            request.user,
            'membership_cancelled',
            'MemberSubscription',
            subscription.id,
            request=request,
            details={'reason': reason},
        )
        return Response(self.get_serializer(subscription).data)

    @action(detail=True, methods=['post'], url_path='resume')
    def resume(self, request, pk=None):
        try:
            subscription = resume_membership(self.get_object())
        except ValueError as exc:
            raise ValidationError({'membership': str(exc)}) from exc
        registrar_auditoria(
            request.user, 'membership_resumed', 'MemberSubscription', subscription.id,
            request=request,
        )
        return Response(self.get_serializer(subscription).data)

    @action(detail=False, methods=['get'], url_path='expiring')
    def expiring(self, request):
        queryset = self.filter_queryset(self.get_queryset().filter(status='expiring'))
        page = self.paginate_queryset(queryset)
        if page is not None:
            return self.get_paginated_response(self.get_serializer(page, many=True).data)
        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=False, methods=['get'], url_path='expired')
    def expired(self, request):
        queryset = self.filter_queryset(self.get_queryset().filter(status='expired'))
        page = self.paginate_queryset(queryset)
        if page is not None:
            return self.get_paginated_response(self.get_serializer(page, many=True).data)
        return Response(self.get_serializer(queryset, many=True).data)


class MyMembershipView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not usa_contexto_cliente(request):
            return Response({'error': 'Solo miembros pueden consultar esta vista.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            member = request.user.memberprofile
        except ObjectDoesNotExist:
            return Response({'error': 'Perfil de miembro no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(membership_summary(member))


class PaymentScheduleViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentScheduleSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsAdministrator()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        member_id = self.request.query_params.get('member')
        if usa_contexto_cliente(self.request):
            return PaymentSchedule.objects.filter(member__user=user)
        queryset = PaymentSchedule.objects.select_related('member__user', 'plan', 'subscription__plan').all()
        if not user.is_staff and tiene_perfil_entrenador(user):
            return PaymentSchedule.objects.none()
        if not user.is_staff:
            return PaymentSchedule.objects.none()
        if member_id:
            queryset = queryset.filter(member_id=member_id)
        return queryset

    def perform_create(self, serializer):
        subscription = serializer.validated_data.get('subscription')
        plan = serializer.validated_data.get('plan')
        member = serializer.validated_data['member']
        user = self.request.user
        if subscription:
            if subscription.member_id != member.id:
                raise ValidationError({'subscription': 'La suscripción no corresponde al miembro.'})
            plan = subscription.plan
        serializer.save(plan=plan)


class PaymentRecordViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PaymentRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action == 'mark_paid':
            return [IsAuthenticated(), IsAdministrator()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        member_id = self.request.query_params.get('member')
        include_void = (
            self.request.query_params.get('include_void') == 'true'
            or self.action == 'mark_paid'
        )
        if usa_contexto_cliente(self.request):
            queryset = PaymentRecord.objects.filter(schedule__member__user=user)
            if not include_void:
                queryset = queryset.exclude(status='void')
            return queryset
        queryset = PaymentRecord.objects.select_related(
            'schedule__member__user', 'schedule__plan', 'schedule__subscription'
        ).all()
        if not user.is_staff and tiene_perfil_entrenador(user):
            return PaymentRecord.objects.none()
        if not user.is_staff:
            return PaymentRecord.objects.none()
        if member_id:
            queryset = queryset.filter(schedule__member_id=member_id)
        if not include_void:
            queryset = queryset.exclude(status='void')
        return queryset

    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        record = self.get_object()
        if record.status == 'paid':
            return Response({'error': 'El pago ya fue registrado.'}, status=status.HTTP_400_BAD_REQUEST)
        if record.status == 'void':
            return Response(
                {'error': 'Este cobro fue anulado y no debe registrarse como pagado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        subscription = record.schedule.subscription
        if subscription and subscription.status == 'cancelled':
            return Response(
                {'error': 'No puedes registrar pagos en una suscripción cancelada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        reference = request.data.get('payment_reference', '').strip()
        method = request.data.get('method', 'cash').strip().lower()
        notes = request.data.get('notes', '').strip()
        try:
            record, _ = mark_payment_paid(
                record,
                reference=reference,
                notes=notes,
                method=method,
                recorded_by=request.user,
            )
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        registrar_auditoria(
            request.user,
            'payment_marked_paid',
            'PaymentRecord',
            record.id,
            request=request,
            details={
                'member_id': record.schedule.member_id,
                'subscription_id': record.schedule.subscription_id,
                'amount': str(record.amount),
                'payment_reference': record.payment_reference,
                'method': record.metodo_registrado,
                'receipt_number': PaymentRecordSerializer(record).data.get('receipt_number'),
            },
        )
        return Response(PaymentRecordSerializer(record).data)

    @action(detail=True, methods=['get'], url_path='receipt')
    def receipt(self, request, pk=None):
        record = self.get_object()
        if record.status != 'paid':
            raise ValidationError({'payment': 'El comprobante se genera después de registrar el pago.'})
        try:
            from reportlab.pdfgen import canvas
        except ImportError as exc:
            raise ValidationError({'receipt': 'El generador de PDF no está disponible.'}) from exc

        gym_profile = None
        trainer = record.schedule.member.trainer_asignado
        if trainer:
            gym_profile = getattr(trainer, 'perfil_gimnasio', None)
        buffer = io.BytesIO()
        pdf = canvas.Canvas(buffer)
        y = 800
        rows = [
            ((gym_profile.nombre if gym_profile else 'GymHub'), 16),
            ('Comprobante interno de pago', 14),
            (f'Comprobante: REC-{record.receipt_issued_at:%Y%m%d}-{record.id}', 10),
            (f'Miembro: {record.schedule.member.user.get_full_name() or record.schedule.member.user.email}', 10),
            (f'Concepto: {record.schedule.resolved_membership_name or "Membresía"}', 10),
            (f'Monto: ₡{record.amount}', 10),
            (f'Método: {record.get_metodo_registrado_display() or "No indicado"}', 10),
            (f'Referencia: {record.payment_reference or "No aplica"}', 10),
            (f'Fecha: {record.paid_at:%d/%m/%Y %H:%M}', 10),
            ('Este comprobante es de control interno y no constituye factura electrónica.', 9),
        ]
        for value, size in rows:
            pdf.setFont('Helvetica-Bold' if size >= 14 else 'Helvetica', size)
            pdf.drawString(55, y, value)
            y -= 32 if size >= 14 else 22
        if gym_profile:
            contact = ' · '.join(filter(None, [gym_profile.telefono, gym_profile.correo, gym_profile.direccion]))
            if contact:
                pdf.drawString(55, y - 10, contact[:100])
        pdf.showPage()
        pdf.save()
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="comprobante-{record.id}.pdf"'
        return response


class PaymentMethodViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentMethodSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if usa_contexto_cliente(self.request):
            return PaymentMethod.objects.filter(member__user=user)
        queryset = PaymentMethod.objects.select_related(
            'member__trainer_asignado'
        )
        if user.is_staff:
            return queryset
        if tiene_perfil_entrenador(user):
            return PaymentMethod.objects.none()
        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user
        if usa_contexto_cliente(self.request):
            try:
                serializer.save(member=user.memberprofile)
            except ObjectDoesNotExist:
                logger.warning('Creación de payment method sin memberprofile para user_id=%s', user.id)
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'member': 'Perfil de miembro no encontrado.'})
        elif user.is_staff:
            member = serializer.validated_data['member']
            serializer.save(member=member)
        else:
            raise PermissionDenied('Solo el administrador gestiona métodos de pago ajenos.')

    def perform_update(self, serializer):
        instance = serializer.instance
        user = self.request.user
        if not user.is_staff:
            if usa_contexto_cliente(self.request) and instance.member.user_id != user.id:
                raise PermissionDenied('No puedes modificar este método de pago.')
            if tiene_perfil_entrenador(user):
                raise PermissionDenied('El entrenador no puede gestionar pagos.')
        serializer.save(member=instance.member)


class PaymentInstructionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PaymentInstruction.objects.select_related('plan').all()
    serializer_class = PaymentInstructionSerializer
    permission_classes = [IsAuthenticated]


class SeguimientoCobroViewSet(viewsets.ModelViewSet):
    serializer_class = SeguimientoCobroSerializer
    permission_classes = [IsAuthenticated, IsAdministrator]

    def get_queryset(self):
        queryset = SeguimientoCobro.objects.select_related(
            'cliente__user', 'administrador'
        ).all()
        cliente_id = self.request.query_params.get('cliente')
        estado = self.request.query_params.get('estado')
        if cliente_id:
            queryset = queryset.filter(cliente_id=cliente_id)
        if estado:
            queryset = queryset.filter(estado=estado)
        return queryset

    def perform_create(self, serializer):
        seguimiento = serializer.save(administrador=self.request.user)
        registrar_auditoria(
            self.request.user,
            'collection_follow_up_created',
            'SeguimientoCobro',
            seguimiento.id,
            request=self.request,
            details={'member_id': seguimiento.cliente_id, 'estado': seguimiento.estado},
        )

    def perform_update(self, serializer):
        seguimiento = serializer.save(administrador=self.request.user)
        registrar_auditoria(
            self.request.user,
            'collection_follow_up_updated',
            'SeguimientoCobro',
            seguimiento.id,
            request=self.request,
            details={'member_id': seguimiento.cliente_id, 'estado': seguimiento.estado},
        )
