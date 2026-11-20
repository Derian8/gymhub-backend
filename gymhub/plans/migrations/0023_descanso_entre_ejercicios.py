from django.core.validators import MaxValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('plans', '0022_disponible_clientes')]
    operations = [migrations.AddField(
        model_name=nombre, name='descanso_entre_ejercicios_segundos',
        field=models.PositiveIntegerField(default=0, validators=[MaxValueValidator(600)]),
    ) for nombre in ['exercise', 'plantillaejercicio']]
