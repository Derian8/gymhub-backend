from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MembershipPlanViewSet, PaymentScheduleViewSet,
    PaymentRecordViewSet, PaymentMethodViewSet, PaymentInstructionViewSet
)

router = DefaultRouter()
router.register(r'membership-plans', MembershipPlanViewSet, basename='membership-plan')
router.register(r'payment-schedules', PaymentScheduleViewSet, basename='payment-schedule')
router.register(r'payment-records', PaymentRecordViewSet, basename='payment-record')
router.register(r'payment-methods', PaymentMethodViewSet, basename='payment-method')
router.register(r'payment-instructions', PaymentInstructionViewSet, basename='payment-instruction')

urlpatterns = [
    path('', include(router.urls)),
]
