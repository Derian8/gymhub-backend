from django.db import transaction
from django.db.models import F
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated

from .models import ClassEnrollment, GymClass
from .serializers import ClassEnrollmentSerializer, GymClassSerializer
from users.permissions import IsTrainer


class GymClassViewSet(viewsets.ModelViewSet):
    queryset = GymClass.objects.select_related('trainer__user').order_by('id')
    serializer_class = GymClassSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsTrainer()]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_staff:
            return queryset
        if user.role == 'trainer':
            return queryset.filter(trainer__user=user)
        return queryset.filter(status='active')

    def perform_create(self, serializer):
        user = self.request.user
        if user.is_staff and serializer.validated_data.get('trainer'):
            serializer.save()
            return
        try:
            trainer = user.trainerprofile
        except AttributeError as exc:
            raise PermissionDenied('Perfil de trainer no encontrado.') from exc
        serializer.save(trainer=trainer)


class ClassEnrollmentViewSet(viewsets.ModelViewSet):
    serializer_class = ClassEnrollmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'member' and not user.is_staff:
            return ClassEnrollment.objects.filter(member__user=user).order_by('id')
        queryset = ClassEnrollment.objects.select_related(
            'member__trainer_asignado', 'gym_class__trainer'
        ).order_by('id')
        if user.is_staff:
            return queryset
        return queryset.filter(gym_class__trainer__user=user)

    @transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user
        gym_class = GymClass.objects.select_for_update().get(
            id=serializer.validated_data['gym_class'].id
        )
        if gym_class.status != 'active':
            raise ValidationError({'gym_class': 'La clase no está activa.'})
        if gym_class.current_enrolled >= gym_class.max_capacity:
            raise ValidationError({'gym_class': 'La clase alcanzó su capacidad máxima.'})

        if user.role == 'member' and not user.is_staff:
            member = user.memberprofile
        else:
            member = serializer.validated_data['member']
            if not user.is_staff:
                if gym_class.trainer.user_id != user.id:
                    raise PermissionDenied('Solo puedes administrar tus propias clases.')
                if member.trainer_asignado_id != user.trainerprofile.id:
                    raise PermissionDenied('El miembro no está asignado a este trainer.')

        serializer.save(member=member, gym_class=gym_class, attended=False)
        GymClass.objects.filter(id=gym_class.id).update(
            current_enrolled=F('current_enrolled') + 1
        )

    def perform_update(self, serializer):
        enrollment = serializer.instance
        user = self.request.user
        if not user.is_staff and (
            user.role != 'trainer'
            or enrollment.gym_class.trainer.user_id != user.id
        ):
            raise PermissionDenied('Solo el trainer de la clase puede marcar asistencia.')
        serializer.save(
            member=enrollment.member,
            gym_class=enrollment.gym_class,
        )

    @transaction.atomic
    def perform_destroy(self, instance):
        user = self.request.user
        if not user.is_staff and user.role == 'trainer':
            if instance.gym_class.trainer.user_id != user.id:
                raise PermissionDenied('Solo puedes administrar tus propias clases.')
        class_id = instance.gym_class_id
        instance.delete()
        GymClass.objects.filter(id=class_id, current_enrolled__gt=0).update(
            current_enrolled=F('current_enrolled') - 1
        )
