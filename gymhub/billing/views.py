from datetime import date
import logging

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
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
from users.permissions import IsTrainer, IsStaffOrTrainer
from users.audit import registrar_auditoria
from users.views import _get_trainer_profile

logger = logging.getLogger(__name__)


def _infer_subscription_status(subscription, preferred_status=None):
    if preferred_status == 'cancelled' or subscription.cancellation_date:
        return 'cancelled'
    if preferred_status == 'suspended' or not subscription.is_active:
        return 'suspended'
    if preferred_status == 'past_due':
        return 'past_due'
    latest_record = PaymentRecord.objects.filter(
        schedule__subscription=subscription
    ).order_by('-schedule__due_date', '-id').first()
    if latest_record and latest_record.status == 'late':
        return 'past_due'
    return 'active'


class MembershipPlanViewSet(viewsets.ModelViewSet):
    serializer_class = MembershipPlanSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = MembershipPlan.objects.select_related('trainer__user').all()
        if user.role == 'member':
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

    def perform_create(self, serializer):
        user = self.request.user
        if user.is_staff and serializer.validated_data.get('trainer'):
            serializer.save()
            return
        serializer.save(trainer=_get_trainer_profile(user))

    def perform_update(self, serializer):
        plan = self.get_object()
        user = self.request.user
        if not user.is_staff and plan.trainer_id != _get_trainer_profile(user).id:
            raise PermissionDenied('Solo puedes editar tus propios planes.')
        trainer = serializer.validated_data.get('trainer') if user.is_staff else _get_trainer_profile(user)
        serializer.save(trainer=trainer)


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
        if user.role == 'member':
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

    def perform_create(self, serializer):
        plan, member, trainer_profile = self._resolve_plan_and_member(serializer)
        MemberSubscription.objects.filter(member=member, is_active=True).update(is_active=False)
        PaymentSchedule.objects.filter(member=member, is_active=True).update(is_active=False)
        subscription = serializer.save(trainer=trainer_profile)
        subscription.status = _infer_subscription_status(
            subscription,
            preferred_status=serializer.validated_data.get('status'),
        )
        if subscription.renewal_date is None:
            subscription.renewal_date = subscription.next_billing_date
        subscription.save(update_fields=['status', 'renewal_date'])
        member.membership_plan = plan
        member.save(update_fields=['membership_plan'])
        schedule = PaymentSchedule.objects.create(
            member=member,
            subscription=subscription,
            plan=plan,
            due_date=subscription.next_billing_date,
            recurrence_type=subscription.recurrence_type,
            grace_period_days=subscription.grace_period_days,
            auto_generate_next=subscription.auto_generate_next,
            is_active=subscription.is_active,
        )
        PaymentRecord.objects.create(
            schedule=schedule,
            amount=subscription.agreed_price,
            status='pending',
        )
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
        updated = serializer.save()
        if updated.is_active:
            MemberSubscription.objects.filter(member=updated.member).exclude(id=updated.id).update(is_active=False)
            PaymentSchedule.objects.filter(member=updated.member).exclude(subscription=updated).update(is_active=False)
        updated.status = _infer_subscription_status(
            updated,
            preferred_status=serializer.validated_data.get('status'),
        )
        if updated.status != 'cancelled' and updated.renewal_date is None:
            updated.renewal_date = updated.next_billing_date
        updated.save(update_fields=['status', 'renewal_date'])
        updated.member.membership_plan = updated.plan
        updated.member.save(update_fields=['membership_plan'])
        PaymentSchedule.objects.filter(subscription=updated).update(
            plan=updated.plan,
            due_date=updated.next_billing_date,
            recurrence_type=updated.recurrence_type,
            grace_period_days=updated.grace_period_days,
            auto_generate_next=updated.auto_generate_next,
            is_active=updated.is_active,
        )
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
        if user.role == 'member':
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
        if user.role == 'member':
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
        from django.utils import timezone
        reference = request.data.get('payment_reference', '').strip()
        notes = request.data.get('notes', '').strip()
        record.status = 'paid'
        record.paid_at = timezone.now()
        record.payment_reference = reference
        record.receipt_issued_at = timezone.now()
        if notes:
            record.notes = notes
        record.save()
        subscription = record.schedule.subscription
        if subscription:
            subscription.status = 'active'
            subscription.renewal_date = subscription.next_billing_date
            subscription.save(update_fields=['status', 'renewal_date'])
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
        if user.role == 'member':
            return PaymentMethod.objects.filter(member__user=user)
        return PaymentMethod.objects.all()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == 'member':
            try:
                serializer.save(member=user.memberprofile)
            except ObjectDoesNotExist:
                logger.warning('Creación de payment method sin memberprofile para user_id=%s', user.id)
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'member': 'Perfil de miembro no encontrado.'})
        else:
            serializer.save()


class PaymentInstructionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PaymentInstruction.objects.select_related('plan').all()
    serializer_class = PaymentInstructionSerializer
    permission_classes = [IsAuthenticated]
