from django.conf import settings
from django.db.models import Count
from rest_framework.response import Response
from rest_framework.views import APIView

from users.permissions import IsAdministrator
from .correos import procesar_correos
from .models import CorreoPendiente


def estado_correos():
    configurado = bool(
        settings.RESEND_HABILITADO and settings.RESEND_API_KEY
        and (not settings.RESEND_MODO_DEMO or settings.RESEND_DESTINATARIO_DEMO)
    )
    return {
        'configurado': configurado,
        'modo_demo': settings.RESEND_MODO_DEMO,
        'cantidades': dict(CorreoPendiente.objects.values_list('estado').annotate(
            cantidad=Count('pk'),
        ).order_by()),
    }


class EstadoCorreosView(APIView):
    permission_classes = [IsAdministrator]

    def get(self, request):
        return Response(estado_correos())

    def post(self, request):
        if not estado_correos()['configurado']:
            return Response(
                {'error': 'Configura Resend y el destinatario demo en el backend.'},
                status=503,
            )
        resultado = procesar_correos()
        return Response({**estado_correos(), **resultado})
