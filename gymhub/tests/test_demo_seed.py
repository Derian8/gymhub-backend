from datetime import date
from io import StringIO

import pytest
from django.core.management import call_command


@pytest.mark.django_db
def test_seed_data_creates_only_first_demo_trainer_and_member():
    from users.models import User
    from plans.models import TrainingPlan, WorkoutDay

    call_command('seed_data', clear=True, stdout=StringIO())

    assert User.objects.filter(email='trainer1@gymhub.com', role='trainer').exists()
    assert User.objects.filter(email='member1@gymhub.com', role='member').exists()
    assert not User.objects.filter(email='trainer2@gymhub.com').exists()
    assert not User.objects.filter(email__in=[f'member{i}@gymhub.com' for i in range(2, 21)]).exists()

    member = User.objects.get(email='member1@gymhub.com').memberprofile
    plan = TrainingPlan.objects.get(member=member, is_active=True)
    weekday_codes = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    today_code = weekday_codes[date.today().weekday()]

    assert WorkoutDay.objects.filter(plan=plan, day_of_week=today_code).exists()


@pytest.mark.django_db
def test_prune_demo_users_deletes_only_extra_demo_accounts():
    from django.contrib.auth import get_user_model

    User = get_user_model()
    trainer1 = User.objects.create_user(
        username='trainer1',
        email='trainer1@gymhub.com',
        password='trainer123!',
        role='trainer',
    )
    member1 = User.objects.create_user(
        username='member1',
        email='member1@gymhub.com',
        password='member123!',
        role='member',
    )
    trainer2 = User.objects.create_user(
        username='trainer2',
        email='trainer2@gymhub.com',
        password='trainer123!',
        role='trainer',
    )
    member2 = User.objects.create_user(
        username='member2',
        email='member2@gymhub.com',
        password='member123!',
        role='member',
    )
    real_user = User.objects.create_user(
        username='member_real',
        email='member-real@gymhub.com',
        password='member123!',
        role='member',
    )

    call_command('prune_demo_users', yes=True, stdout=StringIO())

    assert User.objects.filter(pk=trainer1.pk).exists()
    assert User.objects.filter(pk=member1.pk).exists()
    assert not User.objects.filter(pk=trainer2.pk).exists()
    assert not User.objects.filter(pk=member2.pk).exists()
    assert User.objects.filter(pk=real_user.pk).exists()
