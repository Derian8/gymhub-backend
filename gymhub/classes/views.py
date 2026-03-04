from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import GymClass, ClassEnrollment
from .serializers import GymClassSerializer, ClassEnrollmentSerializer
from users.permissions import IsTrainer


class GymClassViewSet(viewsets.ModelViewSet):
    queryset = GymClass.objects.select_related('trainer__user').all()
    serializer_class = GymClassSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsTrainer()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == 'trainer':
            return qs.filter(trainer__user=user)
        return qs


class ClassEnrollmentViewSet(viewsets.ModelViewSet):
    serializer_class = ClassEnrollmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'member':
            return ClassEnrollment.objects.filter(member__user=user)
        return ClassEnrollment.objects.all()
