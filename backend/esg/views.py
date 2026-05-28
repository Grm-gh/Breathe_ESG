"""
ESG Platform API Views
"""
import json
from datetime import datetime
from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from drf_spectacular.utils import extend_schema, OpenApiParameter

from .models import Organization, IngestionLog, RawRecord, ActivityRecord, AuditLog
from .serializers import (
    ActivityRecordListSerializer, ActivityRecordDetailSerializer,
    ActivityRecordEditSerializer, IngestionLogSerializer,
    FlagSerializer, DashboardSerializer, AuditLogSerializer
)
from .parsers.sap_parser import parse_sap_csv
from .parsers.utility_parser import parse_utility_csv
from .parsers.travel_parser import parse_travel_json


# ──────────────────────────────────────────────────────────
# Mock Travel Data (serves as the simulated Concur/Navan API)
# ──────────────────────────────────────────────────────────

MOCK_TRAVEL_DATA = [
    {"type": "flight", "trip_id": "T001", "traveler": "Alice Smith", "department": "Engineering",
     "date": "2024-01-15", "origin": "LHR", "destination": "JFK", "cabin_class": "economy",
     "passengers": 1, "return_trip": True, "airline": "British Airways"},
    {"type": "flight", "trip_id": "T002", "traveler": "Bob Jones", "department": "Sales",
     "date": "2024-01-20", "origin": "MAN", "destination": "CDG", "cabin_class": "business",
     "passengers": 1, "return_trip": False, "airline": "Air France"},
    {"type": "hotel", "trip_id": "T003", "traveler": "Alice Smith", "department": "Engineering",
     "check_in": "2024-01-15", "check_out": "2024-01-18", "hotel_name": "The Westin New York",
     "location": "New York, USA", "room_category": "deluxe"},
    {"type": "flight", "trip_id": "T004", "traveler": "Carol Lee", "department": "Finance",
     "date": "2024-02-05", "origin": "LHR", "destination": "DXB", "cabin_class": "economy",
     "passengers": 1, "return_trip": True, "airline": "Emirates"},
    {"type": "hotel", "trip_id": "T005", "traveler": "Bob Jones", "department": "Sales",
     "check_in": "2024-01-20", "check_out": "2024-01-21", "hotel_name": "Hotel de Crillon",
     "location": "Paris, France", "room_category": "luxury"},
    {"type": "flight", "trip_id": "T006", "traveler": "David Brown", "department": "Operations",
     "date": "2024-02-12", "origin": "FRA", "destination": "SIN", "cabin_class": "business",
     "passengers": 1, "return_trip": True, "airline": "Lufthansa"},
    {"type": "hotel", "trip_id": "T007", "traveler": "Carol Lee", "department": "Finance",
     "check_in": "2024-02-05", "check_out": "2024-02-09", "hotel_name": "Burj Al Arab",
     "location": "Dubai, UAE", "room_category": "luxury"},
    {"type": "flight", "trip_id": "T008", "traveler": "Eve Wilson", "department": "HR",
     "date": "2024-03-01", "origin": "LHR", "destination": "BOM", "cabin_class": "economy",
     "passengers": 2, "return_trip": True, "airline": "Virgin Atlantic"},
    {"type": "hotel", "trip_id": "T009", "traveler": "David Brown", "department": "Operations",
     "check_in": "2024-02-12", "check_out": "2024-02-15", "hotel_name": "Marina Bay Sands",
     "location": "Singapore", "room_category": "deluxe"},
    {"type": "flight", "trip_id": "T010", "traveler": "Frank Chen", "department": "Product",
     "date": "2024-03-10", "origin": "LHR", "destination": "NRT", "cabin_class": "economy",
     "passengers": 1, "return_trip": False, "airline": "Japan Airlines"},
]


def _get_or_create_default_org():
    org, _ = Organization.objects.get_or_create(
        slug='default',
        defaults={'name': 'Breathe Energy Ltd'}
    )
    return org


def _persist_parsed_records(parsed_records: list, ingestion_log: IngestionLog, org: Organization):
    """Save parsed records to RawRecord + ActivityRecord."""
    success_count = 0
    error_count = 0
    all_errors = []

    for item in parsed_records:
        raw = RawRecord.objects.create(
            ingestion_log=ingestion_log,
            source_type=item['source_type'],
            raw_json=item['raw_data'],
            row_index=success_count + error_count,
        )

        n = item['normalized']
        try:
            activity = ActivityRecord.objects.create(
                raw_record=raw,
                organization=org,
                scope=n['scope'],
                source_type=n['source_type'],
                activity_date=n['activity_date'],
                quantity=n['quantity'],
                unit=n['unit'],
                emission_factor=n['emission_factor'],
                co2e_kg=n['co2e_kg'],
                location=n.get('location', ''),
                department=n.get('department', ''),
                cost_center=n.get('cost_center', ''),
                supplier=n.get('supplier', ''),
                description=n.get('description', ''),
                status=ActivityRecord.Status.PENDING,
            )
            AuditLog.objects.create(
                activity_record=activity,
                action=AuditLog.Action.CREATE,
                note=f"Imported via {ingestion_log.source} ingestion #{ingestion_log.id}",
            )
            success_count += 1
        except Exception as e:
            error_count += 1
            all_errors.append(str(e))

        if item.get('errors'):
            all_errors.extend(item['errors'])

    return success_count, error_count, all_errors


# ──────────────────────────────────────────────────────────
# Dashboard
# ──────────────────────────────────────────────────────────

class DashboardView(APIView):
    def get(self, request):
        from django.db.models.functions import TruncMonth
        from collections import defaultdict

        records = ActivityRecord.objects.all()

        def scope_co2(scope):
            return records.filter(scope=scope).aggregate(t=Sum('co2e_kg'))['t'] or 0.0

        scope1 = scope_co2(1)
        scope2 = scope_co2(2)
        scope3 = scope_co2(3)
        total = scope1 + scope2 + scope3

        status_counts = records.aggregate(
            pending=Count('id', filter=Q(status='PENDING')),
            flagged=Count('id', filter=Q(status='FLAGGED')),
            approved=Count('id', filter=Q(status='APPROVED')),
            locked=Count('id', filter=Q(status='LOCKED')),
        )

        ingestions = IngestionLog.objects.all()
        recent = ingestions[:5]

        scope_breakdown = [
            {'scope': 1, 'label': 'Scope 1', 'co2e_kg': round(scope1, 2), 'color': '#dc6803'},
            {'scope': 2, 'label': 'Scope 2', 'co2e_kg': round(scope2, 2), 'color': '#1d4ed8'},
            {'scope': 3, 'label': 'Scope 3', 'co2e_kg': round(scope3, 2), 'color': '#7c3aed'},
        ]

        source_breakdown = list(
            records.values('source_type')
            .annotate(co2e_kg=Sum('co2e_kg'), count=Count('id'))
            .order_by('-co2e_kg')
        )

        # ── Monthly trend (grouped by month + scope) ──────────────
        monthly_raw = (
            records.annotate(month=TruncMonth('activity_date'))
            .values('month', 'scope')
            .annotate(co2e=Sum('co2e_kg'))
            .order_by('month', 'scope')
        )

        monthly_map = defaultdict(lambda: {'scope1': 0.0, 'scope2': 0.0, 'scope3': 0.0})
        for row in monthly_raw:
            if row['month']:
                key = row['month'].strftime('%b %Y')
                monthly_map[key][f'scope{row["scope"]}'] = round(row['co2e'] or 0.0, 2)

        monthly_trend = [
            {'month': k, **v, 'total': round(v['scope1'] + v['scope2'] + v['scope3'], 2)}
            for k, v in sorted(monthly_map.items(), key=lambda x: x[0])
        ]

        # ── Department breakdown ───────────────────────────────────
        dept_breakdown = list(
            records.exclude(department='').values('department')
            .annotate(co2e_kg=Sum('co2e_kg'), count=Count('id'))
            .order_by('-co2e_kg')[:8]
        )

        data = {
            'total_co2e_kg': round(total, 2),
            'scope1_co2e_kg': round(scope1, 2),
            'scope2_co2e_kg': round(scope2, 2),
            'scope3_co2e_kg': round(scope3, 2),
            'total_records': records.count(),
            'pending_count': status_counts['pending'],
            'flagged_count': status_counts['flagged'],
            'approved_count': status_counts['approved'],
            'locked_count': status_counts['locked'],
            'total_ingestions': ingestions.count(),
            'failed_ingestions': ingestions.filter(status='FAILED').count(),
            'scope_breakdown': scope_breakdown,
            'source_breakdown': source_breakdown,
            'monthly_trend': monthly_trend,
            'dept_breakdown': dept_breakdown,
            'recent_ingestions': IngestionLogSerializer(recent, many=True).data,
        }
        return Response(data)



# ──────────────────────────────────────────────────────────
# Ingestion Endpoints
# ──────────────────────────────────────────────────────────

class IngestSAPView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded.'}, status=400)

        log = None
        try:
            org = _get_or_create_default_org()
            log = IngestionLog.objects.create(
                organization=org,
                source=IngestionLog.SourceType.SAP,
                status=IngestionLog.Status.PENDING,
                raw_file=file_obj,
            )

            file_obj.seek(0)
            parsed = parse_sap_csv(file_obj)
            success, errors, error_details = _persist_parsed_records(parsed, log, org)

            log.status = IngestionLog.Status.SUCCESS if errors == 0 else IngestionLog.Status.PARTIAL
            log.record_count = success
            log.error_count = errors
            log.error_details = error_details[:50]
            log.completed_at = timezone.now()
            log.save()

            return Response({
                'ingestion_id': log.id,
                'records_created': success,
                'errors': errors,
                'status': log.status,
            }, status=201)

        except Exception as e:
            if log:
                log.status = IngestionLog.Status.FAILED
                log.error_details = [str(e)]
                log.completed_at = timezone.now()
                log.save()
            return Response({'error': str(e)}, status=500)


class IngestUtilityView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded.'}, status=400)

        log = None
        try:
            org = _get_or_create_default_org()
            log = IngestionLog.objects.create(
                organization=org,
                source=IngestionLog.SourceType.UTILITY,
                scope=2,
                status=IngestionLog.Status.PENDING,
                raw_file=file_obj,
            )

            file_obj.seek(0)
            parsed = parse_utility_csv(file_obj)
            success, errors, error_details = _persist_parsed_records(parsed, log, org)

            log.status = IngestionLog.Status.SUCCESS if errors == 0 else IngestionLog.Status.PARTIAL
            log.record_count = success
            log.error_count = errors
            log.error_details = error_details[:50]
            log.completed_at = timezone.now()
            log.save()

            return Response({
                'ingestion_id': log.id,
                'records_created': success,
                'errors': errors,
                'status': log.status,
            }, status=201)

        except Exception as e:
            if log:
                log.status = IngestionLog.Status.FAILED
                log.error_details = [str(e)]
                log.completed_at = timezone.now()
                log.save()
            return Response({'error': str(e)}, status=500)


class IngestTravelView(APIView):
    def post(self, request):
        log = None
        try:
            org = _get_or_create_default_org()
            log = IngestionLog.objects.create(
                organization=org,
                source=IngestionLog.SourceType.TRAVEL,
                scope=3,
                status=IngestionLog.Status.PENDING,
            )

            parsed = parse_travel_json(MOCK_TRAVEL_DATA)
            success, errors, error_details = _persist_parsed_records(parsed, log, org)

            log.status = IngestionLog.Status.SUCCESS if errors == 0 else IngestionLog.Status.PARTIAL
            log.record_count = success
            log.error_count = errors
            log.error_details = error_details[:50]
            log.notes = 'Pulled from mock travel API (Concur/Navan simulation)'
            log.completed_at = timezone.now()
            log.save()

            return Response({
                'ingestion_id': log.id,
                'records_created': success,
                'errors': errors,
                'status': log.status,
            }, status=201)

        except Exception as e:
            if log:
                log.status = IngestionLog.Status.FAILED
                log.error_details = [str(e)]
                log.completed_at = timezone.now()
                log.save()
            return Response({'error': str(e)}, status=500)


# ──────────────────────────────────────────────────────────
# Records
# ──────────────────────────────────────────────────────────

class ActivityRecordListView(APIView):
    def get(self, request):
        qs = ActivityRecord.objects.select_related('raw_record').all()

        # Filters
        scope = request.query_params.get('scope')
        status_filter = request.query_params.get('status')
        source = request.query_params.get('source_type')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        search = request.query_params.get('search', '')

        if scope:
            qs = qs.filter(scope=scope)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if source:
            qs = qs.filter(source_type=source)
        if date_from:
            qs = qs.filter(activity_date__gte=date_from)
        if date_to:
            qs = qs.filter(activity_date__lte=date_to)
        if search:
            qs = qs.filter(
                Q(location__icontains=search) |
                Q(department__icontains=search) |
                Q(description__icontains=search)
            )

        # Ordering
        order_by = request.query_params.get('order_by', '-activity_date')
        qs = qs.order_by(order_by)

        serializer = ActivityRecordListSerializer(qs, many=True)
        return Response({'count': qs.count(), 'results': serializer.data})


class ActivityRecordDetailView(APIView):
    def get_object(self, pk):
        try:
            return ActivityRecord.objects.select_related('raw_record').prefetch_related('audit_logs').get(pk=pk)
        except ActivityRecord.DoesNotExist:
            return None

    def get(self, request, pk):
        obj = self.get_object(pk)
        if not obj:
            return Response({'error': 'Not found.'}, status=404)
        return Response(ActivityRecordDetailSerializer(obj).data)

    def patch(self, request, pk):
        obj = self.get_object(pk)
        if not obj:
            return Response({'error': 'Not found.'}, status=404)

        if obj.status in ('APPROVED', 'LOCKED'):
            return Response({'error': 'Record is locked or approved — cannot edit.'}, status=400)

        serializer = ActivityRecordEditSerializer(obj, data=request.data, partial=True)
        if serializer.is_valid():
            # Create audit log entries for each changed field
            for field, new_val in serializer.validated_data.items():
                old_val = getattr(obj, field)
                if str(old_val) != str(new_val):
                    AuditLog.objects.create(
                        activity_record=obj,
                        action=AuditLog.Action.EDIT,
                        field_name=field,
                        old_value=str(old_val),
                        new_value=str(new_val),
                        note=f"Edited via analyst review desk",
                    )
            serializer.save()
            return Response(ActivityRecordDetailSerializer(obj).data)
        return Response(serializer.errors, status=400)


class FlagRecordView(APIView):
    def post(self, request, pk):
        try:
            obj = ActivityRecord.objects.get(pk=pk)
        except ActivityRecord.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        if obj.status == 'LOCKED':
            return Response({'error': 'Record is locked.'}, status=400)

        serializer = FlagSerializer(data=request.data)
        if serializer.is_valid():
            old_status = obj.status
            obj.status = ActivityRecord.Status.FLAGGED
            obj.flag_reason = serializer.validated_data['reason']
            obj.save()

            AuditLog.objects.create(
                activity_record=obj,
                action=AuditLog.Action.FLAG,
                field_name='status',
                old_value=old_status,
                new_value='FLAGGED',
                note=serializer.validated_data['reason'],
            )
            return Response({'status': 'flagged', 'reason': obj.flag_reason})
        return Response(serializer.errors, status=400)


class ApproveRecordView(APIView):
    def post(self, request, pk):
        try:
            obj = ActivityRecord.objects.get(pk=pk)
        except ActivityRecord.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        if obj.status == 'LOCKED':
            return Response({'error': 'Already locked.'}, status=400)

        old_status = obj.status
        obj.status = ActivityRecord.Status.APPROVED
        obj.flag_reason = ''
        obj.save()

        AuditLog.objects.create(
            activity_record=obj,
            action=AuditLog.Action.APPROVE,
            field_name='status',
            old_value=old_status,
            new_value='APPROVED',
        )
        return Response({'status': 'approved'})


class AuditLogView(APIView):
    def get(self, request, pk):
        try:
            obj = ActivityRecord.objects.get(pk=pk)
        except ActivityRecord.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        logs = obj.audit_logs.all().order_by('-changed_at')
        return Response(AuditLogSerializer(logs, many=True).data)


# ──────────────────────────────────────────────────────────
# Ingestion Logs List
# ──────────────────────────────────────────────────────────

class IngestionLogListView(APIView):
    def get(self, request):
        logs = IngestionLog.objects.all()
        return Response(IngestionLogSerializer(logs, many=True).data)


# ──────────────────────────────────────────────────────────
# Mock Travel API
# ──────────────────────────────────────────────────────────

class MockTravelAPIView(APIView):
    def get(self, request):
        """Simulates a Concur/Navan webhook response"""
        return Response({
            'source': 'Concur Travel (Mock)',
            'pulled_at': timezone.now().isoformat(),
            'total_records': len(MOCK_TRAVEL_DATA),
            'data': MOCK_TRAVEL_DATA,
        })
