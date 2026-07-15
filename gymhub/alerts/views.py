from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import InactivityAlert, Notification
from .serializers import (
    InactivityAlertContactSerializer,
    InactivityAlertSerializer,
    NotificationSerializer,
)
from .services import (
    base_trainer_alert_queryset,
    create_contact,
    filter_alerts,
    members_without_open_alerts,
    resolve_alert,
    set_alert_status,
    trainer_alert_summary,
)


class InactivityAlertViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InactivityAlertSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'member' and not user.is_staff:
            return InactivityAlert.objects.none()
        return filter_alerts(base_trainer_alert_queryset(user), self.request.query_params)

    def _require_trainer_or_staff(self, request):
        if request.user.role != 'trainer' and not request.user.is_staff:
            return Response({'error': 'Solo trainers o staff pueden modificar alertas.'}, status=status.HTTP_403_FORBIDDEN)
        return None

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        if request.user.role != 'trainer' and not request.user.is_staff:
            return Response({'error': 'Solo trainers o staff pueden ver este resumen.'}, status=status.HTTP_403_FORBIDDEN)
        return Response(trainer_alert_summary(request.user))

    @action(detail=True, methods=['post'], url_path='resolve')
    def resolve(self, request, pk=None):
        """POST /api/alerts/{id}/resolve/"""
        denied = self._require_trainer_or_staff(request)
        if denied:
            return denied

        alert = self.get_object()
        if alert.status == 'resolved':
            return Response({'error': 'La alerta ya fue resuelta.'}, status=status.HTTP_400_BAD_REQUEST)
        reason = request.data.get('reason', '').strip() or 'Alerta resuelta manualmente.'
        resolve_alert(alert, user=request.user, reason=reason)

        return Response(InactivityAlertSerializer(alert).data)

    @action(detail=True, methods=['post'], url_path='start-follow-up')
    def start_follow_up(self, request, pk=None):
        denied = self._require_trainer_or_staff(request)
        if denied:
            return denied
        alert = self.get_object()
        if alert.status not in {'new', 'in_follow_up'}:
            return Response({'error': 'Solo una alerta abierta puede pasar a seguimiento.'}, status=status.HTTP_400_BAD_REQUEST)
        reason = request.data.get('reason', '').strip() or 'Seguimiento iniciado.'
        set_alert_status(alert, 'in_follow_up', user=request.user, reason=reason)
        return Response(InactivityAlertSerializer(alert).data)

    @action(detail=True, methods=['post'], url_path='dismiss')
    def dismiss(self, request, pk=None):
        denied = self._require_trainer_or_staff(request)
        if denied:
            return denied
        alert = self.get_object()
        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response({'error': 'Se requiere un motivo para descartar.'}, status=status.HTTP_400_BAD_REQUEST)
        set_alert_status(alert, 'dismissed', user=request.user, reason=reason)
        return Response(InactivityAlertSerializer(alert).data)

    @action(detail=True, methods=['post'], url_path='reopen')
    def reopen(self, request, pk=None):
        denied = self._require_trainer_or_staff(request)
        if denied:
            return denied
        alert = self.get_object()
        if alert.status in {'new', 'in_follow_up'}:
            return Response({'error': 'La alerta ya está abierta.'}, status=status.HTTP_400_BAD_REQUEST)
        reason = request.data.get('reason', '').strip() or 'Alerta reabierta.'
        set_alert_status(alert, 'new', user=request.user, reason=reason)
        return Response(InactivityAlertSerializer(alert).data)

    @action(detail=True, methods=['get', 'post'], url_path='contacts')
    def contacts(self, request, pk=None):
        denied = self._require_trainer_or_staff(request)
        if denied:
            return denied
        alert = self.get_object()
        if request.method.lower() == 'get':
            serializer = InactivityAlertContactSerializer(alert.contacts.select_related('trainer__user'), many=True)
            return Response(serializer.data)
        serializer = InactivityAlertContactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        trainer = getattr(request.user, 'trainerprofile', None)
        if trainer is None:
            trainer = alert.member.trainer_asignado
        if trainer is None:
            return Response({'error': 'La alerta no tiene trainer responsable.'}, status=status.HTTP_400_BAD_REQUEST)
        contact = create_contact(
            alert=alert,
            trainer=trainer,
            method=serializer.validated_data['method'],
            result=serializer.validated_data['result'],
            note=serializer.validated_data.get('note', ''),
            next_follow_up_date=serializer.validated_data.get('next_follow_up_date'),
            contacted_at=serializer.validated_data.get('contacted_at'),
        )
        return Response(InactivityAlertContactSerializer(contact).data, status=status.HTTP_201_CREATED)


class MembersWithoutInactivityAlertsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'trainer' and not request.user.is_staff:
            return Response({'error': 'Solo trainers o staff pueden ver esta lista.'}, status=status.HTTP_403_FORBIDDEN)
        members = members_without_open_alerts(request.user)[:50]
        data = [
            {
                'id': member.id,
                'full_name': member.user.get_full_name() or member.user.email,
                'email': member.user.email,
                'photo': member.photo.url if member.photo else None,
                'message': 'Mantiene una asistencia regular.',
            }
            for member in members
        ]
        return Response({'results': data})


class NotificationViewSet(viewsets.ModelViewSet):
    """GET /api/notifications/ y POST /api/notifications/ (crear notificación)"""
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        queryset = Notification.objects.filter(user=self.request.user)
        notification_type = self.request.query_params.get('type')
        if notification_type:
            queryset = queryset.filter(type=notification_type)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        Notification.objects.filter(user=request.user, read=False).update(read=True)
        return Response({'message': 'Notificaciones marcadas como leídas.'})

    @action(detail=True, methods=['patch'], url_path='read')
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.read = True
        notif.save()
        return Response(NotificationSerializer(notif).data)
