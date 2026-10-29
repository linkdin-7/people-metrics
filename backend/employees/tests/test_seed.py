from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone

from employees.countries import default_currency_for, is_valid_country
from employees.models import Department, Employee
from employees.seed import (
    COUNTRY_PROFILES,
    FIRST_NAMES,
    LAST_NAMES,
    SeedError,
    seed_employees,
)

pytestmark = pytest.mark.django_db


def snapshot() -> list[tuple]:
    return list(
        Employee.objects.order_by("email").values_list(
            "email", "country", "currency", "annual_salary", "hire_date", "job_title"
        )
    )


def test_creates_the_requested_number_of_employees():
    assert seed_employees(count=50, seed=1) == 50
    assert Employee.objects.count() == 50


def test_same_seed_gives_identical_data_and_another_seed_differs():
    seed_employees(count=100, seed=1)
    first_run = snapshot()

    seed_employees(count=100, seed=1, reset=True)
    assert snapshot() == first_run

    seed_employees(count=100, seed=2, reset=True)
    assert snapshot() != first_run


def test_every_generated_employee_is_valid():
    seed_employees(count=300, seed=1)

    for employee in Employee.objects.all():
        employee.full_clean()


def test_emails_are_unique_and_use_the_reserved_example_domain():
    seed_employees(count=500, seed=1)
    emails = list(Employee.objects.values_list("email", flat=True))

    assert len(set(emails)) == len(emails)
    assert all(email.endswith("@example.com") for email in emails)


def test_name_lists_cover_ten_thousand_distinct_people():
    assert len(set(FIRST_NAMES)) == len(FIRST_NAMES)
    assert len(set(LAST_NAMES)) == len(LAST_NAMES)
    assert len(FIRST_NAMES) * len(LAST_NAMES) >= 10000


def test_full_names_do_not_repeat():
    seed_employees(count=2000, seed=1)

    full_names = list(Employee.objects.values_list("first_name", "last_name"))
    assert len(set(full_names)) == len(full_names)


def test_employees_are_spread_across_countries_and_departments():
    seed_employees(count=1000, seed=1)

    countries = Employee.objects.values("country").distinct().count()
    used_departments = Employee.objects.values("department").distinct().count()
    assert countries >= 10
    assert used_departments == Department.objects.count() > 1


def test_some_employees_are_paid_in_a_currency_other_than_their_countrys():
    seed_employees(count=2000, seed=1)

    assert any(
        employee.currency != default_currency_for(employee.country)
        for employee in Employee.objects.all()
    )


def test_every_seed_country_is_supported_and_has_a_default_currency():
    for code in COUNTRY_PROFILES:
        assert is_valid_country(code)
        assert default_currency_for(code)


def test_refuses_to_run_when_employees_already_exist():
    seed_employees(count=10, seed=1)

    with pytest.raises(SeedError):
        seed_employees(count=10, seed=1)
    assert Employee.objects.count() == 10


def test_reset_replaces_the_existing_employees():
    seed_employees(count=10, seed=1)

    seed_employees(count=5, seed=1, reset=True)

    assert Employee.objects.count() == 5


def test_reset_also_removes_soft_deleted_employees():
    seed_employees(count=10, seed=1)
    Employee.objects.update(deleted_at=timezone.now())

    seed_employees(count=5, seed=1, reset=True)

    assert Employee.all_objects.count() == 5


@pytest.mark.parametrize("count", [0, -1])
def test_rejects_a_non_positive_count(count):
    with pytest.raises(ValueError):
        seed_employees(count=count, seed=1)


def test_command_reports_how_many_employees_were_created():
    output = StringIO()

    call_command("seed_employees", "--count=20", stdout=output)

    assert "Created 20 employees" in output.getvalue()


def test_command_fails_clearly_when_employees_already_exist():
    call_command("seed_employees", "--count=5", stdout=StringIO())

    with pytest.raises(CommandError):
        call_command("seed_employees", "--count=5", stdout=StringIO())
