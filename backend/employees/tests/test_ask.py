import datetime

import pytest

from employees.ask_parser import Vocabulary, parse_question
from employees.models import Department

ASK = "/api/v1/insights/ask"
TODAY = datetime.date(2026, 10, 29)

VOCABULARY = Vocabulary(
    countries={
        "india": "IN",
        "germany": "DE",
        "canada": "CA",
        "france": "FR",
        "japan": "JP",
        "united states": "US",
        "usa": "US",
        "united kingdom": "GB",
        "uk": "GB",
    },
    country_names={
        "IN": "India",
        "DE": "Germany",
        "CA": "Canada",
        "FR": "France",
        "JP": "Japan",
        "US": "United States",
        "GB": "United Kingdom",
    },
    departments={
        "engineering": "Engineering",
        "sales": "Sales",
        "human resources": "Human Resources",
        "hr": "Human Resources",
        "finance": "Finance",
    },
    job_titles={
        "software engineer": "Software Engineer",
        "senior software engineer": "Senior Software Engineer",
        "data engineer": "Data Engineer",
        "qa engineer": "QA Engineer",
        "account executive": "Account Executive",
        "sales executive": "Sales Executive",
        "engineering manager": "Engineering Manager",
        "accountant": "Accountant",
    },
    currencies=frozenset({"USD", "INR", "EUR", "GBP", "JPY", "ALL", "TOP"}),
)


def understood(question: str) -> dict:
    outcome = parse_question(question, VOCABULARY, TODAY)
    assert outcome.status == "understood", f"{question!r} -> {outcome.status}: {outcome.message}"
    return outcome.spec.__dict__


@pytest.mark.parametrize(
    "question, expected",
    [
        (
            "What is the median salary of software engineers in India?",
            {"metric": "median", "job_title": "Software Engineer", "country": "IN", "group_by": None},
        ),
        (
            "Which department has the highest average salary in Germany?",
            {"metric": "average", "group_by": "department", "order": "highest", "limit": 1, "country": "DE"},
        ),
        (
            "How many employees earn more than 100,000 in the US?",
            {"metric": "headcount", "min_salary": 100001, "country": "US"},
        ),
        (
            "Top 5 job titles by average salary in the UK",
            {"metric": "average", "group_by": "job_title", "limit": 5, "order": "highest", "country": "GB"},
        ),
        ("average salary by country in USD", {"metric": "average", "group_by": "country", "currency": "USD"}),
        ("How many employees are in each department?", {"metric": "headcount", "group_by": "department"}),
        ("What is the lowest salary in Sales?", {"metric": "min", "order": "lowest", "department": "Sales"}),
        ("median pay in india", {"metric": "median", "country": "IN"}),
        ("How many HR employees are in France?", {"metric": "headcount", "department": "Human Resources", "country": "FR"}),
        ("highest salary for data engineers in Japan", {"metric": "max", "job_title": "Data Engineer", "country": "JP"}),
        (
            "bottom 3 departments by median salary in India",
            {"metric": "median", "group_by": "department", "limit": 3, "order": "lowest", "country": "IN"},
        ),
        ("avg salary of senior software engineers", {"metric": "average", "job_title": "Senior Software Engineer"}),
        ("headcount by country", {"metric": "headcount", "group_by": "country"}),
        ("What is the maximum salary of an accountant?", {"metric": "max", "job_title": "Accountant"}),
        ("Which country has the most employees?", {"metric": "headcount", "group_by": "country", "order": "highest", "limit": 1}),
        ("median salary of Engineering Managers", {"metric": "median", "job_title": "Engineering Manager"}),
        ("median salary in engineering", {"metric": "median", "department": "Engineering"}),
    ],
)
def test_supported_questions_are_understood(question, expected):
    spec = understood(question)

    assert {key: spec[key] for key in expected} == expected


@pytest.mark.parametrize(
    "question, expected",
    [
        ("employees earning between 50k and 80k in INR", {"min_salary": 50000, "max_salary": 80000, "currency": "INR"}),
        ("employees paid under 1.5 million USD", {"max_salary": 1499999, "currency": "USD"}),
        ("how many earn more than 120,000 in India", {"min_salary": 120001, "country": "IN"}),
        ("how many earn over 2m in India", {"min_salary": 2000001}),
        ("how many earn below 90 thousand usd", {"max_salary": 89999, "currency": "USD"}),
    ],
)
def test_salary_amounts_are_understood_in_common_forms(question, expected):
    spec = understood(question)

    assert {key: spec[key] for key in expected} == expected


def test_a_lowercase_code_is_a_currency_but_ordinary_words_are_not():
    assert understood("average salary by country in usd")["currency"] == "USD"
    assert understood("top 3 departments by median salary in India")["currency"] is None
    assert understood("how many employees in all departments")["currency"] is None


def test_us_is_a_country_only_when_written_in_capitals():
    assert understood("how many employees in the US")["country"] == "US"
    assert understood("how many of us are in Sales")["country"] is None


def test_hr_means_the_department_not_croatia():
    assert understood("how many HR employees")["department"] == "Human Resources"


@pytest.mark.parametrize(
    "question, mentions",
    [
        ("median salary of engineers in India", "Software Engineer"),
        ("how many engineers are there", "QA Engineer"),
    ],
)
def test_an_ambiguous_job_title_asks_which_one_was_meant(question, mentions):
    outcome = parse_question(question, VOCABULARY, TODAY)

    assert outcome.status == "needs_clarification"
    assert any(mentions in suggestion for suggestion in outcome.suggestions)


def test_a_plural_title_is_accepted():
    assert understood("median salary of accountants")["job_title"] == "Accountant"


@pytest.mark.parametrize("question", ["how many people were hired after 2023", "median salary of astronauts"])
def test_words_that_are_not_understood_are_reported_not_ignored(question):
    outcome = parse_question(question, VOCABULARY, TODAY)

    assert outcome.status == "needs_clarification"
    assert "didn't understand" in outcome.message


def test_a_misspelled_country_offers_the_closest_match():
    outcome = parse_question("median salary in Gernany", VOCABULARY, TODAY)

    assert outcome.status == "needs_clarification"
    assert "Germany" in outcome.message
    assert outcome.suggestions == ("median salary in Germany",)


def test_an_unknown_place_is_reported_instead_of_guessed():
    outcome = parse_question("median salary in Atlantis", VOCABULARY, TODAY)

    assert outcome.status == "needs_clarification"
    assert "atlantis" in outcome.message.lower()


def test_a_missing_statistic_is_asked_for():
    outcome = parse_question("what is the salary in India", VOCABULARY, TODAY)

    assert outcome.status == "needs_clarification"
    assert "What is the median salary in India?" in outcome.suggestions


def test_a_ranking_without_something_to_rank_is_asked_about():
    outcome = parse_question("top 5 salaries", VOCABULARY, TODAY)

    assert outcome.status == "needs_clarification"


def test_two_statistics_in_one_question_are_asked_about():
    outcome = parse_question("median and average salary in India", VOCABULARY, TODAY)

    assert outcome.status == "needs_clarification"


def test_two_countries_in_one_question_are_asked_about():
    outcome = parse_question("median salary in India and Germany", VOCABULARY, TODAY)

    assert outcome.status == "needs_clarification"
    assert "one country" in outcome.message


@pytest.mark.parametrize("question", ["tell me a joke", "hello", "what is the weather", "asdf qwer"])
def test_unrelated_questions_are_unsupported_and_come_with_examples(question):
    outcome = parse_question(question, VOCABULARY, TODAY)

    assert outcome.status == "unsupported"
    assert len(outcome.suggestions) >= 3


def test_the_example_questions_are_all_understood():
    from employees.ask_parser import EXAMPLE_QUESTIONS

    for question in EXAMPLE_QUESTIONS:
        assert parse_question(question, VOCABULARY, TODAY).status == "understood", question


@pytest.fixture
def pay_data(create_employee, engineering):
    sales = Department.objects.create(name="Sales")
    people = [
        ("IN", "INR", 1000000, engineering, "Software Engineer", datetime.date(2021, 5, 1)),
        ("IN", "INR", 2000000, engineering, "Software Engineer", datetime.date(2024, 3, 1)),
        ("DE", "EUR", 70000, engineering, "Software Engineer", datetime.date(2019, 1, 1)),
        ("DE", "USD", 90000, engineering, "Software Engineer", datetime.date(2025, 6, 1)),
        ("IN", "INR", 500000, sales, "Account Executive", datetime.date(2022, 8, 1)),
        ("US", "USD", 100000, sales, "Account Executive", datetime.date(2023, 2, 1)),
        ("US", "USD", 120000, sales, "Account Executive", datetime.date(2024, 9, 1)),
    ]
    for country, currency, salary, department, title, hired in people:
        create_employee(
            country=country,
            currency=currency,
            annual_salary=salary,
            department=department,
            job_title=title,
            hire_date=hired,
        )


def ask(api_client, question: str) -> dict:
    response = api_client.post(ASK, {"question": question}, format="json")
    assert response.status_code == 200, response.content
    return response.json()


def values(body: dict) -> list:
    return [row["value"] for row in body["rows"]]


def test_a_single_statistic_is_answered_from_the_database(api_client, pay_data):
    body = ask(api_client, "What is the median salary of software engineers in India?")

    assert body["status"] == "answered"
    assert values(body) == [1500000]
    assert body["rows"][0]["currency"] == "INR"
    assert "1,500,000 INR" in body["answer"]


def test_the_interpretation_shows_how_the_question_was_understood(api_client, pay_data):
    body = ask(api_client, "What is the median salary of software engineers in India?")

    assert {"label": "Statistic", "value": "Median salary"} in body["interpretation"]
    assert {"label": "Country", "value": "India"} in body["interpretation"]
    assert {"label": "Job title", "value": "Software Engineer"} in body["interpretation"]


def test_a_statistic_over_several_currencies_is_answered_per_currency_never_mixed(api_client, pay_data):
    body = ask(api_client, "median salary in Germany")

    assert body["status"] == "answered"
    assert {row["currency"]: row["value"] for row in body["rows"]} == {"EUR": 70000, "USD": 90000}


def test_a_ranking_in_one_country_uses_that_countrys_currency_and_says_so(api_client, pay_data):
    body = ask(api_client, "Which department has the highest average salary in India?")

    assert body["status"] == "answered"
    assert [(row["group"], row["value"]) for row in body["rows"]] == [("Engineering", 1500000)]
    assert any("INR" in note for note in body["notes"])
    assert "Engineering" in body["answer"]


def test_a_ranking_lists_the_requested_number_of_groups(api_client, pay_data):
    body = ask(api_client, "top 2 job titles by headcount")

    assert [(row["group"], row["value"]) for row in body["rows"]] == [
        ("Software Engineer", 4),
        ("Account Executive", 3),
    ]


def test_the_lowest_ranking_reverses_the_order(api_client, pay_data):
    body = ask(api_client, "bottom 1 job title by headcount")

    assert [row["group"] for row in body["rows"]] == ["Account Executive"]


def test_a_ranking_without_a_country_or_currency_asks_for_one(api_client, pay_data):
    body = ask(api_client, "Which department has the highest average salary?")

    assert body["status"] == "needs_clarification"
    assert "currency" in body["answer"].lower()
    assert any("INR" in suggestion for suggestion in body["suggestions"])


def test_a_salary_filter_without_a_currency_asks_for_one(api_client, pay_data):
    body = ask(api_client, "How many employees earn more than 100000?")

    assert body["status"] == "needs_clarification"


def test_a_salary_filter_in_a_country_uses_its_currency(api_client, pay_data):
    body = ask(api_client, "How many employees earn more than 100000 in the US?")

    assert body["status"] == "answered"
    assert values(body) == [1]
    assert any("USD" in note for note in body["notes"])
    assert "salary above 100,000 USD" in body["answer"]


def test_a_salary_filter_with_an_explicit_currency_needs_no_country(api_client, pay_data):
    body = ask(api_client, "How many employees earn more than 99999 USD?")

    assert values(body) == [2]


def test_headcount_adds_people_across_currencies(api_client, pay_data):
    body = ask(api_client, "headcount by country")

    assert {row["group"]: row["value"] for row in body["rows"]} == {"India": 3, "Germany": 2, "United States": 2}
    assert values(body) == [3, 2, 2]


def test_headcount_without_a_grouping_is_one_number(api_client, pay_data):
    body = ask(api_client, "How many employees are there?")

    assert values(body) == [7]
    assert "7 employees" in body["answer"]


def test_a_question_that_matches_nobody_says_so(api_client, pay_data):
    body = ask(api_client, "How many employees are in Japan?")

    assert body["status"] == "answered"
    assert values(body) == [0]


def test_deleted_employees_are_not_counted(api_client, pay_data, create_employee):
    extra = create_employee(country="IN", currency="INR")
    api_client.delete(f"/api/v1/employees/{extra.id}")

    assert values(ask(api_client, "How many employees are in India?")) == [3]


def test_unsupported_questions_return_examples_not_an_error(api_client, pay_data):
    body = ask(api_client, "tell me a joke")

    assert body["status"] == "unsupported"
    assert len(body["suggestions"]) >= 3
    assert body["rows"] == []


def test_a_clarification_offers_clickable_questions(api_client, pay_data):
    body = ask(api_client, "median salary in Gernany")

    assert body["status"] == "needs_clarification"
    assert body["suggestions"] == ["median salary in Germany"]


@pytest.mark.parametrize("payload", [{}, {"question": ""}, {"question": "   "}, {"question": "x" * 301}, {"question": 5}])
def test_the_question_is_validated(api_client, payload):
    response = api_client.post(ASK, payload, format="json")

    assert response.status_code == 400
