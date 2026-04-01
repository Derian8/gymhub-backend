import pytest
from rest_framework import status


@pytest.mark.django_db
class TestPlansFilters:
    def test_trainer_can_filter_plans_by_member(self, trainer_client, member_profile, trainer_profile, membership_plan):
        from datetime import date
        from django.contrib.auth import get_user_model
        from users.models import MemberProfile
        from plans.models import TrainingPlan
        from billing.models import MembershipPlan

        own_plan = TrainingPlan.objects.create(
            member=member_profile,
            trainer=trainer_profile,
            name='Plan filtrado',
            goal='muscle_gain',
            start_date=date.today(),
            weeks_duration=8,
            days_per_week=3,
            is_active=True,
        )

        User = get_user_model()
        other_user = User.objects.create_user(
            username='member_plan_other',
            email='member-plan-other@test.com',
            password='member123!',
            role='member',
        )
        other_membership = MembershipPlan.objects.create(
            name='Plan membresia alterno',
            description='Plan',
            price_monthly=90.00,
            duration_months=1,
        )
        other_profile, _ = MemberProfile.objects.get_or_create(
            user=other_user,
            defaults={
                'membership_plan': other_membership,
                'is_active': True,
            },
        )
        TrainingPlan.objects.create(
            member=other_profile,
            trainer=trainer_profile,
            name='Plan alterno',
            goal='fat_loss',
            start_date=date.today(),
            weeks_duration=6,
            days_per_week=4,
            is_active=True,
        )

        resp = trainer_client.get(f'/api/plans/?member={member_profile.id}')

        assert resp.status_code == status.HTTP_200_OK
        results = resp.data.get('results', resp.data)
        assert [item['id'] for item in results] == [own_plan.id]
