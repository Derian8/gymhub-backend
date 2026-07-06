from datetime import timedelta

from dateutil.relativedelta import relativedelta
from django.db import transaction
from django.utils import timezone

from .models import MemberSubscription, PaymentRecord, PaymentSchedule


DEFAULT_GRACE_DAYS = {
    'daily': 0,
    'weekly': 1,
    'biweekly': 2,
    'monthly': 7,
    'quarterly': 7,
    'annual': 7,
}


def default_grace_days(recurrence_type):
    return DEFAULT_GRACE_DAYS.get(recurrence_type, 7)


def next_period_start(period_start, recurrence_type):
    if recurrence_type == 'daily':
        return period_start + timedelta(days=1)
    if recurrence_type == 'weekly':
        return period_start + timedelta(days=7)
    if recurrence_type == 'biweekly':
        return period_start + timedelta(days=14)
    if recurrence_type == 'quarterly':
        return period_start + relativedelta(months=3)
    if recurrence_type == 'annual':
        return period_start + relativedelta(years=1)
    return period_start + relativedelta(months=1)


def period_end(period_start, recurrence_type):
    return next_period_start(period_start, recurrence_type) - timedelta(days=1)


def create_pending_charge(subscription, period_start_date):
    period_end_date = period_end(period_start_date, subscription.recurrence_type)
    schedule, _ = PaymentSchedule.objects.get_or_create(
        subscription=subscription,
        period_start=period_start_date,
        defaults={
            'member': subscription.member,
            'plan': subscription.plan,
            'due_date': period_start_date,
            'period_end': period_end_date,
            'recurrence_type': subscription.recurrence_type,
            'grace_period_days': subscription.grace_period_days,
            'auto_generate_next': subscription.auto_generate_next,
            'is_active': True,
        },
    )
    if schedule.period_end is None:
        schedule.period_end = period_end_date
        schedule.save(update_fields=['period_end'])
    record, _ = PaymentRecord.objects.get_or_create(
        schedule=schedule,
        defaults={
            'amount': subscription.agreed_price,
            'status': 'pending',
        },
    )
    return schedule, record


def initialize_subscription(subscription):
    subscription.current_period_start = None
    subscription.current_period_end = None
    subscription.next_billing_date = subscription.start_date
    subscription.renewal_date = None
    subscription.status = 'suspended'
    subscription.save(update_fields=[
        'current_period_start', 'current_period_end', 'next_billing_date',
        'renewal_date', 'status',
    ])
    return create_pending_charge(subscription, subscription.start_date)


@transaction.atomic
def mark_payment_paid(record, reference='', notes=''):
    record = PaymentRecord.objects.select_for_update().select_related(
        'schedule__subscription', 'schedule__member', 'schedule__plan'
    ).get(pk=record.pk)
    if record.status == 'paid':
        return record, None

    now = timezone.now()
    record.status = 'paid'
    record.paid_at = now
    record.payment_reference = reference
    record.receipt_issued_at = now
    if notes:
        record.notes = notes
    record.save()

    schedule = record.schedule
    schedule.is_active = False
    schedule.save(update_fields=['is_active'])
    subscription = schedule.subscription
    next_schedule = None
    if subscription:
        subscription = MemberSubscription.objects.select_for_update().get(pk=subscription.pk)
        start = schedule.period_start or schedule.due_date
        end = schedule.period_end or period_end(start, subscription.recurrence_type)
        if subscription.current_period_end is None or end > subscription.current_period_end:
            subscription.current_period_start = start
            subscription.current_period_end = end
        subscription.status = 'active'
        subscription.is_active = True
        subscription.renewal_date = subscription.current_period_end
        next_start = subscription.current_period_end + timedelta(days=1)
        subscription.next_billing_date = next_start
        subscription.save(update_fields=[
            'current_period_start', 'current_period_end', 'status', 'is_active',
            'renewal_date', 'next_billing_date',
        ])
        if subscription.auto_generate_next:
            next_schedule, _ = create_pending_charge(subscription, next_start)

    return record, next_schedule


def membership_access(member, on_date=None):
    today = on_date or timezone.localdate()
    subscription = member.subscriptions.filter(is_active=True).order_by('-id').first()
    if not member.is_active:
        return {'allowed': False, 'reason': 'member_inactive', 'days_overdue': 0}
    if not subscription or subscription.status in ('suspended', 'cancelled'):
        return {'allowed': False, 'reason': 'payment_required', 'days_overdue': 0}
    if not subscription.current_period_end:
        return {'allowed': False, 'reason': 'payment_required', 'days_overdue': 0}
    if today <= subscription.current_period_end:
        return {'allowed': True, 'reason': None, 'days_overdue': 0}
    days_overdue = (today - subscription.current_period_end).days
    allowed = days_overdue <= subscription.grace_period_days
    return {
        'allowed': allowed,
        'reason': None if allowed else 'payment_overdue',
        'days_overdue': days_overdue,
    }


def run_daily_billing_maintenance(today=None):
    today = today or timezone.localdate()
    subscriptions_updated = 0
    for subscription in MemberSubscription.objects.filter(
        is_active=True,
    ).exclude(status__in=('suspended', 'cancelled')).iterator():
        if subscription.current_period_end and subscription.current_period_end < today:
            if subscription.status != 'past_due':
                subscription.status = 'past_due'
                subscription.save(update_fields=['status'])
                subscriptions_updated += 1
    return {
        'subscriptions_updated': subscriptions_updated,
        'records_updated': 0,
    }
