from datetime import date
from io import StringIO

import pytest
from django.core.management import call_command


@pytest.mark.django_db
def test_seed_data_creates_only_first_demo_trainer_and_member():
    from users.models import User
    from billing.models import MemberSubscription, MembershipPlan, PaymentRecord
    from plans.models import TrainingPlan, WorkoutDay

    call_command(
        'seed_data',
        clear=True,
        trainer_password='Clave-Trainer#2026!',
        member_password='Clave-Member#2026!',
        stdout=StringIO(),
    )

    assert User.objects.filter(email='trainer1@gymhub.com', role='trainer').exists()
    assert User.objects.filter(email='member1@gymhub.com', role='member').exists()
    assert not User.objects.filter(email='trainer2@gymhub.com').exists()
    assert not User.objects.filter(email__in=[f'member{i}@gymhub.com' for i in range(2, 21)]).exists()

    member = User.objects.get(email='member1@gymhub.com').memberprofile
    plan = TrainingPlan.objects.get(member=member, is_active=True)
    weekday_codes = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    today_code = weekday_codes[date.today().weekday()]

    assert MembershipPlan.objects.exists()
    assert member.membership_plan_id is None
    assert not MemberSubscription.objects.filter(member=member).exists()
    assert not PaymentRecord.objects.filter(schedule__member=member).exists()
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


@pytest.mark.django_db
def test_restablecer_demo_dry_run_does_not_modify_users():
    from django.contrib.auth import get_user_model

    User = get_user_model()
    extra = User.objects.create_user(
        username='member22',
        email='member22@gymhub.com',
        password='Temporal#2026!',
        role='member',
    )

    output = StringIO()
    call_command('restablecer_demo', stdout=output)

    assert User.objects.filter(pk=extra.pk).exists()
    assert 'Dry-run' in output.getvalue()


@pytest.mark.django_db
def test_restablecer_demo_preserves_real_and_superusers_and_is_idempotent():
    from django.contrib.auth import get_user_model
    from attendance.models import Attendance
    from progress.models import WorkoutSession

    User = get_user_model()
    real_user = User.objects.create_user(
        username='cliente_real',
        email='cliente.real@example.com',
        password='Real-Segura#2026!',
        role='member',
    )
    superuser = User.objects.create_superuser(
        username='admin_real',
        email='admin@example.com',
        password='Admin-Segura#2026!',
    )
    User.objects.create_user(
        username='trainer9',
        email='trainer9@gymhub.com',
        password='Temporal#2026!',
        role='trainer',
    )
    User.objects.create_user(
        username='member37',
        email='member37@gymhub.com',
        password='Temporal#2026!',
        role='member',
    )

    command_options = {
        'yes': True,
        'trainer_password': 'Fuerza-Titan#2026!',
        'member_password': 'Meta-Pulso#2026!',
        'stdout': StringIO(),
    }
    call_command('restablecer_demo', **command_options)

    demo_users = User.objects.filter(
        email__iregex=r'^(trainer|member)[0-9]+@gymhub\.com$'
    ).order_by('email')
    assert list(demo_users.values_list('email', flat=True)) == [
        'member1@gymhub.com',
        'trainer1@gymhub.com',
    ]
    assert User.objects.filter(pk=real_user.pk).exists()
    assert User.objects.filter(pk=superuser.pk).exists()
    assert User.objects.get(email='trainer1@gymhub.com').check_password(
        'Fuerza-Titan#2026!'
    )
    assert User.objects.get(email='member1@gymhub.com').check_password(
        'Meta-Pulso#2026!'
    )

    counts_before = (Attendance.objects.count(), WorkoutSession.objects.count())
    command_options['stdout'] = StringIO()
    call_command('restablecer_demo', **command_options)
    counts_after = (Attendance.objects.count(), WorkoutSession.objects.count())

    assert counts_after == counts_before
    assert User.objects.filter(pk=real_user.pk).exists()
    assert User.objects.filter(pk=superuser.pk).exists()
