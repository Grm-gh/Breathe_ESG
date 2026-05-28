from django.contrib import admin
from .models import Organization, IngestionLog, RawRecord, ActivityRecord, AuditLog


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'created_at']


@admin.register(IngestionLog)
class IngestionLogAdmin(admin.ModelAdmin):
    list_display = ['source', 'status', 'record_count', 'error_count', 'created_at']
    list_filter = ['source', 'status']


@admin.register(ActivityRecord)
class ActivityRecordAdmin(admin.ModelAdmin):
    list_display = ['source_type', 'scope', 'activity_date', 'co2e_kg', 'status', 'location']
    list_filter = ['scope', 'source_type', 'status']
    search_fields = ['location', 'department', 'description']


@admin.register(RawRecord)
class RawRecordAdmin(admin.ModelAdmin):
    list_display = ['source_type', 'row_index', 'created_at']


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['activity_record', 'action', 'field_name', 'changed_at']
    list_filter = ['action']
