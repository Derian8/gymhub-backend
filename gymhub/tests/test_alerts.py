import pytest
from datetime import date, timedelta
from rest_framework import status


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
class TestAlerts:
    def test_member_cannot_access_internal_alerts(self, member_client, member_profile):
        from alerts.models import InactivityAlert

        InactivityAlert.objects.create(member=member_profile, days_inactive=21)

        resp = member_client.get('/api/trainer/inactivity-alerts/')

        assert resp.status_code == status.HTTP_200_OK
        results = resp.data.get('results', resp.data)
        assert results == []

    def test_trainer_can_resolve_alert(self, trainer_client, trainer_user, member_profile):
        from alerts.models import InactivityAlert

        alert = InactivityAlert.objects.create(member=member_profile, days_inactive=18, status='new')

        resp = trainer_client.post(f'/api/trainer/inactivity-alerts/{alert.id}/resolve/')

        assert resp.status_code == status.HTTP_200_OK
        alert.refresh_from_db()
        assert alert.status == 'resolved'
        assert alert.resolved is True
        assert alert.resolved_by == trainer_user

    def test_member_cannot_resolve_alert(self, member_client, member_profile):
        from alerts.models import InactivityAlert

        alert = InactivityAlert.objects.create(member=member_profile, days_inactive=18)

        resp = member_client.post(f'/api/trainer/inactivity-alerts/{alert.id}/resolve/')

        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_trainer_can_start_follow_up_and_register_contact(self, trainer_client, member_profile):
        from alerts.models import InactivityAlert, InactivityAlertContact

        alert = InactivityAlert.objects.create(member=member_profile, days_inactive=12, status='new')

        follow_resp = trainer_client.post(f'/api/trainer/inactivity-alerts/{alert.id}/start-follow-up/')
        assert follow_resp.status_code == status.HTTP_200_OK
        alert.refresh_from_db()
        assert alert.status == 'in_follow_up'

        contact_resp = trainer_client.post(
            f'/api/trainer/inactivity-alerts/{alert.id}/contacts/',
            {'method': 'whatsapp', 'result': 'Respondió', 'note': 'Vuelve el lunes.'},
        )

        assert contact_resp.status_code == status.HTTP_201_CREATED
        assert InactivityAlertContact.objects.filter(alert=alert, note='Vuelve el lunes.').exists()

    def test_trainer_can_dismiss_and_reopen_alert(self, trainer_client, member_profile):
        from alerts.models import InactivityAlert

        alert = InactivityAlert.objects.create(member=member_profile, days_inactive=10, status='new')

        dismiss_resp = trainer_client.post(
            f'/api/trainer/inactivity-alerts/{alert.id}/dismiss/',
            {'reason': 'Ausencia justificada.'},
        )
        assert dismiss_resp.status_code == status.HTTP_200_OK
        alert.refresh_from_db()
        assert alert.status == 'dismissed'

        reopen_resp = trainer_client.post(f'/api/trainer/inactivity-alerts/{alert.id}/reopen/')
        assert reopen_resp.status_code == status.HTTP_200_OK
        alert.refresh_from_db()
        assert alert.status == 'new'

    def test_alert_serializer_includes_priority_and_member_context(self, trainer_client, member_profile, membership_plan):
        from alerts.models import InactivityAlert
        from attendance.models import Attendance
        from django.utils import timezone

        create_active_subscription(member_profile, membership_plan)
        last_day = date.today() - timedelta(days=23)
        Attendance.objects.create(member=member_profile, attendance_date=last_day, check_in_time=timezone.now() - timedelta(days=23))
        alert = InactivityAlert.objects.create(member=member_profile, last_checkin_date=last_day, days_inactive=23, status='new')

        resp = trainer_client.get(f'/api/trainer/inactivity-alerts/{alert.id}/')

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['member_name']
        assert resp.data['membership_status'] in {'active', 'expiring'}
        assert resp.data['priority'] == 'urgent'

    def test_generates_alert_for_active_member_over_threshold(self, member_profile, membership_plan):
        from alerts.models import InactivityAlert
        from alerts.services import create_alert_if_needed
        from attendance.models import Attendance
        from django.utils import timezone

        create_active_subscription(member_profile, membership_plan)
        Attendance.objects.filter(member=member_profile).delete()
        Attendance.objects.create(
            member=member_profile,
            attendance_date=date.today() - timedelta(days=8),
            check_in_time=timezone.now() - timedelta(days=8),
        )

        alert, created = create_alert_if_needed(member_profile)

        assert created is True
        assert alert.days_inactive == 8
        assert InactivityAlert.objects.filter(member=member_profile, status='new').count() == 1

    def test_does_not_duplicate_open_alert(self, member_profile, membership_plan):
        from alerts.models import InactivityAlert
        from alerts.services import create_alert_if_needed
        from attendance.models import Attendance
        from django.utils import timezone

        create_active_subscription(member_profile, membership_plan)
        Attendance.objects.create(
            member=member_profile,
            attendance_date=date.today() - timedelta(days=8),
            check_in_time=timezone.now() - timedelta(days=8),
        )
        InactivityAlert.objects.create(member=member_profile, days_inactive=8, status='new')

        _, created = create_alert_if_needed(member_profile)

        assert created is False
        assert InactivityAlert.objects.filter(member=member_profile, status='new').count() == 1

    def test_excludes_expired_membership_and_justified_absence(self, member_profile, membership_plan):
        from alerts.services import create_alert_if_needed
        from alerts.models import MemberJustifiedAbsence
        from attendance.models import Attendance
        from django.utils import timezone

        create_active_subscription(
            member_profile,
            membership_plan,
            status='expired',
            current_period_end=date.today() - timedelta(days=1),
        )
        Attendance.objects.create(
            member=member_profile,
            attendance_date=date.today() - timedelta(days=8),
            check_in_time=timezone.now() - timedelta(days=8),
        )

        _, created = create_alert_if_needed(member_profile)
        assert created is False

        member_profile.subscriptions.all().delete()
        create_active_subscription(member_profile, membership_plan)
        MemberJustifiedAbsence.objects.create(
            member=member_profile,
            trainer=member_profile.trainer_asignado,
            start_date=date.today() - timedelta(days=1),
            end_date=date.today() + timedelta(days=2),
            reason='Viaje',
        )

        _, created = create_alert_if_needed(member_profile)
        assert created is False

    def test_members_without_alerts_returns_regular_members(self, trainer_client, member_profile, membership_plan):
        from attendance.models import Attendance
        from django.utils import timezone

        create_active_subscription(member_profile, membership_plan)
        Attendance.objects.create(member=member_profile, attendance_date=date.today(), check_in_time=timezone.now())

        resp = trainer_client.get('/api/trainer/members-without-alerts/')

        assert resp.status_code == status.HTTP_200_OK
        assert any(item['id'] == member_profile.id for item in resp.data['results'])

    def test_resolves_open_alert_when_member_returns(self, member_profile):
        from alerts.models import InactivityAlert
        from alerts.services import resolve_open_alerts_for_attendance
        from attendance.models import Attendance
        from django.utils import timezone

        last_day = date.today() - timedelta(days=12)
        alert = InactivityAlert.objects.create(
            member=member_profile,
            last_checkin_date=last_day,
            days_inactive=12,
            status='new',
        )
        attendance = Attendance.objects.create(
            member=member_profile,
            attendance_date=date.today(),
            check_in_time=timezone.now(),
        )

        count = resolve_open_alerts_for_attendance(attendance)

        alert.refresh_from_db()
        assert count == 1
        assert alert.status == 'resolved'
        assert alert.status_change_reason == 'El miembro volvió a asistir.'

    def test_notifications_are_scoped_to_authenticated_user(self, member_client, member_user, trainer_user):
        from alerts.models import Notification

        own_notification = Notification.objects.create(
            user=member_user,
            message='Tu alerta',
            type='system',
        )
        Notification.objects.create(
            user=trainer_user,
            message='Alerta trainer',
            type='system',
        )

        resp = member_client.get('/api/notifications/')

        assert resp.status_code == status.HTTP_200_OK
        results = resp.data.get('results', resp.data)
        assert [item['id'] for item in results] == [own_notification.id]

    def test_mark_all_read_only_updates_current_user_notifications(self, member_client, member_user, trainer_user):
        from alerts.models import Notification

        own_notification = Notification.objects.create(
            user=member_user,
            message='Pendiente miembro',
            type='system',
            read=False,
        )
        other_notification = Notification.objects.create(
            user=trainer_user,
            message='Pendiente trainer',
            type='system',
            read=False,
        )

        resp = member_client.post('/api/notifications/mark-all-read/')

        assert resp.status_code == status.HTTP_200_OK
        own_notification.refresh_from_db()
        other_notification.refresh_from_db()
        assert own_notification.read is True
        assert other_notification.read is False

    def test_notifications_can_be_filtered_by_type(self, member_client, member_user):
        from alerts.models import Notification

        trainer_message = Notification.objects.create(
            user=member_user,
            message='Tu trainer dejó una indicación.',
            type='trainer_message',
        )
        Notification.objects.create(
            user=member_user,
            message='Pago por vencer',
            type='payment_due',
        )

        resp = member_client.get('/api/notifications/', {'type': 'trainer_message'})

        assert resp.status_code == status.HTTP_200_OK
        results = resp.data.get('results', resp.data)
        assert [item['id'] for item in results] == [trainer_message.id]
