from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('plans', '0017_videos_ejercicios'),
    ]

    operations = [
        migrations.AddField(
            model_name='plantillaejercicio',
            name='url_video',
            field=models.URLField(blank=True, help_text='Video personalizado del ejercicio.'),
        ),
        migrations.AddField(
            model_name='plantillaejercicio',
            name='maquina',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='ejercicios_plantilla',
                to='plans.gymmachine',
            ),
        ),
    ]
