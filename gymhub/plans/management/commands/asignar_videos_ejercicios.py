from django.core.management.base import BaseCommand
from django.db import transaction

from plans.models import Exercise


# Videos públicos de demostración. Cada enlace se asigna por nombre exacto a
# ejercicios que ya aparecen en rutinas; no se agregan movimientos nuevos.
VIDEOS_POR_EJERCICIO = {
    'Abducción de Cadera Acostado de Lado': (
        'https://www.youtube.com/watch?v=HvsO3sFwemE',
        'Dr. of Physical Therapy: side-lying hip abduction',
    ),
    'Apertura con máquina': (
        'https://www.youtube.com/shorts/O-WcETzUhAQ',
        'SEQD: pec deck chest fly',
    ),
    'Balanceo con kettlebell': (
        'https://www.youtube.com/watch?v=HXVrtSMbQxI',
        'CrossFit: kettlebell swing demo',
    ),
    'Curl de bíceps': (
        'https://www.youtube.com/watch?v=in7PaeYlhrM',
        'Mind Pump TV: dumbbell biceps curl',
    ),
    'Curl de pierna': (
        'https://www.youtube.com/watch?v=zDszHA7GnLY',
        'FITTR: leg curl machine',
    ),
    'Dead bug': (
        'https://www.youtube.com/watch?v=v9nD3xQ8DPQ',
        'Move Well Chiropractic: dead bug',
    ),
    'Elevaciones laterales': (
        'https://www.youtube.com/watch?v=v_ZkxWzYnMc',
        'Jeff Nippard: dumbbell lateral raise',
    ),
    'Extensión de rodilla': (
        'https://www.youtube.com/shorts/m65nFSXoZI0',
        'SEQD: leg extension machine',
    ),
    'Hip trust': (
        'https://www.youtube.com/watch?v=_dm2tzA1Mg4',
        'Annie Miller: hip thrust demo',
    ),
    'Jalón al pecho': (
        'https://www.youtube.com/watch?v=SALxEARiMkw',
        'ATHLEAN-X: lat pulldown form',
    ),
    'Peso muerto': (
        'https://www.youtube.com/watch?v=Z6gcRfPNcZo',
        'NASM: barbell deadlift',
    ),
    'Prensa de piernas': (
        'https://www.youtube.com/watch?v=ahaJTts1f3s',
        'Gerardi Performance: leg press machine',
    ),
    'Press de banca': (
        'https://www.youtube.com/watch?v=CayG6UYqL8g',
        'NASM: barbell bench press',
    ),
    'Sentadillas con barra': (
        'https://www.youtube.com/watch?v=-bJIpOq-LWk',
        'NASM: barbell back squat',
    ),
}


class Command(BaseCommand):
    help = 'Asigna demostraciones de YouTube a ejercicios asignados sin video.'

    @transaction.atomic
    def handle(self, *args, **options):
        total = 0
        for nombre, (url, canal) in VIDEOS_POR_EJERCICIO.items():
            ejercicios = Exercise.objects.filter(
                name__iexact=nombre,
                video_url='',
            )
            cantidad = ejercicios.update(video_url=url)
            total += cantidad
            estado = f'{cantidad} asignación(es)' if cantidad else 'sin cambios'
            self.stdout.write(f'{nombre}: {estado} · {canal}')

        self.stdout.write(self.style.SUCCESS(
            f'Videos asignados: {total}. Los demás ejercicios siguen pendientes.'
        ))
