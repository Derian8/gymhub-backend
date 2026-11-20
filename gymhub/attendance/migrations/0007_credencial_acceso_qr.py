import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('attendance', '0006_token_acceso_qr')]

    operations = [
        migrations.CreateModel(
            name='CredencialAccesoQr',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codigo', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('cliente', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, to='users.memberprofile')),
            ],
            options={'db_table': 'credenciales_acceso_qr'},
        ),
    ]
