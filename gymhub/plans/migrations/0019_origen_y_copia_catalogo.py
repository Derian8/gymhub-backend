from django.db import migrations, models
import django.db.models.deletion


def copiar_catalogo_asignado(apps, schema_editor):
    Exercise = apps.get_model('plans', 'Exercise')
    campos = (
        'id', 'identificador_origen', 'nombre', 'categoria', 'parte_cuerpo',
        'equipo', 'musculo_objetivo', 'grupo_muscular', 'grupo_muscular_plan',
        'maquina_recomendada_id', 'musculos_secundarios', 'instrucciones_es',
        'pasos_es', 'imagen_url', 'animacion_url', 'video_url',
        'atribucion_media', 'version_origen', 'esta_activo', 'es_catalogo_base',
    )
    for ejercicio in Exercise.objects.filter(catalogo_ejercicio__isnull=False).select_related('catalogo_ejercicio').iterator(chunk_size=200):
        catalogo = ejercicio.catalogo_ejercicio
        detalle = {campo.removesuffix('_id'): getattr(catalogo, campo) for campo in campos}
        Exercise.objects.filter(pk=ejercicio.pk).update(detalle_catalogo_asignado=detalle)


class Migration(migrations.Migration):
    dependencies = [('plans', '0018_video_y_maquina_plantillas')]

    operations = [
        migrations.AddField(
            model_name='trainingplan',
            name='plantilla_origen',
            field=models.ForeignKey(
                to='plans.plantillaentrenamiento', null=True, blank=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='planes_asignados',
            ),
        ),
        migrations.AddField(
            model_name='exercise',
            name='detalle_catalogo_asignado',
            field=models.JSONField(default=dict, blank=True),
        ),
        migrations.RunPython(copiar_catalogo_asignado, migrations.RunPython.noop),
    ]
