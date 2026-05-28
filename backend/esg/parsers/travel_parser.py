"""
Travel API Parser — Scope 3 (Flights & Hotels)

Consumes JSON from the mock travel API endpoint.
Handles:
  - Flights: IATA code → haversine distance → passenger-km → CO2e
  - Hotels: nights stayed × hotel category emission factor
"""
from esg.normalization import (
    get_flight_distance_km, get_emission_factor, EMISSION_FACTORS
)


def parse_travel_json(travel_data: list[dict]) -> list[dict]:
    """
    Parse travel API JSON response.
    Returns list of normalized records.

    Expected travel_data items:
    For flights:
      {
        "type": "flight",
        "trip_id": "T001",
        "traveler": "Alice Smith",
        "department": "Engineering",
        "date": "2024-03-15",
        "origin": "LHR",
        "destination": "JFK",
        "cabin_class": "economy",  # economy / business / first
        "passengers": 1,
        "return_trip": false
      }

    For hotels:
      {
        "type": "hotel",
        "trip_id": "T002",
        "traveler": "Bob Jones",
        "department": "Sales",
        "check_in": "2024-03-20",
        "check_out": "2024-03-23",
        "hotel_name": "Grand Hotel Berlin",
        "location": "Berlin, Germany",
        "room_category": "standard"  # standard / deluxe / luxury
      }
    """
    results = []

    for idx, item in enumerate(travel_data):
        item_type = item.get('type', '').lower()
        errors = []
        normalized = {}

        if item_type == 'flight':
            origin = str(item.get('origin', '')).upper().strip()
            destination = str(item.get('destination', '')).upper().strip()
            cabin = str(item.get('cabin_class', 'economy')).lower()
            passengers = int(item.get('passengers', 1))
            return_trip = bool(item.get('return_trip', False))

            distance_km = get_flight_distance_km(origin, destination)
            if origin not in ['LHR', 'LGW', 'MAN', 'CDG', 'FRA', 'MUC', 'AMS', 'DXB',
                               'SIN', 'BOM', 'JFK', 'LAX', 'ORD', 'SFO', 'NRT', 'SYD',
                               'HKG', 'ICN', 'DEL', 'DEN']:
                errors.append(f"Item {idx}: Unknown airport code '{origin}' — using estimated distance.")

            multiplier = 2 if return_trip else 1
            passenger_km = round(distance_km * passengers * multiplier, 2)

            if cabin in ('business', 'first'):
                ef_key = 'flight_business'
            else:
                ef_key = 'flight_economy'

            emission_factor = get_emission_factor(ef_key)
            co2e_kg = round(passenger_km * emission_factor, 4)

            activity_date = item.get('date', '')
            description = f"{origin} → {destination} ({cabin.title()}, {'Return' if return_trip else 'One-way'})"
            if passengers > 1:
                description += f", {passengers} passengers"

            normalized = {
                'activity_date': activity_date,
                'location': f"{origin} → {destination}",
                'department': str(item.get('department', '')).strip(),
                'cost_center': '',
                'quantity': passenger_km,
                'unit': 'pass-km',
                'emission_factor': emission_factor,
                'co2e_kg': co2e_kg,
                'scope': 3,
                'source_type': 'TRAVEL_FLIGHT',
                'description': description,
                'supplier': str(item.get('airline', '')).strip(),
            }

        elif item_type == 'hotel':
            import pandas as pd
            try:
                check_in = pd.to_datetime(item.get('check_in')).date()
                check_out = pd.to_datetime(item.get('check_out')).date()
                nights = (check_out - check_in).days
            except Exception:
                nights = 1
                errors.append(f"Item {idx}: Could not parse hotel dates — defaulting to 1 night.")

            room_category = str(item.get('room_category', 'standard')).lower()
            if room_category in ('luxury', 'suite', '5-star'):
                ef_key = 'hotel_night_luxury'
            else:
                ef_key = 'hotel_night'

            emission_factor = get_emission_factor(ef_key)
            co2e_kg = round(nights * emission_factor, 4)
            activity_date = str(item.get('check_in', ''))
            location = str(item.get('location', item.get('hotel_name', ''))).strip()

            normalized = {
                'activity_date': activity_date,
                'location': location,
                'department': str(item.get('department', '')).strip(),
                'cost_center': '',
                'quantity': float(nights),
                'unit': 'nights',
                'emission_factor': emission_factor,
                'co2e_kg': co2e_kg,
                'scope': 3,
                'source_type': 'TRAVEL_HOTEL',
                'description': f"{item.get('hotel_name', 'Hotel')} ({room_category.title()}, {nights} nights)",
                'supplier': str(item.get('hotel_name', '')).strip(),
            }

        else:
            errors.append(f"Item {idx}: Unknown travel type '{item_type}' — skipped.")
            continue

        results.append({
            'raw_data': item,
            'normalized': normalized,
            'errors': errors,
            'scope': 3,
            'source_type': normalized.get('source_type', 'TRAVEL_FLIGHT'),
        })

    return results
