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

    def test_trainer_can_create_complete_draft_plan_from_general_screen(self, trainer_client, member_profile):
        from plans.models import GymMachine, TrainingPlan

        machine = GymMachine.objects.create(name='Prensa 45', category='Pierna', is_active=True)

        resp = trainer_client.post('/api/plans/create-complete/', {
            'member': member_profile.id,
            'name': 'Base fuerza general',
            'goal': 'muscle_gain',
            'start_date': '2026-07-13',
            'weeks_duration': 4,
            'days_per_week': 3,
            'status': 'draft',
            'level': 'intermediate',
            'conflict_strategy': 'keep',
            'days': [{
                'name': 'Torso',
                'day_label': 'A',
                'day_of_week': 'mon',
                'order': 0,
                'exercises': [{
                    'name': 'Press banca',
                    'muscle_group': 'chest',
                    'exercise_type': 'strength',
                    'sets': 3,
                    'reps_range': '8-10',
                    'machine': machine.id,
                    'rest_seconds': 90,
                    'order': 0,
                }],
            }],
        }, format='json')

        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['status'] == 'draft'
        assert resp.data['is_active'] is False
        assert resp.data['end_date'] == '2026-08-10'
        plan = TrainingPlan.objects.get(id=resp.data['id'])
        assert plan.workout_days.count() == 1
        exercise = plan.workout_days.first().exercises.get()
        assert exercise.machine_id == machine.id

        day_resp = trainer_client.get(f'/api/workout-days/{plan.workout_days.first().id}/')
        assert day_resp.status_code == status.HTTP_200_OK
        assert day_resp.data['exercises'][0]['machine'] == machine.id
        assert day_resp.data['exercises'][0]['machine_detail']['name'] == 'Prensa 45'

    def test_complete_plan_rejects_end_date_before_start_date(self, trainer_client, member_profile):
        resp = trainer_client.post('/api/plans/create-complete/', {
            'member': member_profile.id,
            'name': 'Fechas malas',
            'goal': 'general',
            'start_date': '2026-07-13',
            'end_date': '2026-06-27',
            'weeks_duration': 4,
            'days_per_week': 3,
            'status': 'draft',
            'level': 'intermediate',
            'conflict_strategy': 'keep',
            'days': [],
        }, format='json')

        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert 'end_date' in resp.data

    def test_complete_active_plan_requires_conflict_strategy_when_member_has_active_plan(self, trainer_client, training_plan):
        resp = trainer_client.post('/api/plans/create-complete/', {
            'member': training_plan.member_id,
            'name': 'Nuevo activo',
            'goal': 'general',
            'start_date': '2026-07-13',
            'weeks_duration': 4,
            'days_per_week': 3,
            'status': 'active',
            'level': 'intermediate',
            'conflict_strategy': 'keep',
            'days': [],
        }, format='json')

        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert 'member' in resp.data

    def test_complete_plan_replace_active_finishes_previous_plan(self, trainer_client, training_plan):
        from plans.models import TrainingPlan

        resp = trainer_client.post('/api/plans/create-complete/', {
            'member': training_plan.member_id,
            'name': 'Reemplazo activo',
            'goal': 'general',
            'start_date': '2026-07-13',
            'weeks_duration': 4,
            'days_per_week': 3,
            'status': 'active',
            'level': 'intermediate',
            'conflict_strategy': 'replace_active',
            'days': [],
        }, format='json')

        assert resp.status_code == status.HTTP_201_CREATED
        training_plan.refresh_from_db()
        assert training_plan.status == 'finished'
        assert training_plan.is_active is False
        assert TrainingPlan.objects.get(id=resp.data['id']).is_active is True

    def test_complete_plan_is_atomic_when_nested_exercise_invalid(self, trainer_client, member_profile):
        from plans.models import TrainingPlan

        before = TrainingPlan.objects.count()
        resp = trainer_client.post('/api/plans/create-complete/', {
            'member': member_profile.id,
            'name': 'Debe fallar',
            'goal': 'general',
            'start_date': '2026-07-13',
            'weeks_duration': 4,
            'days_per_week': 3,
            'status': 'draft',
            'level': 'intermediate',
            'conflict_strategy': 'keep',
            'days': [{
                'name': 'Torso',
                'day_label': 'A',
                'day_of_week': 'mon',
                'order': 0,
                'exercises': [{
                    'name': 'Press banca',
                    'muscle_group': 'chest',
                    'exercise_type': 'strength',
                    'sets': 3,
                    'reps_range': '',
                    'rest_seconds': 90,
                    'order': 0,
                }],
            }],
        }, format='json')

        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert TrainingPlan.objects.count() == before

    def test_trainer_cannot_create_complete_plan_for_unassigned_member(self, trainer_client, membership_plan):
        from django.contrib.auth import get_user_model
        from users.models import MemberProfile

        user = get_user_model().objects.create_user(
            username='other_member_plan',
            email='other-member-plan@test.com',
            password='member123!',
            role='member',
        )
        other_member = MemberProfile.objects.get(user=user)
        other_member.membership_plan = membership_plan
        other_member.trainer_asignado = None
        other_member.save(update_fields=['membership_plan', 'trainer_asignado'])

        resp = trainer_client.post('/api/plans/create-complete/', {
            'member': other_member.id,
            'name': 'No permitido',
            'goal': 'general',
            'start_date': '2026-07-13',
            'weeks_duration': 4,
            'days_per_week': 3,
            'status': 'draft',
            'level': 'intermediate',
            'conflict_strategy': 'keep',
            'days': [],
        }, format='json')

        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_trainer_can_duplicate_finish_and_archive_plan(self, trainer_client, training_plan):
        duplicate = trainer_client.post(f'/api/plans/{training_plan.id}/duplicate/', {}, format='json')
        assert duplicate.status_code == status.HTTP_201_CREATED
        assert duplicate.data['status'] == 'draft'

        finish = trainer_client.post(f'/api/plans/{training_plan.id}/finish/')
        assert finish.status_code == status.HTTP_200_OK
        assert finish.data['status'] == 'finished'
        assert finish.data['is_active'] is False

        archive = trainer_client.post(f"/api/plans/{duplicate.data['id']}/archive/")
        assert archive.status_code == status.HTTP_200_OK
        assert archive.data['status'] == 'archived'

    def test_plans_summary_returns_real_counts(self, trainer_client, training_plan, member_profile, trainer_profile):
        from plans.models import TrainingPlan

        TrainingPlan.objects.create(
            member=member_profile,
            trainer=trainer_profile,
            name='Borrador',
            goal='general',
            start_date=date.today(),
            weeks_duration=2,
            days_per_week=2,
            status='draft',
        )

        resp = trainer_client.get('/api/plans/summary/')

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['active'] >= 1
        assert resp.data['draft'] >= 1
        assert 'members_without_active_plan' in resp.data


@pytest.mark.django_db
class TestTodayWorkout:
    def test_today_workout_returns_weekday_assigned_day(self, member_client, training_plan):
        """today-workout retorna el WorkoutDay asignado al día real de la semana."""
        resp = member_client.get(f'/api/plans/{training_plan.id}/today-workout/')
        assert resp.status_code == status.HTTP_200_OK
        assert 'exercises' in resp.data
        assert 'day_label' in resp.data
        assert 'today_session_id' in resp.data
        assert 'today_session_completed' in resp.data
        assert 'today_session_started' in resp.data

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

    def test_today_workout_uses_local_business_day(self, member_client, training_plan, monkeypatch):
        from django.utils import timezone as django_timezone
        from plans.models import WorkoutDay
        from plans import views as plan_views
        from users import services as user_services

        local_saturday = date(2026, 5, 2)
        expected_day, _ = WorkoutDay.objects.get_or_create(
            plan=training_plan,
            day_of_week='sat',
            defaults={
                'name': 'Sabado fuerte',
                'day_label': 'C',
                'order': 2,
            },
        )

        monkeypatch.setattr(plan_views.timezone, 'localdate', lambda: local_saturday)
        monkeypatch.setattr(user_services.timezone, 'localdate', lambda: local_saturday)
        monkeypatch.setattr(django_timezone, 'localdate', lambda: local_saturday)

        resp = member_client.get(f'/api/plans/{training_plan.id}/today-workout/')

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['id'] == expected_day.id


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

    def test_complete_workout_session_can_create_physical_progress_log(self, member_client, workout_session):
        from progress.models import ProgressLog

        resp = member_client.patch(
            f'/api/workout-sessions/{workout_session.id}/complete/',
            {
                'overall_feeling': 4,
                'body_weight_kg': 82.5,
                'waist_cm': 88,
            },
        )

        assert resp.status_code == status.HTTP_200_OK
        log = ProgressLog.objects.get(member=workout_session.member)
        assert log.weight_kg == 82.5
        assert log.waist_cm == 88
        assert log.source == 'manual'

    def test_complete_workout_session_without_measurements_does_not_create_progress_log(self, member_client, workout_session):
        from progress.models import ProgressLog

        resp = member_client.patch(
            f'/api/workout-sessions/{workout_session.id}/complete/',
            {'overall_feeling': 4},
        )

        assert resp.status_code == status.HTTP_200_OK
        assert not ProgressLog.objects.filter(member=workout_session.member).exists()

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

    def test_reuses_open_session_for_same_workout_day_on_same_date(self, member_client, workout_day_a):
        first_resp = member_client.post('/api/workout-sessions/', {
            'workout_day_id': workout_day_a.id,
        })
        second_resp = member_client.post('/api/workout-sessions/', {
            'workout_day_id': workout_day_a.id,
        })

        assert first_resp.status_code == status.HTTP_201_CREATED
        assert second_resp.status_code == status.HTTP_200_OK
        assert second_resp.data['id'] == first_resp.data['id']
        assert second_resp.data['is_completed'] is False

    def test_cannot_recreate_completed_session_for_same_workout_day_on_same_date(self, member_client, workout_day_a):
        created_resp = member_client.post('/api/workout-sessions/', {
            'workout_day_id': workout_day_a.id,
        })
        complete_resp = member_client.patch(
            f"/api/workout-sessions/{created_resp.data['id']}/complete/",
            {'overall_feeling': 4},
        )
        repeated_resp = member_client.post('/api/workout-sessions/', {
            'workout_day_id': workout_day_a.id,
        })

        assert created_resp.status_code == status.HTTP_201_CREATED
        assert complete_resp.status_code == status.HTTP_200_OK
        assert repeated_resp.status_code == status.HTTP_400_BAD_REQUEST
        assert 'ya fue completada' in repeated_resp.data['error']

    def test_today_workout_reports_completed_session_state(self, member_client, training_plan):
        today_weekday = date.today().strftime('%a').lower()[:3]
        workout_day = training_plan.workout_days.get(day_of_week=today_weekday)

        create_resp = member_client.post('/api/workout-sessions/', {
            'workout_day_id': workout_day.id,
        })
        member_client.patch(
            f"/api/workout-sessions/{create_resp.data['id']}/complete/",
            {'overall_feeling': 5},
        )

        resp = member_client.get(f'/api/plans/{training_plan.id}/today-workout/')

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['today_session_id'] == create_resp.data['id']
        assert resp.data['today_session_completed'] is True
        assert resp.data['today_session_started'] is False

    def test_today_workout_includes_previous_completed_exercise_log(self, member_client, training_plan):
        from progress.models import WorkoutSession, ExerciseLog

        today_weekday = date.today().strftime('%a').lower()[:3]
        workout_day = training_plan.workout_days.get(day_of_week=today_weekday)
        exercise = workout_day.exercises.filter(exercise_type='strength').first()
        previous_session = WorkoutSession.objects.create(
            member=training_plan.member,
            workout_day=workout_day,
            is_completed=True,
            completed_at=timezone.now() - timedelta(days=7),
        )
        ExerciseLog.objects.create(
            session=previous_session,
            exercise=exercise,
            sets_completed=3,
            reps_completed=8,
            weight_used_kg=55,
            rpe=7,
        )
        exercise.weight_suggestion_kg = 60
        exercise.save(update_fields=['weight_suggestion_kg'])

        resp = member_client.get(f'/api/plans/{training_plan.id}/today-workout/')

        assert resp.status_code == status.HTTP_200_OK
        payload = next(item for item in resp.data['exercises'] if item['id'] == exercise.id)
        assert payload['previous_log']['weight_used_kg'] == 55
        assert payload['previous_log']['reps_completed'] == 8
        assert payload['previous_log']['weight_delta_kg'] == 5


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

    def test_weekly_view_marks_rest_days_explicitly(self, member_client, training_plan):
        resp = member_client.get(f'/api/plans/{training_plan.id}/weekly-view/')
        assert resp.status_code == status.HTTP_200_OK

        rest_days = [day for day in resp.data['week_days'] if day['is_rest_day']]
        workout_days = [day for day in resp.data['week_days'] if day['has_workout']]

        assert rest_days
        assert workout_days
        assert all(day['workout_day_name'] is None for day in rest_days)
        assert all(day['workout_day_id'] is None for day in rest_days)


@pytest.mark.django_db
class TestWorkoutDayWeekdayValidation:
    def test_trainer_cannot_duplicate_weekday_in_same_plan(self, trainer_client, training_plan):
        existing_day = training_plan.workout_days.order_by('order').first()
        assert existing_day is not None

        resp = trainer_client.post('/api/workout-days/', {
            'plan': training_plan.id,
            'name': 'Bloque duplicado',
            'day_label': 'C',
            'day_of_week': existing_day.day_of_week,
            'order': 9,
        }, format='json')

        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert 'day_of_week' in resp.data or 'non_field_errors' in resp.data


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
