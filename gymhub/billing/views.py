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
from users.views import _get_trainer_profile

logger = logging.getLogger(__name__)


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
        member.membership_plan = plan
        member.save(update_fields=['membership_plan'])
        PaymentSchedule.objects.create(
            member=member,
            subscription=subscription,
            plan=plan,
            due_date=subscription.next_billing_date,
            recurrence_type=subscription.recurrence_type,
            grace_period_days=subscription.grace_period_days,
            auto_generate_next=subscription.auto_generate_next,
            is_active=subscription.is_active,
        )

    def perform_update(self, serializer):
        subscription = self.get_object()
        user = self.request.user
        if not user.is_staff and subscription.trainer_id != _get_trainer_profile(user).id:
            raise PermissionDenied('Solo puedes editar suscripciones de tus clientes.')
        updated = serializer.save()
        if updated.is_active:
            MemberSubscription.objects.filter(member=updated.member).exclude(id=updated.id).update(is_active=False)
            PaymentSchedule.objects.filter(member=updated.member).exclude(subscription=updated).update(is_active=False)
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
        record.status = 'paid'
        record.paid_at = timezone.now()
        record.save()
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
