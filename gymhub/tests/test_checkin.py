"""
test_checkin.py — Tests del endpoint POST /api/attendance/check-in/
"""
import pytest
from datetime import date, timedelta
from rest_framework import status


@pytest.mark.django_db
class TestCheckIn:
    def test_checkin_active_member_returns_201(self, member_client, member_profile):
        """Miembro activo con pagos al día → 201."""
        resp = member_client.post('/api/attendance/check-in/', {})
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['member'] == member_profile.id

    def test_checkin_with_overdue_payment_returns_403(self, member_client, member_profile, membership_plan):
        """Miembro con mora > PAYMENT_GRACE_DAYS+7 → 403."""
        from billing.models import PaymentSchedule, PaymentRecord
        # Crear pago muy vencido (35 días > 7+7=14 días)
        schedule = PaymentSchedule.objects.create(
            member=member_profile,
            plan=membership_plan,
            due_date=date.today() - timedelta(days=35),
            grace_period_days=7,
            is_active=True,
        )
        PaymentRecord.objects.create(
            schedule=schedule,
            amount=50.00,
            status='pending',  # pending pero muy vencido
        )

        resp = member_client.post('/api/attendance/check-in/', {})
        assert resp.status_code == status.HTTP_403_FORBIDDEN
        assert resp.data['blocked'] is True
        assert resp.data['reason'] == 'payment_overdue'
        assert 'days_overdue' in resp.data

    def test_checkin_with_grace_period_ok(self, member_client, member_profile, membership_plan):
        """Miembro con mora dentro del período de gracia → 201."""
        from billing.models import PaymentSchedule, PaymentRecord
        # 5 días de mora, grace_period = 7 días → dentro del grace
        schedule = PaymentSchedule.objects.create(
            member=member_profile,
            plan=membership_plan,
            due_date=date.today() - timedelta(days=5),
            grace_period_days=7,
            is_active=True,
        )
        PaymentRecord.objects.create(
            schedule=schedule,
            amount=50.00,
            status='pending',
        )

        resp = member_client.post('/api/attendance/check-in/', {})
        assert resp.status_code == status.HTTP_201_CREATED

    def test_trainer_override_creates_manual_attendance(self, trainer_client, trainer_profile, member_profile, membership_plan):
        """
        Trainer con trainer_override=True → 201 con is_manual_override=True.
        """
        from billing.models import PaymentSchedule, PaymentRecord
        # Crear pago vencido
        schedule = PaymentSchedule.objects.create(
            member=member_profile,
            plan=membership_plan,
            due_date=date.today() - timedelta(days=35),
            grace_period_days=7,
            is_active=True,
        )
        PaymentRecord.objects.create(
            schedule=schedule, amount=50.00, status='late',
        )

        resp = trainer_client.post('/api/attendance/check-in/', {
            'trainer_override': True,
            'member_id': member_profile.id,
        })
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['is_manual_override'] is True

    def test_trainer_override_creates_audit_log(self, trainer_client, trainer_profile, member_profile, membership_plan):
        """trainer_override genera entrada en AuditLog."""
        from users.models import AuditLog
        from billing.models import PaymentSchedule, PaymentRecord
        schedule = PaymentSchedule.objects.create(
            member=member_profile,
            plan=membership_plan,
            due_date=date.today() - timedelta(days=35),
            grace_period_days=7,
            is_active=True,
        )
        PaymentRecord.objects.create(schedule=schedule, amount=50.00, status='late')

        initial_count = AuditLog.objects.count()
        resp = trainer_client.post('/api/attendance/check-in/', {
            'trainer_override': True,
            'member_id': member_profile.id,
        })
        assert resp.status_code == status.HTTP_201_CREATED
        assert AuditLog.objects.count() == initial_count + 1
        log = AuditLog.objects.latest('created_at')
        assert log.action_type == 'TRAINER_OVERRIDE_CHECKIN'

    def test_member_cannot_use_trainer_override(self, member_client, member_profile):
        """Miembro no puede usar trainer_override → 403."""
        resp = member_client.post('/api/attendance/check-in/', {
            'trainer_override': True,
            'member_id': member_profile.id,
        })
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_throttle_30_per_minute(self, member_client, member_profile):
        """
        Más de 30 requests/min → 429.
        Usamos override_settings para reducir el límite.
        """
        from django.test import override_settings

        # Hacer 32 requests rápidos; con throttle de 30/min el 31+ debería dar 429
        # En tests usamos un scope personalizado con límite bajo
        with override_settings(REST_FRAMEWORK={
            **__import__('django.conf', fromlist=['settings']).settings.REST_FRAMEWORK,
            'DEFAULT_THROTTLE_RATES': {'user': '3/min', 'anon': '100/hour', 'login': '10/15min'},
        }):
            responses = []
            for _ in range(5):
                resp = member_client.post('/api/attendance/check-in/', {})
                responses.append(resp.status_code)

            # Al menos uno debe dar 429 después de superar el límite
            assert status.HTTP_429_TOO_MANY_REQUESTS in responses
