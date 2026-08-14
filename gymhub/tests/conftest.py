"""
conftest.py — Fixtures globales para todos los tests.
"""
import pytest
from datetime import date, timedelta
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


def auth_client(user):
    """Retorna un APIClient autenticado para el usuario dado."""
    client = APIClient()
    tokens = get_tokens_for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {tokens["access"]}')
    return client


@pytest.fixture
def api_client():
    client = APIClient()
    response = client.get('/auth/csrf/')
    client.credentials(HTTP_X_CSRFTOKEN=response.data['csrf_token'])
    return client


@pytest.fixture
@pytest.mark.django_db
def admin_user(db):
    return User.objects.create_user(
        username='admin_test',
        email='admin@test.com',
        password='admin123!',
        role='trainer',
        is_staff=True,
        first_name='Admin',
        last_name='Gym',
    )


@pytest.fixture
@pytest.mark.django_db
def admin_client(db, admin_user):
    return auth_client(admin_user)


@pytest.fixture(autouse=True)
def limpiar_cache():
    """Aísla resultados cacheados entre pruebas."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
@pytest.mark.django_db
def membership_plan(db, trainer_profile):
    from billing.models import MembershipPlan
    return MembershipPlan.objects.create(
        trainer=trainer_profile,
        name='Plan Test',
        description='Plan de prueba',
        price=50.00,
        features='Test features',
        is_active=True,
    )


@pytest.fixture
@pytest.mark.django_db
def trainer_user(db):
    user = User.objects.create_user(
        username='trainer_test',
        email='trainer@test.com',
        password='trainer123!',
        role='trainer',
        first_name='Test',
        last_name='Trainer',
    )
    return user


@pytest.fixture
@pytest.mark.django_db
def trainer_profile(db, trainer_user):
    from users.models import TrainerProfile
    profile, _ = TrainerProfile.objects.get_or_create(
        user=trainer_user,
        defaults={'specialization': 'Test', 'bio': 'Test bio', 'certification': 'Test cert'}
    )
    return profile


@pytest.fixture
@pytest.mark.django_db
def trainer_client(db, trainer_user):
    return auth_client(trainer_user)


@pytest.fixture
@pytest.mark.django_db
def member_user(db):
    user = User.objects.create_user(
        username='member_test',
        email='member@test.com',
        password='member123!',
        role='member',
        first_name='Test',
        last_name='Member',
    )
    return user


@pytest.fixture
@pytest.mark.django_db
def member_profile(db, member_user, membership_plan, trainer_profile):
    from users.models import MemberProfile
    profile, _ = MemberProfile.objects.get_or_create(
        user=member_user,
        defaults={
            'trainer_asignado': trainer_profile,
            'membership_plan': membership_plan,
            'join_date': date.today() - timedelta(days=30),
            'is_active': True,
        }
    )
    profile.trainer_asignado = trainer_profile
    profile.save(update_fields=['trainer_asignado'])
    return profile


@pytest.fixture
@pytest.mark.django_db
def member_client(db, member_user):
    return auth_client(member_user)


@pytest.fixture
@pytest.mark.django_db
def training_plan(db, member_profile, trainer_profile):
    from plans.models import TrainingPlan, WorkoutDay, Exercise
    weekday_codes = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    today_index = date.today().weekday()
    day_a_weekday = weekday_codes[today_index]
    day_b_weekday = weekday_codes[(today_index + 1) % 7]
    plan = TrainingPlan.objects.create(
        member=member_profile,
        trainer=trainer_profile,
        name='Plan Test',
        goal='muscle_gain',
        start_date=date.today() - timedelta(days=14),
        weeks_duration=8,
        days_per_week=3,
        is_active=True,
    )
    # Crear WorkoutDays
    wd_a = WorkoutDay.objects.create(plan=plan, name='Pecho y Tríceps', day_label='A', day_of_week=day_a_weekday, order=0)
    wd_b = WorkoutDay.objects.create(plan=plan, name='Espalda y Bíceps', day_label='B', day_of_week=day_b_weekday, order=1)

    # Ejercicios para Día A
    bench = Exercise.objects.create(
        workout_day=wd_a, name='Press de Banca', muscle_group='chest',
        sets=4, reps_range='6-10', weight_suggestion_kg=60.0, rest_seconds=120, order=0
    )
    Exercise.objects.create(
        workout_day=wd_a, name='Press Inclinado', muscle_group='chest',
        sets=3, reps_range='8-12', weight_suggestion_kg=40.0, rest_seconds=90, order=1
    )
    Exercise.objects.create(
        workout_day=wd_b, name='Dominadas', muscle_group='back',
        sets=4, reps_range='6-10', weight_suggestion_kg=None, rest_seconds=120, order=0
    )
    return plan


@pytest.fixture
@pytest.mark.django_db
def workout_day_a(db, training_plan):
    return training_plan.workout_days.filter(day_label='A').first()


@pytest.fixture
@pytest.mark.django_db
def bench_exercise(db, workout_day_a):
    from plans.models import Exercise
    return Exercise.objects.get(workout_day=workout_day_a, name='Press de Banca')


@pytest.fixture
@pytest.mark.django_db
def attendance_record(db, member_profile):
    from attendance.models import Attendance
    return Attendance.objects.create(member=member_profile)


@pytest.fixture
@pytest.mark.django_db
def workout_session(db, member_profile, workout_day_a):
    from progress.models import WorkoutSession
    return WorkoutSession.objects.create(
        member=member_profile,
        workout_day=workout_day_a,
    )


@pytest.fixture
@pytest.mark.django_db
def payment_schedule_and_record(db, member_profile, membership_plan):
    from billing.models import PaymentSchedule, PaymentRecord
    schedule = PaymentSchedule.objects.create(
        member=member_profile,
        plan=membership_plan,
        due_date=date.today() + timedelta(days=15),
        grace_period_days=7,
        is_active=True,
    )
    record = PaymentRecord.objects.create(
        schedule=schedule,
        amount=50.00,
        status='pending',
    )
    return schedule, record


@pytest.fixture
@pytest.mark.django_db
def overdue_payment(db, member_profile, membership_plan):
    """Pago muy vencido (>14 días del grace period) → bloqueará check-in."""
    from billing.models import PaymentSchedule, PaymentRecord
    schedule = PaymentSchedule.objects.create(
        member=member_profile,
        plan=membership_plan,
        due_date=date.today() - timedelta(days=30),
        grace_period_days=7,
        is_active=True,
    )
    record = PaymentRecord.objects.create(
        schedule=schedule,
        amount=50.00,
        status='late',
    )
    return schedule, record
