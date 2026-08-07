import logging

from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date
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
        search = self.request.query_params.get('search', '').strip()
        attendance_date = self.request.query_params.get('date', '').strip()
        if user.role == 'member' and not user.is_staff:
            queryset = Attendance.objects.select_related(
                'member__user', 'checked_in_by'
            ).filter(member__user=user)
        else:
            queryset = Attendance.objects.select_related(
                'member__user', 'checked_in_by'
            ).all()
        if user.role == 'trainer' and not user.is_staff:
            trainer_profile = _get_trainer_profile(user)
            queryset = queryset.filter(member__trainer_asignado=trainer_profile)
        if member_id:
            queryset = queryset.filter(member_id=member_id)
        if attendance_date:
            parsed_date = parse_date(attendance_date)
            if parsed_date:
                queryset = queryset.filter(attendance_date=parsed_date)
        if search and not (user.role == 'member' and not user.is_staff):
            queryset = queryset.filter(
                Q(member__user__first_name__icontains=search)
                | Q(member__user__last_name__icontains=search)
                | Q(member__user__email__icontains=search)
            )
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
        requested_override = serializer.validated_data.get('trainer_override', False)
        override_reason = serializer.validated_data.get('override_reason', '').strip()
        notes = serializer.validated_data.get('notes', '').strip()

        is_trainer = IsTrainer().has_permission(request, self)
        if is_trainer:
            perm = IsTrainer()
            if not perm.has_permission(request, self):
                return Response(
                    {'error': 'Solo un trainer puede usar trainer_override.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            member_id = serializer.validated_data.get('member_id')
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
                return Response({'error': 'Se requiere member_id para registrar la asistencia.'}, status=status.HTTP_400_BAD_REQUEST)
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
        trainer_override = bool(is_trainer and not access['allowed'])
        if requested_override and not is_trainer:
            return Response({'error': 'Solo un trainer puede autorizar excepciones.'}, status=status.HTTP_403_FORBIDDEN)
        if not access['allowed'] and not is_trainer:
            return Response(
                {
                    'blocked': True,
                    'reason': access['reason'],
                    'days_overdue': access['days_overdue'],
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        if trainer_override and not override_reason:
            return Response(
                {'error': 'Indica el motivo de la excepción comercial.'},
                status=status.HTTP_400_BAD_REQUEST,
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
            if is_trainer and not request.user.is_staff:
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
            is_manual_override=is_trainer,
            es_excepcion_comercial=trainer_override,
            motivo_excepcion=override_reason if trainer_override else '',
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
                    'reason': override_reason,
                    'access_reason': access['reason'],
                    'days_overdue': access['days_overdue'],
                },
            )
            logger.info('Trainer override check-in creado attendance_id=%s member_id=%s trainer_user_id=%s', attendance.id, member.id, request.user.id)

        from alerts.services import resolve_open_alerts_for_attendance
        resolve_open_alerts_for_attendance(attendance)

        return Response(
            AttendanceSerializer(attendance).data,
            status=status.HTTP_201_CREATED
        )
