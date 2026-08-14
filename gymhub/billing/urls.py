from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MembershipPlanViewSet, MemberMembershipViewSet, MemberSubscriptionViewSet,
    MyMembershipView, PaymentScheduleViewSet, PaymentRecordViewSet,
    PaymentMethodViewSet, PaymentInstructionViewSet, SeguimientoCobroViewSet
)
from .cron_views import DailyMembershipMaintenanceView
from .reports import AdminDashboardView, AdminReportExportView, AdminReportOverviewView

router = DefaultRouter()
router.register(r'membership-plans', MembershipPlanViewSet, basename='membership-plan')
router.register(r'member-memberships', MemberMembershipViewSet, basename='member-membership')
router.register(r'member-subscriptions', MemberSubscriptionViewSet, basename='member-subscription')
router.register(r'payment-schedules', PaymentScheduleViewSet, basename='payment-schedule')
router.register(r'payment-records', PaymentRecordViewSet, basename='payment-record')
router.register(r'payment-methods', PaymentMethodViewSet, basename='payment-method')
router.register(r'payment-instructions', PaymentInstructionViewSet, basename='payment-instruction')
router.register(r'collection-follow-ups', SeguimientoCobroViewSet, basename='collection-follow-up')

urlpatterns = [
    path(
        'internal/daily-membership-maintenance/',
        DailyMembershipMaintenanceView.as_view(),
        name='daily-membership-maintenance',
    ),
    path('my-membership/', MyMembershipView.as_view(), name='my-membership'),
    path('admin/dashboard/', AdminDashboardView.as_view(), name='admin-dashboard'),
    path('admin/reports/overview/', AdminReportOverviewView.as_view(), name='admin-report-overview'),
    path('admin/reports/export/', AdminReportExportView.as_view(), name='admin-report-export'),
    path('', include(router.urls)),
]
