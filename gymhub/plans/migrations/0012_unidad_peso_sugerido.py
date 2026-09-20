from django.db import migrations, models


UNIDADES_PESO_SUGERIDO = [
    ('kg', 'Kilogramos'),
    ('lb', 'Libras'),
]


class Migration(migrations.Migration):

    dependencies = [
        ('plans', '0011_ampliar_etiquetas_siete_dias'),
    ]

    operations = [
        migrations.AddField(
            model_name='exercise',
            name='weight_suggestion_unit',
            field=models.CharField(choices=UNIDADES_PESO_SUGERIDO, default='kg', max_length=2),
        ),
        migrations.AddField(
            model_name='plantillaejercicio',
            name='unidad_peso_sugerido',
            field=models.CharField(choices=UNIDADES_PESO_SUGERIDO, default='kg', max_length=2),
        ),
    ]
