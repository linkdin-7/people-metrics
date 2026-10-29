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


NAME_PUNCTUATION = set(" '’-.")


def validate_person_name(value: str) -> None:
    name = value.strip()
    is_valid = (
        len(name) >= 2
        and name[0].isalpha()
        and all(character.isalpha() or character in NAME_PUNCTUATION for character in name)
    )
    if not is_valid:
        raise ValidationError(
            "Use at least 2 characters, starting with a letter. Only letters, spaces, "
            "hyphens, apostrophes and full stops are allowed.",
            code="invalid_name",
        )


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
    first_name = models.CharField(max_length=100, validators=[validate_person_name])
    last_name = models.CharField(max_length=100, validators=[validate_person_name])
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
