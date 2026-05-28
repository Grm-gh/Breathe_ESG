"""
Normalization engine — unit conversion and DEFRA emission factors.
All assumptions documented in docs/DECISIONS.md
"""

# ─────────────────────────────────────────────────────────────
# DEFRA 2023 Emission Factors (kgCO2e per unit)
# Source: UK Government GHG Conversion Factors for Company Reporting
# ─────────────────────────────────────────────────────────────

EMISSION_FACTORS = {
    # Scope 1 — Fuel combustion (per litre)
    'diesel': 2.6838,        # kgCO2e/L
    'petrol': 2.3105,        # kgCO2e/L
    'natural_gas': 2.0426,   # kgCO2e/m3 (stored as m3, but we normalize to m3)
    'lpg': 1.5557,           # kgCO2e/L

    # Scope 2 — Electricity (per kWh, UK average grid)
    'electricity_uk': 0.20493,   # kgCO2e/kWh
    'electricity_eu': 0.27600,   # kgCO2e/kWh (EU average)
    'electricity_us': 0.38600,   # kgCO2e/kWh (US average)

    # Scope 3 — Travel
    'flight_economy': 0.255,      # kgCO2e/passenger-km (short-haul economy)
    'flight_business': 0.510,     # kgCO2e/passenger-km (long-haul business)
    'hotel_night': 15.0,          # kgCO2e/night (average hotel stay)
    'hotel_night_luxury': 25.0,   # kgCO2e/night (luxury/4-5 star)
}


# ─────────────────────────────────────────────────────────────
# SAP Plant Code → Location Lookup
# ─────────────────────────────────────────────────────────────

PLANT_LOCATION_MAP = {
    'DE01': 'Munich, Germany',
    'DE02': 'Berlin, Germany',
    'UK01': 'London, United Kingdom',
    'UK02': 'Manchester, United Kingdom',
    'US01': 'New York, USA',
    'US02': 'San Francisco, USA',
    'IN01': 'Mumbai, India',
    'SG01': 'Singapore',
}


# ─────────────────────────────────────────────────────────────
# SAP Material Code → Fuel Type Lookup
# ─────────────────────────────────────────────────────────────

MATERIAL_FUEL_MAP = {
    'DIESEL-001': 'diesel',
    'PETROL-001': 'petrol',
    'NATURAL-GAS': 'natural_gas',
    'LPG-001': 'lpg',
    'DIESEL-HVO': 'diesel',   # Hydrotreated Vegetable Oil — treated as diesel
}


# ─────────────────────────────────────────────────────────────
# Airport coordinates for distance calculation
# ─────────────────────────────────────────────────────────────

AIRPORT_COORDS = {
    'LHR': (51.4700, -0.4543),   # London Heathrow
    'LGW': (51.1537, -0.1821),   # London Gatwick
    'MAN': (53.3537, -2.2750),   # Manchester
    'CDG': (49.0097, 2.5479),    # Paris Charles de Gaulle
    'FRA': (50.0379, 8.5622),    # Frankfurt
    'MUC': (48.3538, 11.7861),   # Munich
    'AMS': (52.3086, 4.7639),    # Amsterdam
    'DXB': (25.2528, 55.3644),   # Dubai
    'SIN': (1.3644, 103.9915),   # Singapore
    'BOM': (19.0896, 72.8656),   # Mumbai
    'JFK': (40.6413, -73.7781),  # New York JFK
    'LAX': (33.9425, -118.4081), # Los Angeles
    'ORD': (41.9742, -87.9073),  # Chicago O'Hare
    'SFO': (37.6213, -122.3790), # San Francisco
    'NRT': (35.7647, 140.3864),  # Tokyo Narita
    'SYD': (-33.9461, 151.1772), # Sydney
    'HKG': (22.3080, 113.9185),  # Hong Kong
    'ICN': (37.4602, 126.4407),  # Seoul Incheon
    'DEL': (28.5665, 77.1031),   # Delhi
    'DEN': (39.8561, -104.6737), # Denver
}


# ─────────────────────────────────────────────────────────────
# Unit conversion helpers
# ─────────────────────────────────────────────────────────────

UNIT_ALIASES = {
    # Fuel volume
    'L': 'L', 'l': 'L', 'liter': 'L', 'litre': 'L', 'liters': 'L', 'litres': 'L',
    'KG': 'KG', 'kg': 'KG', 'kilogram': 'KG', 'kilograms': 'KG',
    'M3': 'M3', 'm3': 'M3', 'cbm': 'M3',
    # Energy
    'KWH': 'kWh', 'kwh': 'kWh', 'kWh': 'kWh', 'kilowatt-hour': 'kWh',
    'MWH': 'MWh', 'mwh': 'MWh', 'megawatt-hour': 'MWh',
}

# Density conversions (kg → litres for common fuels)
KG_TO_LITRE = {
    'diesel': 0.8473,    # 1 kg diesel ≈ 1.18 L (so 1 L = 0.848 kg → 1 kg = 1/0.848 L)
    'petrol': 0.7461,
    'lpg': 0.5405,
}


def normalize_unit(raw_unit: str) -> str:
    """Normalize various unit string representations to canonical form."""
    return UNIT_ALIASES.get(raw_unit.strip(), raw_unit.strip())


def convert_fuel_to_litres(quantity: float, unit: str, fuel_type: str) -> float:
    """
    Convert fuel quantity to litres (our standard unit for Scope 1).
    Supports L, KG, M3.
    """
    unit = normalize_unit(unit)
    if unit == 'L':
        return quantity
    elif unit == 'KG':
        density = KG_TO_LITRE.get(fuel_type, 0.85)  # default density
        return round(quantity * density, 4)
    elif unit == 'M3':
        # 1 m3 = 1000 L (for liquids) — natural gas handled separately
        return round(quantity * 1000, 4)
    return quantity


def convert_energy_to_kwh(quantity: float, unit: str) -> float:
    """Convert energy to kWh (our standard unit for Scope 2)."""
    unit = normalize_unit(unit)
    if unit == 'kWh':
        return quantity
    elif unit == 'MWh':
        return quantity * 1000
    return quantity


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two points in km."""
    import math
    R = 6371  # Earth's radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return round(2 * R * math.asin(math.sqrt(a)), 2)


def get_flight_distance_km(origin: str, destination: str) -> float:
    """
    Return one-way flight distance in km between two IATA airport codes.
    Falls back to 1000 km if either airport is unknown.
    """
    if origin in AIRPORT_COORDS and destination in AIRPORT_COORDS:
        lat1, lon1 = AIRPORT_COORDS[origin]
        lat2, lon2 = AIRPORT_COORDS[destination]
        return haversine_km(lat1, lon1, lat2, lon2)
    return 1000.0  # Safe fallback


def get_emission_factor(factor_key: str) -> float:
    """Look up emission factor. Returns 0 if not found."""
    return EMISSION_FACTORS.get(factor_key, 0.0)


def get_grid_factor(location: str) -> tuple[str, float]:
    """
    Return (factor_key, kgCO2e/kWh) based on location string.
    Defaults to UK grid if unrecognised.
    """
    loc = location.lower()
    if any(x in loc for x in ['germany', 'france', 'spain', 'italy', 'netherlands', 'eu']):
        return 'electricity_eu', EMISSION_FACTORS['electricity_eu']
    elif any(x in loc for x in ['usa', 'united states', 'us']):
        return 'electricity_us', EMISSION_FACTORS['electricity_us']
    else:
        return 'electricity_uk', EMISSION_FACTORS['electricity_uk']
