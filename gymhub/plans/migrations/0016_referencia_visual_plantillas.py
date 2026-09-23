import re
import unicodedata

from django.db import migrations, models


ALIAS = {
    'press banca': 'press plano',
    'press de banca': 'press plano',
    'press palno': 'press plano',
    'hip trust': 'hip thrust',
    'jalon abierto': 'jalon abierto',
    'pull over': 'pull over',
    'remo sentado': 'remo',
    'curl predicador': 'curl predicador',
}


def normalizar(valor):
    valor = unicodedata.normalize('NFKD', valor or '').encode('ascii', 'ignore').decode('ascii').lower()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9]+', ' ', valor)).strip()


def enlazar_plantillas(apps, schema_editor):
    CatalogoEjercicio = apps.get_model('plans', 'CatalogoEjercicio')
    PlantillaEjercicio = apps.get_model('plans', 'PlantillaEjercicio')
    catalogo_por_nombre = {
        normalizar(item.nombre): item.id
        for item in CatalogoEjercicio.objects.exclude(imagen_url='', animacion_url='')
    }
    for ejercicio in PlantillaEjercicio.objects.filter(catalogo_ejercicio__isnull=True):
        nombre = normalizar(ejercicio.nombre)
        catalogo_id = catalogo_por_nombre.get(nombre) or catalogo_por_nombre.get(ALIAS.get(nombre, ''))
        if catalogo_id:
            ejercicio.catalogo_ejercicio_id = catalogo_id
            ejercicio.save(update_fields=['catalogo_ejercicio'])


class Migration(migrations.Migration):
    dependencies = [('plans', '0015_referencias_visuales_ejercicios')]

    operations = [
        migrations.AddField(
            model_name='plantillaejercicio',
            name='imagen_referencia_url',
            field=models.URLField(blank=True),
        ),
        migrations.RunPython(enlazar_plantillas, migrations.RunPython.noop),
    ]
