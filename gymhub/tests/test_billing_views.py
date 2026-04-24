import pytest
from django.utils import timezone
from rest_framework import status


@pytest.mark.django_db
class TestBillingViews:
    def test_trainer_only_sees_own_membership_plans(self, trainer_client, trainer_profile):
        from django.contrib.auth import get_user_model
        from billing.models import MembershipPlan
        own_plan = MembershipPlan.objects.create(
            trainer=trainer_profile,
            name='Plan propio',
            description='Plan propio',
            price_monthly=55.00,
            duration_months=1,
            is_active=True,
        )

        User = get_user_model()
        other_user = User.objects.create_user(
            username='trainer_billing_other',
            email='trainer-billing-other@test.com',
            password='trainer123!',
            role='trainer',
        )
        other_trainer = other_user.trainerprofile
        MembershipPlan.objects.create(
            trainer=other_trainer,
            name='Plan ajeno',
            description='Plan ajeno',
            price_monthly=75.00,
            duration_months=1,
            is_active=True,
        )

        resp = trainer_client.get('/api/membership-plans/')

        assert resp.status_code == status.HTTP_200_OK
        results = resp.data.get('results', resp.data)
        assert [item['id'] for item in results] == [own_plan.id]

    def test_trainer_can_create_member_subscription_with_agreed_price(
        self,
        trainer_client,
        trainer_profile,
        member_profile,
        membership_plan,
    ):
        from billing.models import MemberSubscription, PaymentRecord, PaymentSchedule

        resp = trainer_client.post('/api/member-subscriptions/', {
            'member': member_profile.id,
            'plan': membership_plan.id,
            'agreed_price': '62.50',
            'start_date': timezone.now().date().isoformat(),
            'next_billing_date': timezone.now().date().isoformat(),
            'recurrence_type': 'monthly',
            'grace_period_days': 7,
            'auto_generate_next': True,
            'is_active': True,
            'status': 'active',
            'renewal_date': timezone.now().date().isoformat(),
            'commercial_notes': 'Primer cierre comercial',
        })

        assert resp.status_code == status.HTTP_201_CREATED
        subscription = MemberSubscription.objects.get(member=member_profile, is_active=True)
        schedule = PaymentSchedule.objects.get(subscription=subscription)
        payment_record = PaymentRecord.objects.get(schedule=schedule)
        member_profile.refresh_from_db()

        assert str(subscription.agreed_price) == '62.50'
        assert subscription.trainer_id == trainer_profile.id
        assert member_profile.membership_plan_id == membership_plan.id
        assert schedule.plan_id == membership_plan.id
        assert schedule.member_id == member_profile.id
        assert str(payment_record.amount) == '62.50'
        assert subscription.status == 'active'
        assert subscription.commercial_notes == 'Primer cierre comercial'

    def test_trainer_cannot_create_subscription_for_member_of_another_trainer(
        self,
        trainer_client,
        trainer_profile,
        membership_plan,
    ):
        from django.contrib.auth import get_user_model
        from users.models import MemberProfile

        User = get_user_model()
        other_trainer_user = User.objects.create_user(
            username='trainer_forbidden',
            email='trainer-forbidden@test.com',
            password='trainer123!',
            role='trainer',
        )
        other_trainer = other_trainer_user.trainerprofile
        other_member_user = User.objects.create_user(
            username='member_forbidden',
            email='member-forbidden@test.com',
            password='member123!',
            role='member',
        )
        other_member = other_member_user.memberprofile
        other_member.membership_plan = membership_plan
        other_member.trainer_asignado = other_trainer
        other_member.is_active = True
        other_member.save(update_fields=['membership_plan', 'trainer_asignado', 'is_active'])

        resp = trainer_client.post('/api/member-subscriptions/', {
            'member': other_member.id,
            'plan': membership_plan.id,
            'agreed_price': '62.50',
            'start_date': timezone.now().date().isoformat(),
            'next_billing_date': timezone.now().date().isoformat(),
            'recurrence_type': 'monthly',
            'grace_period_days': 7,
            'auto_generate_next': True,
            'is_active': True,
        })

        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_member_only_sees_own_payment_schedules(self, member_client, member_profile, membership_plan, trainer_profile):
        from django.contrib.auth import get_user_model
        from users.models import MemberProfile
        from billing.models import PaymentSchedule, MembershipPlan

        own_schedule = PaymentSchedule.objects.create(
            member=member_profile,
            plan=membership_plan,
            due_date=timezone.now().date(),
            is_active=True,
        )

        User = get_user_model()
        other_user = User.objects.create_user(
            username='member_billing_other',
            email='member-billing-other@test.com',
            password='member123!',
            role='member',
        )
        other_plan = MembershipPlan.objects.create(
            trainer=trainer_profile,
            name='Plan alterno',
            description='Plan',
            price_monthly=80.00,
            duration_months=1,
        )
        other_profile, _ = MemberProfile.objects.get_or_create(
            user=other_user,
            defaults={'membership_plan': other_plan, 'is_active': True},
        )
        PaymentSchedule.objects.create(
            member=other_profile,
            plan=other_plan,
            due_date=timezone.now().date(),
            is_active=True,
        )

        resp = member_client.get('/api/payment-schedules/')

        assert resp.status_code == status.HTTP_200_OK
        results = resp.data.get('results', resp.data)
        assert [item['id'] for item in results] == [own_schedule.id]

    def test_member_cannot_create_payment_schedule(self, member_client, member_profile, membership_plan):
        resp = member_client.post('/api/payment-schedules/', {
            'member': member_profile.id,
            'plan': membership_plan.id,
            'due_date': timezone.now().date().isoformat(),
            'recurrence_type': 'monthly',
            'grace_period_days': 7,
            'auto_generate_next': True,
            'is_active': True,
        })

        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_member_cannot_mark_payment_as_paid(self, member_client, member_profile, membership_plan):
        from billing.models import PaymentSchedule, PaymentRecord
        from users.models import AuditLog

        schedule = PaymentSchedule.objects.create(
            member=member_profile,
            plan=membership_plan,
            due_date=timezone.now().date(),
            is_active=True,
        )
        record = PaymentRecord.objects.create(
            schedule=schedule,
            amount=50.00,
            status='pending',
        )

        resp = member_client.post(f'/api/payment-records/{record.id}/mark-paid/')

        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_trainer_can_mark_payment_as_paid(self, trainer_client, member_profile, membership_plan):
        from billing.models import PaymentSchedule, PaymentRecord
        from users.models import AuditLog

        schedule = PaymentSchedule.objects.create(
            member=member_profile,
            plan=membership_plan,
            due_date=timezone.now().date(),
            is_active=True,
        )
        record = PaymentRecord.objects.create(
            schedule=schedule,
            amount=50.00,
            status='pending',
        )
        initial_logs = AuditLog.objects.count()

        resp = trainer_client.post(f'/api/payment-records/{record.id}/mark-paid/', {
            'payment_reference': 'TRX-900',
            'notes': 'Pago confirmado en caja',
        })

        assert resp.status_code == status.HTTP_200_OK
        record.refresh_from_db()
        assert record.status == 'paid'
        assert record.paid_at is not None
        assert record.payment_reference == 'TRX-900'
        assert record.receipt_issued_at is not None
        assert AuditLog.objects.count() == initial_logs + 1
        log = AuditLog.objects.latest('created_at')
        assert log.action_type == 'payment_marked_paid'
        assert log.details['payment_reference'] == 'TRX-900'

    def test_member_creates_payment_method_for_self(self, member_client, member_profile):
        resp = member_client.post('/api/payment-methods/', {
            'type': 'card',
            'details': 'Visa',
            'is_default': True,
            'is_active': True,
        })

        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['member'] == member_profile.id

    def test_trainer_can_filter_payment_records_by_member(self, trainer_client, member_profile, membership_plan, trainer_profile):
        from django.contrib.auth import get_user_model
        from users.models import MemberProfile
        from billing.models import PaymentSchedule, PaymentRecord, MembershipPlan

        own_schedule = PaymentSchedule.objects.create(
            member=member_profile,
            plan=membership_plan,
            due_date=timezone.now().date(),
            is_active=True,
        )
        own_record = PaymentRecord.objects.create(
            schedule=own_schedule,
            amount=50.00,
            status='pending',
        )

        User = get_user_model()
        other_user = User.objects.create_user(
            username='member_billing_filter_other',
            email='member-billing-filter-other@test.com',
            password='member123!',
            role='member',
        )
        other_plan = MembershipPlan.objects.create(
            trainer=trainer_profile,
            name='Plan filtro',
            description='Plan',
            price_monthly=70.00,
            duration_months=1,
        )
        other_profile, _ = MemberProfile.objects.get_or_create(
            user=other_user,
            defaults={
                'membership_plan': other_plan,
                'is_active': True,
            },
        )
        other_schedule = PaymentSchedule.objects.create(
            member=other_profile,
            plan=other_plan,
            due_date=timezone.now().date(),
            is_active=True,
        )
        PaymentRecord.objects.create(
            schedule=other_schedule,
            amount=70.00,
            status='late',
        )

        resp = trainer_client.get(f'/api/payment-records/?member={member_profile.id}')

        assert resp.status_code == status.HTTP_200_OK
        results = resp.data.get('results', resp.data)
        assert [item['id'] for item in results] == [own_record.id]
