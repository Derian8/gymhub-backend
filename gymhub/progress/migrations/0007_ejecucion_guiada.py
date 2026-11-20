from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('progress', '0006_historial_inmutable')]

    operations = [
        migrations.AlterField(
            model_name='workoutsession', name='workout_day',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT,
                                    related_name='sessions', to='plans.workoutday'),
        ),
        migrations.AddField(model_name='workoutsession', name='origen',
                            field=models.CharField(max_length=10, default='plan',
                                                   choices=[('plan', 'Plan'), ('libre', 'Libre')])),
        migrations.AddField(model_name='workoutsession', name='progreso_guiado',
                            field=models.JSONField(default=dict, blank=True)),
    ]
