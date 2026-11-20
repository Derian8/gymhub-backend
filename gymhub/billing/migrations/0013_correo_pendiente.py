import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('billing', '0012_seguimiento_cobro')]

    operations = [
        migrations.CreateModel(
            name='CorreoPendiente',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('clave', models.CharField(max_length=120, unique=True)),
                ('identificador', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('contenido', models.JSONField()),
                ('estado', models.CharField(choices=[('pendiente', 'Pendiente'), ('aceptado', 'Aceptado por Resend'), ('fallido', 'Fallido'), ('revisar', 'Revisión manual')], default='pendiente', max_length=20)),
                ('intentos', models.PositiveIntegerField(default=0)),
                ('primer_intento', models.DateTimeField(blank=True, null=True)),
                ('proximo_intento', models.DateTimeField(blank=True, null=True)),
                ('identificador_proveedor', models.CharField(blank=True, max_length=120)),
                ('ultimo_error', models.CharField(blank=True, max_length=120)),
                ('fecha_creacion', models.DateTimeField(auto_now_add=True)),
                ('fecha_aceptacion', models.DateTimeField(blank=True, null=True)),
            ],
            options={
                'db_table': 'correos_pendientes',
                'ordering': ['fecha_creacion'],
                'indexes': [models.Index(fields=['estado', 'proximo_intento'], name='correo_estado_intento_idx')],
            },
        ),
    ]
