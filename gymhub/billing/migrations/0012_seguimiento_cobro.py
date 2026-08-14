from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('billing', '0011_membersubscription_motivo_ajuste_precio_and_more'),
        ('users', '0006_alter_memberprofile_join_date'),
    ]

    operations = [
        migrations.CreateModel(
            name='SeguimientoCobro',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('estado', models.CharField(choices=[('nuevo', 'Nuevo'), ('en_seguimiento', 'En seguimiento'), ('resuelto', 'Resuelto'), ('baja', 'Baja')], default='nuevo', max_length=20)),
                ('medio_contacto', models.CharField(blank=True, choices=[('whatsapp', 'WhatsApp'), ('llamada', 'Llamada'), ('correo', 'Correo'), ('presencial', 'Presencial')], max_length=20)),
                ('nota', models.TextField(blank=True)),
                ('proxima_fecha', models.DateField(blank=True, null=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('actualizado_en', models.DateTimeField(auto_now=True)),
                ('administrador', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='seguimientos_cobro', to=settings.AUTH_USER_MODEL)),
                ('cliente', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='seguimientos_cobro', to='users.memberprofile')),
            ],
            options={
                'db_table': 'seguimientos_cobro',
                'ordering': ['-actualizado_en', '-id'],
            },
        ),
        migrations.AddIndex(
            model_name='seguimientocobro',
            index=models.Index(fields=['estado', 'proxima_fecha'], name='seguimiento_estado_fecha_idx'),
        ),
        migrations.AddIndex(
            model_name='seguimientocobro',
            index=models.Index(fields=['cliente', 'estado'], name='seguimiento_cliente_estado_idx'),
        ),
        migrations.AddConstraint(
            model_name='seguimientocobro',
            constraint=models.UniqueConstraint(condition=models.Q(('estado__in', ['nuevo', 'en_seguimiento'])), fields=('cliente',), name='seguimiento_cobro_abierto_unico'),
        ),
    ]
