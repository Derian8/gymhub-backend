from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [('users', '0005_user_requiere_cambio_contrasena_perfilgimnasio')]
    operations = [
        migrations.AlterField(
            model_name='memberprofile',
            name='join_date',
            field=models.DateField(default=django.utils.timezone.localdate),
        ),
    ]
