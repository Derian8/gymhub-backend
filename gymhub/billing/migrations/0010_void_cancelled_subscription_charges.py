from django.db import migrations, models


def void_non_collectable_charges(apps, schema_editor):
    PaymentRecord = apps.get_model('billing', 'PaymentRecord')

    PaymentRecord.objects.filter(
        status__in=['pending', 'late'],
    ).filter(
        models.Q(schedule__subscription__status='cancelled')
        | models.Q(schedule__is_active=False)
    ).update(
        status='void',
        notes='Cobro anulado automáticamente: la membresía o el calendario ya no está cobrable.',
    )


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0009_member_membership_statuses'),
    ]

    operations = [
        migrations.AlterField(
            model_name='paymentrecord',
            name='status',
            field=models.CharField(
                choices=[
                    ('paid', 'Paid'),
                    ('pending', 'Pending'),
                    ('late', 'Late'),
                    ('void', 'Void'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
        migrations.RunPython(void_non_collectable_charges, migrations.RunPython.noop),
    ]
