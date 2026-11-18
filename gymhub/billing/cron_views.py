import hmac

from django.conf import settings
from django.db import connection, transaction
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .tasks import run_daily_membership_maintenance


class DailyMembershipMaintenanceView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        expected = settings.CRON_SECRET
        provided = request.headers.get('Authorization', '')
        if not expected or not hmac.compare_digest(provided, f'Bearer {expected}'):
            return Response({'error': 'No autorizado.'}, status=401)
        with transaction.atomic():
            if connection.vendor == 'postgresql':
                with connection.cursor() as cursor:
                    cursor.execute('SELECT pg_try_advisory_xact_lock(%s)', [71934021])
                    if not cursor.fetchone()[0]:
                        return Response({'estado': 'mantenimiento_en_curso'}, status=409)
            return Response(run_daily_membership_maintenance())
