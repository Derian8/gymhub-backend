from datetime import datetime, time, timedelta, timezone as zona_horaria

from django.contrib.auth import get_user_model
from django.db import connection
from django.db.models import BooleanField, CharField, DateField, DateTimeField, IntegerField, Value
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from users.models import ConfiguracionSistema, MemberProfile
from users.services import anotar_prioridad_clientes, get_member_risk_snapshot
from users.views import MemberViewSet


class RendimientoClientesTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        ConfiguracionSistema.principal()
        cls.administrador = get_user_model().objects.create_user(
            username='administrador_rendimiento',
            email='administrador_rendimiento@example.com',
            role='admin',
        )
        for indice in range(12):
            get_user_model().objects.create_user(
                username=f'cliente_rendimiento_{indice}',
                email=f'cliente_rendimiento_{indice}@example.com',
                role='member',
                requiere_cambio_contrasena=True,
            )

    def test_consultas_no_crecen_con_las_filas_de_la_pagina(self):
        vista = MemberViewSet.as_view({'get': 'list'})
        cantidades = []
        for tamano in (5, 12):
            solicitud = APIRequestFactory().get(
                '/api/members/', {'ordering': 'riesgo_desc', 'page_size': tamano},
            )
            force_authenticate(solicitud, user=self.administrador)
            with CaptureQueriesContext(connection) as consultas:
                respuesta = vista(solicitud)
                respuesta.render()
            self.assertEqual(respuesta.status_code, 200)
            self.assertEqual(len(respuesta.data['results']), tamano)
            cantidades.append(len(consultas))
        self.assertEqual(cantidades[0], cantidades[1])
        self.assertLessEqual(cantidades[1], 3)

    def test_puntuacion_sql_respeta_umbrales_y_fechas_del_resumen(self):
        hoy = timezone.localdate()
        base = MemberProfile.objects.order_by('id')[:1]
        for dias in (None, 0, 6, 7, 9, 10, 20, 21, 29, 30):
            for estado_pago, dias_pago in ((None, None), ('late', -5), ('pending', 3), ('pending', 10)):
                with self.subTest(dias=dias, estado_pago=estado_pago, dias_pago=dias_pago):
                    fecha = None if dias is None else datetime.combine(
                        hoy - timedelta(days=dias), time(23, 59), tzinfo=zona_horaria.utc,
                    )
                    clientes = base.annotate(
                        active_plan_id_cached=Value(None, output_field=IntegerField()),
                        active_plan_workout_days_count_cached=Value(0),
                        active_plan_exercises_count_cached=Value(0),
                        entrenamiento_hoy_cache=Value(False, output_field=BooleanField()),
                        last_checkin_at_cached=Value(fecha, output_field=DateTimeField()),
                        last_session_at_cached=Value(fecha, output_field=DateTimeField()),
                        last_progress_at_cached=Value(fecha, output_field=DateTimeField()),
                        latest_payment_status_cached=Value(estado_pago, output_field=CharField()),
                        latest_payment_due_date_cached=Value(
                            None if dias_pago is None else hoy + timedelta(days=dias_pago),
                            output_field=DateField(),
                        ),
                    )
                    cliente = list(anotar_prioridad_clientes(clientes))[0]
                    with self.assertNumQueries(0):
                        resumen = get_member_risk_snapshot(cliente)
                    self.assertEqual(cliente.puntuacion_riesgo, resumen['riesgo_adherencia'])
