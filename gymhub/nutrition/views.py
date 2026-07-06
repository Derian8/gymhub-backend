from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import NutritionProfile, NutritionGuideline, PlanNutritionLink, PlantillaNutricion
from .serializers import (
    NutritionProfileSerializer, NutritionGuidelineSerializer,
    PlanNutritionLinkSerializer, PlantillaNutricionSerializer,
)
from plans.models import TrainingPlan
from users.permissions import IsTrainer
from users.views import _get_trainer_profile


class NutritionProfileViewSet(viewsets.ModelViewSet):
    serializer_class = NutritionProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        member_id = self.request.query_params.get('member')
        training_plan_id = self.request.query_params.get('training_plan')
        if user.role == 'member' and not user.is_staff:
            queryset = NutritionProfile.objects.filter(training_plan__member__user=user).order_by('id')
        else:
            queryset = NutritionProfile.objects.select_related(
                'training_plan__member__trainer_asignado'
            ).order_by('id')
            if user.role == 'trainer' and not user.is_staff:
                trainer_profile = _get_trainer_profile(user)
                queryset = queryset.filter(training_plan__member__trainer_asignado=trainer_profile)
        if member_id:
            queryset = queryset.filter(training_plan__member_id=member_id)
        if training_plan_id:
            queryset = queryset.filter(training_plan_id=training_plan_id)
        return queryset

    def perform_create(self, serializer):
        training_plan = serializer.validated_data['training_plan']
        user = self.request.user
        trainer_profile = _get_trainer_profile(user)
        if not user.is_staff and training_plan.member.trainer_asignado_id != trainer_profile.id:
            raise PermissionDenied('Solo puedes crear nutrición para clientes asignados.')
        serializer.save()

    def perform_update(self, serializer):
        nutrition_profile = serializer.instance
        user = self.request.user
        trainer_profile = _get_trainer_profile(user)
        if not user.is_staff and nutrition_profile.training_plan.member.trainer_asignado_id != trainer_profile.id:
            raise PermissionDenied('Solo puedes editar nutrición de clientes asignados.')
        serializer.save()

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsTrainer()]
        return [IsAuthenticated()]

    @action(detail=True, methods=['post'], url_path='save-as-template')
    def save_as_template(self, request, pk=None):
        profile = self.get_object()
        user = request.user
        trainer_profile = _get_trainer_profile(user)
        if not user.is_staff and profile.training_plan.member.trainer_asignado_id != trainer_profile.id:
            raise PermissionDenied('Solo puedes convertir en plantilla nutrición de clientes asignados.')

        template = PlantillaNutricion.objects.create(
            trainer=trainer_profile,
            nombre=request.data.get('nombre') or f'Plantilla — {profile.training_plan.name}',
            descripcion=request.data.get('descripcion', ''),
            goal_type=profile.goal_type,
            nivel_adherencia_recomendado=request.data.get('nivel_adherencia_recomendado', 'medium'),
            calorie_range_min=profile.calorie_range_min or 0,
            calorie_range_max=profile.calorie_range_max or 0,
            protein_focus=profile.protein_focus,
            carb_strategy=profile.carb_strategy,
            hydration_recommendation=profile.hydration_recommendation,
        )
        return Response(PlantillaNutricionSerializer(template).data, status=status.HTTP_201_CREATED)


class NutritionGuidelineViewSet(viewsets.ModelViewSet):
    queryset = NutritionGuideline.objects.order_by('id')
    serializer_class = NutritionGuidelineSerializer

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsTrainer()]
        return [IsAuthenticated()]


class PlanNutritionLinkViewSet(viewsets.ModelViewSet):
    serializer_class = PlanNutritionLinkSerializer

    def get_queryset(self):
        user = self.request.user
        plan_id = self.request.query_params.get('plan')
        if user.role == 'member' and not user.is_staff:
            queryset = PlanNutritionLink.objects.filter(plan__member__user=user).order_by('priority_order', 'id')
            if plan_id:
                queryset = queryset.filter(plan_id=plan_id)
            return queryset
        queryset = PlanNutritionLink.objects.select_related('plan__member__trainer_asignado').order_by('priority_order', 'id')
        if user.role == 'trainer' and not user.is_staff:
            trainer_profile = _get_trainer_profile(user)
            queryset = queryset.filter(plan__member__trainer_asignado=trainer_profile)
        if plan_id:
            queryset = queryset.filter(plan_id=plan_id)
        return queryset

    def perform_create(self, serializer):
        plan = serializer.validated_data['plan']
        user = self.request.user
        trainer_profile = _get_trainer_profile(user)
        if not user.is_staff and plan.member.trainer_asignado_id != trainer_profile.id:
            raise PermissionDenied('Solo puedes asociar guías a clientes asignados.')
        serializer.save()

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsTrainer()]
        return [IsAuthenticated()]


class PlantillaNutricionViewSet(viewsets.ModelViewSet):
    serializer_class = PlantillaNutricionSerializer
    permission_classes = [IsAuthenticated, IsTrainer]

    def get_queryset(self):
        trainer_profile = _get_trainer_profile(self.request.user)
        return PlantillaNutricion.objects.filter(trainer=trainer_profile).order_by('nombre', 'id')

    def perform_create(self, serializer):
        serializer.save(trainer=_get_trainer_profile(self.request.user))

    @action(detail=True, methods=['post'], url_path='apply')
    def apply(self, request, pk=None):
        template = self.get_object()
        training_plan_id = request.data.get('training_plan_id')
        if not training_plan_id:
            raise ValidationError({'training_plan_id': 'Este campo es requerido.'})

        try:
            training_plan = TrainingPlan.objects.select_related('member__trainer_asignado').get(id=training_plan_id)
        except TrainingPlan.DoesNotExist as exc:
            raise ValidationError({'training_plan_id': 'Plan no encontrado.'}) from exc

        user = request.user
        trainer_profile = _get_trainer_profile(user)
        if not user.is_staff and training_plan.member.trainer_asignado_id != trainer_profile.id:
            raise PermissionDenied('Solo puedes aplicar plantillas a clientes asignados.')

        try:
            profile = NutritionProfile.objects.get(training_plan=training_plan)
            serializer = NutritionProfileSerializer(
                profile,
                data={
                    'training_plan': training_plan.id,
                    'goal_type': template.goal_type,
                    'calorie_range_min': template.calorie_range_min,
                    'calorie_range_max': template.calorie_range_max,
                    'protein_focus': template.protein_focus,
                    'carb_strategy': template.carb_strategy,
                    'hydration_recommendation': template.hydration_recommendation,
                },
            )
        except NutritionProfile.DoesNotExist:
            serializer = NutritionProfileSerializer(data={
                'training_plan': training_plan.id,
                'goal_type': template.goal_type,
                'calorie_range_min': template.calorie_range_min,
                'calorie_range_max': template.calorie_range_max,
                'protein_focus': template.protein_focus,
                'carb_strategy': template.carb_strategy,
                'hydration_recommendation': template.hydration_recommendation,
            })

        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
