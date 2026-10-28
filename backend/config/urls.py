from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import SimpleRouter

from employees.views import DepartmentViewSet, EmployeeViewSet, LookupsView

router = SimpleRouter(trailing_slash=False)
router.register("employees", EmployeeViewSet, basename="employee")
router.register("departments", DepartmentViewSet, basename="department")

urlpatterns = [
    path("api/schema", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs", SpectacularSwaggerView.as_view(url_name="schema")),
    path("api/v1/lookups", LookupsView.as_view()),
    path("api/v1/", include(router.urls)),
]
