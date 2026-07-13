from django.db import migrations, models
from django.db.models import Q


def migrate_past_due_to_expired(apps, schema_editor):
    MemberSubscription = apps.get_model('billing', 'MemberSubscription')
    MemberSubscription.objects.filter(status='past_due').update(status='expired')
    MemberSubscription.objects.filter(status='suspended', current_period_end__isnull=True).update(status='pending')


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0008_subscription_without_plan_catalog'),
    ]

    operations = [
        migrations.RunPython(migrate_past_due_to_expired, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='membersubscription',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('active', 'Active'),
                    ('expiring', 'Expiring'),
                    ('expired', 'Expired'),
                    ('suspended', 'Suspended'),
                    ('cancelled', 'Cancelled'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
        migrations.AddConstraint(
            model_name='membersubscription',
            constraint=models.UniqueConstraint(
                fields=('member',),
                condition=Q(is_active=True) & Q(status__in=['pending', 'active', 'expiring', 'suspended']),
                name='billing_unique_operational_member_membership',
            ),
        ),
    ]
