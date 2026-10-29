"""Answers a parsed question from the database, reusing the insights queries."""

from django.db.models import Count
from django.utils import timezone

from employees.ask_parser import EXAMPLE_QUESTIONS, QuerySpec, Vocabulary, parse_question
from employees.countries import default_currency_for, list_countries, list_currencies
from employees.insights import GROUP_FIELDS, salary_stats
from employees.models import Department, Employee

COUNTRY_ALIASES = {
    "usa": "US", "america": "US", "united states of america": "US",
    "uk": "GB", "britain": "GB", "great britain": "GB",
    "uae": "AE", "emirates": "AE", "holland": "NL",
}
DEPARTMENT_ALIASES = {"hr": "Human Resources"}

METRIC_LABELS = {
    "headcount": "Employees", "median": "Median salary", "average": "Average salary",
    "min": "Lowest salary", "max": "Highest salary",
}
METRIC_FIELDS = {"median": "median_salary", "average": "average_salary", "min": "min_salary", "max": "max_salary"}
GROUP_LABELS = {"country": "Country", "department": "Department", "job_title": "Job title"}

TEXT_COLUMN = {"key": "group", "kind": "text"}
EMPLOYEES_COLUMN = {"key": "headcount", "label": "Employees", "kind": "count"}


def build_vocabulary() -> Vocabulary:
    countries = list_countries()
    phrases = {country.name.lower(): country.code for country in countries}
    phrases.update(COUNTRY_ALIASES)

    departments = {name.lower(): name for name in Department.objects.values_list("name", flat=True)}
    for alias, name in DEPARTMENT_ALIASES.items():
        if name.lower() in departments:
            departments[alias] = name
    titles = Employee.objects.order_by().values_list("job_title", flat=True).distinct()

    return Vocabulary(
        countries=phrases,
        country_names={country.code: country.name for country in countries},
        departments=departments,
        job_titles={title.lower(): title for title in titles},
        currencies=frozenset(list_currencies()),
    )


def reply(status: str, question: str, answer: str, **parts) -> dict:
    return {
        "status": status,
        "question": question,
        "interpretation": parts.get("interpretation", []),
        "answer": answer,
        "notes": parts.get("notes", []),
        "columns": parts.get("columns", []),
        "rows": parts.get("rows", []),
        "suggestions": list(parts.get("suggestions", [])),
    }


def money(amount: float, currency: str) -> str:
    return f"{amount:,.0f} {currency}"


def plural(count: int, noun: str) -> str:
    return f"{count:,} {noun}{'' if count == 1 else 's'}"


def describe(spec: QuerySpec, vocabulary: Vocabulary, currency: str | None) -> list[dict]:
    parts = [{"label": "Statistic", "value": METRIC_LABELS[spec.metric]}]
    if spec.group_by:
        parts.append({"label": "Grouped by", "value": GROUP_LABELS[spec.group_by]})
    if spec.country:
        parts.append({"label": "Country", "value": vocabulary.country_names[spec.country]})
    if spec.department:
        parts.append({"label": "Department", "value": spec.department})
    if spec.job_title:
        parts.append({"label": "Job title", "value": spec.job_title})
    if currency:
        parts.append({"label": "Currency", "value": currency})
    if spec.salary_description:
        parts.append({"label": "Salary", "value": spec.salary_description})
    if spec.group_by:
        direction = "highest first" if spec.order == "highest" else "lowest first"
        shown = f"top {spec.limit}, {direction}" if spec.limit else direction
        parts.append({"label": "Showing", "value": shown})
    return parts


def scope_text(spec: QuerySpec, vocabulary: Vocabulary, currency: str | None) -> str:
    salary = f"salary {spec.salary_description}{f' {currency}' if currency else ''}" if spec.salary_description else None
    parts = [
        spec.job_title,
        spec.department,
        vocabulary.country_names[spec.country] if spec.country else None,
        salary,
    ]
    shown = [part for part in parts if part]
    return f" ({', '.join(shown)})" if shown else ""


def filtered_employees(spec: QuerySpec):
    employees = Employee.objects.all()
    if spec.country:
        employees = employees.filter(country=spec.country)
    if spec.department:
        employees = employees.filter(department__name__iexact=spec.department)
    if spec.job_title:
        employees = employees.filter(job_title__iexact=spec.job_title)
    return employees


def group_label(spec: QuerySpec, vocabulary: Vocabulary, group: str) -> str:
    return vocabulary.country_names.get(group, group) if spec.group_by == "country" else group


def ranked(rows: list[dict], spec: QuerySpec) -> list[dict]:
    rows = sorted(rows, key=lambda row: str(row["group"]))
    rows = sorted(rows, key=lambda row: row["value"], reverse=spec.order == "highest")
    return rows[: spec.limit] if spec.limit else rows


def headcount_rows(employees, spec: QuerySpec, vocabulary: Vocabulary) -> list[dict]:
    if not spec.group_by:
        return [{"value": employees.count()}]
    field = GROUP_FIELDS[spec.group_by]
    counted = employees.order_by().values(field).annotate(value=Count("id"))
    rows = [{"group": group_label(spec, vocabulary, row[field]), "value": row["value"]} for row in counted]
    return ranked(rows, spec)


def salary_rows(employees, spec: QuerySpec, vocabulary: Vocabulary) -> list[dict]:
    field = METRIC_FIELDS[spec.metric]
    rows = []
    for stat in salary_stats(employees, spec.group_by):
        row = {"currency": stat["currency"], "headcount": stat["headcount"], "value": stat[field]}
        if spec.group_by:
            row["group"] = group_label(spec, vocabulary, stat["group"])
        rows.append(row)
    if spec.group_by:
        return ranked(rows, spec)
    return sorted(rows, key=lambda row: (-row["headcount"], row["currency"]))


def columns_for(spec: QuerySpec) -> list[dict]:
    group = [{**TEXT_COLUMN, "label": GROUP_LABELS[spec.group_by]}] if spec.group_by else []
    if spec.metric == "headcount":
        return [*group, {"key": "value", "label": "Employees", "kind": "count"}]
    currency = [] if spec.group_by else [{"key": "currency", "label": "Currency", "kind": "text"}]
    return [*group, *currency, EMPLOYEES_COLUMN, {"key": "value", "label": METRIC_LABELS[spec.metric], "kind": "money"}]


def write_answer(spec: QuerySpec, rows: list[dict], vocabulary: Vocabulary, currency: str | None) -> str:
    scope = scope_text(spec, vocabulary, currency)
    metric = METRIC_LABELS[spec.metric]
    if not rows:
        return "No employees match those conditions."

    if spec.metric == "headcount" and not spec.group_by:
        return f"{plural(rows[0]['value'], 'employee')}{scope or ' in total'}."
    if spec.metric == "headcount":
        if spec.limit == 1:
            word = "most" if spec.order == "highest" else "fewest"
            return f"{rows[0]['group']} has the {word} employees{scope}: {rows[0]['value']:,}."
        return f"Employees by {spec.group_by.replace('_', ' ')}{scope}, {spec.order} first:"

    if not spec.group_by:
        top = rows[0]
        if len(rows) == 1:
            return f"{metric}{scope}: {money(top['value'], top['currency'])} across {plural(top['headcount'], 'employee')}."
        return (
            f"{metric}{scope} differs by currency, so each is shown separately. "
            f"Largest group: {money(top['value'], top['currency'])} ({plural(top['headcount'], 'employee')})."
        )
    if spec.limit == 1:
        word = "highest" if spec.order == "highest" else "lowest"
        top = rows[0]
        return f"{top['group']} has the {word} {metric.lower()}{scope}: {money(top['value'], top['currency'])}."
    return f"{metric} by {spec.group_by.replace('_', ' ')} in {rows[0]['currency']}{scope}, {spec.order} first:"


def ask_for_currency(question: str, employees) -> dict:
    common = employees.order_by().values("currency").annotate(total=Count("id")).order_by("-total")[:3]
    stem = question.strip().rstrip(" ?.!")
    return reply(
        "needs_clarification",
        question,
        "Salaries are paid in different currencies, so I need one to compare. Which currency should I use?",
        suggestions=[f"{stem} in {row['currency']}" for row in common],
    )


def run(spec: QuerySpec, question: str, vocabulary: Vocabulary) -> dict:
    employees = filtered_employees(spec)
    notes: list[str] = []
    currency = spec.currency
    compares_salaries = spec.min_salary is not None or spec.max_salary is not None
    ranks_salaries = spec.group_by is not None and spec.metric != "headcount"

    if (compares_salaries or ranks_salaries) and currency is None:
        usual = default_currency_for(spec.country) if spec.country else None
        if not usual:
            return ask_for_currency(question, employees)
        currency = usual
        notes.append(
            f"Salaries are compared in {usual}, the usual currency in {vocabulary.country_names[spec.country]}. "
            "People paid in other currencies are left out."
        )
    if currency:
        employees = employees.filter(currency=currency)
    if spec.min_salary is not None:
        employees = employees.filter(annual_salary__gte=spec.min_salary)
    if spec.max_salary is not None:
        employees = employees.filter(annual_salary__lte=spec.max_salary)

    rows = (
        headcount_rows(employees, spec, vocabulary)
        if spec.metric == "headcount"
        else salary_rows(employees, spec, vocabulary)
    )
    if spec.metric == "headcount" and not spec.group_by and rows[0]["value"] == 0:
        return reply(
            "answered", question, "No employees match those conditions.",
            interpretation=describe(spec, vocabulary, currency), notes=notes,
            columns=columns_for(spec), rows=rows,
        )
    return reply(
        "answered", question, write_answer(spec, rows, vocabulary, currency),
        interpretation=describe(spec, vocabulary, currency), notes=notes,
        columns=columns_for(spec), rows=rows,
    )


def answer_question(question: str) -> dict:
    vocabulary = build_vocabulary()
    outcome = parse_question(question, vocabulary, timezone.localdate())
    if outcome.status == "understood":
        return run(outcome.spec, question, vocabulary)
    suggestions = outcome.suggestions or EXAMPLE_QUESTIONS
    return reply(outcome.status, question, outcome.message, suggestions=suggestions)
