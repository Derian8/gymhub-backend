from django.db import migrations, models


def normalizar_roles(apps, schema_editor):
    User = apps.get_model('users', 'User')
    TrainerProfile = apps.get_model('users', 'TrainerProfile')

    # Los instructores pasan a ser cuentas administrativas con control completo.
    User.objects.filter(role='trainer').update(role='admin', is_staff=True)
    User.objects.filter(is_staff=True).update(role='admin')
    User.objects.filter(is_superuser=True).update(role='admin', is_staff=True)
    ids_con_perfil_tecnico = TrainerProfile.objects.values_list('user_id', flat=True)
    User.objects.filter(pk__in=ids_con_perfil_tecnico).update(role='admin', is_staff=True)

    # El perfil se conserva como vínculo interno para planes, clases y gimnasio.
    admin_ids = list(User.objects.filter(is_staff=True).values_list('id', flat=True))
    existentes = set(TrainerProfile.objects.filter(user_id__in=admin_ids).values_list('user_id', flat=True))
    TrainerProfile.objects.bulk_create(
        [TrainerProfile(user_id=user_id) for user_id in admin_ids if user_id not in existentes],
        ignore_conflicts=True,
    )


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0006_alter_memberprofile_join_date'),
    ]

    operations = [
        migrations.RunPython(normalizar_roles, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[('admin', 'Administrador'), ('member', 'Cliente')],
                default='member',
                max_length=10,
            ),
        ),
        migrations.AddConstraint(
            model_name='user',
            constraint=models.CheckConstraint(
                condition=models.Q(role__in=('admin', 'member')),
                name='user_role_admin_or_member',
            ),
        ),
    ]
