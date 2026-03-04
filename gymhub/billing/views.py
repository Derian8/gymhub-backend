from datetime import date

from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import MembershipPlan, PaymentSchedule, PaymentRecord, PaymentMethod, PaymentInstruction
from .serializers import (
    MembershipPlanSerializer, PaymentScheduleSerializer,
    PaymentRecordSerializer, PaymentMethodSerializer, PaymentInstructionSerializer
)
from users.permissions import IsTrainer, IsStaffOrTrainer


class MembershipPlanViewSet(viewsets.ModelViewSet):
    queryset = MembershipPlan.objects.all()
    serializer_class = MembershipPlanSerializer

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsStaffOrTrainer()]
        return [IsAuthenticated()]


class PaymentScheduleViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentScheduleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'member':
            return PaymentSchedule.objects.filter(member__user=user)
        return PaymentSchedule.objects.all()


class PaymentRecordViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'member':
            return PaymentRecord.objects.filter(schedule__member__user=user)
        return PaymentRecord.objects.select_related('schedule__member__user').all()

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
            serializer.save(member=user.memberprofile)
        else:
            serializer.save()


class PaymentInstructionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PaymentInstruction.objects.select_related('plan').all()
    serializer_class = PaymentInstructionSerializer
    permission_classes = [IsAuthenticated]
