import base64
import binascii
import hmac

from django.conf import settings
from django.http import HttpResponse

EXEMPT_PATHS = {"/health"}


def credentials_match(authorization_header: str) -> bool:
    scheme, _, encoded = authorization_header.partition(" ")
    if scheme.lower() != "basic":
        return False
    try:
        decoded = base64.b64decode(encoded, validate=True).decode("utf-8")
    except (binascii.Error, UnicodeDecodeError):
        return False

    username, _, password = decoded.partition(":")
    username_matches = hmac.compare_digest(
        username.encode(), settings.BASIC_AUTH_USERNAME.encode()
    )
    password_matches = hmac.compare_digest(
        password.encode(), settings.BASIC_AUTH_PASSWORD.encode()
    )
    return username_matches and password_matches


class BasicAuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not settings.BASIC_AUTH_REQUIRED or request.path in EXEMPT_PATHS:
            return self.get_response(request)

        if not (settings.BASIC_AUTH_USERNAME and settings.BASIC_AUTH_PASSWORD):
            return HttpResponse("Basic authentication is not configured.", status=503)

        if credentials_match(request.headers.get("Authorization", "")):
            return self.get_response(request)

        response = HttpResponse("Authentication required.", status=401)
        response["WWW-Authenticate"] = 'Basic realm="ACME Salary Management"'
        return response
