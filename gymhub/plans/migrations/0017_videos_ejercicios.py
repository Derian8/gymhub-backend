from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('plans', '0016_referencia_visual_plantillas'),
    ]

    operations = [
        migrations.AddField(
            model_name='catalogoejercicio',
            name='video_url',
            field=models.URLField(blank=True, help_text='Video HTTPS de YouTube para demostración del ejercicio.'),
        ),
        migrations.AddField(
            model_name='exercise',
            name='video_url',
            field=models.URLField(blank=True, help_text='Enlace de YouTube para ejercicios sin video base.'),
        ),
    ]
