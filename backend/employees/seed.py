import datetime
import random
from math import floor, log10

from django.db import transaction

from employees.countries import default_currency_for
from employees.models import Department, Employee

# Country code -> (relative headcount weight, base annual salary in the local currency).
COUNTRY_PROFILES = {
    "US": (20, 95000),
    "IN": (22, 1300000),
    "GB": (9, 55000),
    "DE": (8, 65000),
    "CA": (6, 85000),
    "AU": (5, 95000),
    "SG": (4, 80000),
    "AE": (3, 200000),
    "FR": (4, 52000),
    "NL": (3, 60000),
    "ES": (2, 38000),
    "IT": (2, 40000),
    "BR": (3, 95000),
    "MX": (2, 420000),
    "JP": (3, 6000000),
    "ZA": (2, 420000),
    "PL": (2, 160000),
    "SE": (2, 540000),
}

# Job title -> (department, salary multiplier relative to a country's base salary).
JOB_TITLES = {
    "Software Engineer": ("Engineering", 1.0),
    "Senior Software Engineer": ("Engineering", 1.35),
    "Staff Engineer": ("Engineering", 1.7),
    "Engineering Manager": ("Engineering", 1.8),
    "QA Engineer": ("Engineering", 0.85),
    "DevOps Engineer": ("Engineering", 1.1),
    "Data Engineer": ("Engineering", 1.15),
    "Product Manager": ("Product", 1.3),
    "Senior Product Manager": ("Product", 1.6),
    "Product Designer": ("Design", 1.0),
    "Senior Designer": ("Design", 1.3),
    "Sales Executive": ("Sales", 0.9),
    "Account Executive": ("Sales", 1.0),
    "Sales Manager": ("Sales", 1.5),
    "Marketing Specialist": ("Marketing", 0.8),
    "Marketing Manager": ("Marketing", 1.3),
    "Accountant": ("Finance", 0.8),
    "Financial Analyst": ("Finance", 0.95),
    "Finance Manager": ("Finance", 1.4),
    "HR Executive": ("Human Resources", 0.75),
    "HR Business Partner": ("Human Resources", 1.0),
    "HR Manager": ("Human Resources", 1.3),
    "Support Associate": ("Customer Support", 0.6),
    "Support Lead": ("Customer Support", 0.9),
    "Operations Analyst": ("Operations", 0.85),
    "Operations Manager": ("Operations", 1.4),
}

FIRST_NAMES = [
    "Aarav", "Maya", "Liam", "Emma", "Noah", "Olivia", "Arjun", "Priya", "Lucas",
    "Sofia", "Mateo", "Chloe", "Kenji", "Yuki", "Omar", "Layla", "Ethan", "Zara",
    "Nikhil", "Ananya", "Felix", "Hannah", "Diego", "Isabella", "Thabo", "Amara",
    "Jakub", "Anna", "Erik", "Ingrid",
]
LAST_NAMES = [
    "Sharma", "Patel", "Smith", "Johnson", "Garcia", "Martinez", "Mueller",
    "Schneider", "Tanaka", "Sato", "Khan", "Hassan", "Silva", "Santos", "Dubois",
    "Martin", "Kowalski", "Nowak", "Andersson", "Larsson", "Nguyen", "Singh",
    "Brown", "Wilson", "Taylor", "Rossi", "Ferrari", "Okafor", "Dlamini", "Tan",
]

FOREIGN_CURRENCY_SHARE = 0.02
FOREIGN_CURRENCY = "USD"
EARLIEST_HIRE_DATE = datetime.date(2015, 1, 1)
LATEST_HIRE_DATE = datetime.date(2026, 9, 30)
BATCH_SIZE = 1000


class SeedError(Exception):
    pass


def round_to_three_significant_digits(value: float) -> int:
    return int(round(value, 2 - floor(log10(value))))


def build_employee(
    rng: random.Random, number: int, departments: dict[str, Department]
) -> Employee:
    first_name = rng.choice(FIRST_NAMES)
    last_name = rng.choice(LAST_NAMES)
    job_title = rng.choice(list(JOB_TITLES))
    department_name, multiplier = JOB_TITLES[job_title]
    country = rng.choices(
        list(COUNTRY_PROFILES), weights=[weight for weight, _ in COUNTRY_PROFILES.values()]
    )[0]

    currency = default_currency_for(country)
    base_salary = COUNTRY_PROFILES[country][1]
    if country != "US" and rng.random() < FOREIGN_CURRENCY_SHARE:
        currency, base_salary = FOREIGN_CURRENCY, COUNTRY_PROFILES["US"][1]

    days_available = (LATEST_HIRE_DATE - EARLIEST_HIRE_DATE).days
    return Employee(
        first_name=first_name,
        last_name=last_name,
        email=f"{first_name}.{last_name}.{number}@example.com".lower(),
        department=departments[department_name],
        job_title=job_title,
        country=country,
        currency=currency,
        annual_salary=round_to_three_significant_digits(
            base_salary * multiplier * rng.uniform(0.85, 1.15)
        ),
        hire_date=EARLIEST_HIRE_DATE + datetime.timedelta(days=rng.randrange(days_available)),
    )


def seed_employees(count: int = 10000, seed: int = 42, reset: bool = False) -> int:
    if count < 1:
        raise ValueError("count must be at least 1")
    existing = Employee.objects.count()
    if existing and not reset:
        raise SeedError(
            f"{existing} employees already exist; run with --reset to replace them"
        )

    rng = random.Random(seed)
    department_names = {department for department, _ in JOB_TITLES.values()}
    with transaction.atomic():
        Employee.objects.all().delete()
        departments = {
            name: Department.objects.get_or_create(name=name)[0]
            for name in sorted(department_names)
        }
        employees = [
            build_employee(rng, number, departments) for number in range(1, count + 1)
        ]
        Employee.objects.bulk_create(employees, batch_size=BATCH_SIZE)
    return len(employees)
