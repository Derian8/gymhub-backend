from datetime import date
from io import StringIO

import pytest
from django.core.management import call_command


@pytest.mark.django_db
def test_reset_memberships_dry_run_does_not_modify_data(member_profile, membership_plan, trainer_profile):
    from billing.models import MemberSubscription, PaymentRecord, PaymentSchedule

    member_profile.membership_plan = membership_plan
    member_profile.save(update_fields=['membership_plan'])
    subscription = MemberSubscription.objects.create(
        member=member_profile,
        plan=membership_plan,
        trainer=trainer_profile,
        agreed_price='50.00',
        start_date=date.today(),
        next_billing_date=date.today(),
        recurrence_type='monthly',
        grace_period_days=7,
        is_active=True,
        status='active',
    )
    schedule = PaymentSchedule.objects.create(
        member=member_profile,
        subscription=subscription,
        plan=membership_plan,
        due_date=date.today(),
        is_active=True,
    )
    PaymentRecord.objects.create(schedule=schedule, amount='50.00', status='pending')

    output = StringIO()
    call_command('reset_memberships', stdout=output)

    member_profile.refresh_from_db()
    assert 'Dry-run' in output.getvalue()
    assert member_profile.membership_plan_id == membership_plan.id
    assert MemberSubscription.objects.filter(pk=subscription.pk).exists()
    assert PaymentSchedule.objects.filter(pk=schedule.pk).exists()
    assert PaymentRecord.objects.filter(schedule=schedule).exists()


@pytest.mark.django_db
def test_reset_memberships_confirm_clears_assignments_and_keeps_plans(member_profile, membership_plan, trainer_profile):
    from billing.models import MemberSubscription, MembershipPlan, PaymentRecord, PaymentSchedule

    member_profile.membership_plan = membership_plan
    member_profile.save(update_fields=['membership_plan'])
    subscription = MemberSubscription.objects.create(
        member=member_profile,
        plan=membership_plan,
        trainer=trainer_profile,
        agreed_price='50.00',
        start_date=date.today(),
        next_billing_date=date.today(),
        recurrence_type='monthly',
        grace_period_days=7,
        is_active=True,
        status='active',
    )
    schedule = PaymentSchedule.objects.create(
        member=member_profile,
        subscription=subscription,
        plan=membership_plan,
        due_date=date.today(),
        is_active=True,
    )
    PaymentRecord.objects.create(schedule=schedule, amount='50.00', status='pending')

    output = StringIO()
    call_command('reset_memberships', confirm=True, stdout=output)

    member_profile.refresh_from_db()
    assert 'Membresías existentes eliminadas' in output.getvalue()
    assert member_profile.membership_plan_id is None
    assert not MemberSubscription.objects.exists()
    assert not PaymentSchedule.objects.exists()
    assert not PaymentRecord.objects.exists()
    assert MembershipPlan.objects.filter(pk=membership_plan.pk).exists()
