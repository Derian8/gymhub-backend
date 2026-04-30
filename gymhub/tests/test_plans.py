"""
test_plans.py — Tests de planes de entrenamiento y sesiones.
"""
import pytest
from datetime import date, timedelta
from django.utils import timezone
from rest_framework import status


@pytest.mark.django_db
class TestTrainingPlans:
    def test_trainer_can_create_plan_without_sending_trainer_field(
        self, trainer_client, member_profile, trainer_profile
    ):
        member_profile.trainer_asignado = trainer_profile
        member_profile.save(update_fields=['trainer_asignado'])

        resp = trainer_client.post('/api/plans/', {
            'member': member_profile.id,
            'name': 'Plan fuerza base',
            'goal': 'muscle_gain',
            'start_date': '2026-03-26',
            'end_date': '2026-05-21',
            'weeks_duration': 8,
            'days_per_week': 4,
            'is_active': True,
        }, format='json')

        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['member'] == member_profile.id
        assert resp.data['trainer'] == trainer_profile.id

    def test_trainer_can_delete_plan_and_cascade_content(self, trainer_client, training_plan):
        plan_id = training_plan.id
        day_ids = list(training_plan.workout_days.values_list('id', flat=True))

        resp = trainer_client.delete(f'/api/plans/{plan_id}/')

        assert resp.status_code == status.HTTP_204_NO_CONTENT

        from plans.models import Exercise, TrainingPlan, WorkoutDay

        assert not TrainingPlan.objects.filter(id=plan_id).exists()
        assert WorkoutDay.objects.filter(id__in=day_ids).count() == 0
        assert Exercise.objects.filter(workout_day_id__in=day_ids).count() == 0

    def test_member_cannot_delete_plan(self, member_client, training_plan):
        resp = member_client.delete(f'/api/plans/{training_plan.id}/')

        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_trainer_can_create_plan_with_maintenance_goal(
        self, trainer_client, member_profile, trainer_profile
    ):
        member_profile.trainer_asignado = trainer_profile
        member_profile.save(update_fields=['trainer_asignado'])

        resp = trainer_client.post('/api/plans/', {
            'member': member_profile.id,
            'name': 'Plan mantenimiento',
            'goal': 'maintenance',
            'start_date': '2026-03-26',
            'end_date': '2026-05-21',
            'weeks_duration': 8,
            'days_per_week': 3,
            'is_active': True,
        }, format='json')

        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['goal'] == 'maintenance'


@pytest.mark.django_db
class TestTodayWorkout:
    def test_today_workout_returns_weekday_assigned_day(self, member_client, training_plan):
        """today-workout retorna el WorkoutDay asignado al día real de la semana."""
        resp = member_client.get(f'/api/plans/{training_plan.id}/today-workout/')
        assert resp.status_code == status.HTTP_200_OK
        assert 'exercises' in resp.data
        assert 'day_label' in resp.data

    def test_today_workout_has_exercises(self, member_client, training_plan):
        """El workout de hoy incluye ejercicios."""
        resp = member_client.get(f'/api/plans/{training_plan.id}/today-workout/')
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data['exercises']) > 0

    def test_today_workout_weekday_consistency(self, member_client, training_plan):
        """La resolución por día fijo es consistente: mismo plan, mismo día → mismo resultado."""
        resp1 = member_client.get(f'/api/plans/{training_plan.id}/today-workout/')
        resp2 = member_client.get(f'/api/plans/{training_plan.id}/today-workout/')
        assert resp1.data['id'] == resp2.data['id']


@pytest.mark.django_db
class TestWorkoutSessions:
    def test_create_workout_session(self, member_client, member_profile, workout_day_a):
        """POST /api/workout-sessions/ crea sesión."""
        resp = member_client.post('/api/workout-sessions/', {
            'workout_day_id': workout_day_a.id,
        })
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['is_completed'] is False
        assert resp.data['workout_day'] == workout_day_a.id

    def test_complete_workout_session(self, member_client, workout_session):
        """PATCH /api/workout-sessions/{id}/complete/ marca como completada con timestamp."""
        resp = member_client.patch(
            f'/api/workout-sessions/{workout_session.id}/complete/',
            {'overall_feeling': 4},
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['is_completed'] is True
        assert resp.data['completed_at'] is not None

    def test_complete_session_sets_timestamp(self, member_client, workout_session):
        """El completed_at se fija al momento de completar."""
        before = timezone.now()
        resp = member_client.patch(
            f'/api/workout-sessions/{workout_session.id}/complete/', {}
        )
        after = timezone.now()
        assert resp.status_code == status.HTTP_200_OK

        from progress.models import WorkoutSession
        session = WorkoutSession.objects.get(id=workout_session.id)
        assert session.completed_at >= before
        assert session.completed_at <= after


@pytest.mark.django_db
class TestBulkExerciseLogs:
    def test_member_bulk_exercise_logs_ignores_manipulated_structure(
        self, member_client, workout_session, workout_day_a
    ):
        from plans.models import Exercise
        from progress.models import ExerciseLog

        exercise = Exercise.objects.filter(workout_day=workout_day_a).first()
        assert exercise is not None

        resp = member_client.post('/api/exercise-logs/bulk/', {
            'session_id': workout_session.id,
            'logs': [
                {
                    'exercise_id': exercise.id,
                    'sets_completed': 99,
                    'reps_completed': 1,
                    'weight_used_kg': 62.5,
                    'rpe': 8,
                },
            ],
        }, format='json')

        assert resp.status_code == status.HTTP_201_CREATED
        log = ExerciseLog.objects.get(session=workout_session, exercise=exercise)
        assert log.sets_completed == exercise.sets
        assert log.reps_completed == int(exercise.reps_range.split('-')[0])

    def test_member_bulk_exercise_logs_accepts_minimal_payload(
        self, member_client, workout_session, workout_day_a
    ):
        from plans.models import Exercise

        exercise = Exercise.objects.filter(workout_day=workout_day_a).first()
        assert exercise is not None

        resp = member_client.post('/api/exercise-logs/bulk/', {
            'session_id': workout_session.id,
            'logs': [
                {
                    'exercise_id': exercise.id,
                    'weight_used_kg': 55.0,
                    'rpe': 7,
                },
            ],
        }, format='json')

        assert resp.status_code == status.HTTP_201_CREATED

    def test_member_bulk_exercise_logs_accepts_timed_exercise_minutes(
        self, member_client, workout_session, workout_day_a
    ):
        from plans.models import Exercise
        from progress.models import ExerciseLog

        exercise = Exercise.objects.create(
            workout_day=workout_day_a,
            name='Bici estatica',
            muscle_group='cardio',
            exercise_type='timed',
            sets=None,
            reps_range='',
            target_minutes=20,
            rest_seconds=30,
            order=5,
        )

        resp = member_client.post('/api/exercise-logs/bulk/', {
            'session_id': workout_session.id,
            'logs': [
                {
                    'exercise_id': exercise.id,
                    'minutes_completed': 18,
                    'weight_used_kg': 99,
                },
            ],
        }, format='json')

        assert resp.status_code == status.HTTP_201_CREATED
        log = ExerciseLog.objects.get(session=workout_session, exercise=exercise)
        assert log.minutes_completed == 18
        assert log.weight_used_kg is None
        assert log.sets_completed == 0
        assert log.reps_completed == 0

    def test_member_bulk_exercise_logs_rejects_timed_exercise_without_minutes(
        self, member_client, workout_session, workout_day_a
    ):
        from plans.models import Exercise

        exercise = Exercise.objects.create(
            workout_day=workout_day_a,
            name='Bici estatica',
            muscle_group='cardio',
            exercise_type='timed',
            sets=None,
            reps_range='',
            target_minutes=20,
            rest_seconds=30,
            order=6,
        )

        resp = member_client.post('/api/exercise-logs/bulk/', {
            'session_id': workout_session.id,
            'logs': [
                {
                    'exercise_id': exercise.id,
                },
            ],
        }, format='json')

        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_bulk_exercise_logs_atomic_transaction(
        self, member_client, workout_session, workout_day_a
    ):
        """POST /api/exercise-logs/bulk/ crea todos los logs en transacción atómica."""
        from plans.models import Exercise
        from progress.models import ExerciseLog

        exercises = list(Exercise.objects.filter(workout_day=workout_day_a)[:2])
        assert len(exercises) >= 2, "Necesita al menos 2 ejercicios"

        initial_count = ExerciseLog.objects.count()

        resp = member_client.post('/api/exercise-logs/bulk/', {
            'session_id': workout_session.id,
            'logs': [
                {
                    'exercise_id': exercises[0].id,
                    'sets_completed': 4,
                    'reps_completed': 10,
                    'weight_used_kg': 60.0,
                    'rpe': 7,
                },
                {
                    'exercise_id': exercises[1].id,
                    'sets_completed': 3,
                    'reps_completed': 12,
                    'weight_used_kg': 40.0,
                    'rpe': 6,
                },
            ],
        }, format='json')
        assert resp.status_code == status.HTTP_201_CREATED
        assert ExerciseLog.objects.count() == initial_count + 2

    def test_bulk_exercise_logs_rollback_on_invalid_exercise(
        self, member_client, workout_session, workout_day_a
    ):
        """Si un ejercicio no existe, toda la transacción hace rollback."""
        from plans.models import Exercise
        from progress.models import ExerciseLog

        exercises = list(Exercise.objects.filter(workout_day=workout_day_a)[:1])
        initial_count = ExerciseLog.objects.count()

        resp = member_client.post('/api/exercise-logs/bulk/', {
            'session_id': workout_session.id,
            'logs': [
                {
                    'exercise_id': exercises[0].id,
                    'sets_completed': 4,
                    'reps_completed': 10,
                    'weight_used_kg': 60.0,
                },
                {
                    'exercise_id': 99999,  # No existe
                    'sets_completed': 3,
                    'reps_completed': 12,
                },
            ],
        }, format='json')
        assert resp.status_code in (status.HTTP_400_BAD_REQUEST, status.HTTP_500_INTERNAL_SERVER_ERROR)
        # Rollback: sin nuevos logs
        assert ExerciseLog.objects.count() == initial_count

    def test_bulk_exercise_logs_rejects_exercise_outside_session_workout_day(
        self, member_client, workout_session, workout_day_a, training_plan
    ):
        from plans.models import Exercise, WorkoutDay

        foreign_day = WorkoutDay.objects.create(
            plan=training_plan,
            name='Dia externo',
            day_label='B',
            day_of_week='sun',
            order=9,
        )
        foreign_exercise = Exercise.objects.create(
            workout_day=foreign_day,
            name='Remo externo',
            muscle_group='back',
            sets=3,
            reps_range='10-12',
            rest_seconds=75,
            order=0,
        )

        resp = member_client.post('/api/exercise-logs/bulk/', {
            'session_id': workout_session.id,
            'logs': [
                {
                    'exercise_id': foreign_exercise.id,
                    'weight_used_kg': 40.0,
                    'rpe': 6,
                },
            ],
        }, format='json')

        assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestWeeklyView:
    def test_weekly_view_returns_7_days(self, member_client, training_plan):
        resp = member_client.get(f'/api/plans/{training_plan.id}/weekly-view/')
        assert resp.status_code == status.HTTP_200_OK
        assert 'week_days' in resp.data
        assert len(resp.data['week_days']) == 7


@pytest.mark.django_db
class TestGymMachines:
    def test_trainer_can_create_gym_machine(self, trainer_client):
        resp = trainer_client.post('/api/gym-machines/', {
            'name': 'Prensa 45',
            'category': 'Pierna',
            'notes': 'Uso general',
            'is_active': True,
        }, format='json')

        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['name'] == 'Prensa 45'
        assert resp.data['category'] == 'Pierna'

    def test_member_cannot_create_gym_machine(self, member_client):
        resp = member_client.post('/api/gym-machines/', {
            'name': 'Smith',
            'category': 'Pecho',
            'notes': '',
            'is_active': True,
        }, format='json')

        assert resp.status_code == status.HTTP_403_FORBIDDEN
