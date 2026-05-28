"""
Django REST Framework Serializers for the ESG platform.
"""
from rest_framework import serializers
from .models import Organization, IngestionLog, RawRecord, ActivityRecord, AuditLog


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = '__all__'


class IngestionLogSerializer(serializers.ModelSerializer):
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = IngestionLog
        fields = [
            'id', 'source', 'source_display', 'scope', 'status', 'status_display',
            'record_count', 'error_count', 'error_details',
            'created_at', 'completed_at', 'notes',
        ]


class RawRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = RawRecord
        fields = ['id', 'source_type', 'raw_json', 'row_index', 'created_at']


class AuditLogSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source='changed_by.username', read_only=True, default='system')
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id', 'action', 'action_display', 'field_name',
            'old_value', 'new_value', 'note',
            'changed_by_name', 'changed_at',
        ]


class ActivityRecordListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for the records list view."""
    scope_display = serializers.CharField(source='get_scope_display', read_only=True)
    source_type_display = serializers.CharField(source='get_source_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    unit_display = serializers.CharField(source='get_unit_display', read_only=True)

    class Meta:
        model = ActivityRecord
        fields = [
            'id', 'scope', 'scope_display', 'source_type', 'source_type_display',
            'activity_date', 'quantity', 'unit', 'unit_display',
            'emission_factor', 'co2e_kg',
            'location', 'department', 'cost_center', 'description',
            'status', 'status_display', 'flag_reason',
            'created_at', 'updated_at',
        ]


class ActivityRecordDetailSerializer(serializers.ModelSerializer):
    """Full serializer including raw record and audit logs."""
    scope_display = serializers.CharField(source='get_scope_display', read_only=True)
    source_type_display = serializers.CharField(source='get_source_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    raw_record = RawRecordSerializer(read_only=True)
    audit_logs = AuditLogSerializer(many=True, read_only=True)

    class Meta:
        model = ActivityRecord
        fields = [
            'id', 'scope', 'scope_display', 'source_type', 'source_type_display',
            'activity_date', 'quantity', 'unit', 'emission_factor', 'co2e_kg',
            'location', 'department', 'cost_center', 'supplier', 'description',
            'status', 'status_display', 'flag_reason',
            'raw_record', 'audit_logs',
            'created_at', 'updated_at',
        ]


class ActivityRecordEditSerializer(serializers.ModelSerializer):
    """Used for PATCH — only editable fields."""
    class Meta:
        model = ActivityRecord
        fields = [
            'activity_date', 'quantity', 'unit', 'emission_factor',
            'location', 'department', 'cost_center', 'description',
        ]
        read_only_fields = ['status', 'co2e_kg']

    def validate(self, data):
        if self.instance and self.instance.status in ('APPROVED', 'LOCKED'):
            raise serializers.ValidationError("Cannot edit an approved or locked record.")
        return data


class FlagSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=1000, required=True)


class DashboardSerializer(serializers.Serializer):
    """KPI summary for the dashboard."""
    total_co2e_kg = serializers.FloatField()
    scope1_co2e_kg = serializers.FloatField()
    scope2_co2e_kg = serializers.FloatField()
    scope3_co2e_kg = serializers.FloatField()
    total_records = serializers.IntegerField()
    pending_count = serializers.IntegerField()
    flagged_count = serializers.IntegerField()
    approved_count = serializers.IntegerField()
    locked_count = serializers.IntegerField()
    total_ingestions = serializers.IntegerField()
    failed_ingestions = serializers.IntegerField()
    scope_breakdown = serializers.ListField()
    source_breakdown = serializers.ListField()
    recent_ingestions = IngestionLogSerializer(many=True)
