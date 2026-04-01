from datetime import date
import logging

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.settings import api_settings
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from .models import Attendance
from .serializers import AttendanceSerializer, CheckInSerializer
from users.models import AuditLog
from users.models import MemberProfile
from users.permissions import IsTrainer
from users.views import _get_trainer_profile

logger = logging.getLogger(__name__)


class CheckInThrottle(UserRateThrottle):
    scope = 'user'

    def get_rate(self):
        return api_settings.DEFAULT_THROTTLE_RATES.get(self.scope)


class AttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        member_id = self.request.query_params.get('member')
        if user.role == 'member':
            return Attendance.objects.filter(member__user=user)
        queryset = Attendance.objects.select_related('member__user').all()
        if user.role == 'trainer' and not user.is_staff:
            trainer_profile = _get_trainer_profile(user)
            queryset = queryset.filter(member__trainer_asignado=trainer_profile)
        if member_id:
            queryset = queryset.filter(member_id=member_id)
        return queryset


class CheckInView(APIView):
    """
    POST /api/attendance/check-in/
    Throttling: 30/min.
    Bloqueo si mora > PAYMENT_GRACE_DAYS+7 días (a menos que trainer_override=True).
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [CheckInThrottle]

    def post(self, request):
        serializer = CheckInSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        gym_class_id = serializer.validated_data.get('gym_class_id')
        trainer_override = serializer.validated_data.get('trainer_override', False)

        # Validar que el usuario sea miembro (o trainer haciendo override)
        if trainer_override:
            perm = IsTrainer()
            if not perm.has_permission(request, self):
                return Response(
                    {'error': 'Solo un trainer puede usar trainer_override.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            # El trainer hace check-in por un miembro; member_id en payload
            member_id = request.data.get('member_id')
            if member_id:
                try:
                    member = MemberProfile.objects.get(id=member_id)
                except MemberProfile.DoesNotExist:
                    logger.warning('Trainer override check-in con member_id inexistente: %s', member_id)
                    return Response({'error': 'Miembro no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
            else:
                return Response({'error': 'Se requiere member_id para trainer_override.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            if request.user.role != 'member':
                logger.warning('Check-in sin override rechazado para user_id=%s role=%s', request.user.id, request.user.role)
                return Response({'error': 'Solo miembros pueden hacer check-in sin override.'}, status=status.HTTP_403_FORBIDDEN)
            try:
                member = request.user.memberprofile
            except ObjectDoesNotExist:
                logger.warning('Check-in sin memberprofile para user_id=%s', request.user.id)
                return Response({'error': 'Perfil de miembro no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        # Verificar estado de pago
        grace_block_days = settings.PAYMENT_GRACE_DAYS + 7
        if not trainer_override:
            from billing.models import PaymentRecord
            last_record = PaymentRecord.objects.filter(
                schedule__member=member,
                status__in=('pending', 'late')
            ).order_by('-schedule__due_date').first()

            if last_record:
                due = last_record.schedule.due_date
                today = date.today()
                days_overdue = (today - due).days
                if days_overdue > grace_block_days:
                    logger.info(
                        'Check-in bloqueado por mora member_id=%s days_overdue=%s',
                        member.id,
                        days_overdue,
                    )
                    return Response(
                        {
                            'blocked': True,
                            'reason': 'payment_overdue',
                            'days_overdue': days_overdue
                        },
                        status=status.HTTP_403_FORBIDDEN
                    )

        # Obtener clase si se proporcionó
        gym_class = None
        if gym_class_id:
            from classes.models import GymClass
            try:
                gym_class = GymClass.objects.get(id=gym_class_id)
            except GymClass.DoesNotExist:
                logger.warning('Check-in con clase inexistente gym_class_id=%s', gym_class_id)
                return Response({'error': 'Clase no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        is_manual = trainer_override
        attendance = Attendance.objects.create(
            member=member,
            gym_class=gym_class,
            checked_in_by=request.user,
            is_manual_override=is_manual,
        )

        # Audit log para trainer override
        if trainer_override:
            AuditLog.objects.create(
                user=request.user,
                action_type='TRAINER_OVERRIDE_CHECKIN',
                target_model='Attendance',
                target_id=str(attendance.id),
                ip_address=request.META.get('REMOTE_ADDR'),
            )
            logger.info('Trainer override check-in creado attendance_id=%s member_id=%s trainer_user_id=%s', attendance.id, member.id, request.user.id)

        return Response(
            AttendanceSerializer(attendance).data,
            status=status.HTTP_201_CREATED
        )
