from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('attendance', '0005_attendance_es_excepcion_comercial_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='TokenAccesoQr',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('resumen', models.CharField(max_length=64, unique=True)),
                ('vence_en', models.DateTimeField(db_index=True)),
                ('consumido_en', models.DateTimeField(blank=True, null=True)),
                ('cliente', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='users.memberprofile')),
            ],
            options={'db_table': 'tokens_acceso_qr'},
        ),
    ]
