from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from rest_framework.authentication import SessionAuthentication


class JWTCookieAuthentication(JWTAuthentication):
    """
    Autenticación JWT que lee el token desde:
    1. El header Authorization: Bearer <token>
    2. La cookie httpOnly 'access_token'
    """

    def authenticate(self, request):
        # Intentar con el header Authorization primero
        header = self.get_header(request)
        authenticated_with_cookie = header is None
        if header is not None:
            raw_token = self.get_raw_token(header)
        else:
            # Leer desde cookie httpOnly
            raw_token = request.COOKIES.get(
                getattr(settings, 'ACCESS_TOKEN_COOKIE_NAME', 'access_token')
            )
            if raw_token is None:
                return None
            raw_token = raw_token.encode('utf-8') if isinstance(raw_token, str) else raw_token

        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
        except (TokenError, InvalidToken):
            return None

        try:
            user = self.get_user(validated_token)
        except (AuthenticationFailed, InvalidToken, TokenError):
            return None

        if authenticated_with_cookie:
            SessionAuthentication().enforce_csrf(request)

        return user, validated_token
