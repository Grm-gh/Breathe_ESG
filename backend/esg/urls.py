"""
ESG app URL patterns
"""
from django.urls import path
from . import views

urlpatterns = [
    # Dashboard
    path('dashboard/', views.DashboardView.as_view(), name='dashboard'),

    # Ingestion
    path('ingest/sap/', views.IngestSAPView.as_view(), name='ingest-sap'),
    path('ingest/utility/', views.IngestUtilityView.as_view(), name='ingest-utility'),
    path('ingest/travel/', views.IngestTravelView.as_view(), name='ingest-travel'),

    # Records
    path('records/', views.ActivityRecordListView.as_view(), name='records-list'),
    path('records/<int:pk>/', views.ActivityRecordDetailView.as_view(), name='records-detail'),
    path('records/<int:pk>/flag/', views.FlagRecordView.as_view(), name='records-flag'),
    path('records/<int:pk>/approve/', views.ApproveRecordView.as_view(), name='records-approve'),
    path('records/<int:pk>/audit/', views.AuditLogView.as_view(), name='records-audit'),

    # Ingestion logs
    path('ingestions/', views.IngestionLogListView.as_view(), name='ingestions-list'),

    # Mock travel API
    path('mock-travel/', views.MockTravelAPIView.as_view(), name='mock-travel'),
]
