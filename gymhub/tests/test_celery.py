"""
test_celery.py — Tests de las tareas Celery Beat (con mocking).
"""
import pytest
from datetime import date, timedelta
from unittest.mock import patch


def create_active_subscription(member_profile, membership_plan, **overrides):
    from billing.models import MemberSubscription

    values = {
        'member': member_profile,
        'plan': membership_plan,
        'membership_name': membership_plan.name,
        'trainer': member_profile.trainer_asignado,
        'agreed_price': membership_plan.price,
        'start_date': date.today() - timedelta(days=10),
        'next_billing_date': date.today() + timedelta(days=20),
        'recurrence_type': 'monthly',
        'grace_period_days': 7,
        'auto_generate_next': True,
        'is_active': True,
        'status': 'active',
        'current_period_start': date.today() - timedelta(days=10),
        'current_period_end': date.today() + timedelta(days=20),
    }
    values.update(overrides)
    return MemberSubscription.objects.create(**values)


@pytest.mark.django_db
class TestCheckOverduePayments:
    @patch('billing.tasks.send_mail')
    def test_check_overdue_payments_changes_status_to_late(
        self, mock_send_mail, member_profile, membership_plan
    ):
        """check_overdue_payments cambia status a 'late' para pagos vencidos."""
        from billing.models import PaymentSchedule, PaymentRecord
        from billing.tasks import check_overdue_payments

        # Crear pago vencido hace 15 días (grace_period=7) → debería pasar a late
        schedule = PaymentSchedule.objects.create(
            member=member_profile,
            plan=membership_plan,
            due_date=date.today() - timedelta(days=15),
            grace_period_days=7,
            is_active=True,
        )
        record = PaymentRecord.objects.create(
            schedule=schedule,
            amount=50.00,
            status='pending',
        )

        result = check_overdue_payments()

        record.refresh_from_db()
        assert record.status == 'late'
        assert result['updated'] >= 1

    @patch('billing.tasks.send_mail')
    def test_payment_within_grace_period_not_changed(
        self, mock_send_mail, member_profile, membership_plan
    ):
        """Pago dentro del período de gracia NO cambia a late."""
        from billing.models import PaymentSchedule, PaymentRecord
        from billing.tasks import check_overdue_payments

        # 3 días de mora, grace_period=7 → NO debería pasar a late
        schedule = PaymentSchedule.objects.create(
            member=member_profile,
            plan=membership_plan,
            due_date=date.today() - timedelta(days=3),
            grace_period_days=7,
            is_active=True,
        )
        record = PaymentRecord.objects.create(
            schedule=schedule, amount=50.00, status='pending',
        )

        check_overdue_payments()

        record.refresh_from_db()
        assert record.status == 'pending'  # Sin cambio

    @patch('billing.tasks.send_mail')
    def test_creates_notification_for_overdue_member(
        self, mock_send_mail, member_profile, membership_plan
    ):
        """check_overdue_payments crea Notification para el miembro en mora."""
        from billing.models import PaymentSchedule, PaymentRecord
        from alerts.models import Notification
        from billing.tasks import check_overdue_payments

        schedule = PaymentSchedule.objects.create(
            member=member_profile,
            plan=membership_plan,
            due_date=date.today() - timedelta(days=15),
            grace_period_days=7,
            is_active=True,
        )
        PaymentRecord.objects.create(schedule=schedule, amount=50.00, status='pending')

        initial_count = Notification.objects.filter(user=member_profile.user).count()
        check_overdue_payments()

        assert Notification.objects.filter(
            user=member_profile.user, type='payment_overdue'
        ).count() > initial_count

    @patch('billing.tasks.send_mail')
    def test_overdue_payment_notifies_administrator_not_trainers(
        self, mock_send_mail, member_profile, membership_plan, trainer_user, admin_user
    ):
        from django.contrib.auth import get_user_model
        from alerts.models import Notification
        from billing.models import PaymentSchedule, PaymentRecord
        from billing.tasks import check_overdue_payments
        from users.models import TrainerProfile

        other_trainer = get_user_model().objects.create_user(
            username='trainer_extra',
            email='trainer-extra@test.com',
            password='trainer123!',
            role='trainer',
        )
        TrainerProfile.objects.get_or_create(user=other_trainer)

        schedule = PaymentSchedule.objects.create(
            member=member_profile,
            plan=membership_plan,
            due_date=date.today() - timedelta(days=15),
            grace_period_days=7,
            is_active=True,
        )
        PaymentRecord.objects.create(schedule=schedule, amount=50.00, status='pending')

        check_overdue_payments()

        assert Notification.objects.filter(
            user=admin_user,
            type='payment_overdue',
        ).exists()
        assert not Notification.objects.filter(
            user=trainer_user,
            type='payment_overdue',
        ).exists()
        assert not Notification.objects.filter(
            user=other_trainer,
            type='payment_overdue',
        ).exists()


@pytest.mark.django_db
class TestCheckMemberInactivity:
    def test_creates_inactivity_alert_if_none_open(self, member_profile, membership_plan):
        """check_member_inactivity crea InactivityAlert solo si no hay una abierta."""
        from attendance.models import Attendance
        from alerts.models import InactivityAlert
        from alerts.tasks import check_member_inactivity
        from django.utils import timezone

        create_active_subscription(member_profile, membership_plan)
        # Registrar última asistencia hace 35 días
        Attendance.objects.filter(member=member_profile).delete()
        Attendance.objects.create(
            member=member_profile,
            attendance_date=date.today() - timedelta(days=35),
            check_in_time=timezone.now() - timedelta(days=35),
        )

        InactivityAlert.objects.filter(member=member_profile, status__in=['new', 'in_follow_up']).delete()
        initial_count = InactivityAlert.objects.filter(member=member_profile).count()

        result = check_member_inactivity()

        final_count = InactivityAlert.objects.filter(member=member_profile, status__in=['new', 'in_follow_up']).count()
        assert final_count == 1
        assert result['alerts_created'] >= 1

    def test_no_duplicate_alert_if_open_exists(self, member_profile, membership_plan):
        """Si ya hay una alerta abierta, no se crea otra."""
        from attendance.models import Attendance
        from alerts.models import InactivityAlert
        from alerts.tasks import check_member_inactivity
        from django.utils import timezone

        create_active_subscription(member_profile, membership_plan)
        Attendance.objects.filter(member=member_profile).delete()
        Attendance.objects.create(
            member=member_profile,
            attendance_date=date.today() - timedelta(days=35),
            check_in_time=timezone.now() - timedelta(days=35),
        )

        # Crear alerta ya abierta
        InactivityAlert.objects.create(
            member=member_profile,
            last_checkin_date=date.today() - timedelta(days=35),
            days_inactive=35,
            status='new',
        )
        existing_count = InactivityAlert.objects.filter(member=member_profile, status__in=['new', 'in_follow_up']).count()

        check_member_inactivity()

        new_count = InactivityAlert.objects.filter(member=member_profile, status__in=['new', 'in_follow_up']).count()
        assert new_count == existing_count  # Sin duplicados


@pytest.mark.django_db
class TestCheckUpcomingPayments:
    @patch('billing.tasks.send_mail')
    def test_creates_notification_once_per_due_date(
        self, mock_send_mail, member_profile, membership_plan
    ):
        """check_upcoming_payments crea Notification solo una vez por due_date."""
        from billing.models import PaymentSchedule, PaymentRecord
        from alerts.models import Notification
        from billing.tasks import check_upcoming_payments

        schedule = PaymentSchedule.objects.create(
            member=member_profile,
            plan=membership_plan,
            due_date=date.today() + timedelta(days=2),
            grace_period_days=7,
            is_active=True,
        )
        PaymentRecord.objects.create(schedule=schedule, amount=50.00, status='pending')

        initial_count = Notification.objects.filter(
            user=member_profile.user, type='payment_due'
        ).count()

        # Ejecutar 2 veces
        check_upcoming_payments()
        check_upcoming_payments()

        final_count = Notification.objects.filter(
            user=member_profile.user, type='payment_due'
        ).count()

        # Solo debe haberse creado 1 notificación, no 2
        assert final_count == initial_count + 1
