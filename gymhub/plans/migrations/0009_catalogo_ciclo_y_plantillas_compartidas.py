import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('plans', '0008_trainingplan_numero_version_trainingplan_plan_origen_and_more')]

    operations = [
        migrations.CreateModel(
            name='CatalogoEjercicio',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('identificador_origen', models.CharField(max_length=32, unique=True)),
                ('nombre', models.CharField(max_length=240)),
                ('categoria', models.CharField(blank=True, max_length=100)),
                ('parte_cuerpo', models.CharField(blank=True, max_length=100)),
                ('equipo', models.CharField(blank=True, max_length=100)),
                ('musculo_objetivo', models.CharField(blank=True, max_length=120)),
                ('grupo_muscular', models.CharField(blank=True, max_length=120)),
                ('musculos_secundarios', models.JSONField(blank=True, default=list)),
                ('instrucciones_es', models.TextField(blank=True)),
                ('pasos_es', models.JSONField(blank=True, default=list)),
                ('imagen_url', models.URLField(blank=True)),
                ('animacion_url', models.URLField(blank=True)),
                ('atribucion_media', models.CharField(blank=True, max_length=255)),
                ('version_origen', models.CharField(blank=True, max_length=80)),
                ('esta_activo', models.BooleanField(default=True)),
                ('importado_en', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'catalogo_ejercicios', 'ordering': ['nombre', 'id']},
        ),
        migrations.AddIndex(model_name='catalogoejercicio', index=models.Index(fields=['nombre'], name='catalogo_ejercicio_nombre_idx')),
        migrations.AddField(model_name='exercise', name='catalogo_ejercicio', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='prescripciones', to='plans.catalogoejercicio')),
        migrations.AddField(model_name='plantillaejercicio', name='catalogo_ejercicio', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='plantillas_ejercicios', to='plans.catalogoejercicio')),
        migrations.AddField(model_name='plantilladiaentrenamiento', name='dia_semana', field=models.CharField(blank=True, choices=[('mon', 'Lunes'), ('tue', 'Martes'), ('wed', 'Miercoles'), ('thu', 'Jueves'), ('fri', 'Viernes'), ('sat', 'Sabado'), ('sun', 'Domingo')], max_length=3, null=True)),
        migrations.AddField(model_name='plantillaentrenamiento', name='es_compartida', field=models.BooleanField(default=True)),
        migrations.AddField(model_name='plantillaentrenamiento', name='modo_ejecucion', field=models.CharField(choices=[('weekly', 'Semanal'), ('cycle', 'Ciclo flexible')], default='cycle', max_length=10)),
        migrations.AddField(model_name='trainingplan', name='indice_bloque_actual', field=models.PositiveIntegerField(default=0)),
        migrations.AddField(model_name='trainingplan', name='modo_ejecucion', field=models.CharField(choices=[('weekly', 'Semanal'), ('cycle', 'Ciclo flexible')], default='weekly', max_length=10)),
        migrations.AlterField(model_name='workoutday', name='day_of_week', field=models.CharField(blank=True, choices=[('mon', 'Lunes'), ('tue', 'Martes'), ('wed', 'Miercoles'), ('thu', 'Jueves'), ('fri', 'Viernes'), ('sat', 'Sabado'), ('sun', 'Domingo')], max_length=3, null=True)),
    ]
