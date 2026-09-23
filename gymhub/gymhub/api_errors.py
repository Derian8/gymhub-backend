import logging

from django.http import JsonResponse
from django.views.defaults import server_error


logger = logging.getLogger(__name__)


def api_server_error(request):
    """Evita que una excepción no controlada exponga HTML en rutas REST."""
    if request.path.startswith('/api/'):
        logger.exception('Error no controlado en API: %s %s', request.method, request.path)
        return JsonResponse(
            {'error': 'No fue posible procesar la solicitud. Intenta nuevamente.'},
            status=500,
        )
    return server_error(request)
