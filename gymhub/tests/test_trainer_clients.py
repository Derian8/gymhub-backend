import pytest
from rest_framework import status


@pytest.mark.django_db
class TestTrainerClients:
    def test_trainer_can_activate_member_without_creating_membership(self, trainer_client, trainer_profile, membership_plan):
        from billing.models import MemberSubscription, PaymentRecord, PaymentSchedule
        from django.contrib.auth import get_user_model

        member_user = get_user_model().objects.create_user(
            username='cliente_por_activar',
            email='cliente-por-activar@test.com',
            password='member123!',
            role='member',
        )
        member = member_user.memberprofile
        member.trainer_asignado = trainer_profile
        member.is_active = False
        member.save(update_fields=['trainer_asignado', 'is_active'])

        response = trainer_client.post(f'/api/members/{member.id}/activate/', {
            'plan_id': membership_plan.id,
            'agreed_price': '64.90',
        })

        assert response.status_code == status.HTTP_200_OK
        member.refresh_from_db()

        assert member.is_active is True
        assert member.membership_plan_id is None
        assert not MemberSubscription.objects.filter(member=member).exists()
        assert not PaymentSchedule.objects.filter(member=member).exists()
        assert not PaymentRecord.objects.filter(schedule__member=member).exists()

    def test_trainer_can_assign_self_to_unassigned_member(self, trainer_client, membership_plan):
        from django.contrib.auth import get_user_model
        from users.models import MemberProfile

        user_model = get_user_model()
        member_user = user_model.objects.create_user(
            username='cliente_libre',
            email='cliente-libre@test.com',
            password='member123!',
            role='member',
        )
        member = member_user.memberprofile
        member.membership_plan = membership_plan
        member.is_active = True
        member.save(update_fields=['membership_plan', 'is_active'])

        response = trainer_client.post(f'/api/members/{member.id}/assign-trainer/')

        assert response.status_code == status.HTTP_200_OK
        member.refresh_from_db()
        assert member.trainer_asignado is not None
        assert response.data['trainer_asignado'] == member.trainer_asignado_id

    def test_trainer_only_sees_assigned_members_plans(self, trainer_client, member_profile, trainer_profile, membership_plan):
        from datetime import date
        from django.contrib.auth import get_user_model
        from users.models import MemberProfile
        from plans.models import TrainingPlan
        from billing.models import MembershipPlan

        TrainingPlan.objects.create(
            member=member_profile,
            trainer=trainer_profile,
            name='Plan visible',
            goal='muscle_gain',
            start_date=date.today(),
            weeks_duration=8,
            days_per_week=3,
            is_active=True,
        )

        other_user = get_user_model().objects.create_user(
            username='cliente_otro_trainer',
            email='cliente-otro-trainer@test.com',
            password='member123!',
            role='member',
        )
        other_membership = MembershipPlan.objects.create(
            name='Plan externo trainer',
            description='Plan',
            price=60.00,
        )
        other_member = other_user.memberprofile
        other_member.membership_plan = other_membership
        other_member.is_active = True
        other_member.save(update_fields=['membership_plan', 'is_active'])
        TrainingPlan.objects.create(
            member=other_member,
            trainer=trainer_profile,
            name='Plan oculto',
            goal='fat_loss',
            start_date=date.today(),
            weeks_duration=6,
            days_per_week=4,
            is_active=True,
        )

        response = trainer_client.get('/api/plans/')

        assert response.status_code == status.HTTP_200_OK
        results = response.data.get('results', response.data)
        assert all(plan['member'] == member_profile.id for plan in results)

    def test_trainer_only_sees_assigned_members_nutrition(self, trainer_client, training_plan, trainer_profile, membership_plan):
        from django.contrib.auth import get_user_model
        from users.models import MemberProfile
        from plans.models import TrainingPlan
        from nutrition.models import NutritionProfile
        from billing.models import MembershipPlan

        NutritionProfile.objects.create(
            training_plan=training_plan,
            goal_type='muscle_gain',
            calorie_range_min=2200,
            calorie_range_max=2600,
        )

        other_user = get_user_model().objects.create_user(
            username='cliente_nutri_oculto',
            email='cliente-nutri-oculto@test.com',
            password='member123!',
            role='member',
        )
        other_membership = MembershipPlan.objects.create(
            name='Plan nutri externo',
            description='Plan',
            price=65.00,
        )
        other_member = other_user.memberprofile
        other_member.membership_plan = other_membership
        other_member.is_active = True
        other_member.save(update_fields=['membership_plan', 'is_active'])
        other_plan = TrainingPlan.objects.create(
            member=other_member,
            trainer=trainer_profile,
            name='Plan oculto nutricion',
            goal='fat_loss',
            start_date=training_plan.start_date,
            weeks_duration=8,
            days_per_week=3,
            is_active=True,
        )
        NutritionProfile.objects.create(
            training_plan=other_plan,
            goal_type='fat_loss',
            calorie_range_min=1700,
            calorie_range_max=2000,
        )

        response = trainer_client.get('/api/nutrition-profiles/')

        assert response.status_code == status.HTTP_200_OK
        results = response.data.get('results', response.data)
        assert [profile['training_plan'] for profile in results] == [training_plan.id]

    def test_trainer_can_filter_members_by_prescription_status(self, trainer_client, trainer_profile, membership_plan):
        from datetime import date
        from django.contrib.auth import get_user_model
        from plans.models import TrainingPlan

        member_user = get_user_model().objects.create_user(
            username='cliente_sin_plan',
            email='cliente-sin-plan@test.com',
            password='member123!',
            role='member',
        )
        member = member_user.memberprofile
        member.trainer_asignado = trainer_profile
        member.membership_plan = membership_plan
        member.is_active = True
        member.save(update_fields=['trainer_asignado', 'membership_plan', 'is_active'])

        response = trainer_client.get('/api/members/?prescription_status=sin_plan')

        assert response.status_code == status.HTTP_200_OK
        results = response.data.get('results', response.data)
        assert any(item['id'] == member.id for item in results)

        TrainingPlan.objects.create(
            member=member,
            trainer=trainer_profile,
            name='Plan incompleto',
            goal='muscle_gain',
            start_date=date.today(),
            weeks_duration=8,
            days_per_week=3,
            is_active=True,
        )

        response = trainer_client.get('/api/members/?prescription_status=incompleta')

        assert response.status_code == status.HTTP_200_OK
        results = response.data.get('results', response.data)
        assert any(item['id'] == member.id for item in results)
