import json
import subprocess
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from ai_chat.agentes_administracion import generar_analisis_administrativo
from ai_chat.proveedor_copilot import consultar_copilot


@override_settings(
    AI_PROVIDER='copilot_hybrid',
    COPILOT_GITHUB_TOKEN='token-ficticio',
    OPENROUTER_API_KEY='router-ficticio',
    COPILOT_TIMEOUT_SECONDS=45,
)
class PruebasCopilot(SimpleTestCase):
    @patch('ai_chat.agentes_administracion.get_admin_overview', return_value={})
    @patch('ai_chat.agentes_administracion._consultar_herramientas_openrouter')
    @patch('ai_chat.agentes_administracion.consultar_copilot')
    def test_copilot_principal_no_consume_openrouter(self, copilot, router, resumen):
        copilot.return_value = ('Revisar cobros.', ['consultar_cobranza'])
        resultado = generar_analisis_administrativo(None, 'Revisa pagos')
        self.assertEqual(resultado['fuente'], 'copilot')
        router.assert_not_called()

    @patch('ai_chat.agentes_administracion.get_admin_overview', return_value={})
    @patch('ai_chat.agentes_administracion._consultar_herramientas_openrouter')
    @patch('ai_chat.agentes_administracion.consultar_copilot')
    def test_fallo_copilot_activa_openrouter(self, copilot, router, resumen):
        copilot.side_effect = ValueError('Cuota')
        router.return_value = ('Respuesta de respaldo.', ['consultar_cobranza'])
        resultado = generar_analisis_administrativo(None, 'Revisa pagos')
        self.assertEqual(resultado['fuente'], 'openrouter')
        self.assertEqual(router.call_count, 1)

    @patch('ai_chat.agentes_administracion.get_admin_overview', return_value={})
    @patch('ai_chat.agentes_administracion._consultar_herramientas_openrouter', side_effect=ValueError('Sin cuota'))
    @patch('ai_chat.agentes_administracion.consultar_copilot', side_effect=ValueError('Sin cuota'))
    def test_fallo_ambos_proveedores_devuelve_reglas(self, copilot, router, resumen):
        self.assertTrue(generar_analisis_administrativo(None, 'Revisa pagos')['respaldo_activo'])

    @patch('ai_chat.proveedor_copilot.subprocess.Popen')
    def test_proceso_no_recibe_secretos_ni_token_por_argumentos(self, ejecutar):
        ejecutar.return_value.returncode = 0
        ejecutar.return_value.communicate.return_value = (json.dumps({'respuesta': 'Listo', 'consultados': []}), None)
        with patch.dict('os.environ', {'DATABASE_URL': 'secreto-db', 'VERCEL_TOKEN': 'secreto-vercel'}):
            self.assertEqual(consultar_copilot('Hola')[0], 'Listo')
        opciones = ejecutar.call_args.kwargs
        self.assertNotIn('DATABASE_URL', opciones['env'])
        self.assertNotIn('VERCEL_TOKEN', opciones['env'])
        self.assertNotIn('token-ficticio', str(ejecutar.call_args.args))
        comunicacion = ejecutar.return_value.communicate.call_args
        self.assertNotIn('token-ficticio', comunicacion.args[0])
        self.assertEqual(comunicacion.kwargs['timeout'], 45)

    @patch('ai_chat.proveedor_copilot.subprocess.Popen', side_effect=subprocess.TimeoutExpired('sdk', 45))
    def test_timeout_no_expone_excepcion_del_proveedor(self, ejecutar):
        with self.assertRaisesMessage(ValueError, 'Copilot no disponible'):
            consultar_copilot('Hola')
