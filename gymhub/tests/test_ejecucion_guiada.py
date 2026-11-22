import uuid
from datetime import timedelta

import pytest
from django.utils import timezone
from freezegun import freeze_time

from plans.models import PlantillaEntrenamiento, PlantillaDiaEntrenamiento, PlantillaEjercicio
from progress.models import WorkoutSession

pytestmark = pytest.mark.django_db
URL = '/api/entrenamiento-cliente/'


@pytest.fixture
def contexto(member_client, member_user, member_profile, attendance_record, training_plan, mocker):
    mocker.patch('progress.ejecucion.assert_workout_access')
    member_client.force_authenticate(member_user)
    training_plan.status = 'active'
    training_plan.save()
    return member_client, training_plan.workout_days.first()


def iniciar(contexto):
    cliente, dia = contexto
    respuesta = cliente.post(URL, {'workout_day_id': dia.id}, format='json')
    assert respuesta.status_code == 201, respuesta.data
    return respuesta.data


def actuar(cliente, sesion, accion, identificador=None):
    return cliente.post(f'{URL}{sesion["id"]}/accion/', {
        'accion': accion, 'revision': sesion['progreso_guiado']['revision'],
        'identificador': identificador or str(uuid.uuid4()),
    }, format='json')


def test_entrada_exige_asistencia_abierta(contexto, attendance_record):
    cliente, dia = contexto
    attendance_record.check_out_time = timezone.now()
    attendance_record.save()
    assert cliente.get(URL).data['asistencia_activa'] is False
    assert cliente.post(URL, {'workout_day_id': dia.id}).status_code == 403


def test_fuerza_confirma_serie_y_descansa_sin_cronometrar_trabajo(contexto):
    cliente, dia = contexto
    with freeze_time(timezone.now()) as reloj:
        dia.plan.member.attendances.update(attendance_date=timezone.localdate())
        sesion = iniciar(contexto)
        assert sesion['progreso_guiado']['fase'] == 'previa'
        sesion = actuar(cliente, sesion, 'comenzar').data
        assert sesion['progreso_guiado']['fase'] == 'preparacion'
        assert sesion['progreso_guiado']['restante'] == 3
        reloj.tick(timedelta(seconds=3))
        sesion = actuar(cliente, sesion, 'intervalo_terminado').data
        assert sesion['progreso_guiado']['fase'] == 'trabajo'
        assert sesion['progreso_guiado']['fin_fase'] is None
        sesion = actuar(cliente, sesion, 'confirmar_serie').data
        assert sesion['progreso_guiado']['fase'] == 'descanso'
        assert sesion['progreso_guiado']['restante'] == dia.exercises.first().rest_seconds
        assert sesion['exercise_logs'][0]['sets_completed'] == 1
        sesion = actuar(cliente, sesion, 'saltar_descanso').data
        assert sesion['progreso_guiado']['fase'] == 'preparacion'
        reloj.tick(timedelta(seconds=3))
        sesion = actuar(cliente, sesion, 'intervalo_terminado').data
        assert sesion['progreso_guiado']['fase'] == 'trabajo'


def test_reintento_y_revision_no_duplican_series(contexto):
    cliente, _ = contexto
    with freeze_time(timezone.now()) as reloj:
        sesion = actuar(cliente, iniciar(contexto), 'comenzar').data
        reloj.tick(timedelta(seconds=3))
        sesion = actuar(cliente, sesion, 'intervalo_terminado').data
        identificador = str(uuid.uuid4())
        primera = actuar(cliente, sesion, 'confirmar_serie', identificador)
        repetida = actuar(cliente, sesion, 'confirmar_serie', identificador)
        assert repetida.data == primera.data
        assert actuar(cliente, sesion, 'confirmar_serie').status_code == 409
        assert primera.data['exercise_logs'][0]['sets_completed'] == 1


def test_finalizar_conserva_series_parciales(contexto):
    cliente, _ = contexto
    with freeze_time(timezone.now()) as reloj:
        sesion = actuar(cliente, iniciar(contexto), 'comenzar').data
        reloj.tick(timedelta(seconds=3))
        sesion = actuar(cliente, sesion, 'intervalo_terminado').data
        sesion = actuar(cliente, sesion, 'confirmar_serie').data
        sesion = actuar(cliente, sesion, 'finalizar').data
        assert sesion['is_completed']
        assert sesion['motivo_cierre'] == 'anticipada'
        assert sesion['exercise_logs'][0]['sets_completed'] == 1
        registros = list(sesion['progreso_guiado']['registros'].values())
        assert registros[0].count('realizado') == 1
        assert registros[0].count('omitido') == 3


def test_saltar_ejercicio_pausado_conserva_series_y_no_duplica(contexto):
    cliente, dia = contexto
    with freeze_time(timezone.now()) as reloj:
        sesion = actuar(cliente, iniciar(contexto), 'comenzar').data
        reloj.tick(timedelta(seconds=3))
        sesion = actuar(cliente, sesion, 'intervalo_terminado').data
        sesion = actuar(cliente, sesion, 'confirmar_serie').data
        sesion = actuar(cliente, sesion, 'pausar').data
        identificador = str(uuid.uuid4())
        salto = actuar(cliente, sesion, 'omitir_ejercicio', identificador)
        assert salto.status_code == 200, salto.data
        progreso = salto.data['progreso_guiado']
        assert progreso['indice'] == 1
        assert progreso['fase'] == 'previa'
        registros = progreso['registros'][str(dia.exercises.first().id)]
        assert registros.count('realizado') == 1
        assert registros.count('omitido') == dia.exercises.first().sets - 1
        assert actuar(cliente, sesion, 'omitir_ejercicio', identificador).data == salto.data


def test_saltar_ultimo_ejercicio_pausado_cierra_sin_contarlo_realizado(contexto):
    cliente, dia = contexto
    dia.exercises.exclude(pk=dia.exercises.first().pk).delete()
    sesion = actuar(cliente, iniciar(contexto), 'pausar').data
    salto = actuar(cliente, sesion, 'omitir_ejercicio')
    assert salto.status_code == 200, salto.data
    assert salto.data['is_completed']
    assert salto.data['exercise_logs'][0]['sets_completed'] == 0
    assert salto.data['exercise_logs'][0]['estado'] == 'omitido'


def test_tiempo_preparacion_trabajo_descanso_y_cierre_automatico(contexto):
    cliente, dia = contexto
    dia.exercises.exclude(pk=dia.exercises.first().pk).delete()
    ejercicio = dia.exercises.first()
    ejercicio.exercise_type = 'timed'
    ejercicio.sets = 2
    ejercicio.reps_range = ''
    ejercicio.duracion_trabajo_segundos = 20
    ejercicio.rest_seconds = 10
    ejercicio.save()
    with freeze_time(timezone.now()) as reloj:
        # La asistencia del fixture puede ser de otro día que el reloj congelado.
        dia.plan.member.attendances.update(attendance_date=timezone.localdate())
        sesion = actuar(cliente, iniciar(contexto), 'comenzar').data
        assert sesion['progreso_guiado']['fase'] == 'preparacion'
        assert actuar(cliente, sesion, 'confirmar_serie').status_code == 400
        assert actuar(cliente, sesion, 'intervalo_terminado').status_code == 400
        for segundos, fase in [(3, 'trabajo'), (20, 'descanso'), (10, 'preparacion'), (3, 'trabajo'), (20, 'terminado')]:
            reloj.tick(timedelta(seconds=segundos))
            respuesta = actuar(cliente, sesion, 'intervalo_terminado')
            assert respuesta.status_code == 200, respuesta.data
            sesion = respuesta.data
            assert sesion['progreso_guiado']['fase'] == fase
        assert sesion['is_completed']
        assert sesion['exercise_logs'][0]['sets_completed'] == 2


def test_pausa_recupera_tiempo_sin_contar_series(contexto):
    cliente, dia = contexto
    with freeze_time(timezone.now()) as reloj:
        sesion = actuar(cliente, iniciar(contexto), 'comenzar').data
        reloj.tick(timedelta(seconds=3))
        sesion = actuar(cliente, sesion, 'intervalo_terminado').data
        sesion = actuar(cliente, sesion, 'confirmar_serie').data
        reloj.tick(timedelta(seconds=12))
        sesion = actuar(cliente, sesion, 'pausar').data
        assert sesion['progreso_guiado']['restante'] == dia.exercises.first().rest_seconds - 12
        reloj.tick(timedelta(hours=1))
        recuperada = cliente.get(URL).data['sesion']
        assert recuperada['progreso_guiado'] == sesion['progreso_guiado']
        assert recuperada['exercise_logs'][0]['sets_completed'] == 1
        sesion = actuar(cliente, sesion, 'reanudar').data
        assert sesion['progreso_guiado']['fin_fase']


@pytest.fixture
def bloque_libre(trainer_profile):
    plantilla = PlantillaEntrenamiento.objects.create(trainer=trainer_profile, nombre='Libre', disponible_clientes=True)
    dia = PlantillaDiaEntrenamiento.objects.create(plantilla=plantilla, nombre='Movilidad', etiqueta_dia='A')
    PlantillaEjercicio.objects.create(dia=dia, nombre='Sentadilla', grupo_muscular='legs', series=1, rango_repeticiones='10')
    return dia


def test_libre_conserva_plan_e_historial(contexto, bloque_libre):
    cliente, dia = contexto
    respuesta = cliente.post(URL, {'plantilla_dia_id': bloque_libre.id}, format='json')
    assert respuesta.status_code == 201, respuesta.data
    sesion = respuesta.data
    assert sesion['origen'] == 'libre'
    assert sesion['workout_day'] is None
    with freeze_time(timezone.now()) as reloj:
        dia.plan.member.attendances.update(attendance_date=timezone.localdate())
        sesion = actuar(cliente, sesion, 'comenzar').data
        reloj.tick(timedelta(seconds=3))
        sesion = actuar(cliente, sesion, 'intervalo_terminado').data
        sesion = actuar(cliente, sesion, 'confirmar_serie').data
        assert sesion['is_completed']
    dia.plan.refresh_from_db()
    assert dia.plan.indice_bloque_actual == 0
    assert cliente.get(URL).data['plan']['id'] == dia.id
    assert cliente.get(f'/api/workout-sessions/{sesion["id"]}/').status_code == 200


def test_biblioteca_solo_publicadas_y_activas(contexto, bloque_libre):
    cliente, _ = contexto
    assert len(cliente.get(URL).data['rutinas']) == 1
    bloque_libre.plantilla.disponible_clientes = False
    bloque_libre.plantilla.save()
    assert cliente.get(URL).data['rutinas'] == []
    assert cliente.post(URL, {'plantilla_dia_id': bloque_libre.id}).status_code == 404


def test_una_sesion_abierta_y_prescripcion_inmutable(contexto, bloque_libre):
    cliente, dia = contexto
    sesion = iniciar(contexto)
    dia.exercises.update(sets=18, reps_range='40')
    respuesta = cliente.post(URL, {'plantilla_dia_id': bloque_libre.id}, format='json')
    assert respuesta.status_code == 200
    assert respuesta.data['id'] == sesion['id']
    assert respuesta.data['detalle_iniciado'] == sesion['detalle_iniciado']
    assert WorkoutSession.objects.filter(is_completed=False).count() == 1


def test_otro_cliente_no_puede_modificar_sesion(contexto, api_client, django_user_model, membership_plan):
    from users.models import MemberProfile
    usuario = django_user_model.objects.create_user(username='otro', password='clave', role='member')
    MemberProfile.objects.get_or_create(user=usuario, defaults={'membership_plan': membership_plan})
    sesion = iniciar(contexto)
    api_client.force_authenticate(usuario)
    assert actuar(api_client, sesion, 'comenzar').status_code == 404


def test_no_permite_saltar_por_endpoints_anteriores(contexto):
    cliente, dia = contexto
    sesion = iniciar(contexto)
    assert cliente.post(f'/api/workout-sessions/{sesion["id"]}/progreso-ejercicio/',
                        {'exercise_id': dia.exercises.first().id, 'estado': 'realizado'}).status_code == 400
    assert cliente.patch(f'/api/workout-sessions/{sesion["id"]}/complete/', {}, format='json').status_code == 400


def test_descanso_entre_ejercicios_vuelve_a_demostracion(contexto):
    cliente, dia = contexto
    primero = dia.exercises.first()
    primero.sets = 1
    primero.descanso_entre_ejercicios_segundos = 30
    primero.save()
    with freeze_time(timezone.now()) as reloj:
        dia.plan.member.attendances.update(attendance_date=timezone.localdate())
        sesion = actuar(cliente, iniciar(contexto), 'comenzar').data
        reloj.tick(timedelta(seconds=3))
        sesion = actuar(cliente, sesion, 'intervalo_terminado').data
        sesion = actuar(cliente, sesion, 'confirmar_serie').data
        assert sesion['progreso_guiado']['fase'] == 'descanso_ejercicio'
        assert sesion['progreso_guiado']['restante'] == 30
        sesion = actuar(cliente, sesion, 'saltar_descanso').data
        assert sesion['progreso_guiado']['fase'] == 'previa'
        assert sesion['progreso_guiado']['indice'] == 1
        assert not sesion['is_completed']


def test_no_exige_plan_para_rutina_libre(contexto, bloque_libre):
    cliente, dia = contexto
    dia.plan.status = 'finished'
    dia.plan.save()
    assert cliente.get(URL).data['plan'] is None
    assert cliente.post(URL, {'plantilla_dia_id': bloque_libre.id}).status_code == 201


def test_membresia_bloqueada_impide_ejecucion(contexto, mocker):
    from rest_framework.exceptions import PermissionDenied
    cliente, dia = contexto
    mocker.patch('progress.ejecucion.assert_workout_access', side_effect=PermissionDenied('Membresía pendiente'))
    assert cliente.get(URL).status_code == 403
    assert cliente.post(URL, {'workout_day_id': dia.id}).status_code == 403


def test_admin_configura_publicacion_y_descansos(admin_client, bloque_libre):
    respuesta = admin_client.patch(f'/api/plan-templates/{bloque_libre.plantilla_id}/',
                                   {'disponible_clientes': False}, format='json')
    assert respuesta.status_code == 200, respuesta.data
    assert respuesta.data['disponible_clientes'] is False
    from plans.serializers import PlantillaEjercicioSerializer
    ejercicio = bloque_libre.ejercicios.first()
    datos = PlantillaEjercicioSerializer(ejercicio, data={'descanso_entre_ejercicios_segundos': 25}, partial=True)
    assert datos.is_valid(), datos.errors
    assert datos.save().descanso_entre_ejercicios_segundos == 25


def test_rechaza_prescripcion_incompleta(contexto):
    cliente, dia = contexto
    dia.exercises.update(sets=None, reps_range='')
    assert cliente.post(URL, {'workout_day_id': dia.id}).status_code == 400
