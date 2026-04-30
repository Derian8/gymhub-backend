from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from charts.views import ChartOverviewView, ChartView
from .health_views import LiveHealthView, ReadyHealthView

urlpatterns = [
    path('admin/', admin.site.urls),

    # API Docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    path('health/live/', LiveHealthView.as_view(), name='health-live'),
    path('health/ready/', ReadyHealthView.as_view(), name='health-ready'),

    # Auth
    path('auth/', include('users.urls')),

    # Apps
    path('api/', include('classes.urls')),
    path('api/', include('plans.urls')),
    path('api/', include('attendance.urls')),
    path('api/', include('progress.urls')),
    path('api/', include('alerts.urls')),
    path('api/', include('billing.urls')),
    path('api/', include('nutrition.urls')),
    path('api/', include('ai_chat.urls')),
    path('api/', include('users.member_urls')),
    path('api/charts/overview/', ChartOverviewView.as_view(), name='charts-overview'),
    path('api/charts/<str:chart_type>/', ChartView.as_view(), name='chart'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
