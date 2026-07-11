from datetime import date, timedelta

import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from billing.services import (
    default_grace_days,
    mark_payment_paid,
    membership_access,
    period_end,
)


@pytest.mark.parametrize(
    ('recurrence_type', 'start', 'expected_end'),
    [
        ('daily', date(2026, 7, 5), date(2026, 7, 5)),
        ('weekly', date(2026, 7, 5), date(2026, 7, 11)),
        ('biweekly', date(2026, 7, 5), date(2026, 7, 18)),
        ('monthly', date(2026, 1, 31), date(2026, 2, 27)),
        ('annual', date(2024, 2, 29), date(2025, 2, 27)),
    ],
)
def test_period_end(recurrence_type, start, expected_end):
    assert period_end(start, recurrence_type) == expected_end


def test_short_period_default_grace_days():
    assert default_grace_days('daily') == 0
    assert default_grace_days('weekly') == 1
    assert default_grace_days('biweekly') == 2


@pytest.mark.django_db
def test_payment_activates_period_and_creates_next_charge(
    member_profile, membership_plan, trainer_profile
):
    from billing.models import MemberSubscription, PaymentRecord
    from billing.services import initialize_subscription

    membership_plan.recurrence_type = 'weekly'
    membership_plan.grace_period_days = 1
    membership_plan.save(update_fields=['recurrence_type', 'grace_period_days'])
    subscription = MemberSubscription.objects.create(
        member=member_profile,
        plan=membership_plan,
        membership_name=membership_plan.name,
        trainer=trainer_profile,
        agreed_price=10000,
        start_date=date(2026, 7, 5),
        next_billing_date=date(2026, 7, 5),
        recurrence_type='weekly',
        grace_period_days=1,
        auto_generate_next=True,
        is_active=True,
        status='suspended',
    )
    _, record = initialize_subscription(subscription)

    paid, next_schedule = mark_payment_paid(record, reference='CAJA-1')
    subscription.refresh_from_db()

    assert paid.status == 'paid'
    assert subscription.status == 'active'
    assert subscription.current_period_start == date(2026, 7, 5)
    assert subscription.current_period_end == date(2026, 7, 11)
    assert next_schedule.period_start == date(2026, 7, 12)
    assert next_schedule.period_end == date(2026, 7, 18)
    assert PaymentRecord.objects.filter(schedule=next_schedule, status='pending').count() == 1


@pytest.mark.django_db
def test_payment_retry_does_not_duplicate_next_charge(
    member_profile, membership_plan, trainer_profile
):
    from billing.models import MemberSubscription, PaymentSchedule
    from billing.services import initialize_subscription

    subscription = MemberSubscription.objects.create(
        member=member_profile,
        plan=membership_plan,
        membership_name=membership_plan.name,
        trainer=trainer_profile,
        agreed_price=30000,
        start_date=date.today(),
        next_billing_date=date.today(),
        recurrence_type='monthly',
        grace_period_days=7,
        auto_generate_next=True,
        is_active=True,
        status='suspended',
    )
    _, record = initialize_subscription(subscription)
    mark_payment_paid(record)
    mark_payment_paid(record)

    assert PaymentSchedule.objects.filter(subscription=subscription).count() == 2


@pytest.mark.django_db
def test_access_uses_subscription_grace(member_profile, membership_plan, trainer_profile):
    from billing.models import MemberSubscription

    subscription = MemberSubscription.objects.create(
        member=member_profile,
        plan=membership_plan,
        membership_name=membership_plan.name,
        trainer=trainer_profile,
        agreed_price=3000,
        start_date=date.today() - timedelta(days=8),
        next_billing_date=date.today() - timedelta(days=1),
        recurrence_type='weekly',
        grace_period_days=1,
        auto_generate_next=True,
        is_active=True,
        status='past_due',
        current_period_start=date.today() - timedelta(days=8),
        current_period_end=date.today() - timedelta(days=1),
    )

    assert membership_access(member_profile)['allowed'] is True
    subscription.current_period_end = date.today() - timedelta(days=2)
    subscription.save(update_fields=['current_period_end'])
    assert membership_access(member_profile)['allowed'] is False


@pytest.mark.django_db
@override_settings(CRON_SECRET='cron-test-secret')
def test_daily_maintenance_endpoint_requires_secret():
    client = APIClient()

    unauthorized = client.get('/api/internal/daily-membership-maintenance/')
    authorized = client.get(
        '/api/internal/daily-membership-maintenance/',
        HTTP_AUTHORIZATION='Bearer cron-test-secret',
    )

    assert unauthorized.status_code == 401
    assert authorized.status_code == 200
    assert authorized.data['subscriptions_updated'] == 0
