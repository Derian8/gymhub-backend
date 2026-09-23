import re
import unicodedata

from django.db import migrations, models


REFERENCIAS_BASE = {
    'press-plano': 'bench-press', 'press-inclinado': 'incline-dumbbell-press',
    'apertura-maquina': 'machine-chest-fly', 'extension-triceps-polea': 'tricep-pushdown',
    'extension-triceps-tras-nuca': 'overhead-tricep-extension', 'elevaciones-laterales': 'dumbbell-lateral-raise',
    'press-militar': 'machine-shoulder-press', 'prensa': 'leg-press', 'sentadilla': 'barbell-squat',
    'extension-rodilla': 'leg-extension', 'hip-thrust': 'hip-thrust', 'peso-muerto': 'deadlift',
    'curl-pierna': 'lying-leg-curl', 'maquina-abductores': 'hip-abduction', 'elevacion-talon': 'machine-calf-raise',
    'jalon-abierto': 'lat-pulldown', 'pull-over': 'db-pullover', 'encogimiento-hombros': 'shrug',
    'vuelo-pajaro': 'rear-delt-fly', 'remo': 'seated-cable-row', 'curl-banca-inclinada': 'incline-db-curl',
    'curl-predicador': 'preacher-curl', 'martillo-mancuerna': 'hammer-curl', 'plancha-isometrica': 'plank',
    'elevacion-piernas': 'captains-chair-leg-raise',
}

ALIAS = {
    'press de banca': 'press-plano', 'press banca': 'press-plano', 'press palno': 'press-plano',
    'press plano': 'press-plano', 'press inclinado': 'press-inclinado', 'prensa de piernas': 'prensa',
    'prensa pendular': 'prensa', 'sentadilla con barra': 'sentadilla', 'sentadillas con barra': 'sentadilla',
    'jalon abierto': 'jalon-abierto', 'jalon al pecho': 'jalon-abierto', 'pull over': 'pull-over',
    'remo sentado': 'remo', 'apertura con maquina': 'apertura-maquina', 'hip trust': 'hip-thrust',
    'extension de rodilla': 'extension-rodilla', 'extensiones de cuadriceps': 'extension-rodilla',
    'press militar': 'press-militar', 'elevaciones laterales': 'elevaciones-laterales',
    'extension de triceps en polea': 'extension-triceps-polea', 'extencion de triceps en polea': 'extension-triceps-polea',
    'peso muerto con mancuernas': 'peso-muerto', 'curl predicador': 'curl-predicador',
    'martillo con mancuerna': 'martillo-mancuerna', 'plancha': 'plancha-isometrica',
    'elevacion de piernas': 'elevacion-piernas',
}

FALLBACKS = {
    'press-inclinado': 'bench-press', 'extension-triceps-tras-nuca': 'tricep-pushdown',
    'elevaciones-laterales': 'machine-shoulder-press', 'sentadilla': 'leg-press',
    'extension-rodilla': 'leg-press', 'curl-pierna': 'deadlift', 'pull-over': 'barbell-pullover',
    'remo': 'lat-pulldown', 'curl-predicador': 'hammer-curl',
}


def normalizar(valor):
    valor = unicodedata.normalize('NFKD', valor or '').encode('ascii', 'ignore').decode('ascii').lower()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9]+', ' ', valor)).strip()


def cargar_referencias(apps, schema_editor):
    CatalogoEjercicio = apps.get_model('plans', 'CatalogoEjercicio')
    Exercise = apps.get_model('plans', 'Exercise')
    fuentes = {
        item.identificador_origen: item
        for item in CatalogoEjercicio.objects.exclude(imagen_url='')
    }
    bases = {
        item.identificador_origen.removeprefix('gymhub-base:'): item
        for item in CatalogoEjercicio.objects.filter(identificador_origen__startswith='gymhub-base:')
    }
    for clave, base in bases.items():
        fuente = fuentes.get(REFERENCIAS_BASE.get(clave)) or fuentes.get(FALLBACKS.get(clave))
        if fuente:
            base.imagen_url = fuente.imagen_url
            base.atribucion_media = fuente.atribucion_media or 'Exercise data by RepDB (repdb.co)'
        else:
            base.imagen_url = f"https://exercise-dataset.com/images/flat/{REFERENCIAS_BASE[clave]}-peak.webp"
            base.atribucion_media = 'Exercise data by RepDB (repdb.co)'
        base.save(update_fields=['imagen_url', 'atribucion_media', 'importado_en'])

    por_nombre = {}
    for item in CatalogoEjercicio.objects.exclude(imagen_url=''):
        por_nombre.setdefault(normalizar(item.nombre), item)
    for exercise in Exercise.objects.filter(catalogo_ejercicio__isnull=True):
        nombre = normalizar(exercise.name).removesuffix(' copia').strip()
        clave_base = ALIAS.get(nombre)
        catalogo = bases.get(clave_base) if clave_base else por_nombre.get(nombre)
        if catalogo and catalogo.imagen_url:
            exercise.catalogo_ejercicio_id = catalogo.id
            exercise.save(update_fields=['catalogo_ejercicio'])


class Migration(migrations.Migration):
    dependencies = [('plans', '0014_marcar_catalogo_base')]
    operations = [
        migrations.AddField(model_name='exercise', name='imagen_referencia_url', field=models.URLField(blank=True, help_text='Referencia visual HTTPS proporcionada por el trainer para ejercicios personalizados.')),
        migrations.RunPython(cargar_referencias, migrations.RunPython.noop),
    ]
