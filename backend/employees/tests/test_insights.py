import pytest

from employees.models import Department

pytestmark = pytest.mark.django_db

INSIGHTS = "/api/v1/insights"


@pytest.fixture
def sales(db) -> Department:
    return Department.objects.create(name="Sales")


@pytest.fixture
def pay_data(create_employee, engineering, sales) -> None:
    rows = [
        ("IN", "INR", 100, engineering, "Software Engineer"),
        ("IN", "INR", 200, engineering, "Software Engineer"),
        ("IN", "INR", 300, sales, "Sales Executive"),
        ("IN", "INR", 400, sales, "Sales Executive"),
        ("US", "USD", 10, engineering, "Software Engineer"),
        ("US", "USD", 20, engineering, "Software Engineer"),
        ("DE", "USD", 90, sales, "Sales Executive"),
        ("DE", "EUR", 50, sales, "Sales Executive"),
    ]
    for country, currency, salary, department, job_title in rows:
        create_employee(
            country=country,
            currency=currency,
            annual_salary=salary,
            department=department,
            job_title=job_title,
        )


def get_json(api_client, path: str, **params) -> dict | list:
    response = api_client.get(f"{INSIGHTS}/{path}", params)
    assert response.status_code == 200
    return response.json()


def find_row(rows: list[dict], currency: str, group: str | None = None) -> dict:
    return next(
        row for row in rows if row["currency"] == currency and row.get("group") == group
    )


def stats_of(row: dict) -> tuple:
    return (
        row["headcount"],
        row["min_salary"],
        row["median_salary"],
        row["average_salary"],
        row["max_salary"],
    )


def test_summary_splits_salary_figures_by_currency(api_client, pay_data):
    body = get_json(api_client, "summary")
    rows = body["salary_by_currency"]

    assert body["headcount"] == 8
    assert stats_of(find_row(rows, "INR")) == (4, 100, 250, 250, 400)
    assert stats_of(find_row(rows, "USD")) == (3, 10, 20, 40, 90)
    assert stats_of(find_row(rows, "EUR")) == (1, 50, 50, 50, 50)


def test_average_and_median_are_rounded_to_two_decimals(api_client, create_employee):
    for salary in (1, 1, 2):
        create_employee(currency="GBP", annual_salary=salary)
    create_employee(currency="CHF", annual_salary=1)
    create_employee(currency="CHF", annual_salary=2)

    rows = get_json(api_client, "summary")["salary_by_currency"]

    assert stats_of(find_row(rows, "GBP")) == (3, 1, 1, 1.33, 2)
    assert stats_of(find_row(rows, "CHF")) == (2, 1, 1.5, 1.5, 2)


def test_summary_lists_each_currency_once_in_alphabetical_order(api_client, pay_data):
    rows = get_json(api_client, "summary")["salary_by_currency"]

    assert [row["currency"] for row in rows] == ["EUR", "INR", "USD"]


@pytest.mark.parametrize(
    "filters, headcount, currencies",
    [
        ({"country": "IN"}, 4, ["INR"]),
        ({"country": "DE"}, 2, ["EUR", "USD"]),
        ({"currency": "USD"}, 3, ["USD"]),
        ({"job_title": "sales executive"}, 4, ["EUR", "INR", "USD"]),
        ({"min_salary": 100, "max_salary": 300}, 3, ["INR"]),
    ],
)
def test_summary_respects_the_employee_filters(
    api_client, pay_data, filters, headcount, currencies
):
    body = get_json(api_client, "summary", **filters)

    assert body["headcount"] == headcount
    assert [row["currency"] for row in body["salary_by_currency"]] == currencies


def test_summary_of_no_matching_employees_is_empty(api_client, pay_data):
    body = get_json(api_client, "summary", country="FR")

    assert body == {"headcount": 0, "salary_by_currency": []}


def test_summary_rejects_an_impossible_salary_range(api_client, pay_data):
    response = api_client.get(f"{INSIGHTS}/summary", {"min_salary": 10, "max_salary": 5})

    assert response.status_code == 400


def test_by_country_keeps_currencies_separate_within_a_country(api_client, pay_data):
    rows = get_json(api_client, "by-country")

    assert [(row["group"], row["currency"]) for row in rows] == [
        ("DE", "EUR"),
        ("DE", "USD"),
        ("IN", "INR"),
        ("US", "USD"),
    ]
    assert stats_of(find_row(rows, "USD", "DE")) == (1, 90, 90, 90, 90)
    assert stats_of(find_row(rows, "USD", "US")) == (2, 10, 15, 15, 20)


def test_by_department_groups_by_department_name(api_client, pay_data):
    rows = get_json(api_client, "by-department")

    assert stats_of(find_row(rows, "INR", "Engineering")) == (2, 100, 150, 150, 200)
    assert stats_of(find_row(rows, "INR", "Sales")) == (2, 300, 350, 350, 400)
    assert {row["group"] for row in rows} == {"Engineering", "Sales"}


def test_by_job_title_groups_by_title(api_client, pay_data):
    rows = get_json(api_client, "by-job-title")

    assert stats_of(find_row(rows, "USD", "Sales Executive")) == (1, 90, 90, 90, 90)
    assert stats_of(find_row(rows, "USD", "Software Engineer")) == (2, 10, 15, 15, 20)


def test_breakdowns_respect_the_employee_filters(api_client, pay_data):
    rows = get_json(api_client, "by-department", currency="INR")

    assert [(row["group"], row["currency"]) for row in rows] == [
        ("Engineering", "INR"),
        ("Sales", "INR"),
    ]


def test_breakdown_without_employees_is_empty(api_client, db):
    assert get_json(api_client, "by-country") == []


def bucket_headcounts(body: dict) -> list[int]:
    return [bucket["headcount"] for bucket in body["buckets"]]


def test_distribution_counts_employees_in_equal_width_buckets(api_client, pay_data):
    body = get_json(api_client, "distribution", currency="INR", buckets=4)

    assert body["currency"] == "INR"
    assert body["bucket_width"] == 76
    assert bucket_headcounts(body) == [1, 1, 1, 1]
    assert (body["buckets"][0]["min_salary"], body["buckets"][0]["max_salary"]) == (100, 175)
    assert body["buckets"][-1]["max_salary"] == 400


def test_distribution_includes_empty_buckets(api_client, pay_data):
    body = get_json(api_client, "distribution", currency="USD", buckets=3)

    assert bucket_headcounts(body) == [2, 0, 1]
    assert [(b["min_salary"], b["max_salary"]) for b in body["buckets"]] == [
        (10, 36),
        (37, 63),
        (64, 90),
    ]


def test_distribution_with_one_distinct_salary_has_one_bucket(api_client, pay_data):
    body = get_json(api_client, "distribution", currency="EUR", buckets=5)

    assert bucket_headcounts(body) == [1]
    assert (body["buckets"][0]["min_salary"], body["buckets"][0]["max_salary"]) == (50, 50)


def test_distribution_defaults_to_ten_buckets(api_client, pay_data):
    body = get_json(api_client, "distribution", currency="INR")

    assert len(body["buckets"]) == 10
    assert sum(bucket_headcounts(body)) == 4


def test_distribution_respects_the_employee_filters(api_client, pay_data):
    body = get_json(api_client, "distribution", currency="USD", country="DE")

    assert bucket_headcounts(body) == [1]


def test_distribution_without_matching_employees_is_empty(api_client, pay_data):
    body = get_json(api_client, "distribution", currency="GBP")

    assert body == {"currency": "GBP", "bucket_width": 0, "buckets": []}


@pytest.mark.parametrize(
    "params",
    [
        {},
        {"currency": "INR", "buckets": 0},
        {"currency": "INR", "buckets": 51},
        {"currency": "INR", "buckets": "many"},
    ],
)
def test_distribution_rejects_invalid_parameters(api_client, pay_data, params):
    response = api_client.get(f"{INSIGHTS}/distribution", params)

    assert response.status_code == 400


def salaries_of(rows: list[dict]) -> list[int]:
    return [row["annual_salary"] for row in rows]


def test_earners_lists_the_highest_paid_first_by_default(api_client, pay_data):
    rows = get_json(api_client, "earners", currency="INR")

    assert salaries_of(rows) == [400, 300, 200, 100]


def test_earners_can_list_the_lowest_paid_with_a_limit(api_client, pay_data):
    rows = get_json(api_client, "earners", currency="INR", order="lowest", limit=2)

    assert salaries_of(rows) == [100, 200]


def test_earners_are_limited_to_one_currency(api_client, pay_data):
    rows = get_json(api_client, "earners", currency="USD")

    assert salaries_of(rows) == [90, 20, 10]
    assert {row["currency"] for row in rows} == {"USD"}


def test_earners_respect_the_employee_filters(api_client, pay_data, sales):
    rows = get_json(api_client, "earners", currency="INR", department=sales.id)

    assert salaries_of(rows) == [400, 300]


def test_earners_with_equal_salaries_are_ordered_by_id(api_client, create_employee):
    first = create_employee(currency="INR", annual_salary=500)
    second = create_employee(currency="INR", annual_salary=500)

    rows = get_json(api_client, "earners", currency="INR")

    assert [row["id"] for row in rows] == [first.id, second.id]


def test_earners_include_the_employee_details(api_client, pay_data):
    row = get_json(api_client, "earners", currency="INR", limit=1)[0]

    assert row["job_title"] == "Sales Executive"
    assert row["department_name"] == "Sales"
    assert row["country"] == "IN"


@pytest.mark.parametrize(
    "params",
    [
        {},
        {"currency": "INR", "order": "richest"},
        {"currency": "INR", "limit": 0},
        {"currency": "INR", "limit": 101},
    ],
)
def test_earners_reject_invalid_parameters(api_client, pay_data, params):
    response = api_client.get(f"{INSIGHTS}/earners", params)

    assert response.status_code == 400
