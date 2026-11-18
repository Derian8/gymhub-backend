from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from billing.models import MemberSubscription, PaymentRecord
from billing.services import initialize_subscription, mark_payment_paid
from users.models import MemberProfile
from users.services import anotar_estado_clientes, obtener_estado_cliente
from users.views import MemberViewSet


class EstadosClientesTests(TestCase):
    def setUp(self):
        cache.clear()
        self.administrador = get_user_model().objects.create_user(
            username='administrador_estados',
            email='administrador_estados@example.com', role='admin',
        )
        self.cliente = get_user_model().objects.create_user(
            username='cliente_estados',
            email='cliente_estados@example.com', role='member',
        ).memberprofile

    def crear_suscripcion(self, dias=None, estado='active'):
        hoy = timezone.localdate()
        return MemberSubscription.objects.create(
            member=self.cliente, trainer=self.administrador,
            agreed_price='12000', membership_name='Mensual',
            start_date=hoy, next_billing_date=hoy, status=estado,
            current_period_end=(
                hoy + timedelta(days=dias) if dias is not None else None
            ),
        )

    def comprobar_estado(self, esperado, suscripcion):
        cliente = anotar_estado_clientes(
            MemberProfile.objects.filter(pk=self.cliente.pk),
        ).get()
        self.assertEqual(cliente.estado_cliente_cache, esperado)
        self.assertEqual(
            obtener_estado_cliente(self.cliente, suscripcion), esperado,
        )
        for filtro in (
            'membresia_activa', 'membresia_inactiva', 'cliente_inactivo',
        ):
            solicitud = APIRequestFactory().get(
                '/api/members/', {'estado_cliente': filtro},
            )
            force_authenticate(solicitud, user=self.administrador)
            respuesta = MemberViewSet.as_view({'get': 'list'})(solicitud)
            self.assertEqual(respuesta.status_code, 200)
            ids = {item['id'] for item in respuesta.data['results']}
            self.assertEqual(self.cliente.id in ids, filtro == esperado)
            if filtro == esperado:
                self.assertEqual(
                    respuesta.data['results'][0]['estado_cliente'], esperado,
                )

    def test_limites_del_vencimiento_y_atraso(self):
        for dias, esperado in (
            (7, 'membresia_activa'), (0, 'membresia_activa'),
            (-1, 'membresia_inactiva'), (-30, 'membresia_inactiva'),
            (-31, 'cliente_inactivo'),
        ):
            with self.subTest(dias=dias):
                suscripcion = self.crear_suscripcion(dias)
                self.comprobar_estado(esperado, suscripcion)
                suscripcion.delete()

    def test_sin_pago_o_sin_suscripcion_no_hay_membresia_activa(self):
        self.comprobar_estado('membresia_inactiva', None)
        suscripcion = self.crear_suscripcion(estado='pending')
        self.comprobar_estado('membresia_inactiva', suscripcion)

    def test_pago_y_cobro_futuro_mantienen_la_membresia_activa(self):
        suscripcion = self.crear_suscripcion(estado='pending')
        _, cobro = initialize_subscription(suscripcion)
        mark_payment_paid(cobro, method='cash', recorded_by=self.administrador)
        suscripcion.refresh_from_db()
        self.assertTrue(PaymentRecord.objects.filter(
            schedule__subscription=suscripcion, status='pending',
            schedule__due_date__gt=timezone.localdate(),
        ).exists())
        self.comprobar_estado('membresia_activa', suscripcion)

    def test_renovacion_recupera_cliente_con_mas_de_30_dias(self):
        suscripcion = self.crear_suscripcion(-31, estado='expired')
        self.comprobar_estado('cliente_inactivo', suscripcion)
        _, cobro = initialize_subscription(suscripcion)
        mark_payment_paid(cobro, method='cash', recorded_by=self.administrador)
        suscripcion.refresh_from_db()
        self.comprobar_estado('membresia_activa', suscripcion)

    def test_suspension_y_baja_manual_se_respetan(self):
        suscripcion = self.crear_suscripcion(7, estado='suspended')
        self.comprobar_estado('membresia_inactiva', suscripcion)
        self.cliente.is_active = False
        self.cliente.save(update_fields=['is_active'])
        self.comprobar_estado('cliente_inactivo', suscripcion)
