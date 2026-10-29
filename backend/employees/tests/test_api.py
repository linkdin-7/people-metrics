import pytest

from employees.models import Department, Employee

pytestmark = pytest.mark.django_db

EMPLOYEES = "/api/v1/employees"
DEPARTMENTS = "/api/v1/departments"
LOOKUPS = "/api/v1/lookups"


def employee_payload(default_department, **overrides) -> dict:
    payload = {
        "first_name": "Asha",
        "last_name": "Rao",
        "email": "asha@example.com",
        "department": default_department.id,
        "job_title": "Software Engineer",
        "country": "IN",
        "annual_salary": 1200000,
        "hire_date": "2022-04-01",
    }
    payload.update(overrides)
    return payload


def emails_in(response) -> list[str]:
    return [employee["email"] for employee in response.json()["results"]]


def test_department_is_created_with_a_normalized_name(api_client):
    response = api_client.post(DEPARTMENTS, {"name": "  Human   Resources "}, format="json")

    assert response.status_code == 201
    assert response.json()["name"] == "Human Resources"


def test_duplicate_department_returns_conflict(api_client):
    Department.objects.create(name="Human Resources")

    response = api_client.post(DEPARTMENTS, {"name": " human resources"}, format="json")

    assert response.status_code == 409


def test_blank_department_name_is_a_validation_error(api_client):
    response = api_client.post(DEPARTMENTS, {"name": "   "}, format="json")

    assert response.status_code == 400
    assert "name" in response.json()


def test_departments_are_listed_alphabetically(api_client):
    for name in ("Sales", "Engineering"):
        Department.objects.create(name=name)

    response = api_client.get(DEPARTMENTS)

    assert [department["name"] for department in response.json()] == [
        "Engineering",
        "Sales",
    ]


def test_employee_is_created_and_currency_defaults_from_the_country(
    api_client, engineering
):
    response = api_client.post(EMPLOYEES, employee_payload(engineering), format="json")

    assert response.status_code == 201
    body = response.json()
    assert body["currency"] == "INR"
    assert body["department_name"] == "Engineering"
    assert Employee.objects.count() == 1


def test_explicit_currency_is_kept(api_client, engineering):
    payload = employee_payload(engineering, country="DE", currency="USD")

    response = api_client.post(EMPLOYEES, payload, format="json")

    assert response.json()["currency"] == "USD"


def test_email_is_stored_trimmed_and_lowercase(api_client, engineering):
    payload = employee_payload(engineering, email="Asha.Rao@Example.COM")

    response = api_client.post(EMPLOYEES, payload, format="json")

    assert response.json()["email"] == "asha.rao@example.com"


def test_country_without_a_default_currency_needs_an_explicit_one(
    api_client, engineering
):
    response = api_client.post(
        EMPLOYEES, employee_payload(engineering, country="AQ"), format="json"
    )

    assert response.status_code == 400
    assert "currency" in response.json()


@pytest.mark.parametrize(
    "overrides, field",
    [
        ({"annual_salary": 0}, "annual_salary"),
        ({"annual_salary": -5}, "annual_salary"),
        ({"annual_salary": "abc"}, "annual_salary"),
        ({"country": "ZZ"}, "country"),
        ({"currency": "ABC"}, "currency"),
        ({"email": "not-an-email"}, "email"),
        ({"hire_date": "2022-13-45"}, "hire_date"),
        ({"first_name": ""}, "first_name"),
        ({"department": 999999}, "department"),
    ],
)
def test_invalid_employee_data_is_a_validation_error(
    api_client, engineering, overrides, field
):
    response = api_client.post(
        EMPLOYEES, employee_payload(engineering, **overrides), format="json"
    )

    assert response.status_code == 400
    assert field in response.json()
    assert Employee.objects.count() == 0


def test_duplicate_email_returns_conflict_ignoring_case(
    api_client, engineering, create_employee
):
    create_employee(email="asha@example.com")

    response = api_client.post(
        EMPLOYEES, employee_payload(engineering, email="ASHA@example.com"), format="json"
    )

    assert response.status_code == 409


def test_employee_is_returned_by_id(api_client, create_employee):
    employee = create_employee()

    response = api_client.get(f"{EMPLOYEES}/{employee.id}")

    assert response.status_code == 200
    assert response.json()["email"] == employee.email


def test_missing_employee_returns_not_found(api_client, db):
    response = api_client.get(f"{EMPLOYEES}/999999")

    assert response.status_code == 404
    assert "detail" in response.json()


def test_patch_changes_only_the_given_fields(api_client, create_employee):
    employee = create_employee(annual_salary=1000000)

    response = api_client.patch(
        f"{EMPLOYEES}/{employee.id}", {"annual_salary": 1500000}, format="json"
    )

    assert response.status_code == 200
    employee.refresh_from_db()
    assert employee.annual_salary == 1500000
    assert employee.job_title == "Software Engineer"
    assert employee.currency == "INR"


def test_patch_can_keep_the_employees_own_email(api_client, create_employee):
    employee = create_employee(email="asha@example.com")

    response = api_client.patch(
        f"{EMPLOYEES}/{employee.id}", {"email": "Asha@example.com"}, format="json"
    )

    assert response.status_code == 200


def test_patch_to_another_employees_email_returns_conflict(
    api_client, create_employee
):
    create_employee(email="taken@example.com")
    employee = create_employee(email="asha@example.com")

    response = api_client.patch(
        f"{EMPLOYEES}/{employee.id}", {"email": "taken@example.com"}, format="json"
    )

    assert response.status_code == 409


def test_put_replaces_all_fields(api_client, engineering, create_employee):
    employee = create_employee()
    payload = employee_payload(
        engineering, email=employee.email, job_title="Staff Engineer", country="DE"
    )

    response = api_client.put(f"{EMPLOYEES}/{employee.id}", payload, format="json")

    assert response.status_code == 200
    employee.refresh_from_db()
    assert (employee.job_title, employee.country) == ("Staff Engineer", "DE")


def test_put_without_required_fields_is_a_validation_error(api_client, create_employee):
    employee = create_employee()

    response = api_client.put(
        f"{EMPLOYEES}/{employee.id}", {"first_name": "Only"}, format="json"
    )

    assert response.status_code == 400


def test_employee_is_deleted(api_client, create_employee):
    employee = create_employee()

    assert api_client.delete(f"{EMPLOYEES}/{employee.id}").status_code == 204
    assert api_client.get(f"{EMPLOYEES}/{employee.id}").status_code == 404


def test_list_is_paginated_with_a_default_page_size_of_25(api_client, create_employee):
    for _ in range(30):
        create_employee()

    first_page = api_client.get(EMPLOYEES).json()
    second_page = api_client.get(EMPLOYEES, {"page": 2}).json()

    assert first_page["count"] == 30
    assert len(first_page["results"]) == 25
    assert len(second_page["results"]) == 5


def test_page_size_can_be_chosen_and_is_capped_at_100(api_client, create_employee):
    for _ in range(101):
        create_employee()

    assert len(api_client.get(EMPLOYEES, {"page_size": 10}).json()["results"]) == 10
    assert len(api_client.get(EMPLOYEES, {"page_size": 1000}).json()["results"]) == 100


def test_page_past_the_end_returns_not_found(api_client, create_employee):
    create_employee()

    response = api_client.get(EMPLOYEES, {"page": 2})

    assert response.status_code == 404
    assert "detail" in response.json()


def test_list_is_ordered_by_name_by_default(api_client, create_employee):
    create_employee(first_name="Zoe", last_name="Adams", email="zoe@example.com")
    create_employee(first_name="Amy", last_name="Adams", email="amy@example.com")
    create_employee(first_name="Bob", last_name="Zed", email="bob@example.com")

    response = api_client.get(EMPLOYEES)

    assert emails_in(response) == ["amy@example.com", "zoe@example.com", "bob@example.com"]


@pytest.mark.parametrize(
    "query, expected",
    [
        ("rao", ["asha@example.com", "maya@example.com"]),
        ("ASHA rao", ["asha@example.com"]),
        ("ravi.patel@", ["ravi.patel@example.com"]),
        ("nobody", []),
    ],
)
def test_search_matches_names_and_email_case_insensitively(
    api_client, create_employee, query, expected
):
    create_employee(first_name="Asha", last_name="Rao", email="asha@example.com")
    create_employee(first_name="Maya", last_name="Rao", email="maya@example.com")
    create_employee(first_name="Ravi", last_name="Patel", email="ravi.patel@example.com")

    response = api_client.get(EMPLOYEES, {"q": query})

    assert sorted(emails_in(response)) == expected


@pytest.fixture
def mixed_employees(create_employee):
    product = Department.objects.create(name="Product")
    return {
        "india_low": create_employee(email="a@example.com", annual_salary=1000000),
        "india_high": create_employee(email="b@example.com", annual_salary=2000000),
        "germany_eur": create_employee(
            email="c@example.com",
            country="DE",
            annual_salary=70000,
            department=product,
            job_title="Product Manager",
        ),
        "germany_usd": create_employee(
            email="d@example.com", country="DE", currency="USD", annual_salary=90000
        ),
    }


@pytest.mark.parametrize(
    "filters, expected",
    [
        ({"country": "de"}, ["c@example.com", "d@example.com"]),
        ({"currency": "usd"}, ["d@example.com"]),
        ({"country": "DE", "currency": "EUR"}, ["c@example.com"]),
        ({"job_title": "product manager"}, ["c@example.com"]),
        ({"min_salary": 1500000}, ["b@example.com"]),
        ({"country": "IN", "max_salary": 1000000}, ["a@example.com"]),
        ({"min_salary": 1000000, "max_salary": 2000000}, ["a@example.com", "b@example.com"]),
    ],
)
def test_list_filters(api_client, mixed_employees, filters, expected):
    response = api_client.get(EMPLOYEES, filters)

    assert sorted(emails_in(response)) == expected


def test_list_can_be_filtered_by_department(api_client, mixed_employees):
    product = Department.objects.get(name="Product")

    response = api_client.get(EMPLOYEES, {"department": product.id})

    assert emails_in(response) == ["c@example.com"]


def test_minimum_salary_above_maximum_is_a_validation_error(api_client, db):
    response = api_client.get(EMPLOYEES, {"min_salary": 10, "max_salary": 5})

    assert response.status_code == 400


def test_list_can_be_sorted_by_salary_in_both_directions(api_client, mixed_employees):
    ascending = api_client.get(EMPLOYEES, {"country": "IN", "sort": "annual_salary"})
    descending = api_client.get(EMPLOYEES, {"country": "IN", "sort": "-annual_salary"})

    assert emails_in(ascending) == ["a@example.com", "b@example.com"]
    assert emails_in(descending) == ["b@example.com", "a@example.com"]


def test_salary_sort_groups_by_currency_so_amounts_are_never_compared_across_currencies(
    api_client, create_employee
):
    create_employee(email="usd-high@example.com", country="US", annual_salary=180000)
    create_employee(email="eur-low@example.com", country="DE", annual_salary=60000)
    create_employee(email="eur-high@example.com", country="DE", annual_salary=130000)
    create_employee(email="usd-low@example.com", country="US", annual_salary=90000)

    ascending = api_client.get(EMPLOYEES, {"sort": "annual_salary"})
    descending = api_client.get(EMPLOYEES, {"sort": "-annual_salary"})

    assert emails_in(ascending) == [
        "eur-low@example.com",
        "eur-high@example.com",
        "usd-low@example.com",
        "usd-high@example.com",
    ]
    assert emails_in(descending) == [
        "eur-high@example.com",
        "eur-low@example.com",
        "usd-high@example.com",
        "usd-low@example.com",
    ]


def test_equal_sort_values_fall_back_to_id_order(api_client, create_employee):
    first = create_employee(email="x@example.com", annual_salary=500000)
    second = create_employee(email="y@example.com", annual_salary=500000)

    response = api_client.get(EMPLOYEES, {"sort": "annual_salary"})

    assert emails_in(response) == [first.email, second.email]


def test_openapi_schema_describes_the_employee_endpoints(api_client):
    response = api_client.get("/api/schema", {"format": "json"})

    assert response.status_code == 200
    assert "/api/v1/employees/{id}" in response.json()["paths"]


def test_swagger_ui_page_is_served(api_client):
    response = api_client.get("/api/docs")

    assert response.status_code == 200
    assert b"swagger" in response.content.lower()


def test_lookups_list_countries_currencies_departments_and_job_titles(
    api_client, create_employee
):
    create_employee(job_title="Software Engineer")
    create_employee(job_title="Software Engineer")
    create_employee(job_title="Accountant")

    body = api_client.get(LOOKUPS).json()

    assert {"code": "IN", "name": "India", "currency": "INR"} in body["countries"]
    assert "INR" in body["currencies"]
    assert [department["name"] for department in body["departments"]] == ["Engineering"]
    assert body["job_titles"] == ["Accountant", "Software Engineer"]
