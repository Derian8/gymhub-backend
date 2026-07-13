from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MembershipPlanViewSet, MemberMembershipViewSet, MemberSubscriptionViewSet,
    MyMembershipView, PaymentScheduleViewSet, PaymentRecordViewSet,
    PaymentMethodViewSet, PaymentInstructionViewSet
)
from .cron_views import DailyMembershipMaintenanceView

router = DefaultRouter()
router.register(r'membership-plans', MembershipPlanViewSet, basename='membership-plan')
router.register(r'member-memberships', MemberMembershipViewSet, basename='member-membership')
router.register(r'member-subscriptions', MemberSubscriptionViewSet, basename='member-subscription')
router.register(r'payment-schedules', PaymentScheduleViewSet, basename='payment-schedule')
router.register(r'payment-records', PaymentRecordViewSet, basename='payment-record')
router.register(r'payment-methods', PaymentMethodViewSet, basename='payment-method')
router.register(r'payment-instructions', PaymentInstructionViewSet, basename='payment-instruction')

urlpatterns = [
    path(
        'internal/daily-membership-maintenance/',
        DailyMembershipMaintenanceView.as_view(),
        name='daily-membership-maintenance',
    ),
    path('my-membership/', MyMembershipView.as_view(), name='my-membership'),
    path('', include(router.urls)),
]
