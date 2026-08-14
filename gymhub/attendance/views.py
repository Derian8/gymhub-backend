import logging

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
from users.permissions import IsAdministrator, IsMember, usa_contexto_cliente

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
        contexto_cliente = usa_contexto_cliente(self.request)
        if contexto_cliente:
            queryset = Attendance.objects.select_related(
                'member__user', 'checked_in_by'
            ).filter(member__user=user)
        elif user.is_staff:
            queryset = Attendance.objects.select_related(
                'member__user', 'checked_in_by'
            ).all()
        else:
            return Attendance.objects.none()
        if member_id:
            queryset = queryset.filter(member_id=member_id)
        if attendance_date:
            parsed_date = parse_date(attendance_date)
            if parsed_date:
                queryset = queryset.filter(attendance_date=parsed_date)
        if search and not contexto_cliente:
            queryset = queryset.filter(
                Q(member__user__first_name__icontains=search)
                | Q(member__user__last_name__icontains=search)
                | Q(member__user__email__icontains=search)
            )
        return queryset

    def get_permissions(self):
        if self.action == 'check_out':
            return [IsAuthenticated(), IsAdministrator()]
        return [IsAuthenticated()]

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
    Entrada manual administrativa. Si hay bloqueo exige excepción y motivo.
    """
    permission_classes = [IsAuthenticated, IsAdministrator]
    throttle_classes = [CheckInThrottle]

    def post(self, request):
        serializer = CheckInSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        gym_class_id = serializer.validated_data.get('gym_class_id')
        requested_override = serializer.validated_data.get('trainer_override', False)
        override_reason = serializer.validated_data.get('override_reason', '').strip()
        notes = serializer.validated_data.get('notes', '').strip()

        member_id = serializer.validated_data.get('member_id')
        if not member_id:
            return Response({'error': 'Se requiere member_id para registrar la entrada.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            member = MemberProfile.objects.get(id=member_id)
        except MemberProfile.DoesNotExist:
            return Response({'error': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        from billing.services import membership_access
        access = membership_access(member)
        commercial_override = bool(not access['allowed'] and requested_override)
        if not access['allowed'] and not commercial_override:
            return Response(
                {
                    'blocked': True,
                    'reason': access['reason'],
                    'days_overdue': access['days_overdue'],
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        if commercial_override and not override_reason:
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
            enrollment = ClassEnrollment.objects.filter(
                member=member, gym_class=gym_class
            ).first()
            if not enrollment:
                return Response(
                    {'error': 'El miembro no está inscrito en esta clase.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        attendance = Attendance.objects.create(
            member=member,
            gym_class=gym_class,
            checked_in_by=request.user,
            is_manual_override=True,
            es_excepcion_comercial=commercial_override,
            motivo_excepcion=override_reason if commercial_override else '',
            attendance_date=today,
            notes=notes,
        )
        if gym_class_id:
            ClassEnrollment.objects.filter(
                member=member, gym_class=gym_class
            ).update(attended=True)

        # Audit log para trainer override
        if commercial_override:
            AuditLog.objects.create(
                user=request.user,
                action_type='ADMIN_ACCESS_EXCEPTION',
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
            logger.info('Excepción administrativa creada attendance_id=%s member_id=%s admin_user_id=%s', attendance.id, member.id, request.user.id)

        from alerts.services import resolve_open_alerts_for_attendance
        resolve_open_alerts_for_attendance(attendance)

        return Response(
            AttendanceSerializer(attendance).data,
            status=status.HTTP_201_CREATED
        )


class MemberRoutineEntryView(APIView):
    """Valida membresía, registra la entrada y recién entonces revela la rutina."""

    permission_classes = [IsAuthenticated, IsMember]
    throttle_classes = [CheckInThrottle]

    @transaction.atomic
    def post(self, request):
        try:
            member = MemberProfile.objects.select_for_update().get(user=request.user)
        except MemberProfile.DoesNotExist:
            return Response({'error': 'Perfil de cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        from billing.services import membership_access
        access = membership_access(member)
        if not access['allowed']:
            AuditLog.objects.create(
                user=request.user,
                action_type='ROUTINE_ACCESS_DENIED',
                target_model='MemberProfile',
                target_id=str(member.id),
                ip_address=request.META.get('REMOTE_ADDR'),
                details={
                    'reason': access['reason'],
                    'days_overdue': access['days_overdue'],
                },
            )
            return Response(
                {
                    'blocked': True,
                    'reason': access['reason'],
                    'days_overdue': access['days_overdue'],
                    'message': 'Tu acceso está bloqueado. Contacta al administrador.',
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        attendance, created = Attendance.objects.get_or_create(
            member=member,
            attendance_date=timezone.localdate(),
            defaults={
                'checked_in_by': request.user,
                'notes': 'Entrada registrada al abrir la rutina.',
            },
        )
        if created:
            from alerts.services import resolve_open_alerts_for_attendance
            resolve_open_alerts_for_attendance(attendance)

        from users.audit import registrar_auditoria
        from users.services import get_active_prescription
        registrar_auditoria(
            request.user,
            'routine_view_entry',
            'Attendance',
            attendance.id,
            request=request,
            details={'member_id': member.id, 'attendance_created': created},
        )
        return Response({
            'attendance': AttendanceSerializer(attendance).data,
            'attendance_created': created,
            'prescription': get_active_prescription(member),
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
