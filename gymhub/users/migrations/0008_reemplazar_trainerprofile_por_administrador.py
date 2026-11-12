from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class OperacionEnOtraApp:
    """Permite a esta migración coordinar cambios de estado entre apps."""

    def __init__(self, app_objetivo, *args, **kwargs):
        self.app_objetivo = app_objetivo
        super().__init__(*args, **kwargs)

    def state_forwards(self, app_label, state):
        return super().state_forwards(self.app_objetivo, state)

    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        return super().database_forwards(
            self.app_objetivo, schema_editor, from_state, to_state
        )

    def database_backwards(self, app_label, schema_editor, from_state, to_state):
        return super().database_backwards(
            self.app_objetivo, schema_editor, from_state, to_state
        )

    def references_model(self, name, app_label):
        return super().references_model(name, self.app_objetivo)


class AgregarCampoEnOtraApp(OperacionEnOtraApp, migrations.AddField):
    pass


class QuitarIndiceEnOtraApp(OperacionEnOtraApp, migrations.RemoveIndex):
    pass


class QuitarCampoEnOtraApp(OperacionEnOtraApp, migrations.RemoveField):
    pass


class RenombrarCampoEnOtraApp(OperacionEnOtraApp, migrations.RenameField):
    pass


class AlterarCampoEnOtraApp(OperacionEnOtraApp, migrations.AlterField):
    pass


class AgregarIndiceEnOtraApp(OperacionEnOtraApp, migrations.AddIndex):
    pass


RELACIONES = (
    ('users', 'MemberProfile', 'trainer_asignado', 'admin_migrado'),
    ('users', 'PerfilGimnasio', 'entrenador', 'admin_migrado'),
    ('billing', 'MembershipPlan', 'trainer', 'admin_migrado'),
    ('billing', 'MemberSubscription', 'trainer', 'admin_migrado'),
    ('classes', 'GymClass', 'trainer', 'admin_migrado'),
    ('plans', 'TrainingPlan', 'trainer', 'admin_migrado'),
    ('plans', 'PlantillaEntrenamiento', 'trainer', 'admin_migrado'),
    ('nutrition', 'PlantillaNutricion', 'trainer', 'admin_migrado'),
    ('alerts', 'InactivityAlertContact', 'trainer', 'admin_migrado'),
    ('alerts', 'MemberJustifiedAbsence', 'trainer', 'admin_migrado'),
)


def migrar_responsables_a_cuentas(apps, schema_editor):
    TrainerProfile = apps.get_model('users', 'TrainerProfile')
    perfil_a_administrador = dict(
        TrainerProfile.objects.values_list('id', 'user_id')
    )

    for app_label, model_name, campo_anterior, campo_nuevo in RELACIONES:
        Modelo = apps.get_model(app_label, model_name)
        for registro in Modelo.objects.all().iterator():
            id_perfil = getattr(registro, f'{campo_anterior}_id')
            if id_perfil is None:
                continue
            id_administrador = perfil_a_administrador.get(id_perfil)
            if id_administrador is None:
                raise RuntimeError(
                    f'{app_label}.{model_name}({registro.pk}) referencia un '
                    f'TrainerProfile inexistente: {id_perfil}'
                )
            Modelo.objects.filter(pk=registro.pk).update(
                **{f'{campo_nuevo}_id': id_administrador}
            )


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0007_simplificar_roles_administrador_cliente'),
        ('billing', '0012_seguimiento_cobro'),
        ('classes', '0002_initial'),
        ('plans', '0017_videos_ejercicios'),
        ('nutrition', '0003_plantillanutricion'),
        ('alerts', '0005_inactivityalertcontact_memberjustifiedabsence_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='memberprofile',
            name='admin_migrado',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='+', to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='perfilgimnasio',
            name='admin_migrado',
            field=models.OneToOneField(
                blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                related_name='+', to=settings.AUTH_USER_MODEL,
            ),
        ),
        AgregarCampoEnOtraApp(
            'billing',
            model_name='membershipplan',
            name='admin_migrado',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='+', to=settings.AUTH_USER_MODEL,
            ),
        ),
        AgregarCampoEnOtraApp(
            'billing',
            model_name='membersubscription',
            name='admin_migrado',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                related_name='+', to=settings.AUTH_USER_MODEL,
            ),
        ),
        AgregarCampoEnOtraApp(
            'classes',
            model_name='gymclass',
            name='admin_migrado',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                related_name='+', to=settings.AUTH_USER_MODEL,
            ),
        ),
        AgregarCampoEnOtraApp(
            'plans',
            model_name='trainingplan',
            name='admin_migrado',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                related_name='+', to=settings.AUTH_USER_MODEL,
            ),
        ),
        AgregarCampoEnOtraApp(
            'plans',
            model_name='plantillaentrenamiento',
            name='admin_migrado',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                related_name='+', to=settings.AUTH_USER_MODEL,
            ),
        ),
        AgregarCampoEnOtraApp(
            'nutrition',
            model_name='plantillanutricion',
            name='admin_migrado',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                related_name='+', to=settings.AUTH_USER_MODEL,
            ),
        ),
        AgregarCampoEnOtraApp(
            'alerts',
            model_name='inactivityalertcontact',
            name='admin_migrado',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                related_name='+', to=settings.AUTH_USER_MODEL,
            ),
        ),
        AgregarCampoEnOtraApp(
            'alerts',
            model_name='memberjustifiedabsence',
            name='admin_migrado',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='+', to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(migrar_responsables_a_cuentas),
        migrations.RemoveIndex(
            model_name='memberprofile',
            name='users_membe_trainer_0c80c8_idx',
        ),
        QuitarIndiceEnOtraApp(
            'billing',
            model_name='membershipplan',
            name='billing_mem_trainer_30915f_idx',
        ),
        QuitarIndiceEnOtraApp(
            'billing',
            model_name='membersubscription',
            name='billing_mem_trainer_208d10_idx',
        ),
        QuitarIndiceEnOtraApp(
            'alerts',
            model_name='inactivityalertcontact',
            name='alerts_inac_trainer_98db00_idx',
        ),
        migrations.RemoveField(model_name='memberprofile', name='trainer_asignado'),
        migrations.RemoveField(model_name='perfilgimnasio', name='entrenador'),
        QuitarCampoEnOtraApp('billing', model_name='membershipplan', name='trainer'),
        QuitarCampoEnOtraApp('billing', model_name='membersubscription', name='trainer'),
        QuitarCampoEnOtraApp('classes', model_name='gymclass', name='trainer'),
        QuitarCampoEnOtraApp('plans', model_name='trainingplan', name='trainer'),
        QuitarCampoEnOtraApp('plans', model_name='plantillaentrenamiento', name='trainer'),
        QuitarCampoEnOtraApp('nutrition', model_name='plantillanutricion', name='trainer'),
        QuitarCampoEnOtraApp('alerts', model_name='inactivityalertcontact', name='trainer'),
        QuitarCampoEnOtraApp('alerts', model_name='memberjustifiedabsence', name='trainer'),
        migrations.RenameField('memberprofile', 'admin_migrado', 'trainer_asignado'),
        migrations.RenameField('perfilgimnasio', 'admin_migrado', 'administrador'),
        RenombrarCampoEnOtraApp('billing', 'membershipplan', 'admin_migrado', 'trainer'),
        RenombrarCampoEnOtraApp('billing', 'membersubscription', 'admin_migrado', 'trainer'),
        RenombrarCampoEnOtraApp('classes', 'gymclass', 'admin_migrado', 'trainer'),
        RenombrarCampoEnOtraApp('plans', 'trainingplan', 'admin_migrado', 'trainer'),
        RenombrarCampoEnOtraApp('plans', 'plantillaentrenamiento', 'admin_migrado', 'trainer'),
        RenombrarCampoEnOtraApp('nutrition', 'plantillanutricion', 'admin_migrado', 'trainer'),
        RenombrarCampoEnOtraApp('alerts', 'inactivityalertcontact', 'admin_migrado', 'trainer'),
        RenombrarCampoEnOtraApp('alerts', 'memberjustifiedabsence', 'admin_migrado', 'trainer'),
        migrations.AlterField(
            model_name='memberprofile', name='trainer_asignado',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='clientes', to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name='perfilgimnasio', name='administrador',
            field=models.OneToOneField(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='perfil_gimnasio', to=settings.AUTH_USER_MODEL,
            ),
        ),
        AlterarCampoEnOtraApp(
            'billing',
            model_name='membershipplan', name='trainer',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='membership_plans', to=settings.AUTH_USER_MODEL,
            ),
        ),
        AlterarCampoEnOtraApp(
            'billing',
            model_name='membersubscription', name='trainer',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='member_subscriptions', to=settings.AUTH_USER_MODEL,
            ),
        ),
        AlterarCampoEnOtraApp(
            'classes',
            model_name='gymclass', name='trainer',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='classes', to=settings.AUTH_USER_MODEL,
            ),
        ),
        AlterarCampoEnOtraApp(
            'plans',
            model_name='trainingplan', name='trainer',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='created_plans', to=settings.AUTH_USER_MODEL,
            ),
        ),
        AlterarCampoEnOtraApp(
            'plans',
            model_name='plantillaentrenamiento', name='trainer',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='plantillas_entrenamiento', to=settings.AUTH_USER_MODEL,
            ),
        ),
        AlterarCampoEnOtraApp(
            'nutrition',
            model_name='plantillanutricion', name='trainer',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='plantillas_nutricion', to=settings.AUTH_USER_MODEL,
            ),
        ),
        AlterarCampoEnOtraApp(
            'alerts',
            model_name='inactivityalertcontact', name='trainer',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='inactivity_contacts', to=settings.AUTH_USER_MODEL,
            ),
        ),
        AlterarCampoEnOtraApp(
            'alerts',
            model_name='memberjustifiedabsence', name='trainer',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='justified_absences', to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddIndex(
            model_name='memberprofile',
            index=models.Index(fields=['trainer_asignado', 'is_active'], name='users_membe_trainer_0c80c8_idx'),
        ),
        AgregarIndiceEnOtraApp(
            'billing',
            model_name='membershipplan',
            index=models.Index(fields=['trainer', 'is_active'], name='billing_mem_trainer_30915f_idx'),
        ),
        AgregarIndiceEnOtraApp(
            'billing',
            model_name='membersubscription',
            index=models.Index(fields=['trainer', 'is_active'], name='billing_mem_trainer_208d10_idx'),
        ),
        AgregarIndiceEnOtraApp(
            'alerts',
            model_name='inactivityalertcontact',
            index=models.Index(fields=['trainer', 'contacted_at'], name='alerts_inac_trainer_98db00_idx'),
        ),
        migrations.DeleteModel(name='TrainerProfile'),
    ]
