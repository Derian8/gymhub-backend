from decimal import Decimal
import re

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status

from users.views import _temporary_password


User = get_user_model()


def test_temporary_password_is_simple_but_unique():
    passwords = {_temporary_password('Ajmena') for _ in range(20)}

    assert len(passwords) == 20
    assert all(re.fullmatch(r'[A-Z][a-zA-Z0-9]{3}-\d{6}', password) for password in passwords)


@pytest.mark.django_db
class TestRegistroClientePago:
    def test_entrenador_no_puede_registrar_ni_cobrar(
        self, trainer_client, trainer_profile, membership_plan,
    ):
        response = trainer_client.post('/api/members/registro-con-pago/', {
            'nombres': 'Cliente',
            'apellidos': 'Bloqueado',
            'correo_electronico': 'bloqueado@test.com',
            'telefono': '8000-0000',
            'entrenador': trainer_profile.id,
            'tipo_membresia': 'catalogo',
            'plan_membresia': membership_plan.id,
            'metodo_pago': 'cash',
        }, format='json')

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_registra_cliente_plan_pago_y_acceso_en_una_operacion(
        self,
        admin_client,
        admin_user,
        trainer_profile,
        membership_plan,
    ):
        response = admin_client.post(
            '/api/members/registro-con-pago/',
            {
                'nombres': 'Ana',
                'apellidos': 'Solano',
                'correo_electronico': 'ana.solano@test.com',
                'telefono': '8888-0000',
                'entrenador': trainer_profile.id,
                'tipo_membresia': 'catalogo',
                'plan_membresia': membership_plan.id,
                'renovacion_automatica': True,
                'metodo_pago': 'sinpe',
                'referencia_pago': 'SINPE-1001',
                'notas_pago': 'Primer pago',
            },
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['member']['email'] == 'ana.solano@test.com'
        assert response.data['membership']['status'] == 'active'
        assert response.data['membership']['can_check_in'] is True
        assert response.data['payment']['status'] == 'paid'
        assert response.data['payment']['metodo_registrado'] == 'sinpe'
        assert response.data['payment']['payment_reference'] == 'SINPE-1001'
        assert response.data['receipt_url'].endswith('/receipt/')
        assert response.data['contrasena_temporal']

        member = User.objects.get(email='ana.solano@test.com').memberprofile
        subscription = member.subscriptions.get()
        payment = subscription.payment_schedules.get(
            period_start=timezone.localdate(),
        ).records.get(status='paid')
        assert member.trainer_asignado_id == trainer_profile.id
        assert subscription.current_period_start == timezone.localdate()
        assert subscription.current_period_end is not None
        assert payment.registrado_por_id == admin_user.id
        assert member.user.audit_logs.filter(
            action_type='client_registered_with_payment',
        ).count() == 0
        assert admin_user.audit_logs.filter(
            action_type='client_registered_with_payment',
        ).exists()

    def test_registra_membresia_personalizada_con_pago_en_efectivo(
        self,
        admin_client,
        trainer_profile,
    ):
        response = admin_client.post(
            '/api/members/registro-con-pago/',
            {
                'nombres': 'Luis',
                'apellidos': 'Mora',
                'correo_electronico': 'luis.mora@test.com',
                'telefono': '8777-0000',
                'entrenador': trainer_profile.id,
                'tipo_membresia': 'personalizada',
                'nombre_membresia': 'Convenio estudiantil',
                'precio_acordado': '25000.00',
                'tipo_recurrencia': 'monthly',
                'dias_gracia': 3,
                'renovacion_automatica': False,
                'metodo_pago': 'cash',
                'referencia_pago': '',
            },
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['membership']['membership_plan'] is None
        assert response.data['membership']['plan_name'] == 'Convenio estudiantil'
        assert Decimal(response.data['membership']['agreed_price']) == Decimal('25000.00')
        assert response.data['payment']['metodo_registrado'] == 'cash'

    def test_referencia_es_obligatoria_fuera_de_efectivo(
        self,
        admin_client,
        trainer_profile,
        membership_plan,
    ):
        response = admin_client.post(
            '/api/members/registro-con-pago/',
            {
                'nombres': 'Carla',
                'apellidos': 'Rojas',
                'correo_electronico': 'carla.rojas@test.com',
                'telefono': '8666-0000',
                'entrenador': trainer_profile.id,
                'tipo_membresia': 'catalogo',
                'plan_membresia': membership_plan.id,
                'metodo_pago': 'transfer',
            },
            format='json',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'referencia_pago' in response.data
        assert not User.objects.filter(email='carla.rojas@test.com').exists()

    def test_revierte_toda_el_alta_si_falla_la_confirmacion_del_pago(
        self,
        admin_client,
        trainer_profile,
        membership_plan,
        mocker,
    ):
        mocker.patch(
            'users.views.mark_payment_paid',
            side_effect=ValueError('No se pudo confirmar el pago.'),
        )

        response = admin_client.post(
            '/api/members/registro-con-pago/',
            {
                'nombres': 'Mario',
                'apellidos': 'Vargas',
                'correo_electronico': 'mario.vargas@test.com',
                'telefono': '8555-0000',
                'entrenador': trainer_profile.id,
                'tipo_membresia': 'catalogo',
                'plan_membresia': membership_plan.id,
                'metodo_pago': 'cash',
            },
            format='json',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert not User.objects.filter(email='mario.vargas@test.com').exists()

    def test_miembro_no_puede_registrar_otro_cliente(
        self,
        member_client,
        membership_plan,
        trainer_profile,
    ):
        response = member_client.post(
            '/api/members/registro-con-pago/',
            {
                'nombres': 'No',
                'apellidos': 'Permitido',
                'correo_electronico': 'no.permitido@test.com',
                'telefono': '8444-0000',
                'entrenador': trainer_profile.id,
                'tipo_membresia': 'catalogo',
                'plan_membresia': membership_plan.id,
                'metodo_pago': 'cash',
            },
            format='json',
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_reintento_no_duplica_cliente_ni_pago(
        self,
        admin_client,
        trainer_profile,
        membership_plan,
    ):
        payload = {
            'nombres': 'Eva',
            'apellidos': 'Campos',
            'correo_electronico': 'eva.campos@test.com',
            'telefono': '8333-0000',
            'entrenador': trainer_profile.id,
            'tipo_membresia': 'catalogo',
            'plan_membresia': membership_plan.id,
            'metodo_pago': 'cash',
        }

        first = admin_client.post('/api/members/registro-con-pago/', payload, format='json')
        second = admin_client.post('/api/members/registro-con-pago/', payload, format='json')

        assert first.status_code == status.HTTP_201_CREATED
        assert second.status_code == status.HTTP_400_BAD_REQUEST
        assert User.objects.filter(email='eva.campos@test.com').count() == 1
        member = User.objects.get(email='eva.campos@test.com').memberprofile
        assert member.payment_schedules.filter(records__status='paid').count() == 1

    def test_pago_confirmado_no_admite_edicion_crud(
        self,
        admin_client,
        trainer_profile,
        membership_plan,
    ):
        response = admin_client.post(
            '/api/members/registro-con-pago/',
            {
                'nombres': 'Sara',
                'apellidos': 'León',
                'correo_electronico': 'sara.leon@test.com',
                'telefono': '8222-0000',
                'entrenador': trainer_profile.id,
                'tipo_membresia': 'catalogo',
                'plan_membresia': membership_plan.id,
                'metodo_pago': 'cash',
            },
            format='json',
        )
        payment_id = response.data['payment']['id']

        edit_response = admin_client.patch(
            f'/api/payment-records/{payment_id}/',
            {'amount': '1.00'},
            format='json',
        )

        assert edit_response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
