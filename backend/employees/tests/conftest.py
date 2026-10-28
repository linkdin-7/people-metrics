import datetime
import itertools

import pytest
from rest_framework.test import APIClient

from employees.models import Department, Employee


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def engineering(db) -> Department:
    return Department.objects.create(name="Engineering")


@pytest.fixture
def build_employee(engineering):
    numbers = itertools.count(1)

    def build(**overrides) -> Employee:
        fields = {
            "first_name": "Asha",
            "last_name": "Rao",
            "email": f"asha{next(numbers)}@example.com",
            "department": engineering,
            "job_title": "Software Engineer",
            "country": "IN",
            "annual_salary": 1200000,
            "hire_date": datetime.date(2022, 4, 1),
        }
        fields.update(overrides)
        return Employee(**fields)

    return build


@pytest.fixture
def create_employee(build_employee):
    def create(**overrides) -> Employee:
        employee = build_employee(**overrides)
        employee.save()
        return employee

    return create
