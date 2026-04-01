import pytest
from rest_framework import status


@pytest.mark.django_db
class TestNutrition:
    def test_member_only_sees_own_nutrition_profile(self, member_client, training_plan, trainer_profile):
        from django.contrib.auth import get_user_model
        from billing.models import MembershipPlan
        from users.models import MemberProfile
        from plans.models import TrainingPlan
        from nutrition.models import NutritionProfile

        NutritionProfile.objects.create(
            training_plan=training_plan,
            goal_type='muscle_gain',
            calorie_range_min=2400,
            calorie_range_max=2800,
        )

        User = get_user_model()
        other_user = User.objects.create_user(
            username='member_nutrition_other',
            email='member-nutrition-other@test.com',
            password='member123!',
            role='member',
        )
        other_plan = MembershipPlan.objects.create(
            name='Plan Nutri',
            description='Plan',
            price_monthly=70.00,
            duration_months=1,
        )
        other_profile, _ = MemberProfile.objects.get_or_create(
            user=other_user,
            defaults={'membership_plan': other_plan, 'is_active': True},
        )
        other_training_plan = TrainingPlan.objects.create(
            member=other_profile,
            trainer=trainer_profile,
            name='Plan otro',
            goal='fat_loss',
            start_date=training_plan.start_date,
            weeks_duration=8,
            days_per_week=3,
            is_active=True,
        )
        NutritionProfile.objects.create(
            training_plan=other_training_plan,
            goal_type='fat_loss',
            calorie_range_min=1800,
            calorie_range_max=2100,
        )

        resp = member_client.get('/api/nutrition-profiles/')

        assert resp.status_code == status.HTTP_200_OK
        results = resp.data.get('results', resp.data)
        assert len(results) == 1
        assert results[0]['training_plan'] == training_plan.id

    def test_member_cannot_create_guideline(self, member_client):
        resp = member_client.post('/api/nutrition-guidelines/', {
            'goal_type': 'muscle_gain',
            'title': 'Alta proteína',
            'description': 'Más proteína diaria',
        })

        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_trainer_can_create_guideline(self, trainer_client):
        resp = trainer_client.post('/api/nutrition-guidelines/', {
            'goal_type': 'muscle_gain',
            'title': 'Alta proteína',
            'description': 'Más proteína diaria',
            'recommended_foods': 'pollo, huevos',
            'foods_to_limit': 'ultraprocesados',
            'timing_suggestions': 'post-entreno',
        })

        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['title'] == 'Alta proteína'

    def test_member_only_sees_own_plan_nutrition_links(self, member_client, training_plan, trainer_profile):
        from django.contrib.auth import get_user_model
        from billing.models import MembershipPlan
        from users.models import MemberProfile
        from plans.models import TrainingPlan
        from nutrition.models import NutritionGuideline, PlanNutritionLink

        guideline = NutritionGuideline.objects.create(
            goal_type='muscle_gain',
            title='Guía principal',
            description='Descripción',
        )
        PlanNutritionLink.objects.create(plan=training_plan, guideline=guideline, priority_order=1)

        User = get_user_model()
        other_user = User.objects.create_user(
            username='member_link_other',
            email='member-link-other@test.com',
            password='member123!',
            role='member',
        )
        other_plan = MembershipPlan.objects.create(
            name='Plan Link',
            description='Plan',
            price_monthly=55.00,
            duration_months=1,
        )
        other_profile, _ = MemberProfile.objects.get_or_create(
            user=other_user,
            defaults={'membership_plan': other_plan, 'is_active': True},
        )
        other_training_plan = TrainingPlan.objects.create(
            member=other_profile,
            trainer=trainer_profile,
            name='Plan externo',
            goal='maintenance',
            start_date=training_plan.start_date,
            weeks_duration=4,
            days_per_week=2,
            is_active=True,
        )
        other_guideline = NutritionGuideline.objects.create(
            goal_type='maintenance',
            title='Guía externa',
            description='Descripción externa',
        )
        PlanNutritionLink.objects.create(plan=other_training_plan, guideline=other_guideline, priority_order=1)

        resp = member_client.get('/api/plan-nutrition-links/')

        assert resp.status_code == status.HTTP_200_OK
        results = resp.data.get('results', resp.data)
        assert len(results) == 1
        assert results[0]['plan'] == training_plan.id
