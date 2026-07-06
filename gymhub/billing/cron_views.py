import hmac

from django.conf import settings
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
        return Response(run_daily_membership_maintenance())
