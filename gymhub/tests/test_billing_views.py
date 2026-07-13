import pytest
from datetime import timedelta
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
            price=55.00,
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
            price=75.00,
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
        assert member_profile.membership_plan_id is None
        assert schedule.plan_id == membership_plan.id
        assert schedule.member_id == member_profile.id
        assert str(payment_record.amount) == '62.50'
        assert subscription.status == 'pending'
        assert subscription.current_period_end is None
        assert subscription.commercial_notes == 'Primer cierre comercial'

    def test_trainer_can_assign_member_membership_from_plan(
        self,
        trainer_client,
        member_profile,
        membership_plan,
    ):
        resp = trainer_client.post('/api/member-memberships/', {
            'member': member_profile.id,
            'membership_plan': membership_plan.id,
            'start_date': timezone.now().date().isoformat(),
            'auto_renew': True,
        })

        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['member'] == member_profile.id
        assert resp.data['membership_plan'] == membership_plan.id
        assert resp.data['plan_name'] == membership_plan.name
        assert resp.data['status'] == 'pending'

    def test_member_membership_prevents_two_operational_memberships(
        self,
        trainer_client,
        member_profile,
        membership_plan,
    ):
        payload = {
            'member': member_profile.id,
            'membership_plan': membership_plan.id,
            'start_date': timezone.now().date().isoformat(),
            'auto_renew': True,
        }

        first = trainer_client.post('/api/member-memberships/', payload)
        second = trainer_client.post('/api/member-memberships/', payload)

        assert first.status_code == status.HTTP_201_CREATED
        assert second.status_code == status.HTTP_400_BAD_REQUEST
        assert 'member' in second.data

    def test_member_membership_actions_and_summary(
        self,
        trainer_client,
        member_profile,
        membership_plan,
    ):
        create_resp = trainer_client.post('/api/member-memberships/', {
            'member': member_profile.id,
            'membership_plan': membership_plan.id,
            'start_date': timezone.now().date().isoformat(),
            'auto_renew': True,
        })
        membership_id = create_resp.data['id']

        renew_resp = trainer_client.post(f'/api/member-memberships/{membership_id}/renew/')
        suspend_resp = trainer_client.post(
            f'/api/member-memberships/{membership_id}/suspend/',
            {'reason': 'Pago en revisión'},
        )
        summary_resp = trainer_client.get(f'/api/members/{member_profile.id}/membership-summary/')
        cancel_resp = trainer_client.post(
            f'/api/member-memberships/{membership_id}/cancel/',
            {'reason': 'Solicitud del miembro'},
        )

        assert renew_resp.status_code == status.HTTP_200_OK
        assert suspend_resp.status_code == status.HTTP_200_OK
        assert suspend_resp.data['status'] == 'suspended'
        assert summary_resp.status_code == status.HTTP_200_OK
        assert summary_resp.data['membership_id'] == membership_id
        assert summary_resp.data['can_check_in'] is False
        assert cancel_resp.status_code == status.HTTP_200_OK
        assert cancel_resp.data['status'] == 'cancelled'

    def test_member_only_reads_own_membership_summary(
        self,
        member_client,
        trainer_client,
        member_profile,
        membership_plan,
    ):
        trainer_client.post('/api/member-memberships/', {
            'member': member_profile.id,
            'membership_plan': membership_plan.id,
            'start_date': timezone.now().date().isoformat(),
            'auto_renew': True,
        })

        resp = member_client.get('/api/my-membership/')

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['membership_id'] is not None
        assert resp.data['plan_name'] == membership_plan.name

    def test_trainer_can_create_member_subscription_without_plan_catalog(
        self,
        trainer_client,
        trainer_profile,
        member_profile,
    ):
        from billing.models import MemberSubscription, PaymentRecord, PaymentSchedule

        today = timezone.now().date().isoformat()
        resp = trainer_client.post('/api/member-subscriptions/', {
            'member': member_profile.id,
            'membership_name': 'Mensual personalizada',
            'description': 'Creada directamente para el cliente',
            'agreed_price': '72.00',
            'start_date': today,
            'recurrence_type': 'biweekly',
            'grace_period_days': 2,
            'auto_generate_next': True,
            'is_active': True,
            'status': 'active',
        })

        assert resp.status_code == status.HTTP_201_CREATED
        subscription = MemberSubscription.objects.get(member=member_profile, is_active=True)
        schedule = PaymentSchedule.objects.get(subscription=subscription)
        payment_record = PaymentRecord.objects.get(schedule=schedule)

        assert subscription.plan_id is None
        assert subscription.membership_name == 'Mensual personalizada'
        assert subscription.description == 'Creada directamente para el cliente'
        assert subscription.recurrence_type == 'biweekly'
        assert subscription.grace_period_days == 2
        assert schedule.plan_id is None
        assert schedule.resolved_membership_name == 'Mensual personalizada'
        assert str(payment_record.amount) == '72.00'

    def test_direct_member_subscription_is_visible_in_member_summary(
        self,
        trainer_client,
        member_profile,
    ):
        today = timezone.now().date().isoformat()
        create_resp = trainer_client.post('/api/member-subscriptions/', {
            'member': member_profile.id,
            'membership_name': 'Derian mensual',
            'description': 'Membresía creada desde cero',
            'agreed_price': '72.00',
            'start_date': today,
            'recurrence_type': 'monthly',
            'grace_period_days': 7,
            'auto_generate_next': True,
            'is_active': True,
        })

        assert create_resp.status_code == status.HTTP_201_CREATED

        detail_resp = trainer_client.get(f'/api/members/{member_profile.id}/')

        assert detail_resp.status_code == status.HTTP_200_OK
        summary = detail_resp.data['membresia_actual']
        assert summary is not None
        assert summary['subscription_id'] == create_resp.data['id']
        assert summary['plan_id'] is None
        assert summary['plan_name'] == 'Derian mensual'
        assert summary['status'] == 'pending'
        assert summary['access_allowed'] is False

    def test_cancelled_subscription_is_not_visible_in_member_summary(
        self,
        trainer_client,
        trainer_profile,
        member_profile,
    ):
        from billing.models import MemberSubscription

        today = timezone.now().date()
        MemberSubscription.objects.create(
            member=member_profile,
            plan=None,
            membership_name='Membresía cancelada',
            trainer=trainer_profile,
            agreed_price='12000.00',
            start_date=today,
            next_billing_date=today,
            recurrence_type='weekly',
            grace_period_days=7,
            is_active=False,
            status='cancelled',
            cancellation_date=today,
        )

        detail_resp = trainer_client.get(f'/api/members/{member_profile.id}/')

        assert detail_resp.status_code == status.HTTP_200_OK
        assert detail_resp.data['membresia_actual'] is None

    def test_trainer_can_create_new_subscription_when_member_has_cancelled_history(
        self,
        trainer_client,
        trainer_profile,
        member_profile,
    ):
        from billing.models import MemberSubscription

        today = timezone.now().date()
        MemberSubscription.objects.create(
            member=member_profile,
            plan=None,
            membership_name='Membresía cancelada',
            trainer=trainer_profile,
            agreed_price='12000.00',
            start_date=today,
            next_billing_date=today,
            recurrence_type='weekly',
            grace_period_days=7,
            is_active=False,
            status='cancelled',
            cancellation_date=today,
        )

        create_resp = trainer_client.post('/api/member-subscriptions/', {
            'member': member_profile.id,
            'membership_name': 'Membresía nueva',
            'description': 'Creada después de historial cancelado',
            'agreed_price': '12000.00',
            'start_date': today.isoformat(),
            'recurrence_type': 'weekly',
            'grace_period_days': 7,
            'auto_generate_next': True,
            'is_active': True,
        })

        assert create_resp.status_code == status.HTTP_201_CREATED
        active_subscriptions = MemberSubscription.objects.filter(member=member_profile, is_active=True)
        assert active_subscriptions.count() == 1
        assert active_subscriptions.get().membership_name == 'Membresía nueva'

        detail_resp = trainer_client.get(f'/api/members/{member_profile.id}/')
        assert detail_resp.data['membresia_actual']['subscription_id'] == create_resp.data['id']

    def test_members_endpoint_includes_current_membership_summary(
        self,
        trainer_client,
        trainer_profile,
        member_profile,
        membership_plan,
    ):
        from billing.models import MemberSubscription

        today = timezone.now().date()
        subscription = MemberSubscription.objects.create(
            member=member_profile,
            plan=membership_plan,
            membership_name='Plan Test',
            trainer=trainer_profile,
            agreed_price='62.50',
            start_date=today,
            next_billing_date=today,
            recurrence_type='monthly',
            grace_period_days=7,
            is_active=True,
            status='active',
            current_period_start=today,
            current_period_end=today + timedelta(days=30),
            renewal_date=today + timedelta(days=30),
        )

        resp = trainer_client.get('/api/members/')

        assert resp.status_code == status.HTTP_200_OK
        results = resp.data.get('results', resp.data)
        item = next(member for member in results if member['id'] == member_profile.id)
        summary = item['membresia_actual']

        assert item['membership_plan_nombre'] == 'Plan Test'
        assert summary['subscription_id'] == subscription.id
        assert summary['plan_id'] == membership_plan.id
        assert summary['plan_name'] == 'Plan Test'
        assert summary['agreed_price'] == '62.50'
        assert summary['recurrence_type'] == 'monthly'
        assert summary['status'] == 'active'
        assert summary['access_allowed'] is True

    @pytest.mark.parametrize('recurrence_type', ['daily', 'weekly', 'biweekly'])
    def test_trainer_can_create_short_recurrence_member_subscription(
        self,
        trainer_client,
        member_profile,
        membership_plan,
        recurrence_type,
    ):
        from billing.models import MemberSubscription, PaymentSchedule

        membership_plan.recurrence_type = recurrence_type
        membership_plan.grace_period_days = {
            'daily': 0,
            'weekly': 1,
            'biweekly': 2,
        }[recurrence_type]
        membership_plan.save(update_fields=['recurrence_type', 'grace_period_days'])

        resp = trainer_client.post('/api/member-subscriptions/', {
            'member': member_profile.id,
            'plan': membership_plan.id,
            'agreed_price': '25.00',
            'start_date': timezone.now().date().isoformat(),
            'next_billing_date': timezone.now().date().isoformat(),
            'recurrence_type': recurrence_type,
            'grace_period_days': 7,
            'auto_generate_next': True,
            'is_active': True,
            'status': 'active',
        })

        assert resp.status_code == status.HTTP_201_CREATED
        subscription = MemberSubscription.objects.get(member=member_profile, is_active=True)
        schedule = PaymentSchedule.objects.get(subscription=subscription)
        assert subscription.recurrence_type == recurrence_type
        assert schedule.recurrence_type == recurrence_type
        assert schedule.period_start == timezone.now().date()

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
            price=80.00,
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

    def test_void_payment_record_cannot_be_marked_paid(self, trainer_client, member_profile, membership_plan):
        from billing.models import PaymentSchedule, PaymentRecord

        schedule = PaymentSchedule.objects.create(
            member=member_profile,
            plan=membership_plan,
            due_date=timezone.now().date(),
            is_active=False,
        )
        record = PaymentRecord.objects.create(
            schedule=schedule,
            amount=50.00,
            status='void',
        )

        resp = trainer_client.post(f'/api/payment-records/{record.id}/mark-paid/')

        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert resp.data['error'] == 'Este cobro fue anulado y no debe registrarse como pagado.'
        record.refresh_from_db()
        assert record.status == 'void'
        assert record.paid_at is None

    def test_payment_records_hide_void_by_default_and_allow_history(self, trainer_client, member_profile, membership_plan):
        from billing.models import PaymentSchedule, PaymentRecord

        active_schedule = PaymentSchedule.objects.create(
            member=member_profile,
            plan=membership_plan,
            due_date=timezone.now().date(),
            is_active=True,
        )
        visible_record = PaymentRecord.objects.create(
            schedule=active_schedule,
            amount=50.00,
            status='pending',
        )
        inactive_schedule = PaymentSchedule.objects.create(
            member=member_profile,
            plan=membership_plan,
            due_date=timezone.now().date() - timedelta(days=1),
            is_active=False,
        )
        void_record = PaymentRecord.objects.create(
            schedule=inactive_schedule,
            amount=50.00,
            status='void',
        )

        default_resp = trainer_client.get(f'/api/payment-records/?member={member_profile.id}')
        history_resp = trainer_client.get(f'/api/payment-records/?member={member_profile.id}&include_void=true')

        assert default_resp.status_code == status.HTTP_200_OK
        assert [item['id'] for item in default_resp.data.get('results', default_resp.data)] == [visible_record.id]
        assert history_resp.status_code == status.HTTP_200_OK
        history_ids = [item['id'] for item in history_resp.data.get('results', history_resp.data)]
        assert visible_record.id in history_ids
        assert void_record.id in history_ids

    def test_cancel_membership_voids_pending_charges(self, trainer_client, member_profile, membership_plan):
        from billing.models import MemberSubscription, PaymentRecord

        create_resp = trainer_client.post('/api/member-memberships/', {
            'member': member_profile.id,
            'membership_plan': membership_plan.id,
            'start_date': timezone.now().date().isoformat(),
            'auto_renew': True,
        })
        subscription_id = create_resp.data['id']

        cancel_resp = trainer_client.post(
            f'/api/member-memberships/{subscription_id}/cancel/',
            {'reason': 'Corrección de membresía duplicada'},
        )

        assert cancel_resp.status_code == status.HTTP_200_OK
        subscription = MemberSubscription.objects.get(pk=subscription_id)
        record = PaymentRecord.objects.get(schedule__subscription=subscription)
        assert subscription.status == 'cancelled'
        assert record.status == 'void'
        assert record.schedule.is_active is False

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
            price=70.00,
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
