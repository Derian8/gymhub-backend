import logging
import hashlib
import secrets
from datetime import timedelta

from django.core.cache import cache
from django.db import IntegrityError, transaction
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
MEMBER_QR_TOKEN_TTL_SECONDS = 120


def member_qr_cache_key(token):
    digest = hashlib.sha256(token.encode('utf-8')).hexdigest()
    return f'attendance:member-qr:{digest}'


def create_qr_membership_block_alert(member, admin_user, access):
    """Record a billing follow-up and notify the admin who scanned the QR."""
    from alerts.models import Notification
    from billing.models import SeguimientoCobro
    from billing.services import current_member_membership

    today = timezone.localdate()
    subscription = current_member_membership(member)
    membership_name = subscription.membership_name if subscription else 'Membresía'
    full_name = member.user.get_full_name() or member.user.email
    days_overdue = access.get('days_overdue', 0)
    detail = (
        f' vencida hace {days_overdue} día(s)'
        if access.get('reason') == 'payment_overdue'
        else ' pendiente de regularización'
    )

    if not SeguimientoCobro.objects.filter(
        cliente=member,
        estado__in=['nuevo', 'en_seguimiento'],
    ).exists():
        try:
            with transaction.atomic():
                SeguimientoCobro.objects.create(
                    cliente=member,
                    administrador=admin_user,
                    nota=f'Check-in QR bloqueado: membresía {membership_name}{detail}.',
                )
        except IntegrityError:
            # Another scan may have created the unique open follow-up at the same time.
            pass

    if subscription:
        event_key = 'membership_expired' if access.get('reason') == 'payment_overdue' else 'membership_payment_required'
        dedupe_key = f'{event_key}:admin:{admin_user.id}:{subscription.id}:{today.isoformat()}'
    else:
        dedupe_key = f'qr_membership_blocked:admin:{admin_user.id}:{member.id}:{today.isoformat()}'

    Notification.objects.get_or_create(
        user=admin_user,
        dedupe_key=dedupe_key,
        defaults={
            'type': 'payment_overdue' if access.get('reason') == 'payment_overdue' else 'payment_due',
            'message': f'{full_name}: membresía {membership_name}{detail}; asistencia QR bloqueada.',
        },
    )


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

        qr_token = serializer.validated_data.get('qr_token', '').strip()
        if qr_token:
            member_id = cache.get(member_qr_cache_key(qr_token))
            if member_id is None:
                return Response(
                    {'error': 'El codigo QR vencio o ya fue utilizado. Solicita uno nuevo al cliente.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
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
            if qr_token and access['reason'] != 'member_inactive':
                create_qr_membership_block_alert(member, request.user, access)
                cache.delete(member_qr_cache_key(qr_token))
            return Response(
                {
                    'blocked': True,
                    'reason': access['reason'],
                    'days_overdue': access['days_overdue'],
                    'member_id': member.id,
                    'member_name': member.user.get_full_name() or member.user.email,
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
        if qr_token:
            cache.delete(member_qr_cache_key(qr_token))
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


class MemberAttendanceQrView(APIView):
    """Emite un token opaco, temporal y de un solo uso para el check-in del cliente."""

    permission_classes = [IsAuthenticated, IsMember]

    def get(self, request):
        try:
            member = MemberProfile.objects.get(user=request.user)
        except MemberProfile.DoesNotExist:
            return Response(
                {'error': 'Perfil de cliente no encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        token = secrets.token_urlsafe(32)
        cache.set(
            member_qr_cache_key(token),
            member.id,
            timeout=MEMBER_QR_TOKEN_TTL_SECONDS,
        )
        expires_at = timezone.now() + timedelta(seconds=MEMBER_QR_TOKEN_TTL_SECONDS)
        return Response({
            'token': token,
            'expires_at': expires_at,
            'expires_in_seconds': MEMBER_QR_TOKEN_TTL_SECONDS,
        })


class MemberRoutineEntryView(APIView):
    """Valida la membresía y reutiliza la entrada del día para mostrar la rutina."""

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

        attendance = Attendance.objects.filter(
            member=member,
            attendance_date=timezone.localdate(),
        ).first()
        if attendance is None:
            return Response(
                {
                    'attendance_required': True,
                    'message': 'Muestra tu codigo QR a la administracion para registrar tu entrada antes de abrir los ejercicios.',
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        from users.audit import registrar_auditoria
        from users.services import get_active_prescription
        registrar_auditoria(
            request.user,
            'routine_view_entry',
            'Attendance',
            attendance.id,
            request=request,
            details={'member_id': member.id, 'attendance_created': False},
        )
        return Response({
            'attendance': AttendanceSerializer(attendance).data,
            'attendance_created': False,
            'prescription': get_active_prescription(member),
        }, status=status.HTTP_200_OK)
