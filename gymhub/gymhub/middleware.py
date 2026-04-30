import logging
import time


logger = logging.getLogger(__name__)


class RequestTimingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        started_at = time.perf_counter()
        response = self.get_response(request)
        duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
        response['X-Request-Duration-Ms'] = str(duration_ms)
        logger.info(
            '%s %s -> %s in %sms',
            request.method,
            request.path,
            getattr(response, 'status_code', 'unknown'),
            duration_ms,
        )
        return response
