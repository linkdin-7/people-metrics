from dataclasses import asdict

import django_filters
from django import forms
from django.db import IntegrityError
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import mixins, serializers, viewsets
from rest_framework.filters import OrderingFilter
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView, exception_handler

from employees.countries import list_countries, list_currencies
from employees.models import Department, Employee
from employees.serializers import DepartmentSerializer, EmployeeSerializer

def api_exception_handler(exception, context):
    # Two simultaneous requests can pass the duplicate check and hit the database constraint.
    if isinstance(exception, IntegrityError):
        return Response({"detail": "The change conflicts with existing data."}, status=409)
    return exception_handler(exception, context)


class StandardPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class StableOrderingFilter(OrderingFilter):
    ordering_param = "sort"

    def filter_queryset(self, request, queryset, view):
        ordering = self.get_ordering(request, queryset, view)
        return queryset.order_by(*ordering, "id") if ordering else queryset


class SalaryRangeForm(forms.Form):
    def clean(self) -> dict:
        cleaned = super().clean()
        low, high = cleaned.get("min_salary"), cleaned.get("max_salary")
        if low is not None and high is not None and low > high:
            raise forms.ValidationError("min_salary cannot be greater than max_salary.")
        return cleaned


class EmployeeFilter(django_filters.FilterSet):
    q = django_filters.CharFilter(method="search")
    country = django_filters.CharFilter(lookup_expr="iexact")
    currency = django_filters.CharFilter(lookup_expr="iexact")
    department = django_filters.NumberFilter(field_name="department_id")
    job_title = django_filters.CharFilter(lookup_expr="iexact")
    min_salary = django_filters.NumberFilter(field_name="annual_salary", lookup_expr="gte")
    max_salary = django_filters.NumberFilter(field_name="annual_salary", lookup_expr="lte")

    class Meta:
        model = Employee
        fields = []
        form = SalaryRangeForm

    def search(self, queryset, name, value):
        for term in value.split():
            queryset = queryset.filter(
                Q(first_name__icontains=term)
                | Q(last_name__icontains=term)
                | Q(email__icontains=term)
            )
        return queryset


class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.select_related("department")
    serializer_class = EmployeeSerializer
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, StableOrderingFilter]
    filterset_class = EmployeeFilter
    ordering_fields = [
        "first_name",
        "last_name",
        "email",
        "country",
        "job_title",
        "annual_salary",
        "hire_date",
    ]
    ordering = ["last_name", "first_name"]


class DepartmentViewSet(
    mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    pagination_class = None


LOOKUPS_RESPONSE = inline_serializer(
    "Lookups",
    {
        "countries": serializers.ListField(child=serializers.DictField()),
        "currencies": serializers.ListField(child=serializers.CharField()),
        "departments": DepartmentSerializer(many=True),
        "job_titles": serializers.ListField(child=serializers.CharField()),
    },
)


class LookupsView(APIView):
    @extend_schema(responses=LOOKUPS_RESPONSE)
    def get(self, request) -> Response:
        job_titles = (
            Employee.objects.order_by("job_title")
            .values_list("job_title", flat=True)
            .distinct()
        )
        return Response(
            {
                "countries": [asdict(country) for country in list_countries()],
                "currencies": list_currencies(),
                "departments": DepartmentSerializer(Department.objects.all(), many=True).data,
                "job_titles": list(job_titles),
            }
        )
