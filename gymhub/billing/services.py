from datetime import timedelta

from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import MemberSubscription, PaymentRecord, PaymentSchedule

VISIBLE_MEMBERSHIP_STATUSES = {'pending', 'active', 'expiring', 'expired', 'suspended'}
OPERATIVE_MEMBERSHIP_STATUSES = {'pending', 'active', 'expiring', 'suspended'}
BLOCKED_ACCESS_STATUSES = {'pending', 'expired', 'suspended', 'cancelled'}


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
    subscription.status = 'pending'
    subscription.save(update_fields=[
        'current_period_start', 'current_period_end', 'next_billing_date',
        'renewal_date', 'status',
    ])
    return create_pending_charge(subscription, subscription.start_date)


def current_member_membership(member):
    return (
        member.subscriptions
        .filter(is_active=True, status__in=VISIBLE_MEMBERSHIP_STATUSES)
        .order_by('-start_date', '-id')
        .first()
    )


def refresh_membership_status(subscription, today=None, save=True):
    today = today or timezone.localdate()
    if not subscription.is_active or subscription.status in ('cancelled', 'suspended'):
        return subscription.status
    if not subscription.current_period_end:
        target = 'pending'
    elif subscription.current_period_end < today:
        target = 'expired'
    elif (subscription.current_period_end - today).days <= settings.MEMBERSHIP_EXPIRING_DAYS:
        target = 'expiring'
    else:
        target = 'active'
    if subscription.status != target:
        subscription.status = target
        if save:
            subscription.save(update_fields=['status'])
    return target


def _payment_summary(record):
    if not record:
        return None
    return {
        'id': record.id,
        'amount': str(record.amount),
        'status': record.status,
        'due_date': record.schedule.due_date.isoformat(),
        'paid_at': record.paid_at.isoformat() if record.paid_at else None,
        'receipt_number': f"REC-{record.receipt_issued_at:%Y%m%d}-{record.id}" if record.receipt_issued_at else None,
    }


def membership_summary(member):
    subscription = current_member_membership(member)
    if subscription:
        refresh_membership_status(subscription)
    last_record = (
        PaymentRecord.objects
        .filter(schedule__member=member, status='paid')
        .select_related('schedule')
        .order_by('-paid_at', '-id')
        .first()
    )
    next_record = (
        PaymentRecord.objects
        .filter(schedule__member=member, schedule__is_active=True, status__in=['pending', 'late'])
        .select_related('schedule')
        .order_by('schedule__due_date', 'id')
        .first()
    )
    access = membership_access(member)
    if not subscription:
        return {
            'membership_id': None,
            'plan_name': None,
            'status': None,
            'start_date': None,
            'end_date': None,
            'days_remaining': None,
            'price': None,
            'next_payment': _payment_summary(next_record),
            'last_payment': _payment_summary(last_record),
            'can_check_in': False,
            'access_reason': access['reason'],
        }
    return {
        'membership_id': subscription.id,
        'plan_name': subscription.membership_name,
        'status': subscription.status,
        'start_date': (
            subscription.current_period_start or subscription.start_date
        ).isoformat(),
        'end_date': subscription.current_period_end.isoformat() if subscription.current_period_end else None,
        'days_remaining': subscription.days_remaining,
        'price': str(subscription.agreed_price),
        'next_payment': _payment_summary(next_record),
        'last_payment': _payment_summary(last_record),
        'can_check_in': access['allowed'],
        'access_reason': access['reason'],
    }


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
    subscription = current_member_membership(member)
    if not member.is_active:
        return {'allowed': False, 'reason': 'member_inactive', 'days_overdue': 0}
    if not subscription:
        return {'allowed': False, 'reason': 'no_membership', 'days_overdue': 0}
    refresh_membership_status(subscription, today=today)
    if not subscription.current_period_end:
        return {'allowed': False, 'reason': 'payment_required', 'days_overdue': 0}
    if subscription.status in {'pending', 'suspended', 'cancelled'}:
        return {'allowed': False, 'reason': 'payment_required', 'days_overdue': 0}
    if subscription.status == 'expired':
        return {
            'allowed': False,
            'reason': 'payment_overdue',
            'days_overdue': max(0, (today - subscription.current_period_end).days),
        }
    if today <= subscription.current_period_end:
        return {'allowed': True, 'reason': None, 'days_overdue': 0}
    days_overdue = (today - subscription.current_period_end).days
    allowed = days_overdue <= subscription.grace_period_days
    return {
        'allowed': allowed,
        'reason': None if allowed else 'payment_overdue',
        'days_overdue': days_overdue,
    }


@transaction.atomic
def renew_membership(subscription, start_date=None):
    subscription = MemberSubscription.objects.select_for_update().get(pk=subscription.pk)
    if subscription.status == 'cancelled':
        raise ValueError('No puedes renovar una membresía cancelada.')
    start = start_date or subscription.next_billing_date or timezone.localdate()
    if subscription.current_period_end and start <= subscription.current_period_end:
        start = subscription.current_period_end + timedelta(days=1)
    schedule, record = create_pending_charge(subscription, start)
    subscription.is_active = True
    subscription.status = 'pending'
    subscription.next_billing_date = start
    subscription.save(update_fields=['is_active', 'status', 'next_billing_date'])
    return subscription, schedule, record


@transaction.atomic
def suspend_membership(subscription, reason=''):
    subscription = MemberSubscription.objects.select_for_update().get(pk=subscription.pk)
    if subscription.status != 'cancelled':
        subscription.status = 'suspended'
        subscription.is_active = True
        if reason:
            subscription.cancellation_reason = reason
        subscription.save(update_fields=['status', 'is_active', 'cancellation_reason'])
    return subscription


@transaction.atomic
def cancel_membership(subscription, reason=''):
    subscription = MemberSubscription.objects.select_for_update().get(pk=subscription.pk)
    subscription.status = 'cancelled'
    subscription.is_active = False
    subscription.cancellation_date = timezone.localdate()
    if reason:
        subscription.cancellation_reason = reason
    subscription.save(update_fields=['status', 'is_active', 'cancellation_date', 'cancellation_reason'])
    PaymentSchedule.objects.filter(subscription=subscription, is_active=True).update(is_active=False)
    return subscription


def run_daily_billing_maintenance(today=None):
    today = today or timezone.localdate()
    subscriptions_updated = 0
    for subscription in MemberSubscription.objects.filter(
        is_active=True,
    ).exclude(status__in=('suspended', 'cancelled')).iterator():
        previous = subscription.status
        refresh_membership_status(subscription, today=today)
        if subscription.status != previous:
            subscriptions_updated += 1
    return {
        'subscriptions_updated': subscriptions_updated,
        'records_updated': 0,
    }
