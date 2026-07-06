import logging
import time
import uuid


logger = logging.getLogger(__name__)


class RequestTimingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        started_at = time.perf_counter()
        request_id = request.headers.get('X-Request-ID') or uuid.uuid4().hex
        request.request_id = request_id
        response = self.get_response(request)
        duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
        response['X-Request-Duration-Ms'] = str(duration_ms)
        response['X-Request-ID'] = request_id
        logger.info(
            '%s %s -> %s in %sms request_id=%s',
            request.method,
            request.path,
            getattr(response, 'status_code', 'unknown'),
            duration_ms,
            request_id,
        )
        return response
