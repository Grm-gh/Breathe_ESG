"""
SAP CSV Parser — Scope 1 (Fuel) and Scope 3 (Procurement)

Expected SAP export format (German headers):
  Buchungsdatum, Werk, Materialnummer, Materialbezeichnung, Menge, Einheit, Kostenstelle
"""
import io
import pandas as pd
from datetime import date
from esg.normalization import (
    PLANT_LOCATION_MAP, MATERIAL_FUEL_MAP,
    convert_fuel_to_litres, get_emission_factor, normalize_unit
)


# German → English column mapping
SAP_COLUMN_MAP = {
    'Buchungsdatum': 'posting_date',
    'Werk': 'plant_code',
    'Materialnummer': 'material_number',
    'Materialbezeichnung': 'material_description',
    'Menge': 'quantity',
    'Einheit': 'unit',
    'Kostenstelle': 'cost_center',
    'Belegdatum': 'document_date',
    'Buchungskreis': 'company_code',
}

FUEL_MATERIALS = set(MATERIAL_FUEL_MAP.keys())


def parse_sap_csv(file_obj) -> list[dict]:
    """
    Parse a SAP fuel export CSV.
    Returns list of dicts with normalized fields and metadata.
    Each dict has: raw_data, normalized, errors, source_type, scope.
    """
    try:
        # Django InMemoryUploadedFile is a binary stream — decode to text for pandas
        if hasattr(file_obj, 'read'):
            raw_bytes = file_obj.read()
            text = raw_bytes.decode('utf-8-sig', errors='replace')
            file_obj = io.StringIO(text)
        df = pd.read_csv(file_obj, sep=None, engine='python')
    except Exception as e:
        raise ValueError(f"Could not read CSV: {e}")

    # Normalize column names
    df.columns = [SAP_COLUMN_MAP.get(col.strip(), col.strip()) for col in df.columns]

    results = []

    for idx, row in df.iterrows():
        raw_data = row.to_dict()
        errors = []
        normalized = {}

        # ── Posting Date ──────────────────────────────────────────
        try:
            posting_date = pd.to_datetime(str(row.get('posting_date', '')), dayfirst=True).date()
        except Exception:
            posting_date = date.today()
            errors.append(f"Row {idx}: Could not parse 'Buchungsdatum', defaulted to today.")

        # ── Plant / Location ──────────────────────────────────────
        plant_code = str(row.get('plant_code', '')).strip()
        location = PLANT_LOCATION_MAP.get(plant_code, f'Unknown ({plant_code})')
        if 'Unknown' in location:
            errors.append(f"Row {idx}: Plant code '{plant_code}' not in lookup table.")

        # ── Material / Fuel Type ──────────────────────────────────
        material_number = str(row.get('material_number', '')).strip()
        fuel_type = MATERIAL_FUEL_MAP.get(material_number)
        is_fuel = fuel_type is not None

        # ── Quantity & Unit ───────────────────────────────────────
        try:
            raw_qty = float(str(row.get('quantity', '0')).replace(',', '.'))
        except ValueError:
            raw_qty = 0.0
            errors.append(f"Row {idx}: Invalid quantity '{row.get('quantity')}'.")

        raw_unit = str(row.get('unit', 'L')).strip()

        if is_fuel:
            quantity_litres = convert_fuel_to_litres(raw_qty, raw_unit, fuel_type)
            emission_factor = get_emission_factor(fuel_type)
            scope = 1
            source_type = 'SAP_FUEL'
            unit = 'L'
        else:
            # Non-fuel procurement — Scope 3, keep raw quantity, no EF
            quantity_litres = raw_qty
            emission_factor = 0.0
            scope = 3
            source_type = 'SAP_PROC'
            unit = normalize_unit(raw_unit)
            errors.append(f"Row {idx}: Material '{material_number}' has no emission factor — logged as Scope 3 procurement.")

        co2e_kg = round(quantity_litres * emission_factor, 4)

        normalized = {
            'activity_date': str(posting_date),
            'location': location,
            'department': str(row.get('cost_center', '')).strip(),
            'cost_center': str(row.get('cost_center', '')).strip(),
            'quantity': quantity_litres,
            'unit': unit,
            'emission_factor': emission_factor,
            'co2e_kg': co2e_kg,
            'scope': scope,
            'source_type': source_type,
            'description': str(row.get('material_description', material_number)).strip(),
            'supplier': '',
        }

        results.append({
            'raw_data': raw_data,
            'normalized': normalized,
            'errors': errors,
            'scope': scope,
            'source_type': source_type,
        })

    return results
