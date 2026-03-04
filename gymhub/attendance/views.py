from datetime import date

from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from .models import Attendance
from .serializers import AttendanceSerializer, CheckInSerializer
from users.models import AuditLog
from users.permissions import IsTrainer


class CheckInThrottle(UserRateThrottle):
    rate = '30/min'
    scope = 'user'


class AttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'member':
            try:
                return Attendance.objects.filter(member__user=user)
            except Exception:
                return Attendance.objects.none()
        return Attendance.objects.select_related('member__user').all()


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
                from users.models import MemberProfile
                try:
                    member = MemberProfile.objects.get(id=member_id)
                except MemberProfile.DoesNotExist:
                    return Response({'error': 'Miembro no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
            else:
                return Response({'error': 'Se requiere member_id para trainer_override.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            if request.user.role != 'member':
                return Response({'error': 'Solo miembros pueden hacer check-in sin override.'}, status=status.HTTP_403_FORBIDDEN)
            try:
                member = request.user.memberprofile
            except Exception:
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

        return Response(
            AttendanceSerializer(attendance).data,
            status=status.HTTP_201_CREATED
        )
