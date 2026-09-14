import json
from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from billing.models import MemberSubscription, PaymentRecord
from billing.services import membership_access
from plans.models import TrainingPlan
from users.models import MemberProfile, TrainerProfile, User


@pytest.fixture
def cuentas_demo(db):
    instructor = User.objects.create_user(username='trainer2', email='trainer2@gymhub.com', role='trainer')
    TrainerProfile.objects.get_or_create(user=instructor)
    admin = User.objects.create_user(username='admin', email='admin@gymhub.com', is_staff=True, is_superuser=True)
    real = User.objects.create_user(username='real', email='real@example.com')
    for numero in range(1, 5):
        usuario = User.objects.create_user(username=f'cliente{numero}', email=f'cliente.demo{numero:02d}@gymhub.com')
        MemberProfile.objects.get_or_create(user=usuario)
    return [instructor, admin, real]


@pytest.mark.django_db
def test_completa_dos_preserva_cuentas_y_es_repetible(cuentas_demo, tmp_path):
    protegidos = list(User.objects.filter(pk__in=[u.pk for u in cuentas_demo]).order_by('pk').values())
    claves = dict(User.objects.values_list('email', 'password'))
    salida = StringIO()
    call_command('completar_clientes_demo', stdout=salida)
    assert User.objects.count() == 7
    assert 'ELIMINAR:  <cliente.demo03@gymhub.com>' in salida.getvalue()
    respaldo = tmp_path / 'respaldo.json'
    call_command('completar_clientes_demo', yes=True, respaldo=str(respaldo), stdout=StringIO())
    assert json.loads(respaldo.read_text())
    assert respaldo.stat().st_mode & 0o777 == 0o600
    assert User.objects.count() == 5
    assert protegidos == list(User.objects.filter(pk__in=[u.pk for u in cuentas_demo]).order_by('pk').values())
    for perfil in MemberProfile.objects.filter(user__email__startswith="cliente.demo"):
        assert perfil.user.password == claves[perfil.user.email]
        assert perfil.phone and perfil.birth_date and perfil.emergency_contact
        plan = TrainingPlan.objects.get(member=perfil, is_active=True)
        assert plan.workout_days.count() == 3
        assert all(d.exercises.count() == 4 for d in plan.workout_days.all())
        assert plan.nutrition_links.count() == 3
        assert perfil.progress_logs.count() == 2
        assert perfil.workout_sessions.filter(is_completed=True).count() == 2
        assert MemberSubscription.objects.get(member=perfil, is_active=True).status == 'active'
        assert membership_access(perfil)['allowed']
        from progress.models import WorkoutSession
        from progress.views import WorkoutSessionViewSet
        from rest_framework.test import APIRequestFactory, force_authenticate

        dia = plan.workout_days.first()
        sesion = WorkoutSession.objects.create(member=perfil, workout_day=dia)
        for indice, ejercicio in enumerate(dia.exercises.all()):
            solicitud = APIRequestFactory().post('/', {
                'exercise_id': ejercicio.pk,
                'estado': 'omitido' if indice == 0 else 'realizado',
            }, format='json')
            force_authenticate(solicitud, user=perfil.user)
            respuesta = WorkoutSessionViewSet.as_view({'post': 'progreso_ejercicio'})(
                solicitud, pk=sesion.pk,
            )
            assert respuesta.status_code == 200
        sesion.refresh_from_db()
        assert sesion.is_completed
        assert sesion.exercise_logs.filter(estado='omitido').count() == 1
    conteos = (TrainingPlan.objects.count(), MemberSubscription.objects.count(), PaymentRecord.objects.count())
    call_command('completar_clientes_demo', yes=True, respaldo=str(tmp_path / 'segunda.json'), stdout=StringIO())
    assert conteos == (TrainingPlan.objects.count(), MemberSubscription.objects.count(), PaymentRecord.objects.count())


@pytest.mark.django_db
def test_exige_respaldo_y_revierte_fallos(cuentas_demo, tmp_path):
    with pytest.raises(CommandError):
        call_command('completar_clientes_demo', yes=True, stdout=StringIO())
    with patch('users.management.commands.completar_clientes_demo.Command.completar', side_effect=RuntimeError('fallo')):
        with pytest.raises(RuntimeError):
            call_command('completar_clientes_demo', yes=True, respaldo=str(tmp_path / 'fallo.json'), stdout=StringIO())
    assert User.objects.count() == 7
    assert not TrainingPlan.objects.exists()
