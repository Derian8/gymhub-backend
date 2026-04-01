from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import InactivityAlert, Notification
from .serializers import InactivityAlertSerializer, NotificationSerializer
from users.permissions import IsTrainer


class InactivityAlertViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InactivityAlertSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'member':
            return InactivityAlert.objects.filter(member__user=user)
        return InactivityAlert.objects.select_related('member__user').all()

    @action(detail=True, methods=['post'], url_path='resolve')
    def resolve(self, request, pk=None):
        """POST /api/alerts/{id}/resolve/"""
        if request.user.role != 'trainer' and not request.user.is_staff:
            return Response({'error': 'Solo trainers o staff pueden resolver alertas.'}, status=status.HTTP_403_FORBIDDEN)

        alert = self.get_object()
        if alert.resolved:
            return Response({'error': 'La alerta ya fue resuelta.'}, status=status.HTTP_400_BAD_REQUEST)

        alert.resolved = True
        alert.resolved_by = request.user
        alert.resolved_at = timezone.now()
        alert.save()

        return Response(InactivityAlertSerializer(alert).data)


class NotificationViewSet(viewsets.ModelViewSet):
    """GET /api/notifications/ y POST /api/notifications/ (crear notificación)"""
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

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
