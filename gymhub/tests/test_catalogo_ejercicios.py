from datetime import date
import json

import pytest
from django.core.management import call_command


@pytest.mark.django_db
def test_trainer_can_search_spanish_exercise_catalog(trainer_client):
    from plans.models import CatalogoEjercicio

    CatalogoEjercicio.objects.create(
        identificador_origen='0001',
        nombre='Abdominal parcial',
        categoria='cintura',
        equipo='peso corporal',
        instrucciones_es='Eleva el torso de forma controlada.',
        pasos_es=['Acuéstate.', 'Eleva el torso.', 'Baja lentamente.'],
    )

    response = trainer_client.get('/api/catalogo-ejercicios/', {'search': 'abdominal'})

    assert response.status_code == 200
    exercise = response.data['results'][0]
    assert exercise['nombre'] == 'Abdominal parcial'
    assert exercise['instrucciones_es']
    assert len(exercise['pasos_es']) == 3


@pytest.mark.django_db
def test_importer_accepts_repdb_spanish_schema(tmp_path):
    from plans.models import CatalogoEjercicio

    source = tmp_path / 'exercises.json'
    source.write_text(json.dumps({
        'exercises': [{
            'id': 'ab-wheel-rollout',
            'name_es': 'Rueda Abdominal',
            'description_es': 'Ejercicio para el core.',
            'instructions_es': ['Arrodíllate.', 'Rueda hacia adelante.'],
            'tips_es': ['Mantén la espalda neutra.'],
            'category': 'strength',
            'body_part': 'core',
            'equipment': 'ab_wheel',
            'primary_muscles': ['rectus_abdominis'],
            'secondary_muscles': ['obliques'],
            'images': {'flat': {'peak': 'images/flat/ab-wheel-rollout-peak.webp'}},
        }],
    }), encoding='utf-8')

    call_command('importar_catalogo_ejercicios', str(source))

    exercise = CatalogoEjercicio.objects.get(identificador_origen='ab-wheel-rollout')
    assert exercise.nombre == 'Rueda Abdominal'
    assert exercise.pasos_es == ['Arrodíllate.', 'Rueda hacia adelante.', 'Mantén la espalda neutra.']
    assert exercise.imagen_url.endswith('images/flat/ab-wheel-rollout-peak.webp')
    assert exercise.animacion_url == ''
    assert exercise.atribucion_media == 'Exercise data by RepDB (repdb.co)'


@pytest.mark.django_db
def test_cycle_advances_only_when_session_is_completed(
    member_client, member_profile, trainer_profile, membership_plan
):
    from attendance.models import Attendance
    from plans.models import Exercise, TrainingPlan, WorkoutDay
    from progress.models import WorkoutSession

    plan = TrainingPlan.objects.create(
        member=member_profile,
        trainer=trainer_profile,
        name='Ciclo de fuerza',
        goal='muscle_gain',
        start_date=date.today(),
        weeks_duration=8,
        days_per_week=3,
        status='active',
        modo_ejecucion='cycle',
    )
    day_a = WorkoutDay.objects.create(plan=plan, name='Torso', day_label='A', order=0)
    day_b = WorkoutDay.objects.create(plan=plan, name='Piernas', day_label='B', order=1)
    Exercise.objects.create(workout_day=day_a, name='Press', muscle_group='chest', sets=3, reps_range='8-12')
    Exercise.objects.create(workout_day=day_b, name='Sentadilla', muscle_group='legs', sets=3, reps_range='8-12')
    attendance = Attendance.objects.create(member=member_profile, attendance_date=date.today())
    session = WorkoutSession.objects.create(member=member_profile, workout_day=day_a, attendance=attendance)

    response = member_client.patch(f'/api/workout-sessions/{session.id}/complete/', {}, format='json')

    assert response.status_code == 200
    plan.refresh_from_db()
    assert plan.indice_bloque_actual == 1
