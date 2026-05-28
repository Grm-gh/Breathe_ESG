"""
Utility Portal CSV Parser — Scope 2 (Electricity)

Expected format:
  BillingPeriodStart, BillingPeriodEnd, SiteID, SiteName, MeterID, Location, kWh_Used, Unit, Tariff

Pain point handled: billing periods crossing calendar month boundaries
→ Pro-rates consumption across months proportionally.
"""
import io
import pandas as pd
from datetime import date, timedelta
from calendar import monthrange
from esg.normalization import convert_energy_to_kwh, get_grid_factor


def _pro_rate_across_months(start: date, end: date, total_kwh: float, location: str) -> list[dict]:
    """
    Split a billing period across calendar months proportionally.

    e.g. Jan 15 – Feb 14 (31 days) with 1000 kWh becomes:
      - Jan: 17/31 × 1000 = 548.4 kWh
      - Feb: 14/31 × 1000 = 451.6 kWh
    """
    total_days = (end - start).days + 1
    results = []

    current = start
    while current <= end:
        # Find end of current month
        _, days_in_month = monthrange(current.year, current.month)
        month_end = date(current.year, current.month, days_in_month)
        period_end = min(month_end, end)

        days_in_period = (period_end - current).days + 1
        fraction = days_in_period / total_days
        kwh_slice = round(total_kwh * fraction, 4)

        # Use last day of the slice as the activity_date (calendar convention)
        factor_key, factor_value = get_grid_factor(location)

        results.append({
            'activity_date': str(period_end),
            'quantity': kwh_slice,
            'unit': 'kWh',
            'emission_factor': factor_value,
            'co2e_kg': round(kwh_slice * factor_value, 4),
            'factor_key': factor_key,
            'days_in_period': days_in_period,
            'total_days': total_days,
        })

        current = period_end + timedelta(days=1)

    return results


def parse_utility_csv(file_obj) -> list[dict]:
    """
    Parse utility portal CSV export.
    Returns list of normalized records (one per calendar month slice).
    """
    try:
        # Django InMemoryUploadedFile is a binary stream — wrap as text for pandas
        if hasattr(file_obj, 'read'):
            raw_bytes = file_obj.read()
            text = raw_bytes.decode('utf-8-sig', errors='replace')
            file_obj = io.StringIO(text)
        df = pd.read_csv(file_obj, sep=None, engine='python')
    except Exception as e:
        raise ValueError(f"Could not read CSV: {e}")

    # Normalize column names
    df.columns = [col.strip() for col in df.columns]

    results = []

    for idx, row in df.iterrows():
        raw_data = row.to_dict()
        errors = []

        # ── Parse dates ───────────────────────────────────────────
        try:
            start_date = pd.to_datetime(str(row.get('BillingPeriodStart', ''))).date()
            end_date = pd.to_datetime(str(row.get('BillingPeriodEnd', ''))).date()
        except Exception:
            errors.append(f"Row {idx}: Invalid billing period dates.")
            continue

        if end_date < start_date:
            errors.append(f"Row {idx}: End date before start date — skipped.")
            continue

        # ── Parse consumption ─────────────────────────────────────
        try:
            raw_qty = float(str(row.get('kWh_Used', row.get('Consumption', '0'))).replace(',', ''))
        except ValueError:
            raw_qty = 0.0
            errors.append(f"Row {idx}: Invalid consumption value.")

        raw_unit = str(row.get('Unit', 'kWh')).strip()
        total_kwh = convert_energy_to_kwh(raw_qty, raw_unit)

        location = str(row.get('Location', row.get('SiteName', 'Unknown'))).strip()
        site_id = str(row.get('SiteID', '')).strip()
        meter_id = str(row.get('MeterID', '')).strip()
        tariff = str(row.get('Tariff', 'Standard')).strip()

        # ── Pro-rate across months ────────────────────────────────
        month_slices = _pro_rate_across_months(start_date, end_date, total_kwh, location)

        for slice_data in month_slices:
            normalized = {
                'activity_date': slice_data['activity_date'],
                'location': location,
                'department': tariff,
                'cost_center': site_id,
                'quantity': slice_data['quantity'],
                'unit': 'kWh',
                'emission_factor': slice_data['emission_factor'],
                'co2e_kg': slice_data['co2e_kg'],
                'scope': 2,
                'source_type': 'UTILITY_ELEC',
                'description': f"Meter {meter_id} | {slice_data['days_in_period']}/{slice_data['total_days']} days of billing period",
                'supplier': str(row.get('Supplier', '')).strip(),
            }

            results.append({
                'raw_data': raw_data,
                'normalized': normalized,
                'errors': errors,
                'scope': 2,
                'source_type': 'UTILITY_ELEC',
            })

    return results
