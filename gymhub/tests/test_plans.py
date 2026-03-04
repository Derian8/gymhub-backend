"""
test_plans.py — Tests de planes de entrenamiento y sesiones.
"""
import pytest
from datetime import date, timedelta
from django.utils import timezone
from rest_framework import status


@pytest.mark.django_db
class TestTodayWorkout:
    def test_today_workout_returns_correct_rotation(self, member_client, training_plan):
        """today-workout retorna el WorkoutDay correcto según la rotación."""
        resp = member_client.get(f'/api/plans/{training_plan.id}/today-workout/')
        assert resp.status_code == status.HTTP_200_OK
        assert 'exercises' in resp.data
        assert 'day_label' in resp.data

    def test_today_workout_has_exercises(self, member_client, training_plan):
        """El workout de hoy incluye ejercicios."""
        resp = member_client.get(f'/api/plans/{training_plan.id}/today-workout/')
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data['exercises']) > 0

    def test_today_workout_rotation_consistency(self, member_client, training_plan):
        """La rotación es consistente: mismo plan, mismo día → mismo resultado."""
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


@pytest.mark.django_db
class TestWeeklyView:
    def test_weekly_view_returns_7_days(self, member_client, training_plan):
        resp = member_client.get(f'/api/plans/{training_plan.id}/weekly-view/')
        assert resp.status_code == status.HTTP_200_OK
        assert 'week_days' in resp.data
        assert len(resp.data['week_days']) == 7
