import io
import json
from unittest.mock import patch
from urllib.error import HTTPError

from django.test import SimpleTestCase, override_settings

from ai_chat.agentes_administracion import generar_analisis_administrativo
from ai_chat.openrouter import consultar_openrouter


@override_settings(
    AI_PROVIDER='openrouter_hybrid',
    OPENROUTER_API_KEY='clave-ficticia',
    OPENROUTER_MODEL='openrouter/free',
)
class PruebasOpenRouter(SimpleTestCase):
    @patch('ai_chat.openrouter.request.urlopen')
    def test_solo_envia_clave_en_cabecera_y_rechaza_modelos_pagados(self, abrir):
        abrir.return_value.__enter__.return_value.read.return_value = json.dumps({
            'choices': [{'message': {'content': 'Respuesta'}}],
        }).encode()
        self.assertEqual(consultar_openrouter([{'role': 'user', 'content': 'Hola'}])['content'], 'Respuesta')
        solicitud = abrir.call_args.args[0]
        self.assertNotIn('clave-ficticia', solicitud.full_url)
        self.assertNotIn('clave-ficticia', solicitud.data.decode())
        self.assertEqual(solicitud.get_header('Authorization'), 'Bearer clave-ficticia')
        abrir.reset_mock()
        with override_settings(OPENROUTER_MODEL='proveedor/modelo-pago'):
            with self.assertRaises(ValueError):
                consultar_openrouter([])
        abrir.assert_not_called()

    @patch('ai_chat.agentes_administracion.get_admin_overview', return_value={'payments_overdue': 2})
    @patch('ai_chat.agentes_administracion.consultar_openrouter')
    def test_ejecuta_herramienta_permitida_y_devuelve_resultado_al_modelo(self, consultar, resumen):
        consultar.side_effect = [
            {'role': 'assistant', 'content': None, 'tool_calls': [
                {'id': 'consulta-1', 'type': 'function', 'function': {'name': 'consultar_cobranza', 'arguments': '{}'}},
            ]},
            {'role': 'assistant', 'content': 'Hay 2 cobros vencidos.'},
        ]
        resultado = generar_analisis_administrativo(None, 'Revisa la cobranza')
        self.assertEqual(resultado['fuente'], 'openrouter')
        self.assertFalse(resultado['respaldo_activo'])
        self.assertEqual(resultado['agentes_consultados'], ['consultar_cobranza'])
        self.assertTrue(consultar.call_args_list[0].kwargs['exigir_herramienta'])
        self.assertFalse(consultar.call_args_list[1].kwargs['exigir_herramienta'])
        mensajes = consultar.call_args.args[0]
        self.assertEqual(json.loads(mensajes[-1]['content'])['cobros_vencidos'], 2)

    @patch('ai_chat.agentes_administracion.get_admin_overview', return_value={})
    @patch('ai_chat.agentes_administracion.consultar_openrouter')
    def test_no_acepta_cifras_sin_consultar_herramientas(self, consultar, resumen):
        consultar.return_value = {'content': 'Tienes 999 cobros vencidos.'}
        resultado = generar_analisis_administrativo(None, 'Revisa todo')
        self.assertEqual(resultado['fuente'], 'rules')
        self.assertNotIn('999', resultado['respuesta'])

    @patch('ai_chat.agentes_administracion.get_admin_overview', return_value={})
    @patch('ai_chat.agentes_administracion.consultar_openrouter')
    def test_cuota_agotada_activa_respaldo_sin_reintentos(self, consultar, resumen):
        consultar.side_effect = HTTPError('https://openrouter.ai', 429, 'Límite', {}, io.BytesIO())
        resultado = generar_analisis_administrativo(None, 'Revisa todo')
        self.assertEqual(resultado['codigo_proveedor'], 429)
        self.assertTrue(resultado['respaldo_activo'])
        self.assertEqual(consultar.call_count, 1)

    @override_settings(OPENROUTER_API_KEY='')
    @patch('ai_chat.agentes_administracion.get_admin_overview', return_value={})
    @patch('ai_chat.agentes_administracion.consultar_openrouter')
    def test_sin_clave_usa_reglas(self, consultar, resumen):
        self.assertEqual(generar_analisis_administrativo(None, 'Hola')['fuente'], 'rules')
        consultar.assert_not_called()
