import time
import logging

from django.core.cache import cache
from django.db import connections
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


class LiveHealthView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = []

    def get(self, request):
        return Response(
            {
                'status': 'ok',
                'service': 'gymhub-backend',
            },
            status=status.HTTP_200_OK,
        )


class ReadyHealthView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = []

    def get(self, request):
        started_at = time.perf_counter()
        checks = {}
        overall_status = status.HTTP_200_OK

        try:
            with connections['default'].cursor() as cursor:
                cursor.execute('SELECT 1')
                cursor.fetchone()
            checks['database'] = {'status': 'ok'}
        except Exception:
            logger.exception('Fallo de readiness de base de datos')
            checks['database'] = {'status': 'error'}
            overall_status = status.HTTP_503_SERVICE_UNAVAILABLE

        try:
            cache_key = 'health:ready'
            cache.set(cache_key, 'ok', timeout=5)
            cache_value = cache.get(cache_key)
            if cache_value != 'ok':
                raise RuntimeError('Cache no disponible')
            checks['cache'] = {'status': 'ok'}
        except Exception:
            logger.exception('Fallo de readiness de caché')
            checks['cache'] = {'status': 'error'}
            overall_status = status.HTTP_503_SERVICE_UNAVAILABLE

        duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
        return Response(
            {
                'status': 'ok' if overall_status == status.HTTP_200_OK else 'degraded',
                'duration_ms': duration_ms,
                'checks': checks,
            },
            status=overall_status,
        )
