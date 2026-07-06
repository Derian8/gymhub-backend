import pytest
from datetime import datetime, timezone as dt_timezone
from rest_framework import status


@pytest.mark.django_db
class TestProgressMetrics:
    def test_member_cannot_start_session_with_another_members_workout_day(
        self, member_client, workout_day_a, membership_plan, trainer_profile
    ):
        from django.contrib.auth import get_user_model
        from plans.models import TrainingPlan, WorkoutDay
        from users.models import MemberProfile

        other_user = get_user_model().objects.create_user(
            username='otro_plan', email='otro-plan@test.com',
            password='member123!', role='member'
        )
        other_member = MemberProfile.objects.get(user=other_user)
        other_member.membership_plan = membership_plan
        other_member.trainer_asignado = trainer_profile
        other_member.save(update_fields=['membership_plan', 'trainer_asignado'])
        other_plan = TrainingPlan.objects.create(
            member=other_member, trainer=trainer_profile, name='Plan ajeno',
            goal='general', start_date=datetime.now().date(),
            weeks_duration=4, days_per_week=1
        )
        other_day = WorkoutDay.objects.create(
            plan=other_plan, name='Día ajeno', day_label='A',
            day_of_week='mon', order=0
        )

        response = member_client.post('/api/workout-sessions/', {
            'workout_day_id': other_day.id,
        }, format='json')

        assert response.status_code == status.HTTP_403_FORBIDDEN
    def test_trainer_can_create_progress_log_for_assigned_member(self, trainer_client, member_profile):
        response = trainer_client.post('/api/progress-logs/', {
            'member': member_profile.id,
            'recorded_at': '2026-04-20T10:30:00Z',
            'weight_kg': 81.2,
            'height_cm': 176,
            'body_fat_pct': 17.5,
            'muscle_mass_kg': 35.1,
            'waist_cm': 82,
            'notes': 'Seguimiento mensual',
        }, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['member'] == member_profile.id
        assert response.data['height_cm'] == 176
        recorded_at = datetime.fromisoformat(response.data['recorded_at'])
        assert recorded_at.astimezone(dt_timezone.utc) == datetime(
            2026, 4, 20, 10, 30, tzinfo=dt_timezone.utc
        )

    def test_member_cannot_create_progress_log(self, member_client, member_profile):
        response = member_client.post('/api/progress-logs/', {
            'member': member_profile.id,
            'weight_kg': 80,
            'height_cm': 176,
        }, format='json')

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_trainer_cannot_manage_progress_of_other_trainers_member(self, trainer_client, membership_plan):
        from django.contrib.auth import get_user_model
        from users.models import TrainerProfile

        other_trainer_user = get_user_model().objects.create_user(
            username='trainer_otro',
            email='trainer-otro@test.com',
            password='trainer123!',
            role='trainer',
        )
        other_trainer = TrainerProfile.objects.get(user=other_trainer_user)

        member_user = get_user_model().objects.create_user(
            username='cliente_externo',
            email='cliente-externo@test.com',
            password='member123!',
            role='member',
        )
        member = member_user.memberprofile
        member.trainer_asignado = other_trainer
        member.membership_plan = membership_plan
        member.save(update_fields=['trainer_asignado', 'membership_plan'])

        response = trainer_client.post('/api/progress-logs/', {
            'member': member.id,
            'weight_kg': 85,
            'height_cm': 180,
        }, format='json')

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_trainer_can_update_existing_progress_log(self, trainer_client, member_profile):
        from progress.models import ProgressLog

        log = ProgressLog.objects.create(
            member=member_profile,
            recorded_at=datetime(2026, 4, 1, 9, 0, tzinfo=dt_timezone.utc),
            weight_kg=82,
            height_cm=176,
        )

        response = trainer_client.patch(f'/api/progress-logs/{log.id}/', {
            'weight_kg': 80.5,
            'notes': 'Ajuste posterior',
        }, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['weight_kg'] == 80.5
        assert response.data['height_cm'] == 176

    def test_member_physical_summary_includes_bmi(self, trainer_client, member_profile):
        from progress.models import ProgressLog

        ProgressLog.objects.create(
            member=member_profile,
            recorded_at=datetime(2026, 3, 1, 9, 0, tzinfo=dt_timezone.utc),
            weight_kg=84,
            height_cm=176,
        )
        ProgressLog.objects.create(
            member=member_profile,
            recorded_at=datetime(2026, 4, 1, 9, 0, tzinfo=dt_timezone.utc),
            weight_kg=82,
            height_cm=176,
            body_fat_pct=18,
            waist_cm=83,
        )

        response = trainer_client.get(f'/api/members/{member_profile.id}/physical-summary/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['current_weight_kg'] == 82
        assert response.data['height_cm'] == 176
        assert response.data['weight_change_kg'] == -2
        assert response.data['bmi'] == 26.5

    def test_trainer_progress_list_requires_member_id(self, trainer_client):
        response = trainer_client.get('/api/progress-logs/')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
