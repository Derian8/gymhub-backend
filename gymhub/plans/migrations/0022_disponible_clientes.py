from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('plans', '0021_duracion_trabajo_segundos')]
    operations = [migrations.AddField(
        model_name='plantillaentrenamiento', name='disponible_clientes',
        field=models.BooleanField(default=False),
    )]
