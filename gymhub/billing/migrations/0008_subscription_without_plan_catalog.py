from django.db import migrations, models
import django.db.models.deletion


def copy_plan_names_to_subscriptions(apps, schema_editor):
    MemberSubscription = apps.get_model('billing', 'MemberSubscription')

    for subscription in MemberSubscription.objects.select_related('plan').iterator():
        if subscription.plan_id and subscription.plan:
            subscription.membership_name = subscription.plan.name
            subscription.description = subscription.plan.description
            subscription.save(update_fields=['membership_name', 'description'])


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0007_membership_periods_and_crc'),
    ]

    operations = [
        migrations.AddField(
            model_name='membersubscription',
            name='description',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='membersubscription',
            name='membership_name',
            field=models.CharField(default='Membresía', max_length=200),
        ),
        migrations.AlterField(
            model_name='membersubscription',
            name='plan',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='subscriptions',
                to='billing.membershipplan',
            ),
        ),
        migrations.RunPython(copy_plan_names_to_subscriptions, migrations.RunPython.noop),
    ]
