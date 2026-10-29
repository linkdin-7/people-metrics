from rest_framework import serializers
from rest_framework.exceptions import APIException

from employees.countries import default_currency_for
from employees.models import Department, Employee, normalize_name


class Conflict(APIException):
    status_code = 409
    default_detail = "The request conflicts with existing data."
    default_code = "conflict"


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name"]

    def validate_name(self, value: str) -> str:
        name = normalize_name(value)
        if not name:
            raise serializers.ValidationError("This field may not be blank.")
        if Department.objects.filter(name__iexact=name).exists():
            raise Conflict("A department with this name already exists.")
        return name


class QuestionField(serializers.CharField):
    def to_internal_value(self, data):
        if not isinstance(data, str):
            self.fail("invalid")
        return super().to_internal_value(data)


class AskQuestionSerializer(serializers.Serializer):
    question = QuestionField(max_length=300)


class AskAnswerSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["answered", "needs_clarification", "unsupported"])
    question = serializers.CharField()
    interpretation = serializers.ListField(child=serializers.DictField(child=serializers.CharField()))
    answer = serializers.CharField()
    notes = serializers.ListField(child=serializers.CharField())
    columns = serializers.ListField(child=serializers.DictField(child=serializers.CharField()))
    rows = serializers.ListField(child=serializers.DictField())
    suggestions = serializers.ListField(child=serializers.CharField())


class SalaryStatsSerializer(serializers.Serializer):
    group = serializers.CharField(required=False)
    currency = serializers.CharField()
    headcount = serializers.IntegerField()
    min_salary = serializers.IntegerField()
    median_salary = serializers.FloatField()
    average_salary = serializers.FloatField()
    max_salary = serializers.IntegerField()


class SummarySerializer(serializers.Serializer):
    headcount = serializers.IntegerField()
    salary_by_currency = SalaryStatsSerializer(many=True)


class SalaryBucketSerializer(serializers.Serializer):
    min_salary = serializers.IntegerField()
    max_salary = serializers.IntegerField()
    headcount = serializers.IntegerField()


class DistributionSerializer(serializers.Serializer):
    currency = serializers.CharField()
    bucket_width = serializers.IntegerField()
    buckets = SalaryBucketSerializer(many=True)


class DistributionQuerySerializer(serializers.Serializer):
    currency = serializers.CharField()
    buckets = serializers.IntegerField(min_value=1, max_value=50, default=10)


class EarnersQuerySerializer(serializers.Serializer):
    currency = serializers.CharField()
    order = serializers.ChoiceField(choices=["highest", "lowest"], default="highest")
    limit = serializers.IntegerField(min_value=1, max_value=100, default=10)


class EmployeeSerializer(serializers.ModelSerializer):
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all())
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = Employee
        fields = [
            "id",
            "first_name",
            "last_name",
            "email",
            "department",
            "department_name",
            "job_title",
            "country",
            "currency",
            "annual_salary",
            "hire_date",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"currency": {"required": False}}

    def validate_email(self, value: str) -> str:
        email = value.strip().lower()
        duplicates = Employee.objects.filter(email__iexact=email)
        if self.instance:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise Conflict("An employee with this email already exists.")
        return email

    def validate(self, attributes: dict) -> dict:
        creating = self.instance is None
        if creating and not attributes.get("currency"):
            default_currency = default_currency_for(attributes["country"])
            if default_currency is None:
                raise serializers.ValidationError(
                    {"currency": "Currency is required for this country."}
                )
            attributes["currency"] = default_currency
        return attributes
