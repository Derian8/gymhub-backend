from datetime import timedelta

from dateutil.relativedelta import relativedelta
from django.db import migrations, models
import django.db.models.deletion


def _period_end(start, recurrence_type):
    if recurrence_type == 'daily':
        next_start = start + timedelta(days=1)
    elif recurrence_type == 'weekly':
        next_start = start + timedelta(days=7)
    elif recurrence_type == 'biweekly':
        next_start = start + timedelta(days=14)
    elif recurrence_type == 'quarterly':
        next_start = start + relativedelta(months=3)
    elif recurrence_type == 'annual':
        next_start = start + relativedelta(years=1)
    else:
        next_start = start + relativedelta(months=1)
    return next_start - timedelta(days=1)


def migrate_memberships(apps, schema_editor):
    MembershipPlan = apps.get_model('billing', 'MembershipPlan')
    MemberSubscription = apps.get_model('billing', 'MemberSubscription')
    PaymentSchedule = apps.get_model('billing', 'PaymentSchedule')
    PaymentRecord = apps.get_model('billing', 'PaymentRecord')

    for plan in MembershipPlan.objects.all():
        plan.price = plan.price_monthly
        if 0 < plan.price < 1000:
            plan.price *= 1000
        plan.recurrence_type = 'monthly'
        plan.grace_period_days = 7
        plan.save(update_fields=['price', 'recurrence_type', 'grace_period_days'])

    for subscription in MemberSubscription.objects.all():
        if 0 < subscription.agreed_price < 1000:
            subscription.agreed_price *= 1000
        if subscription.status == 'cancelled':
            subscription.current_period_start = None
            subscription.current_period_end = None
            subscription.is_active = False
            PaymentSchedule.objects.filter(subscription=subscription).update(is_active=False)
        elif subscription.next_billing_date > subscription.start_date:
            subscription.current_period_start = subscription.start_date
            subscription.current_period_end = subscription.next_billing_date - timedelta(days=1)
            subscription.renewal_date = subscription.current_period_end
        else:
            subscription.current_period_start = None
            subscription.current_period_end = None
            subscription.status = 'suspended'
        subscription.save(update_fields=[
            'agreed_price', 'current_period_start', 'current_period_end',
            'renewal_date', 'status', 'is_active',
        ])

    for schedule in PaymentSchedule.objects.all():
        schedule.period_start = schedule.due_date
        schedule.period_end = _period_end(schedule.due_date, schedule.recurrence_type)
        schedule.save(update_fields=['period_start', 'period_end'])

    for record in PaymentRecord.objects.filter(amount__gt=0, amount__lt=1000):
        record.amount *= 1000
        record.save(update_fields=['amount'])


class Migration(migrations.Migration):
    atomic = False

    dependencies = [('billing', '0006_membersubscription_cancellation_date_and_more')]

    operations = [
        migrations.AddField(
            model_name='membershipplan', name='price',
            field=models.DecimalField(
                decimal_places=2, default=0, max_digits=10, null=True,
            ),
        ),
        migrations.AlterField(
            model_name='membershipplan', name='price_monthly',
            field=models.DecimalField(decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AlterField(
            model_name='membershipplan', name='duration_months',
            field=models.PositiveIntegerField(default=1, null=True),
        ),
        migrations.AddField(
            model_name='membershipplan', name='recurrence_type',
            field=models.CharField(
                choices=[
                    ('daily', 'Daily'), ('weekly', 'Weekly'),
                    ('biweekly', 'Biweekly'), ('monthly', 'Monthly'),
                    ('quarterly', 'Quarterly'), ('annual', 'Annual'),
                ], default='monthly', max_length=20, null=True,
            ),
        ),
        migrations.AddField(
            model_name='membershipplan', name='grace_period_days',
            field=models.PositiveIntegerField(default=7, null=True),
        ),
        migrations.AddField(
            model_name='membersubscription', name='current_period_start',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='membersubscription', name='current_period_end',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='paymentschedule', name='period_start',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='paymentschedule', name='period_end',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='membersubscription', name='plan',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='subscriptions', to='billing.membershipplan',
            ),
        ),
        migrations.RunPython(migrate_memberships, migrations.RunPython.noop),
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterField(
                    model_name='membershipplan', name='price',
                    field=models.DecimalField(decimal_places=2, max_digits=10),
                ),
                migrations.AlterField(
                    model_name='membershipplan', name='recurrence_type',
                    field=models.CharField(
                        choices=[
                            ('daily', 'Daily'), ('weekly', 'Weekly'),
                            ('biweekly', 'Biweekly'), ('monthly', 'Monthly'),
                            ('quarterly', 'Quarterly'), ('annual', 'Annual'),
                        ], default='monthly', max_length=20,
                    ),
                ),
                migrations.AlterField(
                    model_name='membershipplan', name='grace_period_days',
                    field=models.PositiveIntegerField(default=7),
                ),
                migrations.RemoveField(
                    model_name='membershipplan', name='price_monthly',
                ),
                migrations.RemoveField(
                    model_name='membershipplan', name='duration_months',
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name='paymentschedule',
            constraint=models.UniqueConstraint(
                fields=('subscription', 'period_start'),
                name='billing_unique_subscription_period',
            ),
        ),
    ]
