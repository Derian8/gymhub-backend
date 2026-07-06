import logging

from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import MembershipPlan, MemberSubscription, PaymentSchedule, PaymentRecord, PaymentMethod, PaymentInstruction
from .serializers import (
    MembershipPlanSerializer, PaymentScheduleSerializer,
    PaymentRecordSerializer, PaymentMethodSerializer, PaymentInstructionSerializer, MemberSubscriptionSerializer
)
from .services import initialize_subscription, mark_payment_paid, period_end
from users.permissions import IsStaffOrTrainer
from users.audit import registrar_auditoria
from users.views import _get_trainer_profile

logger = logging.getLogger(__name__)

class MembershipPlanViewSet(viewsets.ModelViewSet):
    serializer_class = MembershipPlanSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = MembershipPlan.objects.select_related('trainer__user').all()
        if user.role == 'member' and not user.is_staff:
            try:
                trainer_profile = user.memberprofile.trainer_asignado
            except ObjectDoesNotExist:
                return MembershipPlan.objects.none()
            if trainer_profile:
                return queryset.filter(trainer=trainer_profile, is_active=True)
            return MembershipPlan.objects.none()
        if user.role == 'trainer' and not user.is_staff:
            trainer_profile = _get_trainer_profile(user)
            queryset = queryset.filter(trainer=trainer_profile)
        return queryset

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsStaffOrTrainer()]
        return [IsAuthenticated()]

    @transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user
        if user.is_staff and serializer.validated_data.get('trainer'):
            serializer.save()
            return
        serializer.save(trainer=_get_trainer_profile(user))

    @transaction.atomic
    def perform_update(self, serializer):
        plan = self.get_object()
        user = self.request.user
        if not user.is_staff and plan.trainer_id != _get_trainer_profile(user).id:
            raise PermissionDenied('Solo puedes editar tus propios planes.')
        trainer = serializer.validated_data.get('trainer') if user.is_staff else _get_trainer_profile(user)
        serializer.save(trainer=trainer)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])


class MemberSubscriptionViewSet(viewsets.ModelViewSet):
    serializer_class = MemberSubscriptionSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsStaffOrTrainer()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        member_id = self.request.query_params.get('member')
        queryset = MemberSubscription.objects.select_related(
            'member__user', 'plan', 'trainer__user'
        ).all()
        if user.role == 'member' and not user.is_staff:
            queryset = queryset.filter(member__user=user)
        elif user.role == 'trainer' and not user.is_staff:
            trainer_profile = _get_trainer_profile(user)
            queryset = queryset.filter(trainer=trainer_profile)
        if member_id:
            queryset = queryset.filter(member_id=member_id)
        return queryset

    def _resolve_plan_and_member(self, serializer):
        plan = serializer.validated_data['plan']
        member = serializer.validated_data['member']
        user = self.request.user
        if user.is_staff:
            return plan, member, (serializer.validated_data.get('trainer') or member.trainer_asignado)
        trainer_profile = _get_trainer_profile(user)
        if member.trainer_asignado_id != trainer_profile.id:
            raise PermissionDenied('Solo puedes suscribir clientes asignados.')
        if plan.trainer_id != trainer_profile.id:
            raise PermissionDenied('Solo puedes usar tus propios planes configurables.')
        return plan, member, trainer_profile

    @transaction.atomic
    def perform_create(self, serializer):
        plan, member, trainer_profile = self._resolve_plan_and_member(serializer)
        MemberSubscription.objects.filter(member=member, is_active=True).update(is_active=False)
        PaymentSchedule.objects.filter(member=member, is_active=True).update(is_active=False)
        start_date = serializer.validated_data['start_date']
        subscription = serializer.save(
            trainer=trainer_profile,
            recurrence_type=plan.recurrence_type,
            grace_period_days=plan.grace_period_days,
            next_billing_date=start_date,
            renewal_date=None,
            status='suspended',
        )
        member.membership_plan = plan
        member.save(update_fields=['membership_plan'])
        initialize_subscription(subscription)
        registrar_auditoria(
            self.request.user,
            'subscription_created',
            'MemberSubscription',
            subscription.id,
            request=self.request,
            details={
                'member_id': member.id,
                'plan_id': plan.id,
                'agreed_price': str(subscription.agreed_price),
                'status': subscription.status,
            },
        )

    @transaction.atomic
    def perform_update(self, serializer):
        subscription = self.get_object()
        user = self.request.user
        if not user.is_staff and subscription.trainer_id != _get_trainer_profile(user).id:
            raise PermissionDenied('Solo puedes editar suscripciones de tus clientes.')
        previous_values = {
            'agreed_price': str(subscription.agreed_price),
            'status': subscription.status,
            'is_active': subscription.is_active,
            'renewal_date': subscription.renewal_date.isoformat() if subscription.renewal_date else None,
            'cancellation_date': subscription.cancellation_date.isoformat() if subscription.cancellation_date else None,
        }
        target_plan = serializer.validated_data.get('plan', subscription.plan)
        updated = serializer.save(
            recurrence_type=target_plan.recurrence_type,
            grace_period_days=target_plan.grace_period_days,
        )
        if updated.is_active:
            MemberSubscription.objects.filter(member=updated.member).exclude(id=updated.id).update(is_active=False)
            PaymentSchedule.objects.filter(member=updated.member).exclude(subscription=updated).update(is_active=False)
        if updated.status == 'cancelled' or updated.cancellation_date:
            updated.status = 'cancelled'
            updated.is_active = False
            PaymentSchedule.objects.filter(subscription=updated, is_active=True).update(is_active=False)
        updated.save(update_fields=['status', 'is_active'])
        updated.member.membership_plan = updated.plan
        updated.member.save(update_fields=['membership_plan'])
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


class PaymentScheduleViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentScheduleSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsStaffOrTrainer()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        member_id = self.request.query_params.get('member')
        if user.role == 'member' and not user.is_staff:
            return PaymentSchedule.objects.filter(member__user=user)
        queryset = PaymentSchedule.objects.select_related('member__user', 'plan', 'subscription__plan').all()
        if user.role == 'trainer' and not user.is_staff:
            trainer_profile = _get_trainer_profile(user)
            queryset = queryset.filter(member__trainer_asignado=trainer_profile)
        if member_id:
            queryset = queryset.filter(member_id=member_id)
        return queryset

    def perform_create(self, serializer):
        subscription = serializer.validated_data.get('subscription')
        plan = serializer.validated_data.get('plan')
        member = serializer.validated_data['member']
        user = self.request.user
        if user.role == 'trainer' and not user.is_staff:
            trainer_profile = _get_trainer_profile(user)
            if member.trainer_asignado_id != trainer_profile.id:
                raise PermissionDenied('Solo puedes crear cobros para clientes asignados.')
        if subscription:
            if subscription.member_id != member.id:
                raise ValidationError({'subscription': 'La suscripción no corresponde al miembro.'})
            if user.role == 'trainer' and not user.is_staff and subscription.trainer_id != trainer_profile.id:
                raise PermissionDenied('Solo puedes usar suscripciones de tus clientes.')
            plan = subscription.plan
        elif user.role == 'trainer' and not user.is_staff and plan and plan.trainer_id != trainer_profile.id:
            raise PermissionDenied('Solo puedes usar tus propios planes configurables.')
        serializer.save(plan=plan)


class PaymentRecordViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'mark_paid'):
            return [IsAuthenticated(), IsStaffOrTrainer()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        member_id = self.request.query_params.get('member')
        if user.role == 'member' and not user.is_staff:
            return PaymentRecord.objects.filter(schedule__member__user=user)
        queryset = PaymentRecord.objects.select_related('schedule__member__user', 'schedule__plan').all()
        if user.role == 'trainer' and not user.is_staff:
            trainer_profile = _get_trainer_profile(user)
            queryset = queryset.filter(schedule__member__trainer_asignado=trainer_profile)
        if member_id:
            queryset = queryset.filter(schedule__member_id=member_id)
        return queryset

    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        record = self.get_object()
        if record.status == 'paid':
            return Response({'error': 'El pago ya fue registrado.'}, status=status.HTTP_400_BAD_REQUEST)
        subscription = record.schedule.subscription
        if subscription and subscription.status == 'cancelled':
            return Response(
                {'error': 'No puedes registrar pagos en una suscripción cancelada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        reference = request.data.get('payment_reference', '').strip()
        notes = request.data.get('notes', '').strip()
        record, _ = mark_payment_paid(record, reference=reference, notes=notes)
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
                'receipt_number': PaymentRecordSerializer(record).data.get('receipt_number'),
            },
        )
        return Response(PaymentRecordSerializer(record).data)


class PaymentMethodViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentMethodSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'member' and not user.is_staff:
            return PaymentMethod.objects.filter(member__user=user)
        queryset = PaymentMethod.objects.select_related(
            'member__trainer_asignado'
        )
        if user.is_staff:
            return queryset
        return queryset.filter(member__trainer_asignado=user.trainerprofile)

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == 'member' and not user.is_staff:
            try:
                serializer.save(member=user.memberprofile)
            except ObjectDoesNotExist:
                logger.warning('Creación de payment method sin memberprofile para user_id=%s', user.id)
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'member': 'Perfil de miembro no encontrado.'})
        else:
            member = serializer.validated_data['member']
            if not user.is_staff and member.trainer_asignado_id != user.trainerprofile.id:
                raise PermissionDenied('El miembro no está asignado a este trainer.')
            serializer.save(member=member)

    def perform_update(self, serializer):
        instance = serializer.instance
        user = self.request.user
        if not user.is_staff:
            if user.role == 'member' and not user.is_staff and instance.member.user_id != user.id:
                raise PermissionDenied('No puedes modificar este método de pago.')
            if user.role == 'trainer' and instance.member.trainer_asignado_id != user.trainerprofile.id:
                raise PermissionDenied('El miembro no está asignado a este trainer.')
        serializer.save(member=instance.member)


class PaymentInstructionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PaymentInstruction.objects.select_related('plan').all()
    serializer_class = PaymentInstructionSerializer
    permission_classes = [IsAuthenticated]
