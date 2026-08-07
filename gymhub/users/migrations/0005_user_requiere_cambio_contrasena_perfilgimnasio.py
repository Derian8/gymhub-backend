import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('users', '0004_auditlog_details')]
    operations = [
        migrations.AddField(model_name='user', name='requiere_cambio_contrasena', field=models.BooleanField(default=False)),
        migrations.CreateModel(name='PerfilGimnasio', fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('nombre', models.CharField(default='Mi gimnasio', max_length=200)),
            ('logo', models.ImageField(blank=True, null=True, upload_to='logos_gimnasios/')),
            ('telefono', models.CharField(blank=True, max_length=30)),
            ('correo', models.EmailField(blank=True, max_length=254)),
            ('direccion', models.TextField(blank=True)),
            ('moneda', models.CharField(default='CRC', editable=False, max_length=3)),
            ('actualizado_en', models.DateTimeField(auto_now=True)),
            ('entrenador', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='perfil_gimnasio', to='users.trainerprofile')),
        ], options={'db_table': 'perfiles_gimnasio'}),
    ]
