import pytest
from datetime import timedelta

from django.utils import timezone


@pytest.mark.django_db
def test_member_dashboard_summary_includes_risk_and_actions(
    member_client,
    member_profile,
    training_plan,
    payment_schedule_and_record,
):
    from attendance.models import Attendance
    from progress.models import WorkoutSession

    schedule, record = payment_schedule_and_record
    schedule.due_date = timezone.localdate() + timedelta(days=2)
    schedule.save(update_fields=['due_date'])

    Attendance.objects.create(
        member=member_profile,
        check_in_time=timezone.now(),
    )
    WorkoutSession.objects.create(
        member=member_profile,
        workout_day=training_plan.workout_days.first(),
        is_completed=True,
        completed_at=timezone.now() - timedelta(days=12),
    )

    response = member_client.get(f'/api/members/{member_profile.id}/dashboard-summary/')

    assert response.status_code == 200
    assert response.data['payment_status'] == record.status
    assert response.data['days_until_due'] == 2
    assert response.data['streak_asistencia'] >= 1
    assert response.data['riesgo_personal']['score'] > 0
    assert response.data['riesgo_personal']['level'] in ('medium', 'high')
    assert response.data['siguiente_accion']
    assert response.data['resumen_hoy']


@pytest.mark.django_db
def test_trainer_overview_returns_members_at_risk(
    trainer_client,
    trainer_profile,
    membership_plan,
):
    from django.contrib.auth import get_user_model
    from users.models import MemberProfile
    from billing.models import PaymentSchedule, PaymentRecord

    User = get_user_model()
    user = User.objects.create_user(
        username='member_risk',
        email='member_risk@test.com',
        password='member123!',
        role='member',
        first_name='Riesgo',
        last_name='Alto',
    )
    member = user.memberprofile
    member.trainer_asignado = trainer_profile
    member.membership_plan = membership_plan
    member.join_date = timezone.localdate() - timedelta(days=40)
    member.is_active = True
    member.save()
    schedule = PaymentSchedule.objects.create(
        member=member,
        plan=membership_plan,
        due_date=timezone.localdate() - timedelta(days=8),
        grace_period_days=7,
        is_active=True,
    )
    PaymentRecord.objects.create(
        schedule=schedule,
        amount=membership_plan.price_monthly,
        status='late',
    )

    response = trainer_client.get('/api/trainer/gym-overview/')

    assert response.status_code == 200
    assert 'miembros_en_riesgo' in response.data
    assert response.data['payments_overdue'] >= 1
    assert 'members_without_active_plan' in response.data
    assert 'incomplete_prescriptions' in response.data
    assert 'miembros_sin_plan_activo' in response.data
    assert 'miembros_con_prescripcion_incompleta' in response.data
    assert any(item['id'] == member.id for item in response.data['miembros_en_riesgo'])
