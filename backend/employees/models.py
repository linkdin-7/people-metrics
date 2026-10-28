from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models.functions import Lower

from employees.countries import (
    default_currency_for,
    is_valid_country,
    is_valid_currency,
)


def normalize_name(value: str) -> str:
    return " ".join(value.split())


def validate_country_code(value: str) -> None:
    if not is_valid_country(value):
        raise ValidationError(
            "%(value)s is not a supported ISO 3166-1 alpha-2 country code.",
            code="invalid_country",
            params={"value": value},
        )


def validate_currency_code(value: str) -> None:
    if not is_valid_currency(value):
        raise ValidationError(
            "%(value)s is not a supported ISO 4217 currency code.",
            code="invalid_currency",
            params={"value": value},
        )


class Department(models.Model):
    name = models.CharField(max_length=100)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                Lower("name"), name="unique_department_name_ignoring_case"
            ),
            models.CheckConstraint(
                condition=~models.Q(name=""), name="department_name_not_empty"
            ),
        ]

    def save(self, *args, **kwargs) -> None:
        self.name = normalize_name(self.name)
        super().save(*args, **kwargs)


class Employee(models.Model):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField()
    department = models.ForeignKey(
        Department, on_delete=models.PROTECT, related_name="employees"
    )
    job_title = models.CharField(max_length=100)
    country = models.CharField(max_length=2, validators=[validate_country_code])
    currency = models.CharField(
        max_length=3, blank=True, validators=[validate_currency_code]
    )
    annual_salary = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    hire_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["last_name", "first_name", "id"]
        constraints = [
            models.UniqueConstraint(
                Lower("email"), name="unique_employee_email_ignoring_case"
            ),
            models.CheckConstraint(
                condition=models.Q(annual_salary__gt=0),
                name="employee_salary_positive",
            ),
            models.CheckConstraint(
                condition=~models.Q(currency=""), name="employee_currency_not_empty"
            ),
        ]
        indexes = [
            models.Index(fields=["country"]),
            models.Index(fields=["annual_salary"]),
        ]

    def apply_default_currency(self) -> None:
        if not self.currency:
            self.currency = default_currency_for(self.country) or ""

    def clean(self) -> None:
        if is_valid_country(self.country):
            self.apply_default_currency()

    def save(self, *args, **kwargs) -> None:
        self.email = self.email.strip().lower()
        self.first_name = normalize_name(self.first_name)
        self.last_name = normalize_name(self.last_name)
        self.job_title = normalize_name(self.job_title)
        self.apply_default_currency()
        super().save(*args, **kwargs)
