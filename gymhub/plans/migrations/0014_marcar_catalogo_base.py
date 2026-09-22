from django.db import migrations, models


def marcar_catalogo_base(apps, schema_editor):
    CatalogoEjercicio = apps.get_model('plans', 'CatalogoEjercicio')
    GymMachine = apps.get_model('plans', 'GymMachine')
    CatalogoEjercicio.objects.filter(identificador_origen__startswith='gymhub-base:').update(es_catalogo_base=True)
    GymMachine.objects.filter(notes='Equipo base de catálogo.').update(es_catalogo_base=True)


class Migration(migrations.Migration):
    dependencies = [('plans', '0013_catalogo_base_gimnasio')]
    operations = [
        migrations.AddField(model_name='catalogoejercicio', name='es_catalogo_base', field=models.BooleanField(default=False)),
        migrations.AddField(model_name='gymmachine', name='es_catalogo_base', field=models.BooleanField(default=False)),
        migrations.RunPython(marcar_catalogo_base, migrations.RunPython.noop),
    ]
