import pytest
from django.utils import timezone
from rest_framework import status


@pytest.mark.django_db
class TestClasses:
    def test_trainer_only_sees_own_classes(self, trainer_client, trainer_profile):
        from django.contrib.auth import get_user_model
        from users.models import TrainerProfile
        from classes.models import GymClass

        GymClass.objects.create(
            trainer=trainer_profile,
            name='Clase propia',
            schedule=timezone.now(),
            max_capacity=15,
        )

        User = get_user_model()
        other_trainer_user = User.objects.create_user(
            username='trainer_other_class',
            email='trainer-other-class@test.com',
            password='trainer123!',
            role='trainer',
        )
        other_trainer_profile, _ = TrainerProfile.objects.get_or_create(
            user=other_trainer_user,
            defaults={'specialization': 'Yoga', 'bio': 'Bio', 'certification': 'Cert'},
        )
        GymClass.objects.create(
            trainer=other_trainer_profile,
            name='Clase ajena',
            schedule=timezone.now(),
            max_capacity=20,
        )

        resp = trainer_client.get('/api/classes/')

        assert resp.status_code == status.HTTP_200_OK
        results = resp.data.get('results', resp.data)
        assert len(results) == 1
        assert results[0]['name'] == 'Clase propia'

    def test_member_cannot_create_gym_class(self, member_client, trainer_profile):
        resp = member_client.post('/api/classes/', {
            'trainer': trainer_profile.id,
            'name': 'Clase inválida',
            'schedule': timezone.now().isoformat(),
            'max_capacity': 10,
            'status': 'active',
        })

        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_member_only_sees_own_enrollments(self, member_client, member_profile, trainer_profile, membership_plan):
        from django.contrib.auth import get_user_model
        from users.models import MemberProfile
        from classes.models import GymClass, ClassEnrollment

        gym_class = GymClass.objects.create(
            trainer=trainer_profile,
            name='Crossfit',
            schedule=timezone.now(),
            max_capacity=12,
        )
        own_enrollment = ClassEnrollment.objects.create(member=member_profile, gym_class=gym_class)

        User = get_user_model()
        other_user = User.objects.create_user(
            username='member_other_enrollment',
            email='member-other-enrollment@test.com',
            password='member123!',
            role='member',
        )
        other_profile, _ = MemberProfile.objects.get_or_create(
            user=other_user,
            defaults={'membership_plan': membership_plan, 'is_active': True},
        )
        ClassEnrollment.objects.create(member=other_profile, gym_class=gym_class)

        resp = member_client.get('/api/class-enrollments/')

        assert resp.status_code == status.HTTP_200_OK
        results = resp.data.get('results', resp.data)
        assert [item['id'] for item in results] == [own_enrollment.id]
