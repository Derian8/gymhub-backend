import re
import unicodedata

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from nutrition.models import NutritionProfile, PlanNutritionLink
from plans.models import (
    CatalogoEjercicio,
    Exercise,
    PlantillaDiaEntrenamiento,
    PlantillaEjercicio,
    PlantillaEntrenamiento,
    TrainingPlan,
    WorkoutDay,
)
from progress.models import ExerciseLog, WorkoutSession
from django.contrib.auth import get_user_model


RUTINAS = [
    {
        'nombre': 'Abs — Interval Timer',
        'categoria': 'Abdomen',
        'objetivo': 'endurance',
        'nivel': 'beginner',
        'ejercicios': [
            ('Dead Bug', 'core'),
            ('Reverse Crunches', 'abs'),
            ('V Crunch', 'abs'),
            ('Crunches', 'abs'),
            ('Flutter Kicks', 'abs'),
            ('Reverse Crunches with leg raised', 'abs'),
            ('Plank Leg Up', 'core'),
            ('Cobras', 'lower_back'),
        ],
    },
    {
        'nombre': 'Lower body — Interval Timer',
        'categoria': 'Piernas y glúteos',
        'objetivo': 'muscle_gain',
        'nivel': 'beginner',
        'ejercicios': [
            ('Dead Bug', 'core'),
            ('Squats', 'quadriceps'),
            ('Glute Kickback Right', 'glutes'),
            ('Glute Kickback Left', 'glutes'),
            ('Donkey Kicks Right', 'glutes'),
            ('Donkey Kicks Left', 'glutes'),
            ('Squats', 'quadriceps'),
            ('Plank Leg Up', 'core'),
            ('Bird Dog', 'core'),
            ('Plank Leg Up', 'core'),
            ('Bird Dog', 'core'),
        ],
    },
    {
        'nombre': 'Upper body — Interval Timer',
        'categoria': 'Tren superior',
        'objetivo': 'muscle_gain',
        'nivel': 'intermediate',
        'ejercicios': [
            ('Bird Dog', 'core'),
            ('Knee Push Ups', 'chest'),
            ('Plank Leg Up', 'core'),
            ('Superman', 'lower_back'),
            ('Mountain Climber', 'full_body'),
            ('Tricep Dips', 'triceps'),
            ('Mountain Climber', 'full_body'),
            ('Tricep Dips', 'triceps'),
            ('Cobras', 'lower_back'),
        ],
    },
    {
        'nombre': 'HIIT — Interval Timer',
        'categoria': 'HIIT y cuerpo completo',
        'objetivo': 'endurance',
        'nivel': 'intermediate',
        'ejercicios': [
            ('Mountain Climber', 'full_body'),
            ('Knee Push Ups', 'chest'),
            ('Reverse Crunches', 'abs'),
            ('Mountain Climber', 'full_body'),
            ('Knee Push Ups', 'chest'),
            ('Reverse Crunches', 'abs'),
            ('Rest - 30 sec', None),
            ('High Stepping', 'cardio'),
            ('Squats', 'quadriceps'),
            ('Plank Leg Up', 'core'),
            ('High Stepping', 'cardio'),
            ('Squats', 'quadriceps'),
            ('Plank Leg Up', 'core'),
            ('High Stepping', 'cardio'),
            ('Squats', 'quadriceps'),
            ('Plank Leg Up', 'core'),
            ('Cobras', 'lower_back'),
        ],
    },
]

EQUIPOS_POR_CATEGORIA = {
    'core': ('Abdomen', 'abdomen'),
    'abs': ('Abdomen', 'abdomen'),
    'quadriceps': ('Piernas y glúteos', 'piernas'),
    'glutes': ('Piernas y glúteos', 'piernas'),
    'chest': ('Tren superior', 'tren superior'),
    'triceps': ('Tren superior', 'tren superior'),
    'lower_back': ('Core y espalda', 'espalda'),
    'full_body': ('HIIT y cuerpo completo', 'cuerpo completo'),
    'cardio': ('HIIT y cuerpo completo', 'cardio'),
}


def normalizar(valor):
    texto = unicodedata.normalize('NFKD', valor or '').encode('ascii', 'ignore').decode('ascii').lower()
    return re.sub(r'[^a-z0-9]+', ' ', texto).strip()


class Command(BaseCommand):
    help = (
        'Elimina las rutinas, plantillas e historial de entrenamiento actuales, '
        'conserva catálogo/media y nutrición, y crea cuatro plantillas de ejemplo.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirmar-borrado',
            action='store_true',
            help='Confirma el borrado irreversible de rutinas, plantillas y sesiones.',
        )

    def handle(self, *args, **options):
        if not options['confirmar_borrado']:
            raise CommandError(
                'Operación destructiva. Revisa el alcance y vuelve a ejecutar '
                'con --confirmar-borrado.'
            )

        User = get_user_model()
        entrenador = User.objects.filter(is_staff=True, role='admin').order_by('id').first()
        if not entrenador:
            raise CommandError('No hay administrador para crear las plantillas compartidas.')

        with transaction.atomic():
            # Eliminar logs explícitamente hace el alcance del borrado verificable.
            ExerciseLog.objects.all().delete()
            WorkoutSession.objects.all().delete()
            Exercise.objects.all().delete()
            WorkoutDay.objects.all().delete()
            PlantillaEntrenamiento.objects.all().delete()

            # NutritionProfile y PlanNutritionLink requieren un TrainingPlan padre.
            # Se conservan como registros archivados sin bloques ni ejercicios.
            ids_con_nutricion = set(NutritionProfile.objects.values_list('training_plan_id', flat=True))
            ids_con_nutricion.update(PlanNutritionLink.objects.values_list('plan_id', flat=True))
            planes_con_nutricion = TrainingPlan.objects.filter(id__in=ids_con_nutricion)
            planes_con_nutricion.update(
                name='Registro nutricional conservado',
                status='archived',
                is_active=False,
                archived_at=timezone.now(),
                finished_at=None,
                notes='',
            )
            TrainingPlan.objects.exclude(id__in=ids_con_nutricion).delete()

            catalogo = self._preparar_catalogo()
            for rutina in RUTINAS:
                self._crear_plantilla(entrenador, rutina, catalogo)

        resumen = {
            'rutinas_eliminadas': 'todas las asignadas y archivadas',
            'plantillas_eliminadas': 'todas las anteriores',
            'sesiones_eliminadas': 'todas',
            'logs_eliminados': 'todos',
            'planes_archivados_para_conservar_nutricion': len(ids_con_nutricion),
            'plantillas_de_ejemplo': len(RUTINAS),
            'ejercicios_unicos': len(catalogo),
        }
        self.stdout.write(self.style.SUCCESS(f'Reemplazo completado: {resumen}'))

    def _preparar_catalogo(self):
        existentes = list(CatalogoEjercicio.objects.all())
        por_nombre = {}
        for ejercicio in existentes:
            por_nombre.setdefault(normalizar(ejercicio.nombre), ejercicio)

        resultado = {}
        claves = {
            nombre: grupo
            for rutina in RUTINAS
            for nombre, grupo in rutina['ejercicios']
            if grupo
        }
        for nombre, grupo in claves.items():
            actual = por_nombre.get(normalizar(nombre))
            if actual:
                # No modificar los medios existentes; solo reutilizar la ficha.
                resultado[nombre] = actual
                continue

            categoria, parte_cuerpo = EQUIPOS_POR_CATEGORIA[grupo]
            identificador = f'interval-timer:{normalizar(nombre).replace(" ", "-")}'
            actual, _ = CatalogoEjercicio.objects.get_or_create(
                identificador_origen=identificador,
                defaults={
                    'nombre': nombre,
                    'categoria': categoria,
                    'parte_cuerpo': parte_cuerpo,
                    'equipo': 'peso corporal',
                    'musculo_objetivo': categoria,
                    'grupo_muscular': parte_cuerpo,
                    'grupo_muscular_plan': grupo,
                    'musculos_secundarios': [],
                    'instrucciones_es': '',
                    'pasos_es': [],
                    'imagen_url': '',
                    'animacion_url': '',
                    'video_url': '',
                    'atribucion_media': 'Nombre tomado de rutina de ejemplo Interval Timer; sin medios importados.',
                    'version_origen': 'Interval Timer observed 1.6.2',
                    'esta_activo': True,
                    'es_catalogo_base': True,
                },
            )
            resultado[nombre] = actual
        return resultado

    def _crear_plantilla(self, entrenador, rutina, catalogo):
        descripcion = (
            f"Ejemplo basado en la secuencia observada de Interval Timer. "
            f"Categoría: {rutina['categoria']}. Prescripción inicial de gimnasio: "
            '3 series de 10–12 repeticiones y 60 segundos de descanso; '
            'ajusta la carga y las repeticiones con el instructor.'
        )
        plantilla = PlantillaEntrenamiento.objects.create(
            trainer=entrenador,
            nombre=rutina['nombre'],
            descripcion=descripcion,
            objetivo=rutina['objetivo'],
            nivel_adherencia_recomendado='medium',
            dias_por_semana_sugeridos=3,
            esta_activa=True,
            es_compartida=True,
            modo_ejecucion='cycle',
        )
        dia = PlantillaDiaEntrenamiento.objects.create(
            plantilla=plantilla,
            nombre=rutina['categoria'],
            etiqueta_dia='A',
            dia_semana=None,
            orden=0,
        )

        posicion = 0
        ultimo_ejercicio = None
        for nombre, grupo in rutina['ejercicios']:
            if nombre.startswith('Rest - '):
                segundos = int(nombre.rsplit(' ', 2)[1])
                if ultimo_ejercicio:
                    ultimo_ejercicio.descanso_segundos = segundos
                    ultimo_ejercicio.save(update_fields=['descanso_segundos'])
                continue

            ejercicio_catalogo = catalogo[nombre]
            ultimo_ejercicio = PlantillaEjercicio.objects.create(
                dia=dia,
                catalogo_ejercicio=ejercicio_catalogo,
                nombre=nombre,
                grupo_muscular=grupo,
                tipo_ejercicio='strength',
                series=3,
                rango_repeticiones='10-12',
                minutos_objetivo=None,
                peso_sugerido_kg=None,
                unidad_peso_sugerido='kg',
                descanso_segundos=60,
                notas_tecnicas='',
                orden=posicion,
            )
            posicion += 1
