from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework import status

from attendance.models import Attendance
from billing.models import MemberSubscription, PaymentRecord, PaymentSchedule, SeguimientoCobro
from plans.models import Exercise, TrainingPlan, WorkoutDay
from users.models import AuditLog


def crear_membresia_activa(member, trainer, plan, fin=None, gracia=7, estado='active'):
    hoy = timezone.localdate()
    return MemberSubscription.objects.create(
        member=member,
        plan=plan,
        membership_name=plan.name,
        trainer=trainer,
        agreed_price=plan.price,
        start_date=hoy - timedelta(days=30),
        next_billing_date=hoy,
        recurrence_type='monthly',
        grace_period_days=gracia,
        is_active=True,
        status=estado,
        current_period_start=hoy - timedelta(days=30),
        current_period_end=fin or (hoy + timedelta(days=5)),
    )


@pytest.mark.django_db
class TestFlujoDemoPorRoles:
    def test_admin_crea_plan_global_visible_para_cliente_pero_no_para_entrenador(
        self, admin_client, member_client, trainer_client, member_profile,
    ):
        response = admin_client.post('/api/membership-plans/', {
            'name': 'Plan global demo',
            'description': 'Catálogo del gimnasio',
            'price': '30000.00',
            'recurrence_type': 'monthly',
            'grace_period_days': 7,
            'features': '',
            'is_active': True,
        }, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['trainer'] is None
        member_results = member_client.get('/api/membership-plans/').data['results']
        trainer_results = trainer_client.get('/api/membership-plans/').data['results']
        assert response.data['id'] in {item['id'] for item in member_results}
        assert trainer_results == []

    def test_entrenador_recibe_estado_sanitizado_sin_finanzas(
        self, trainer_client, trainer_profile, member_profile, membership_plan,
    ):
        crear_membresia_activa(member_profile, trainer_profile, membership_plan)

        response = trainer_client.get(f'/api/members/{member_profile.id}/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['estado_comercial'] == 'por_vencer'
        assert 'precio_suscripcion_actual' not in response.data
        assert 'membresia_actual' not in response.data
        assert 'membership_plan' not in response.data
        assert trainer_client.get('/api/payment-records/').status_code == status.HTTP_200_OK
        assert trainer_client.get('/api/payment-records/').data['count'] == 0

    def test_ver_rutina_registra_entrada_y_habilita_consulta_directa(
        self, member_client, member_profile, trainer_profile, membership_plan, training_plan,
    ):
        crear_membresia_activa(member_profile, trainer_profile, membership_plan)

        blocked = member_client.get(f'/api/members/{member_profile.id}/active-prescription/')
        opened = member_client.post('/api/member/ver-rutina/', {}, format='json')
        visible = member_client.get(f'/api/members/{member_profile.id}/active-prescription/')

        assert blocked.status_code == status.HTTP_403_FORBIDDEN
        assert opened.status_code == status.HTTP_201_CREATED
        assert opened.data['attendance_created'] is True
        assert opened.data['prescription']['plan_activo']['id'] == training_plan.id
        assert visible.status_code == status.HTTP_200_OK
        assert Attendance.objects.filter(member=member_profile).count() == 1

        repeated = member_client.post('/api/member/ver-rutina/', {}, format='json')
        assert repeated.status_code == status.HTTP_200_OK
        assert repeated.data['attendance_created'] is False
        assert Attendance.objects.filter(member=member_profile).count() == 1

    def test_periodo_de_gracia_permite_entrada(
        self, member_client, member_profile, trainer_profile, membership_plan,
    ):
        crear_membresia_activa(
            member_profile, trainer_profile, membership_plan,
            fin=timezone.localdate() - timedelta(days=2), gracia=7, estado='expired',
        )

        response = member_client.post('/api/member/ver-rutina/', {}, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert Attendance.objects.filter(member=member_profile).exists()

    def test_mora_fuera_de_gracia_bloquea_y_audita(
        self, member_client, member_profile, trainer_profile, membership_plan,
    ):
        crear_membresia_activa(
            member_profile, trainer_profile, membership_plan,
            fin=timezone.localdate() - timedelta(days=8), gracia=7, estado='expired',
        )

        response = member_client.post('/api/member/ver-rutina/', {}, format='json')

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert response.data['blocked'] is True
        assert not Attendance.objects.filter(member=member_profile).exists()
        assert AuditLog.objects.filter(
            user=member_profile.user,
            action_type='ROUTINE_ACCESS_DENIED',
        ).exists()

    def test_excepcion_admin_registra_entrada_pero_no_habilita_rutina(
        self, admin_client, member_client, member_profile, trainer_profile,
        membership_plan, workout_day_a,
    ):
        crear_membresia_activa(
            member_profile, trainer_profile, membership_plan,
            fin=timezone.localdate() - timedelta(days=20), gracia=7, estado='expired',
        )

        exception = admin_client.post('/api/attendance/check-in/', {
            'member_id': member_profile.id,
            'trainer_override': True,
            'override_reason': 'Autorización por visita administrativa.',
        }, format='json')
        routine = member_client.get(f'/api/members/{member_profile.id}/active-prescription/')
        session = member_client.post('/api/workout-sessions/', {
            'workout_day_id': workout_day_a.id,
            'attendance_id': exception.data['id'],
        }, format='json')

        assert exception.status_code == status.HTTP_201_CREATED
        assert exception.data['es_excepcion_comercial'] is True
        assert routine.status_code == status.HTTP_403_FORBIDDEN
        assert session.status_code == status.HTTP_403_FORBIDDEN

    def test_entrenador_no_puede_crear_rutina_para_cliente_bloqueado(
        self, trainer_client, member_profile, trainer_profile, membership_plan,
    ):
        crear_membresia_activa(
            member_profile, trainer_profile, membership_plan,
            fin=timezone.localdate() - timedelta(days=20), gracia=7, estado='expired',
        )
        response = trainer_client.post('/api/plans/', {
            'member': member_profile.id,
            'name': 'Plan bloqueado',
            'goal': 'general',
            'start_date': timezone.localdate().isoformat(),
            'weeks_duration': 4,
            'days_per_week': 3,
            'level': 'beginner',
        }, format='json')

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert not TrainingPlan.objects.filter(name='Plan bloqueado').exists()


@pytest.mark.django_db
class TestReportesAdministrativos:
    def test_admin_gestiona_seguimiento_y_el_pago_lo_resuelve(
        self, admin_client, trainer_client, admin_user, member_profile,
        trainer_profile, membership_plan,
    ):
        subscription = crear_membresia_activa(
            member_profile, trainer_profile, membership_plan,
        )
        hoy = timezone.localdate()
        schedule = PaymentSchedule.objects.create(
            member=member_profile,
            subscription=subscription,
            plan=membership_plan,
            due_date=hoy - timedelta(days=4),
            period_start=hoy,
            period_end=hoy + timedelta(days=30),
            is_active=True,
        )
        payment = PaymentRecord.objects.create(
            schedule=schedule,
            amount=Decimal('30000.00'),
            status='late',
        )

        created = admin_client.post('/api/collection-follow-ups/', {
            'cliente': member_profile.id,
            'estado': 'en_seguimiento',
            'medio_contacto': 'whatsapp',
            'nota': 'Cliente contactado.',
        }, format='json')
        duplicate = admin_client.post('/api/collection-follow-ups/', {
            'cliente': member_profile.id,
            'estado': 'nuevo',
        }, format='json')
        overview = admin_client.get('/api/admin/reports/overview/')

        assert created.status_code == status.HTTP_201_CREATED
        assert duplicate.status_code == status.HTTP_400_BAD_REQUEST
        assert overview.data['alerts'][0]['follow_up_id'] == created.data['id']
        assert overview.data['alerts'][0]['follow_up_status'] == 'en_seguimiento'
        assert trainer_client.post('/api/collection-follow-ups/', {
            'cliente': member_profile.id,
        }).status_code == status.HTTP_403_FORBIDDEN

        paid = admin_client.post(f'/api/payment-records/{payment.id}/mark-paid/', {
            'method': 'cash',
            'payment_reference': '',
            'notes': 'Pago recibido en caja.',
        }, format='json')

        assert paid.status_code == status.HTTP_200_OK
        assert SeguimientoCobro.objects.get(pk=created.data['id']).estado == 'resuelto'
        assert SeguimientoCobro.objects.get(pk=created.data['id']).administrador == admin_user

    def test_reporte_y_exportes_son_solo_para_admin(
        self, admin_client, trainer_client, admin_user, member_profile,
        trainer_profile, membership_plan,
    ):
        subscription = crear_membresia_activa(member_profile, trainer_profile, membership_plan)
        hoy = timezone.localdate()
        schedule = PaymentSchedule.objects.create(
            member=member_profile,
            subscription=subscription,
            plan=membership_plan,
            due_date=hoy,
            period_start=hoy,
            period_end=hoy + timedelta(days=30),
            is_active=False,
        )
        PaymentRecord.objects.create(
            schedule=schedule,
            amount=Decimal('25000.00'),
            status='paid',
            paid_at=timezone.now(),
            metodo_registrado='sinpe',
            registrado_por=admin_user,
        )
        Attendance.objects.create(member=member_profile, checked_in_by=member_profile.user)
        params = f'?fecha_inicio={hoy.replace(day=1)}&fecha_fin={hoy}'

        overview = admin_client.get(f'/api/admin/reports/overview/{params}')
        pdf = admin_client.get(f'/api/admin/reports/export/{params}&formato=pdf')
        csv_response = admin_client.get(f'/api/admin/reports/export/{params}&formato=csv&seccion=pagos')

        assert overview.status_code == status.HTTP_200_OK
        assert Decimal(overview.data['commercial']['collected']) == Decimal('25000.00')
        assert overview.data['access']['entries'] == 1
        assert pdf.status_code == status.HTTP_200_OK
        assert pdf['Content-Type'] == 'application/pdf'
        assert csv_response.status_code == status.HTTP_200_OK
        assert csv_response['Content-Type'].startswith('text/csv')
        assert trainer_client.get(f'/api/admin/reports/overview/{params}').status_code == status.HTTP_403_FORBIDDEN
