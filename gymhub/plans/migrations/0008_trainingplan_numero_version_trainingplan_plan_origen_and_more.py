import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('plans', '0007_expand_muscle_group_choices'), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.AddField(model_name='trainingplan', name='numero_version', field=models.PositiveIntegerField(default=1)),
        migrations.AddField(model_name='trainingplan', name='plan_origen', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='revisiones', to='plans.trainingplan')),
        migrations.AddField(model_name='trainingplan', name='publicado_en', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='trainingplan', name='publicado_por', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='planes_publicados', to=settings.AUTH_USER_MODEL)),
    ]
