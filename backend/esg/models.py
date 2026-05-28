"""
Breathe ESG — Django Models

Hierarchy:
  Organization
    └── IngestionLog
          └── RawRecord (raw JSON from source)
                └── ActivityRecord (normalized, auditable)
                      └── AuditLog (every change tracked)
"""
from django.db import models
from django.contrib.auth.models import User
import json


class Organization(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['name']


class IngestionLog(models.Model):
    class SourceType(models.TextChoices):
        SAP = 'SAP', 'SAP Fuel/Procurement'
        UTILITY = 'UTILITY', 'Utility Portal'
        TRAVEL = 'TRAVEL', 'Corporate Travel API'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        SUCCESS = 'SUCCESS', 'Success'
        FAILED = 'FAILED', 'Failed'
        PARTIAL = 'PARTIAL', 'Partial (with errors)'

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='ingestion_logs',
        null=True, blank=True
    )
    source = models.CharField(max_length=20, choices=SourceType.choices)
    scope = models.IntegerField(choices=[(1, 'Scope 1'), (2, 'Scope 2'), (3, 'Scope 3')], null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    raw_file = models.FileField(upload_to='ingestions/', null=True, blank=True)
    record_count = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    error_details = models.JSONField(default=list, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.source} ingestion on {self.created_at.strftime('%Y-%m-%d %H:%M')} [{self.status}]"

    class Meta:
        ordering = ['-created_at']


class RawRecord(models.Model):
    """Immutable raw source record - the ground truth"""
    ingestion_log = models.ForeignKey(IngestionLog, on_delete=models.CASCADE, related_name='raw_records')
    source_type = models.CharField(max_length=20)
    raw_json = models.JSONField()
    row_index = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Raw #{self.row_index} from {self.source_type}"

    class Meta:
        ordering = ['ingestion_log', 'row_index']


class ActivityRecord(models.Model):
    """Normalized, auditable emission activity record"""

    class Scope(models.IntegerChoices):
        SCOPE_1 = 1, 'Scope 1 — Direct Emissions'
        SCOPE_2 = 2, 'Scope 2 — Indirect (Electricity)'
        SCOPE_3 = 3, 'Scope 3 — Value Chain'

    class SourceType(models.TextChoices):
        SAP_FUEL = 'SAP_FUEL', 'SAP — Fuel'
        SAP_PROCUREMENT = 'SAP_PROC', 'SAP — Procurement'
        UTILITY_ELECTRICITY = 'UTILITY_ELEC', 'Utility — Electricity'
        TRAVEL_FLIGHT = 'TRAVEL_FLIGHT', 'Travel — Flight'
        TRAVEL_HOTEL = 'TRAVEL_HOTEL', 'Travel — Hotel'

    class Unit(models.TextChoices):
        LITERS = 'L', 'Liters'
        KWH = 'kWh', 'Kilowatt-hours'
        PASSENGER_KM = 'pass-km', 'Passenger-kilometres'
        NIGHTS = 'nights', 'Hotel Nights'
        KG = 'kg', 'Kilograms'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending Review'
        FLAGGED = 'FLAGGED', 'Flagged'
        APPROVED = 'APPROVED', 'Approved'
        LOCKED = 'LOCKED', 'Locked'

    raw_record = models.OneToOneField(RawRecord, on_delete=models.CASCADE, related_name='activity_record')
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='activity_records',
        null=True, blank=True
    )
    scope = models.IntegerField(choices=Scope.choices)
    source_type = models.CharField(max_length=20, choices=SourceType.choices)
    activity_date = models.DateField()
    quantity = models.FloatField()
    unit = models.CharField(max_length=20, choices=Unit.choices)
    emission_factor = models.FloatField(help_text='kgCO2e per unit')
    co2e_kg = models.FloatField(help_text='Total kgCO2e = quantity × emission_factor')
    location = models.CharField(max_length=200, blank=True)
    department = models.CharField(max_length=200, blank=True)
    cost_center = models.CharField(max_length=100, blank=True)
    supplier = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    flag_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Always recompute co2e
        self.co2e_kg = round(self.quantity * self.emission_factor, 4)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_source_type_display()} | {self.activity_date} | {self.co2e_kg} kgCO2e [{self.status}]"

    class Meta:
        ordering = ['-activity_date']


class AuditLog(models.Model):
    """Immutable change log for every mutation on an ActivityRecord"""

    class Action(models.TextChoices):
        EDIT = 'EDIT', 'Field Edited'
        FLAG = 'FLAG', 'Record Flagged'
        APPROVE = 'APPROVE', 'Record Approved'
        LOCK = 'LOCK', 'Record Locked'
        CREATE = 'CREATE', 'Record Created'

    activity_record = models.ForeignKey(ActivityRecord, on_delete=models.CASCADE, related_name='audit_logs')
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)
    action = models.CharField(max_length=20, choices=Action.choices)
    field_name = models.CharField(max_length=100, blank=True)
    old_value = models.TextField(blank=True)
    new_value = models.TextField(blank=True)
    note = models.TextField(blank=True)

    def __str__(self):
        return f"{self.action} on Record#{self.activity_record_id} at {self.changed_at}"

    class Meta:
        ordering = ['-changed_at']
