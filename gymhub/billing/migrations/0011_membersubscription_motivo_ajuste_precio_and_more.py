import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('billing', '0010_void_cancelled_subscription_charges'), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.AddField(model_name='membersubscription', name='motivo_ajuste_precio', field=models.CharField(blank=True, max_length=255)),
        migrations.AddField(model_name='paymentrecord', name='metodo_registrado', field=models.CharField(blank=True, choices=[('cash', 'Cash'), ('sinpe', 'SINPE Móvil'), ('transfer', 'Transfer'), ('card', 'Card'), ('other', 'Other')], max_length=20)),
        migrations.AddField(model_name='paymentrecord', name='registrado_por', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='pagos_registrados', to=settings.AUTH_USER_MODEL)),
        migrations.AlterField(model_name='paymentmethod', name='type', field=models.CharField(choices=[('cash', 'Cash'), ('sinpe', 'SINPE Móvil'), ('transfer', 'Transfer'), ('card', 'Card'), ('other', 'Other')], max_length=20)),
    ]
