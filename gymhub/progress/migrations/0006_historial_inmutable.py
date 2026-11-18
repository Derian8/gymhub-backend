from django.db import migrations, models
import django.db.models.deletion


def conservar_sesiones_existentes(apps, schema_editor):
    WorkoutSession = apps.get_model('progress', 'WorkoutSession')
    for sesion in WorkoutSession.objects.select_related('workout_day__plan').iterator(chunk_size=200):
        dia = sesion.workout_day
        ejercicios = [
            {
                'id': ejercicio.id,
                'nombre': ejercicio.name,
                'tipo': ejercicio.exercise_type,
                'series': ejercicio.sets,
                'repeticiones': ejercicio.reps_range,
                'minutos': ejercicio.target_minutes,
                'descanso_segundos': ejercicio.rest_seconds,
                'peso_sugerido_kg': ejercicio.weight_suggestion_kg,
                'notas_tecnicas': ejercicio.technique_notes,
                'catalogo': ejercicio.detalle_catalogo_asignado,
            }
            for ejercicio in dia.exercises.order_by('order', 'id')
        ]
        WorkoutSession.objects.filter(pk=sesion.pk).update(detalle_iniciado={
            'plan_nombre': dia.plan.name,
            'dia_nombre': dia.name,
            'ejercicios': ejercicios,
        })


class Migration(migrations.Migration):
    dependencies = [
        ('plans', '0019_origen_y_copia_catalogo'),
        ('progress', '0005_exerciselog_estado'),
    ]

    operations = [
        migrations.AddField(
            model_name='workoutsession',
            name='detalle_iniciado',
            field=models.JSONField(default=dict, blank=True),
        ),
        migrations.AddField(
            model_name='workoutsession',
            name='motivo_cierre',
            field=models.CharField(
                max_length=12, blank=True,
                choices=[
                    ('automatica', 'Automática'),
                    ('anticipada', 'Anticipada'),
                    ('manual', 'Manual'),
                ],
            ),
        ),
        migrations.AlterField(
            model_name='workoutsession',
            name='workout_day',
            field=models.ForeignKey(
                to='plans.workoutday', on_delete=django.db.models.deletion.PROTECT,
                related_name='sessions',
            ),
        ),
        migrations.AlterField(
            model_name='exerciselog',
            name='exercise',
            field=models.ForeignKey(
                to='plans.exercise', on_delete=django.db.models.deletion.PROTECT,
                related_name='logs',
            ),
        ),
        migrations.RunPython(conservar_sesiones_existentes, migrations.RunPython.noop),
    ]
