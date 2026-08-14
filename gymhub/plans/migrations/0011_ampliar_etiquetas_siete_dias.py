from django.db import migrations, models


ETIQUETAS_DIAS = [
    ('A', 'Day A'),
    ('B', 'Day B'),
    ('C', 'Day C'),
    ('D', 'Day D'),
    ('E', 'Day E'),
    ('F', 'Day F'),
    ('G', 'Day G'),
]


class Migration(migrations.Migration):

    dependencies = [
        ('plans', '0010_alter_catalogoejercicio_identificador_origen'),
    ]

    operations = [
        migrations.AlterField(
            model_name='workoutday',
            name='day_label',
            field=models.CharField(choices=ETIQUETAS_DIAS, max_length=1),
        ),
        migrations.AlterField(
            model_name='plantilladiaentrenamiento',
            name='etiqueta_dia',
            field=models.CharField(choices=ETIQUETAS_DIAS, max_length=1),
        ),
    ]
