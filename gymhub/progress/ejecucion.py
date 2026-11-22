"""Ejecución del cliente: prescripción congelada y transiciones por serie."""
import math
from datetime import timedelta

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from attendance.models import Attendance
from plans.models import Exercise, PlantillaDiaEntrenamiento, TrainingPlan
from plans.serializers import CatalogoEjercicioSerializer, ExerciseSerializer
from plans.views import get_today_workout_day
from users.permissions import usa_contexto_cliente
from .models import ExerciseLog, WorkoutSession
from .serializers import WorkoutSessionSerializer
from .views import assert_workout_access, completar_sesion


def cliente_actual(request):
    if not usa_contexto_cliente(request):
        raise PermissionDenied('Selecciona el contexto de cliente para entrenar.')
    return request.user.memberprofile


def entrada_activa(cliente):
    return Attendance.objects.filter(
        member=cliente, attendance_date=timezone.localdate(), check_out_time__isnull=True,
    ).first()


def exigir_entrada(cliente):
    entrada = entrada_activa(cliente)
    if entrada is None:
        raise PermissionDenied('Confirma tu entrada en recepción antes de entrenar.')
    assert_workout_access(cliente, entrada)
    return entrada


def ejercicios_plantilla(dia):
    ejercicios = []
    for item in dia.ejercicios.select_related('catalogo_ejercicio', 'maquina').order_by('orden', 'id'):
        catalogo = CatalogoEjercicioSerializer(item.catalogo_ejercicio).data if item.catalogo_ejercicio_id else {}
        ejercicio = Exercise(
            id=item.id, name=item.nombre, muscle_group=item.grupo_muscular,
            exercise_type=item.tipo_ejercicio, sets=item.series,
            reps_range=item.rango_repeticiones, target_minutes=item.minutos_objetivo,
            duracion_trabajo_segundos=item.duracion_trabajo_segundos,
            rest_seconds=item.descanso_segundos, weight_suggestion_kg=item.peso_sugerido_kg,
            descanso_entre_ejercicios_segundos=item.descanso_entre_ejercicios_segundos,
            weight_suggestion_unit=item.unidad_peso_sugerido,
            technique_notes=item.notas_tecnicas, imagen_referencia_url=item.imagen_referencia_url,
            video_url=item.url_video, machine=item.maquina,
            detalle_catalogo_asignado=dict(catalogo), order=item.orden,
        )
        ejercicios.append(dict(ExerciseSerializer(ejercicio).data))
    return ejercicios


def prescripcion_valida(ejercicios):
    if not ejercicios:
        raise ValidationError('La rutina no tiene ejercicios disponibles.')
    for ejercicio in ejercicios:
        if ejercicio['exercise_type'] == 'timed':
            valida = bool(ejercicio.get('duracion_trabajo_segundos') or ejercicio.get('target_minutes'))
        else:
            valida = bool(ejercicio.get('sets') and ejercicio.get('reps_range'))
        if not valida:
            raise ValidationError(f"El administrador debe completar la prescripción de {ejercicio['name']}.")


class InicioSerializer(serializers.Serializer):
    workout_day_id = serializers.IntegerField(required=False, min_value=1)
    plantilla_dia_id = serializers.IntegerField(required=False, min_value=1)

    def validate(self, attrs):
        if len(attrs) != 1:
            raise serializers.ValidationError('Elige el bloque del plan o una rutina libre.')
        return attrs


class AccionSerializer(serializers.Serializer):
    revision = serializers.IntegerField(min_value=0)
    identificador = serializers.UUIDField()
    accion = serializers.ChoiceField(choices=[
        'comenzar', 'confirmar_serie', 'intervalo_terminado', 'saltar_descanso',
        'omitir_serie', 'omitir_ejercicio', 'pausar', 'reanudar', 'finalizar',
    ])


class EntrenamientoClienteView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cliente = cliente_actual(request)
        if not entrada_activa(cliente):
            return Response({'asistencia_activa': False, 'sesion': None, 'plan': None, 'rutinas': []})
        exigir_entrada(cliente)
        sesion = WorkoutSession.objects.filter(member=cliente, is_completed=False).first()
        plan = TrainingPlan.objects.filter(member=cliente, status='active').order_by('-start_date', '-id').first()
        dia = get_today_workout_day(plan)
        # Una rutina compartida entre administradores no implica publicación al cliente.
        dias = PlantillaDiaEntrenamiento.objects.filter(
            plantilla__esta_activa=True, plantilla__disponible_clientes=True,
        ).select_related('plantilla').prefetch_related('ejercicios__catalogo_ejercicio', 'ejercicios__maquina')
        return Response({
            'asistencia_activa': True,
            'sesion': WorkoutSessionSerializer(sesion).data if sesion else None,
            'plan': {'id': dia.id, 'nombre': plan.name, 'bloque': dia.name,
                     'ejercicios': ExerciseSerializer(dia.exercises.order_by('order', 'id'), many=True).data} if dia else None,
            'rutinas': [{'id': item.id, 'nombre': item.plantilla.nombre, 'bloque': item.nombre,
                         'descripcion': item.plantilla.descripcion,
                         'ejercicios': ejercicios_plantilla(item)} for item in dias],
        })

    def post(self, request):
        cliente = cliente_actual(request)
        datos = InicioSerializer(data=request.data)
        datos.is_valid(raise_exception=True)
        with transaction.atomic():
            # El mismo bloqueo serializa todos los inicios del cliente.
            type(cliente).objects.select_for_update().get(pk=cliente.pk)
            entrada = exigir_entrada(cliente)
            existente = WorkoutSession.objects.filter(member=cliente, is_completed=False).first()
            if existente:
                return Response(incorporar_sesion(existente))
            if 'workout_day_id' in datos.validated_data:
                from plans.models import WorkoutDay
                dia = get_object_or_404(WorkoutDay, pk=datos.validated_data['workout_day_id'],
                                        plan__member=cliente, plan__status='active')
                if get_today_workout_day(dia.plan).id != dia.id:
                    raise ValidationError('Solo puedes iniciar el siguiente bloque del plan.')
                ejercicios = list(ExerciseSerializer(dia.exercises.order_by('order', 'id'), many=True).data)
                nombre, bloque, origen = dia.plan.name, dia.name, 'plan'
            else:
                plantilla_dia = get_object_or_404(
                    PlantillaDiaEntrenamiento, pk=datos.validated_data['plantilla_dia_id'],
                    plantilla__esta_activa=True, plantilla__disponible_clientes=True,
                )
                ejercicios = ejercicios_plantilla(plantilla_dia)
                nombre, bloque, origen = plantilla_dia.plantilla.nombre, plantilla_dia.nombre, 'libre'
                dia = None
            prescripcion_valida(ejercicios)
            sesion = WorkoutSession.objects.create(
                member=cliente, attendance=entrada, workout_day=dia, origen=origen,
                detalle_iniciado=crear_detalle(nombre, bloque, ejercicios),
                progreso_guiado=estado_inicial(),
            )
            return Response(WorkoutSessionSerializer(sesion).data, status=201)


def crear_detalle(nombre, bloque, ejercicios):
    return {'plan_nombre': nombre, 'dia_nombre': bloque, 'prescripcion': ejercicios,
            'ejercicios': [
                {'id': e['id'], 'nombre': e['name'], 'tipo': e['exercise_type'],
                 'series': e['sets'] or 1, 'repeticiones': e['reps_range'],
                 'minutos': e['target_minutes'], 'duracion_trabajo_segundos': e['duracion_trabajo_segundos'],
                 'descanso_segundos': e['rest_seconds']} for e in ejercicios]}


def estado_inicial():
    return {'revision': 0, 'indice': 0, 'fase': 'previa', 'registros': {},
            'restante': 0, 'fin_fase': None, 'pausado': False, 'ultima_accion': None}


def incorporar_sesion(sesion):
    """Incorpora sesiones antiguas conservando las decisiones ya registradas."""
    if not sesion.progreso_guiado:
        ejercicios = list(ExerciseSerializer(sesion.workout_day.exercises.order_by('order', 'id'), many=True).data)
        prescripcion_valida(ejercicios)
        # Recupera la prescripción congelada cuando la sesión antecede al ejecutor.
        for ejercicio in ejercicios:
            copia = next((e for e in sesion.detalle_iniciado.get('ejercicios', []) if e['id'] == ejercicio['id']), {})
            for destino, fuente in [('name', 'nombre'), ('sets', 'series'), ('reps_range', 'repeticiones'),
                                    ('target_minutes', 'minutos'), ('rest_seconds', 'descanso_segundos'),
                                    ('duracion_trabajo_segundos', 'duracion_trabajo_segundos')]:
                if fuente in copia:
                    ejercicio[destino] = copia[fuente]
        sesion.detalle_iniciado = crear_detalle(sesion.workout_day.plan.name, sesion.workout_day.name, ejercicios)
        sesion.progreso_guiado = estado_inicial()
        registros = sesion.progreso_guiado['registros']
        for log in sesion.exercise_logs.all():
            ejercicio = next((e for e in ejercicios if e['id'] == log.exercise_id), None)
            if ejercicio:
                registros[str(log.exercise_id)] = [log.estado] * (ejercicio['sets'] or 1)
        while sesion.progreso_guiado['indice'] < len(ejercicios):
            ejercicio = ejercicios[sesion.progreso_guiado['indice']]
            if str(ejercicio['id']) not in registros:
                break
            sesion.progreso_guiado['indice'] += 1
        if sesion.progreso_guiado['indice'] == len(ejercicios):
            sesion.progreso_guiado['fase'] = 'terminado'
            sesion.motivo_cierre = 'automatica'
            completar_sesion(sesion)
        sesion.save()
    return WorkoutSessionSerializer(sesion).data


def establecer_fase(estado, fase, segundos=0):
    estado.update(fase=fase, restante=segundos, duracion_fase=segundos, pausado=False,
                  fin_fase=(timezone.now() + timedelta(seconds=segundos)).isoformat() if segundos else None)


def duracion(ejercicio):
    return ejercicio.get('duracion_trabajo_segundos') or (ejercicio.get('target_minutes') or 0) * 60


def guardar_registro(sesion, ejercicio, registros):
    if sesion.origen == 'plan':
        realizados = registros.count('realizado')
        ExerciseLog.objects.update_or_create(
            session=sesion, exercise_id=ejercicio['id'],
            defaults={'estado': 'realizado' if realizados else 'omitido',
                      'sets_completed': realizados,
                      # Las repeticiones son prescritas; el cliente confirma la serie, no una medición.
                      'reps_completed': 0,
                      'minutes_completed': (realizados * duracion(ejercicio)) // 60 if ejercicio['exercise_type'] == 'timed' else None},
        )


def resolver_serie(sesion, ejercicio, decision):
    estado = sesion.progreso_guiado
    registros = estado['registros'].setdefault(str(ejercicio['id']), [])
    registros.append(decision)
    guardar_registro(sesion, ejercicio, registros)
    if len(registros) == (ejercicio['sets'] or 1):
        siguiente_ejercicio(sesion, ejercicio.get('descanso_entre_ejercicios_segundos', 0))
    elif ejercicio['rest_seconds']:
        establecer_fase(estado, 'descanso', ejercicio['rest_seconds'])
    else:
        # Incluso sin descanso configurado, damos una señal breve antes de la
        # siguiente serie. Así el cliente no entra a trabajar por sorpresa.
        establecer_fase(estado, 'preparacion', 3)


def siguiente_ejercicio(sesion, descanso=0):
    estado = sesion.progreso_guiado
    estado['indice'] += 1
    if estado['indice'] == len(sesion.detalle_iniciado['prescripcion']):
        establecer_fase(estado, 'terminado')
        sesion.motivo_cierre = 'automatica'
        completar_sesion(sesion)
    else:
        establecer_fase(estado, 'descanso_ejercicio' if descanso else 'previa', descanso)


class AccionEntrenamientoView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        cliente = cliente_actual(request)
        datos = AccionSerializer(data=request.data)
        datos.is_valid(raise_exception=True)
        with transaction.atomic():
            sesion = get_object_or_404(WorkoutSession.objects.select_for_update(), pk=pk, member=cliente)
            if not sesion.progreso_guiado:
                incorporar_sesion(sesion)
            estado = sesion.progreso_guiado
            identificador = str(datos.validated_data['identificador'])
            if estado['ultima_accion'] == identificador:
                return Response(WorkoutSessionSerializer(sesion).data)
            if datos.validated_data['revision'] != estado['revision']:
                return Response({'detail': 'El progreso cambió. Recuperamos la última versión.',
                                 'sesion': WorkoutSessionSerializer(sesion).data}, status=409)
            if sesion.is_completed:
                raise ValidationError('El entrenamiento ya terminó.')
            accion = datos.validated_data['accion']
            # Pausar o finalizar sigue disponible si recepción ya registró la salida.
            if accion not in ('pausar', 'finalizar'):
                exigir_entrada(cliente)
            ejercicio = sesion.detalle_iniciado['prescripcion'][estado['indice']]
            aplicar_accion(sesion, ejercicio, accion)
            estado['revision'] += 1
            estado['ultima_accion'] = identificador
            sesion.save()
            return Response(WorkoutSessionSerializer(sesion).data)


def aplicar_accion(sesion, ejercicio, accion):
    estado = sesion.progreso_guiado
    fase = estado['fase']
    es_tiempo = ejercicio['exercise_type'] == 'timed'
    if fase in ('descanso', 'descanso_ejercicio') and accion in (
        'saltar_descanso', 'intervalo_terminado', 'omitir_ejercicio', 'finalizar',
    ):
        restante = estado['restante']
        if estado['fin_fase']:
            restante = max(0, math.ceil((parse_datetime(estado['fin_fase']) - timezone.now()).total_seconds()))
        estado.setdefault('descansos', []).append({
            'indice': estado['indice'], 'fase': fase,
            'segundos_programados': estado.get('duracion_fase', estado['restante']),
            'segundos_realizados': max(0, estado.get('duracion_fase', estado['restante']) - restante),
        })
    if accion == 'pausar':
        if estado['fin_fase']:
            estado['restante'] = max(0, math.ceil((parse_datetime(estado['fin_fase']) - timezone.now()).total_seconds()))
        estado.update(fin_fase=None, pausado=True)
    elif accion == 'reanudar' and estado['pausado']:
        estado['pausado'] = False
        if fase in ('preparacion', 'descanso', 'descanso_ejercicio') or (fase == 'trabajo' and es_tiempo):
            estado['fin_fase'] = (timezone.now() + timedelta(seconds=estado['restante'])).isoformat()
    elif accion == 'comenzar' and fase == 'previa':
        # La cuenta regresiva es una fase persistida: funciona igual al
        # recuperar la sesión, pausar o cambiar de pantalla.
        establecer_fase(estado, 'preparacion', 3)
    elif accion == 'finalizar':
        for pendiente in sesion.detalle_iniciado['prescripcion'][estado['indice']:]:
            registros = estado['registros'].setdefault(str(pendiente['id']), [])
            registros.extend(['omitido'] * ((pendiente['sets'] or 1) - len(registros)))
            guardar_registro(sesion, pendiente, registros)
        establecer_fase(estado, 'terminado')
        sesion.motivo_cierre = 'anticipada'
        completar_sesion(sesion)
    elif estado['pausado'] and accion != 'omitir_ejercicio':
        raise ValidationError('Reanuda el entrenamiento para continuar.')
    elif accion == 'omitir_ejercicio':
        registros = estado['registros'].setdefault(str(ejercicio['id']), [])
        registros.extend(['omitido'] * ((ejercicio['sets'] or 1) - len(registros)))
        guardar_registro(sesion, ejercicio, registros)
        siguiente_ejercicio(sesion)
    elif accion == 'omitir_serie' and fase in ('trabajo', 'preparacion'):
        resolver_serie(sesion, ejercicio, 'omitido')
    elif accion == 'confirmar_serie' and fase == 'trabajo' and not es_tiempo:
        resolver_serie(sesion, ejercicio, 'realizado')
    elif accion == 'saltar_descanso' and fase in ('descanso', 'descanso_ejercicio'):
        establecer_fase(estado, 'previa' if fase == 'descanso_ejercicio' else 'preparacion', 0 if fase == 'descanso_ejercicio' else 3)
    elif accion == 'intervalo_terminado' and estado['fin_fase'] and parse_datetime(estado['fin_fase']) <= timezone.now():
        if fase == 'descanso_ejercicio':
            establecer_fase(estado, 'previa')
        elif fase == 'preparacion':
            establecer_fase(estado, 'trabajo', duracion(ejercicio) if es_tiempo else 0)
        elif fase == 'descanso':
            establecer_fase(estado, 'preparacion', 3)
        elif fase == 'trabajo' and es_tiempo:
            resolver_serie(sesion, ejercicio, 'realizado')
        else:
            raise ValidationError('No hay un intervalo activo.')
    else:
        raise ValidationError('Esta acción no corresponde al paso actual.')
