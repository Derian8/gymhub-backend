from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import NutritionProfile, NutritionGuideline, PlanNutritionLink
from .serializers import NutritionProfileSerializer, NutritionGuidelineSerializer, PlanNutritionLinkSerializer
from users.permissions import IsTrainer


class NutritionProfileViewSet(viewsets.ModelViewSet):
    serializer_class = NutritionProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'member':
            return NutritionProfile.objects.filter(training_plan__member__user=user)
        return NutritionProfile.objects.all()

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsTrainer()]
        return [IsAuthenticated()]


class NutritionGuidelineViewSet(viewsets.ModelViewSet):
    queryset = NutritionGuideline.objects.all()
    serializer_class = NutritionGuidelineSerializer

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsTrainer()]
        return [IsAuthenticated()]


class PlanNutritionLinkViewSet(viewsets.ModelViewSet):
    serializer_class = PlanNutritionLinkSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'member':
            return PlanNutritionLink.objects.filter(plan__member__user=user)
        return PlanNutritionLink.objects.all()

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsTrainer()]
        return [IsAuthenticated()]
