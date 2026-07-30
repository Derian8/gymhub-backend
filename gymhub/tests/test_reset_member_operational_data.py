from datetime import date
from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone


@pytest.fixture
def operational_data(
    db,
    attendance_record,
    bench_exercise,
    member_profile,
    member_user,
    membership_plan,
    payment_schedule_and_record,
    trainer_profile,
    training_plan,
    workout_session,
):
    from ai_chat.models import AIChatConversation, AIChatMessage
    from alerts.models import InactivityAlert, InactivityAlertContact, MemberJustifiedAbsence, Notification
    from billing.models import MemberSubscription, PaymentInstruction, PaymentMethod
    from classes.models import ClassEnrollment, GymClass
    from nutrition.models import NutritionGuideline, NutritionProfile, PlantillaNutricion, PlanNutritionLink
    from plans.models import GymMachine, PlantillaEntrenamiento
    from progress.models import ExerciseLog, ProgressLog
    from users.models import AuditLog

    subscription = MemberSubscription.objects.create(
        member=member_profile,
        trainer=trainer_profile,
        plan=membership_plan,
        membership_name=membership_plan.name,
        agreed_price=membership_plan.price,
        start_date=date.today(),
        next_billing_date=date.today(),
    )
    PaymentMethod.objects.create(member=member_profile, type='cash')
    PaymentInstruction.objects.create(plan=membership_plan, title='Sinpe', steps_text='Pagar')

    ExerciseLog.objects.create(session=workout_session, exercise=bench_exercise, sets_completed=3, reps_completed=10)
    ProgressLog.objects.create(member=member_profile, weight_kg=75)

    alert = InactivityAlert.objects.create(member=member_profile, days_inactive=8)
    InactivityAlertContact.objects.create(
        member=member_profile,
        trainer=trainer_profile,
        alert=alert,
        method='call',
        result='Sin respuesta',
    )
    MemberJustifiedAbsence.objects.create(
        member=member_profile,
        trainer=trainer_profile,
        start_date=date.today(),
        end_date=date.today(),
        reason='Prueba',
    )
    Notification.objects.create(user=member_user, message='Prueba')

    conversation = AIChatConversation.objects.create(
        member=member_profile,
        usuario=member_user,
        modo='member',
    )
    AIChatMessage.objects.create(
        conversation=conversation,
        member=member_profile,
        role='user',
        content='Hola',
    )

    gym_class = GymClass.objects.create(
        trainer=trainer_profile,
        name='Funcional',
        schedule=timezone.now(),
        current_enrolled=1,
    )
    ClassEnrollment.objects.create(member=member_profile, gym_class=gym_class)

    guideline = NutritionGuideline.objects.create(
        goal_type='muscle_gain',
        title='Proteína',
        description='Guía reutilizable',
    )
    NutritionProfile.objects.create(training_plan=training_plan, goal_type='muscle_gain')
    PlanNutritionLink.objects.create(plan=training_plan, guideline=guideline)
    PlantillaNutricion.objects.create(
        trainer=trainer_profile,
        nombre='Nutrición base',
        goal_type='muscle_gain',
    )
    GymMachine.objects.create(name='Polea')
    PlantillaEntrenamiento.objects.create(trainer=trainer_profile, nombre='Rutina base')
    AuditLog.objects.create(
        user=member_user,
        action_type='test',
        target_model='MemberProfile',
        target_id=str(member_profile.id),
    )

    return {
        'password_hash': member_user.password,
        'trainer_id': trainer_profile.id,
        'subscription_id': subscription.id,
    }


@pytest.mark.django_db
def test_reset_member_operational_data_is_dry_run_by_default(operational_data):
    from plans.models import TrainingPlan
    from billing.models import MemberSubscription

    output = StringIO()
    call_command('reset_member_operational_data', stdout=output)

    assert TrainingPlan.objects.exists()
    assert MemberSubscription.objects.exists()
    assert 'Dry-run: no se modificó ningún dato' in output.getvalue()


@pytest.mark.django_db
def test_reset_member_operational_data_clears_activity_and_preserves_identity_and_catalogs(
    operational_data,
    member_profile,
    member_user,
    membership_plan,
):
    from ai_chat.models import AIChatConversation, AIChatMessage
    from alerts.models import InactivityAlert, InactivityAlertContact, MemberJustifiedAbsence, Notification
    from attendance.models import Attendance
    from billing.models import MemberSubscription, PaymentInstruction, PaymentMethod, PaymentRecord, PaymentSchedule
    from classes.models import ClassEnrollment, GymClass
    from nutrition.models import NutritionGuideline, NutritionProfile, PlantillaNutricion, PlanNutritionLink
    from plans.models import Exercise, GymMachine, PlantillaEntrenamiento, TrainingPlan, WorkoutDay
    from progress.models import ExerciseLog, ProgressLog, WorkoutSession
    from users.models import AuditLog, MemberProfile, User

    output = StringIO()
    call_command('reset_member_operational_data', confirm=True, stdout=output)

    for model in (
        AIChatConversation, AIChatMessage, InactivityAlert, InactivityAlertContact,
        MemberJustifiedAbsence, Notification, Attendance, MemberSubscription,
        PaymentMethod, PaymentRecord, PaymentSchedule, ClassEnrollment,
        NutritionProfile, PlanNutritionLink, TrainingPlan, WorkoutDay, Exercise,
        ProgressLog, WorkoutSession, ExerciseLog,
    ):
        assert model.objects.count() == 0, model.__name__

    member_user.refresh_from_db()
    member_profile.refresh_from_db()
    assert User.objects.filter(pk=member_user.pk).exists()
    assert member_user.password == operational_data['password_hash']
    assert member_profile.trainer_asignado_id == operational_data['trainer_id']
    assert member_profile.membership_plan_id is None
    assert AuditLog.objects.count() == 1

    assert GymMachine.objects.count() == 1
    assert PlantillaEntrenamiento.objects.count() == 1
    assert NutritionGuideline.objects.count() == 1
    assert PlantillaNutricion.objects.count() == 1
    assert PaymentInstruction.objects.filter(plan=membership_plan).exists()
    assert GymClass.objects.get().current_enrolled == 0
    assert 'Reinicio completado' in output.getvalue()

    call_command('reset_member_operational_data', confirm=True, stdout=StringIO())
    assert MemberProfile.objects.get(pk=member_profile.pk).trainer_asignado_id == operational_data['trainer_id']
