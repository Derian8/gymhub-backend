import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from plans.models import CatalogoEjercicio


class Command(BaseCommand):
    help = 'Importa el catálogo RepDB en español desde exercises.json.'

    def add_arguments(self, parser):
        parser.add_argument('archivo_json', help='Ruta al exercises.json de RepDB')
        parser.add_argument('--version-origen', default='RepDB/exercise-dataset')
        parser.add_argument('--base-media-url', default='https://exercise-dataset.com')
        parser.add_argument(
            '--sin-imagenes', action='store_true',
            help='Importa solo los datos e instrucciones, sin ilustraciones WebP.',
        )

    def handle(self, *args, **options):
        archivo = Path(options['archivo_json'])
        if not archivo.is_file():
            raise CommandError(f'No existe el archivo {archivo}.')

        try:
            registros = json.loads(archivo.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError) as exc:
            raise CommandError(f'No se pudo leer el JSON: {exc}') from exc
        if not isinstance(registros, dict) or not isinstance(registros.get('exercises'), list):
            raise CommandError('Se espera el exercises.json de RepDB con la propiedad "exercises".')

        base_media_url = options['base_media_url'].rstrip('/')
        incluir_imagenes = bool(base_media_url and not options['sin_imagenes'])
        creados = actualizados = 0
        for item in registros['exercises']:
            identificador = str(item.get('id', '')).strip()
            nombre = str(item.get('name_es', '')).strip()
            if not identificador or not nombre:
                self.stderr.write(f'Registro omitido: id o nombre faltante ({item!r}).')
                continue
            imagenes = (item.get('images') or {}).get('flat') or {}
            ruta_imagen = imagenes.get('peak') or imagenes.get('main') or imagenes.get('start') or ''
            pasos = item.get('instructions_es') or []
            consejos = item.get('tips_es') or []
            defaults = {
                'nombre': nombre,
                'categoria': item.get('category', ''),
                'parte_cuerpo': item.get('body_part', ''),
                'equipo': str(item.get('equipment', '')).replace('_', ' '),
                'musculo_objetivo': (item.get('primary_muscles') or [''])[0].replace('_', ' '),
                'grupo_muscular': item.get('body_part', ''),
                'musculos_secundarios': item.get('secondary_muscles') or [],
                'instrucciones_es': item.get('description_es', ''),
                'pasos_es': pasos + consejos,
                'imagen_url': '',
                'version_origen': options['version_origen'],
                'esta_activo': True,
                'animacion_url': '',
                'atribucion_media': 'Exercise data by RepDB (repdb.co)',
            }
            if incluir_imagenes and ruta_imagen:
                defaults.update({
                    'imagen_url': f"{base_media_url}/{ruta_imagen.lstrip('/')}",
                })
            catalogo, creado = CatalogoEjercicio.objects.update_or_create(
                identificador_origen=identificador, defaults=defaults,
            )
            if creado:
                creados += 1
            else:
                actualizados += 1

        mensaje_medios = 'con ilustraciones RepDB' if incluir_imagenes else 'sin ilustraciones'
        self.stdout.write(self.style.SUCCESS(
            f'Catálogo importado: {creados} creados, {actualizados} actualizados; {mensaje_medios}.'
        ))
