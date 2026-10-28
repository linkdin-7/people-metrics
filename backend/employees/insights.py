from math import ceil

from django.db.models import (
    Aggregate,
    Avg,
    Count,
    ExpressionWrapper,
    F,
    FloatField,
    IntegerField,
    Max,
    Min,
    QuerySet,
)

GROUP_FIELDS = {
    "country": "country",
    "department": "department__name",
    "job_title": "job_title",
}


# Django has no median, so this wraps the Postgres function percentile_cont.
class Median(Aggregate):
    function = "percentile_cont"
    template = "%(function)s(0.5) WITHIN GROUP (ORDER BY %(expressions)s)"
    output_field = FloatField()


# Pattern used below: annotate each row with a label, group by the label, then aggregate.
def salary_stats(employees: QuerySet, group_by: str | None = None) -> list[dict]:
    rows = employees.order_by()
    group_labels = ["currency"]
    if group_by:
        rows = rows.annotate(group=F(GROUP_FIELDS[group_by]))
        group_labels = ["group", "currency"]

    rows = (
        rows.values(*group_labels)
        .annotate(
            headcount=Count("id"),
            min_salary=Min("annual_salary"),
            median_salary=Median("annual_salary"),
            average_salary=Avg("annual_salary"),
            max_salary=Max("annual_salary"),
        )
        .order_by(*group_labels)
    )
    return [
        {
            **row,
            "median_salary": round(row["median_salary"], 2),
            "average_salary": round(row["average_salary"], 2),
        }
        for row in rows
    ]


def salary_distribution(employees: QuerySet, bucket_count: int) -> dict:
    """Headcount per equal-width salary range; call with employees of a single currency."""
    bounds = employees.aggregate(lowest=Min("annual_salary"), highest=Max("annual_salary"))
    lowest, highest = bounds["lowest"], bounds["highest"]
    if lowest is None:
        return {"bucket_width": 0, "buckets": []}

    salary_span = highest - lowest + 1
    width = ceil(salary_span / bucket_count)

    # Same pattern: label each employee with a bucket number, group by it, count.
    bucket_number = ExpressionWrapper(
        (F("annual_salary") - lowest) / width, output_field=IntegerField()
    )
    rows = (
        employees.order_by()
        .annotate(bucket=bucket_number)
        .values("bucket")
        .annotate(headcount=Count("id"))
    )
    headcounts = {row["bucket"]: row["headcount"] for row in rows}

    buckets = []
    for number in range(ceil(salary_span / width)):
        bucket_start = lowest + number * width
        buckets.append(
            {
                "min_salary": bucket_start,
                "max_salary": min(bucket_start + width - 1, highest),
                "headcount": headcounts.get(number, 0),
            }
        )
    return {"bucket_width": width, "buckets": buckets}


def top_earners(employees: QuerySet, order: str, limit: int) -> QuerySet:
    ordering = "-annual_salary" if order == "highest" else "annual_salary"
    return employees.select_related("department").order_by(ordering, "id")[:limit]
