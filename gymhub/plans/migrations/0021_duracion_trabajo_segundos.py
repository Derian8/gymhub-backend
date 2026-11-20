from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('plans', '0020_vincular_plantillas_historicas')]

    operations = [
        migrations.AddField(
            model_name='exercise',
            name='duracion_trabajo_segundos',
            field=models.PositiveIntegerField(
                blank=True, null=True,
                validators=[MinValueValidator(1), MaxValueValidator(36000)],
            ),
        ),
        migrations.AddField(
            model_name='plantillaejercicio',
            name='duracion_trabajo_segundos',
            field=models.PositiveIntegerField(
                blank=True, null=True,
                validators=[MinValueValidator(1), MaxValueValidator(36000)],
            ),
        ),
    ]
