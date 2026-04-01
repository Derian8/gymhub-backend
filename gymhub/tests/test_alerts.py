import pytest
from rest_framework import status


@pytest.mark.django_db
class TestAlerts:
    def test_member_only_sees_own_alerts(self, member_client, member_profile, membership_plan):
        from django.contrib.auth import get_user_model
        from users.models import MemberProfile
        from alerts.models import InactivityAlert

        User = get_user_model()
        other_user = User.objects.create_user(
            username='member_alert_other',
            email='member-alert-other@test.com',
            password='member123!',
            role='member',
        )
        other_profile, _ = MemberProfile.objects.get_or_create(
            user=other_user,
            defaults={'membership_plan': membership_plan, 'is_active': True},
        )

        own_alert = InactivityAlert.objects.create(member=member_profile, days_inactive=21)
        InactivityAlert.objects.create(member=other_profile, days_inactive=30)

        resp = member_client.get('/api/alerts/')

        assert resp.status_code == status.HTTP_200_OK
        results = resp.data.get('results', resp.data)
        assert [item['id'] for item in results] == [own_alert.id]

    def test_trainer_can_resolve_alert(self, trainer_client, trainer_user, member_profile):
        from alerts.models import InactivityAlert

        alert = InactivityAlert.objects.create(member=member_profile, days_inactive=18)

        resp = trainer_client.post(f'/api/alerts/{alert.id}/resolve/')

        assert resp.status_code == status.HTTP_200_OK
        alert.refresh_from_db()
        assert alert.resolved is True
        assert alert.resolved_by == trainer_user

    def test_member_cannot_resolve_alert(self, member_client, member_profile):
        from alerts.models import InactivityAlert

        alert = InactivityAlert.objects.create(member=member_profile, days_inactive=18)

        resp = member_client.post(f'/api/alerts/{alert.id}/resolve/')

        assert resp.status_code == status.HTTP_403_FORBIDDEN

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
