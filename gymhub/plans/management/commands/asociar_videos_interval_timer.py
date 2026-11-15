import re
import unicodedata

from django.core.management.base import BaseCommand
from django.db import transaction

from plans.models import CatalogoEjercicio, PlantillaEjercicio, PlantillaEntrenamiento


# Enlaces leídos del reproductor de YouTube abierto desde cada ficha de
# ejercicio de Interval Timer. Los lados derecho/izquierdo comparten ficha.
VIDEOS_POR_EJERCICIO = {
    'Dead Bug': 'ozlmVocjtcw',
    'Reverse Crunches': 'LZrt1yW2w5s',
    'V Crunch': '-fbwFsRcH5o',
    'Crunches': 'BfkVua4xLpE',
    'Flutter Kicks': 'DXQYMKtB1qE',
    'Reverse Crunches with leg raised': 'Z_YeGFwxOko',
    'Plank Leg Up': 'dLAHhjiLiYw',
    'Cobras': 'yCvhg0EtudQ',
    'Squats': 'PiEtHBWixhk',
    'Glute Kickback Right': '-ruJdstnd2U',
    'Glute Kickback Left': '-ruJdstnd2U',
    'Donkey Kicks Right': 'CvKOEW8ZX30',
    'Donkey Kicks Left': 'CvKOEW8ZX30',
    'Bird Dog': 'RJi-QuhWG-k',
    'Knee Push Ups': 'Z-6e9bkjsww',
    'Superman': 'fwJUMzHWjqc',
    'Mountain Climber': 'c4oXHyWlFEc',
    'Tricep Dips': '7qn3Iy15JEA',
    'High Stepping': 'bD9afjFQu9M',
}


def normalizar(valor):
    texto = unicodedata.normalize('NFKD', valor or '')
    texto = texto.encode('ascii', 'ignore').decode('ascii').lower()
    return re.sub(r'[^a-z0-9]+', ' ', texto).strip()


class Command(BaseCommand):
    help = (
        'Asocia los videos verificados de Interval Timer a las fichas del '
        'catálogo que usan sus rutinas, sin reemplazar videos existentes.'
    )

    @transaction.atomic
    def handle(self, *args, **options):
        ids_catalogo = set(
            CatalogoEjercicio.objects.filter(
                identificador_origen__startswith='interval-timer:'
            ).values_list('id', flat=True)
        )
        ids_catalogo.update(
            PlantillaEjercicio.objects.filter(
                dia__plantilla__nombre__icontains='Interval Timer',
                catalogo_ejercicio__isnull=False,
            ).values_list('catalogo_ejercicio_id', flat=True)
        )

        ejercicios = CatalogoEjercicio.objects.filter(id__in=ids_catalogo)
        por_nombre = {}
        for ejercicio in ejercicios:
            por_nombre.setdefault(normalizar(ejercicio.nombre), []).append(ejercicio)

        actualizados = 0
        conservados = 0
        no_encontrados = []
        for nombre, video_id in VIDEOS_POR_EJERCICIO.items():
            coincidencias = por_nombre.get(normalizar(nombre), [])
            if not coincidencias:
                no_encontrados.append(nombre)
                continue

            url = f'https://www.youtube.com/watch?v={video_id}'
            for ejercicio in coincidencias:
                if ejercicio.video_url:
                    conservados += 1
                    continue
                ejercicio.video_url = url
                ejercicio.save(update_fields=['video_url'])
                actualizados += 1

        self.stdout.write(self.style.SUCCESS(
            f'Videos de Interval Timer asignados: {actualizados}; '
            f'videos existentes conservados: {conservados}; '
            f'ejercicios sin ficha coincidente: {len(no_encontrados)}.'
        ))
        if no_encontrados:
            self.stdout.write('Sin ficha: ' + ', '.join(no_encontrados))
