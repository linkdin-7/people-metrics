from django.db.models import Aggregate, Avg, Count, F, FloatField, Max, Min, QuerySet

GROUP_FIELDS = {
    "country": "country",
    "department": "department__name",
    "job_title": "job_title",
}


class Median(Aggregate):
    function = "percentile_cont"
    template = "%(function)s(0.5) WITHIN GROUP (ORDER BY %(expressions)s)"
    output_field = FloatField()


def salary_stats(employees: QuerySet, group_by: str | None = None) -> list[dict]:
    """Salary figures per currency, optionally per group within each currency."""
    group_expressions = {"group": F(GROUP_FIELDS[group_by])} if group_by else {}
    ordering = ["group", "currency"] if group_by else ["currency"]
    rows = (
        employees.order_by()
        .values("currency", **group_expressions)
        .annotate(
            headcount=Count("id"),
            min_salary=Min("annual_salary"),
            median_salary=Median("annual_salary"),
            average_salary=Avg("annual_salary"),
            max_salary=Max("annual_salary"),
        )
        .order_by(*ordering)
    )
    return [
        {
            **row,
            "median_salary": round(row["median_salary"], 2),
            "average_salary": round(row["average_salary"], 2),
        }
        for row in rows
    ]
