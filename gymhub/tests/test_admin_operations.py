from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework import status


def crear_suscripcion_vigente(member, trainer, plan):
    from billing.models import MemberSubscription

    return MemberSubscription.objects.create(
        member=member,
        trainer=trainer,
        plan=plan,
        membership_name=plan.name,
        agreed_price=plan.price,
        start_date=date.today() - timedelta(days=10),
        next_billing_date=date.today() + timedelta(days=20),
        recurrence_type='monthly',
        grace_period_days=7,
        is_active=True,
        status='active',
        current_period_start=date.today() - timedelta(days=10),
        current_period_end=date.today() + timedelta(days=20),
    )


def crear_plantilla(trainer):
    from plans.models import PlantillaDiaEntrenamiento, PlantillaEjercicio, PlantillaEntrenamiento

    plantilla = PlantillaEntrenamiento.objects.create(
        trainer=trainer,
        nombre='Rutina base rápida',
        objetivo='general',
        dias_por_semana_sugeridos=3,
        modo_ejecucion='cycle',
    )
    dia = PlantillaDiaEntrenamiento.objects.create(
        plantilla=plantilla,
        nombre='Cuerpo completo',
        etiqueta_dia='A',
        orden=0,
    )
    PlantillaEjercicio.objects.create(
        dia=dia,
        nombre='Sentadilla goblet',
        grupo_muscular='legs',
        tipo_ejercicio='strength',
        series=3,
        rango_repeticiones='10-12',
        descanso_segundos=60,
        orden=0,
    )
    return plantilla


@pytest.mark.django_db
class TestAdminDashboardOperations:
    def test_future_pending_payment_keeps_client_current(
        self, admin_client, trainer_client, member_profile, trainer_profile, membership_plan,
    ):
        from billing.models import PaymentRecord, PaymentSchedule

        subscription = crear_suscripcion_vigente(member_profile, trainer_profile, membership_plan)
        schedule = PaymentSchedule.objects.create(
            member=member_profile,
            subscription=subscription,
            plan=membership_plan,
            due_date=date.today() + timedelta(days=5),
            period_start=date.today() + timedelta(days=20),
            period_end=date.today() + timedelta(days=50),
            is_active=True,
        )
        PaymentRecord.objects.create(schedule=schedule, amount=Decimal('25000'), status='pending')

        response = admin_client.get('/api/admin/dashboard/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['commercial']['current_clients'] == 1
        assert response.data['commercial']['due_soon_count'] == 1
        assert response.data['training']['without_routine_count'] == 1
        assert trainer_client.get('/api/admin/dashboard/').status_code == status.HTTP_403_FORBIDDEN

    def test_late_payment_removes_client_from_current(
        self, admin_client, member_profile, trainer_profile, membership_plan,
    ):
        from billing.models import PaymentRecord, PaymentSchedule

        subscription = crear_suscripcion_vigente(member_profile, trainer_profile, membership_plan)
        schedule = PaymentSchedule.objects.create(
            member=member_profile,
            subscription=subscription,
            plan=membership_plan,
            due_date=date.today() - timedelta(days=2),
            period_start=date.today() - timedelta(days=30),
            period_end=date.today(),
            is_active=True,
        )
        PaymentRecord.objects.create(schedule=schedule, amount=Decimal('25000'), status='late')

        response = admin_client.get('/api/admin/dashboard/')

        assert response.data['commercial']['current_clients'] == 0
        assert response.data['commercial']['overdue_count'] == 1
        assert response.data['payments']['overdue'][0]['member_id'] == member_profile.id

    def test_pending_payment_past_due_is_not_current_even_during_grace(
        self, admin_client, member_profile, trainer_profile, membership_plan,
    ):
        from billing.models import PaymentRecord, PaymentSchedule

        subscription = crear_suscripcion_vigente(member_profile, trainer_profile, membership_plan)
        schedule = PaymentSchedule.objects.create(
            member=member_profile,
            subscription=subscription,
            plan=membership_plan,
            due_date=date.today() - timedelta(days=1),
            grace_period_days=7,
            is_active=True,
        )
        PaymentRecord.objects.create(schedule=schedule, amount=Decimal('25000'), status='pending')

        response = admin_client.get('/api/admin/dashboard/')

        assert response.data['commercial']['current_clients'] == 0
        assert response.data['commercial']['overdue_count'] == 1


@pytest.mark.django_db
class TestQuickRoutineAssignment:
    def test_admin_publishes_existing_client_draft_without_copying_it(
        self, admin_client, member_profile, trainer_profile, membership_plan,
    ):
        from plans.models import Exercise, TrainingPlan, WorkoutDay

        crear_suscripcion_vigente(member_profile, trainer_profile, membership_plan)
        draft = TrainingPlan.objects.create(
            member=member_profile,
            trainer=trainer_profile,
            name='Plan creado independientemente',
            goal='muscle_gain',
            start_date=date.today(),
            weeks_duration=8,
            days_per_week=3,
            status='draft',
            is_active=False,
        )
        day = WorkoutDay.objects.create(
            plan=draft, name='Día personalizado', day_label='A', order=0,
        )
        exercise = Exercise.objects.create(
            workout_day=day,
            name='Ejercicio personalizado',
            muscle_group='legs',
            sets=5,
            reps_range='5-8',
            rest_seconds=120,
            order=0,
        )

        response = admin_client.post('/api/plans/assign-template/', {
            'source_type': 'draft',
            'plan_id': draft.id,
            'member_id': member_profile.id,
            'trainer_id': trainer_profile.id,
            'start_date': date.today().isoformat(),
            'weeks_duration': 6,
            'confirm_trainer_change': False,
        }, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        draft.refresh_from_db()
        exercise.refresh_from_db()
        assert response.data['id'] == draft.id
        assert draft.status == 'active'
        assert draft.weeks_duration == 6
        assert draft.end_date == date.today() + timedelta(weeks=6)
        assert exercise.name == 'Ejercicio personalizado'

    def test_admin_publishes_template_for_client_without_routine(
        self, admin_client, member_profile, trainer_profile, membership_plan,
    ):
        from plans.models import TrainingPlan

        crear_suscripcion_vigente(member_profile, trainer_profile, membership_plan)
        plantilla = crear_plantilla(trainer_profile)

        response = admin_client.post('/api/plans/assign-template/', {
            'member_id': member_profile.id,
            'trainer_id': trainer_profile.id,
            'template_id': plantilla.id,
            'start_date': date.today().isoformat(),
            'weeks_duration': 6,
            'confirm_trainer_change': False,
        }, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        plan = TrainingPlan.objects.get(id=response.data['id'])
        assert plan.status == 'active'
        assert plan.publicado_en is not None
        assert plan.workout_days.first().exercises.count() == 1
        assert plan.end_date == date.today() + timedelta(weeks=6)

    def test_ending_plan_schedules_replacement_and_daily_task_activates_it(
        self, admin_client, training_plan, trainer_profile, membership_plan,
    ):
        from plans.models import TrainingPlan
        from plans.tasks import activar_planes_programados

        member = training_plan.member
        crear_suscripcion_vigente(member, trainer_profile, membership_plan)
        training_plan.end_date = date.today() + timedelta(days=5)
        training_plan.save(update_fields=['end_date'])
        plantilla = crear_plantilla(trainer_profile)
        start_date = training_plan.end_date + timedelta(days=1)

        response = admin_client.post('/api/plans/assign-template/', {
            'member_id': member.id,
            'trainer_id': trainer_profile.id,
            'template_id': plantilla.id,
            'start_date': start_date.isoformat(),
            'weeks_duration': 8,
            'confirm_trainer_change': False,
        }, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        replacement = TrainingPlan.objects.get(id=response.data['id'])
        assert replacement.status == 'scheduled'
        assert training_plan.status == 'active'

        result = activar_planes_programados(start_date)

        replacement.refresh_from_db()
        training_plan.refresh_from_db()
        assert result['activated'] == 1
        assert replacement.status == 'active'
        assert training_plan.status == 'finished'

    def test_blocked_client_cannot_receive_published_template(
        self, admin_client, member_profile, trainer_profile,
    ):
        plantilla = crear_plantilla(trainer_profile)

        response = admin_client.post('/api/plans/assign-template/', {
            'member_id': member_profile.id,
            'trainer_id': trainer_profile.id,
            'template_id': plantilla.id,
            'start_date': date.today().isoformat(),
            'weeks_duration': 8,
            'confirm_trainer_change': False,
        }, format='json')

        assert response.status_code == status.HTTP_403_FORBIDDEN
