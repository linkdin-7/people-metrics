import base64

import pytest
from django.db import OperationalError

PROTECTED_URL = "/api/schema"


def basic_header(username: str, password: str) -> str:
    encoded = base64.b64encode(f"{username}:{password}".encode()).decode()
    return f"Basic {encoded}"


@pytest.fixture
def protected(settings) -> None:
    settings.BASIC_AUTH_REQUIRED = True
    settings.BASIC_AUTH_USERNAME = "hr-manager"
    settings.BASIC_AUTH_PASSWORD = "test-password"


def test_request_without_credentials_is_challenged(api_client, protected):
    response = api_client.get(PROTECTED_URL)

    assert response.status_code == 401
    assert response["WWW-Authenticate"].startswith("Basic")


def test_correct_credentials_are_accepted(api_client, protected):
    header = basic_header("hr-manager", "test-password")

    assert api_client.get(PROTECTED_URL, HTTP_AUTHORIZATION=header).status_code == 200


@pytest.mark.parametrize(
    "username, password",
    [
        ("hr-manager", "wrong"),
        ("someone-else", "test-password"),
        ("", ""),
        ("hr-manager", "test-password-extra"),
    ],
)
def test_wrong_credentials_are_rejected(api_client, protected, username, password):
    header = basic_header(username, password)

    assert api_client.get(PROTECTED_URL, HTTP_AUTHORIZATION=header).status_code == 401


@pytest.mark.parametrize(
    "header",
    [
        "Bearer test-password",
        "Basic",
        "Basic !!!not-base64!!!",
        "Basic " + base64.b64encode(b"no-colon-here").decode(),
        "Basic " + base64.b64encode(b"\xff\xfe:\xff").decode(),
    ],
)
def test_malformed_authorization_headers_are_rejected(api_client, protected, header):
    assert api_client.get(PROTECTED_URL, HTTP_AUTHORIZATION=header).status_code == 401


def test_password_may_contain_a_colon(api_client, protected, settings):
    settings.BASIC_AUTH_PASSWORD = "pass:with:colons"
    header = basic_header("hr-manager", "pass:with:colons")

    assert api_client.get(PROTECTED_URL, HTTP_AUTHORIZATION=header).status_code == 200


def test_api_endpoints_are_protected_too(api_client, protected):
    assert api_client.get("/api/v1/employees").status_code == 401


@pytest.mark.parametrize("username, password", [("", ""), ("hr-manager", ""), ("", "test-password")])
def test_required_but_unconfigured_credentials_deny_everything(
    api_client, settings, username, password
):
    settings.BASIC_AUTH_REQUIRED = True
    settings.BASIC_AUTH_USERNAME = username
    settings.BASIC_AUTH_PASSWORD = password
    header = basic_header(username, password)

    response = api_client.get(PROTECTED_URL, HTTP_AUTHORIZATION=header)

    assert response.status_code == 503


def test_authentication_is_not_enforced_when_not_required(api_client, settings):
    settings.BASIC_AUTH_REQUIRED = False

    assert api_client.get(PROTECTED_URL).status_code == 200


def test_authentication_is_required_by_default_outside_debug_mode():
    from config import settings as project_settings

    assert project_settings.BASIC_AUTH_REQUIRED == (not project_settings.DEBUG)


def test_health_check_needs_no_credentials(api_client, protected, db):
    response = api_client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_check_works_even_when_credentials_are_not_configured(
    api_client, settings, db
):
    settings.BASIC_AUTH_REQUIRED = True
    settings.BASIC_AUTH_USERNAME = ""
    settings.BASIC_AUTH_PASSWORD = ""

    assert api_client.get("/health").status_code == 200


def test_health_check_accepts_head_requests(api_client, protected, db):
    assert api_client.head("/health").status_code == 200


def test_health_check_rejects_other_methods(api_client, protected):
    assert api_client.post("/health").status_code == 405


def test_health_check_reports_unavailable_when_the_database_is_down(
    api_client, protected, monkeypatch
):
    class BrokenConnection:
        def cursor(self):
            raise OperationalError("database is down")

    monkeypatch.setattr("employees.views.connection", BrokenConnection())

    response = api_client.get("/health")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}
