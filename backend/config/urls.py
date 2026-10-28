from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import SimpleRouter

from employees.views import (
    BreakdownView,
    DepartmentViewSet,
    DistributionView,
    EarnersView,
    EmployeeViewSet,
    LookupsView,
    SummaryView,
)

router = SimpleRouter(trailing_slash=False)
router.register("employees", EmployeeViewSet, basename="employee")
router.register("departments", DepartmentViewSet, basename="department")

insights_urls = [
    path("summary", SummaryView.as_view()),
    path("by-country", BreakdownView.as_view(group_by="country")),
    path("by-department", BreakdownView.as_view(group_by="department")),
    path("by-job-title", BreakdownView.as_view(group_by="job_title")),
    path("distribution", DistributionView.as_view()),
    path("earners", EarnersView.as_view()),
]

urlpatterns = [
    path("api/schema", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs", SpectacularSwaggerView.as_view(url_name="schema")),
    path("api/v1/lookups", LookupsView.as_view()),
    path("api/v1/insights/", include(insights_urls)),
    path("api/v1/", include(router.urls)),
]
