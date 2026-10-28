import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError

from employees.countries import UnknownCountryError
from employees.models import Department, normalize_name


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("Human Resources", "Human Resources"),
        ("  Human   Resources ", "Human Resources"),
        ("Human\tResources\n", "Human Resources"),
        ("  hR  Operations ", "hR Operations"),
        ("   ", ""),
    ],
)
def test_normalize_name_trims_and_collapses_whitespace(raw, expected):
    assert normalize_name(raw) == expected


def test_department_name_is_normalized_on_save(db):
    department = Department.objects.create(name="  Human   Resources ")

    assert Department.objects.get(pk=department.pk).name == "Human Resources"


def test_department_names_differing_only_by_case_or_spacing_are_duplicates(db):
    Department.objects.create(name="Human Resources")

    with pytest.raises(IntegrityError), transaction.atomic():
        Department.objects.create(name=" human   resources")


def test_blank_department_name_is_rejected(db):
    with pytest.raises(IntegrityError), transaction.atomic():
        Department.objects.create(name="   ")


def test_departments_are_listed_alphabetically(db):
    for name in ("Sales", "Engineering", "Finance"):
        Department.objects.create(name=name)

    assert [d.name for d in Department.objects.all()] == [
        "Engineering",
        "Finance",
        "Sales",
    ]


def test_valid_employee_passes_validation(build_employee):
    build_employee().full_clean()


def test_email_is_stored_trimmed_and_lowercase(build_employee):
    employee = build_employee(email="  Asha.Rao@Example.COM ")
    employee.save()

    employee.refresh_from_db()
    assert employee.email == "asha.rao@example.com"


def test_emails_differing_only_by_case_are_duplicates(build_employee):
    build_employee(email="asha@example.com").save()

    with pytest.raises(IntegrityError), transaction.atomic():
        build_employee(email="ASHA@example.com").save()


def test_names_and_job_title_are_whitespace_normalized(build_employee):
    employee = build_employee(
        first_name=" Asha  ", last_name="  Rao ", job_title="Senior   Engineer "
    )
    employee.save()

    employee.refresh_from_db()
    assert (employee.first_name, employee.last_name, employee.job_title) == (
        "Asha",
        "Rao",
        "Senior Engineer",
    )


@pytest.mark.parametrize("salary", [0, -1])
def test_salary_must_be_positive(build_employee, salary):
    with pytest.raises(ValidationError) as error:
        build_employee(annual_salary=salary).full_clean()

    assert "annual_salary" in error.value.message_dict


def test_salary_of_zero_is_rejected_by_the_database(build_employee):
    with pytest.raises(IntegrityError), transaction.atomic():
        build_employee(annual_salary=0).save()


def test_unknown_country_is_invalid(build_employee):
    with pytest.raises(ValidationError) as error:
        build_employee(country="ZZ").full_clean()

    assert "country" in error.value.message_dict


def test_unknown_currency_is_invalid(build_employee):
    with pytest.raises(ValidationError) as error:
        build_employee(currency="ABC").full_clean()

    assert "currency" in error.value.message_dict


def test_currency_defaults_from_the_country(build_employee):
    employee = build_employee(country="IN")
    employee.save()

    assert employee.currency == "INR"


def test_explicit_currency_is_kept(build_employee):
    employee = build_employee(country="DE", currency="USD")
    employee.save()

    employee.refresh_from_db()
    assert employee.currency == "USD"


def test_country_without_a_default_currency_needs_an_explicit_one(build_employee):
    with pytest.raises(IntegrityError), transaction.atomic():
        build_employee(country="AQ").save()

    employee = build_employee(country="AQ", currency="USD")
    employee.save()
    assert employee.currency == "USD"


def test_saving_with_an_unknown_country_and_no_currency_raises(build_employee):
    with pytest.raises(UnknownCountryError):
        build_employee(country="ZZ").save()


def test_department_with_employees_cannot_be_deleted(build_employee, engineering):
    build_employee().save()

    with pytest.raises(ProtectedError):
        engineering.delete()
