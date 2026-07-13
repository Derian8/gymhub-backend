import logging

from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
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


class AttendanceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        member_id = self.request.query_params.get('member')
        if user.role == 'member' and not user.is_staff:
            return Attendance.objects.filter(member__user=user)
        queryset = Attendance.objects.select_related('member__user').all()
        if user.role == 'trainer' and not user.is_staff:
            trainer_profile = _get_trainer_profile(user)
            queryset = queryset.filter(member__trainer_asignado=trainer_profile)
        if member_id:
            queryset = queryset.filter(member_id=member_id)
        return queryset

    @action(detail=True, methods=['post'], url_path='check-out')
    def check_out(self, request, pk=None):
        with transaction.atomic():
            attendance = Attendance.objects.select_for_update().get(
                pk=self.get_object().pk
            )
            if attendance.check_out_time:
                return Response(
                    {'error': 'La salida ya fue registrada.'},
                    status=status.HTTP_409_CONFLICT,
                )
            if attendance.attendance_date != timezone.localdate():
                return Response(
                    {'error': 'Solo puedes registrar la salida del día actual.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            attendance.check_out_time = timezone.now()
            attendance.save(update_fields=['check_out_time'])
        return Response(AttendanceSerializer(attendance).data)


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
        notes = serializer.validated_data.get('notes', '').strip()

        # Validar que el usuario sea miembro (o trainer haciendo override)
        if trainer_override:
            perm = IsTrainer()
            if not perm.has_permission(request, self):
                return Response(
                    {'error': 'Solo un trainer puede usar trainer_override.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            if not notes:
                return Response(
                    {'error': 'Se requiere un motivo en notes para la excepción manual.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # El trainer hace check-in por un miembro; member_id en payload
            member_id = request.data.get('member_id')
            if member_id:
                try:
                    member_queryset = MemberProfile.objects.all()
                    if not request.user.is_staff:
                        trainer_profile = _get_trainer_profile(request.user)
                        member_queryset = member_queryset.filter(
                            trainer_asignado=trainer_profile
                        )
                    member = member_queryset.get(id=member_id)
                except MemberProfile.DoesNotExist:
                    logger.warning('Trainer override fuera de alcance o inexistente: %s', member_id)
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

        from billing.services import membership_access
        access = membership_access(member)
        if not trainer_override and not access['allowed']:
            return Response(
                {
                    'blocked': True,
                    'reason': access['reason'],
                    'days_overdue': access['days_overdue'],
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        today = timezone.localdate()
        existing = Attendance.objects.filter(
            member=member,
            attendance_date=today,
        ).first()
        if existing:
            return Response(
                {
                    'error': 'Ya existe un registro de asistencia para hoy.',
                    'attendance': AttendanceSerializer(existing).data,
                },
                status=status.HTTP_409_CONFLICT,
            )

        # Obtener clase si se proporcionó
        gym_class = None
        if gym_class_id:
            from classes.models import ClassEnrollment, GymClass
            try:
                gym_class = GymClass.objects.get(id=gym_class_id)
            except GymClass.DoesNotExist:
                logger.warning('Check-in con clase inexistente gym_class_id=%s', gym_class_id)
                return Response({'error': 'Clase no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
            if gym_class.status != 'active':
                return Response(
                    {'error': 'La clase no está activa.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if trainer_override and not request.user.is_staff:
                if gym_class.trainer.user_id != request.user.id:
                    raise PermissionDenied('Solo puedes registrar asistencia en tus clases.')
            enrollment = ClassEnrollment.objects.filter(
                member=member, gym_class=gym_class
            ).first()
            if not enrollment:
                return Response(
                    {'error': 'El miembro no está inscrito en esta clase.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        is_manual = trainer_override
        attendance = Attendance.objects.create(
            member=member,
            gym_class=gym_class,
            checked_in_by=request.user,
            is_manual_override=is_manual,
            attendance_date=today,
            notes=notes,
        )
        if gym_class_id:
            ClassEnrollment.objects.filter(
                member=member, gym_class=gym_class
            ).update(attended=True)

        # Audit log para trainer override
        if trainer_override:
            AuditLog.objects.create(
                user=request.user,
                action_type='TRAINER_OVERRIDE_CHECKIN',
                target_model='Attendance',
                target_id=str(attendance.id),
                ip_address=request.META.get('REMOTE_ADDR'),
                details={
                    'member_id': member.id,
                    'reason': notes,
                    'access_reason': access['reason'],
                    'days_overdue': access['days_overdue'],
                },
            )
            logger.info('Trainer override check-in creado attendance_id=%s member_id=%s trainer_user_id=%s', attendance.id, member.id, request.user.id)

        return Response(
            AttendanceSerializer(attendance).data,
            status=status.HTTP_201_CREATED
        )
