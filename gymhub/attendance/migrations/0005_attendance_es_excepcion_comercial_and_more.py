from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('attendance', '0004_daily_attendance_checkout')]
    operations = [
        migrations.AddField(model_name='attendance', name='es_excepcion_comercial', field=models.BooleanField(default=False)),
        migrations.AddField(model_name='attendance', name='motivo_excepcion', field=models.CharField(blank=True, max_length=500)),
    ]
