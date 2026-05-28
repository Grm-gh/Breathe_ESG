# Data Source Research — SOURCES.md

## Source 1: SAP ERP (Scope 1 — Fuel, Scope 3 — Procurement)

### Format
SAP systems expose procurement and fuel data through several mechanisms:
- **ALV Grid exports**: The most common analyst-facing export — produces a CSV with German column headers (reflecting the SAP UI language setting).
- **ABAP List Viewer (ALV)**: Customizable column selection, supports CSV/Excel/text output.
- **RFC/BAPI calls**: Direct function module calls for programmatic extraction (e.g., `MM_GOODS_MOVEMENT_CREATE`).

### Simulated Format (This Implementation)
We simulate a German-header CSV as produced by an SAP MM (Materials Management) report:

| German Header | English Meaning | Notes |
|---|---|---|
| `Buchungsdatum` | Posting Date | Format: DD.MM.YYYY |
| `Werk` | Plant Code | Maps to physical site (e.g., DE01 = Munich) |
| `Materialnummer` | Material Number | Identifies fuel type |
| `Materialbezeichnung` | Material Description | Free text |
| `Menge` | Quantity | Uses European decimal (comma as separator) |
| `Einheit` | Unit | L, KG, M3 |
| `Kostenstelle` | Cost Centre | Organisational allocation |

### Key Pain Points Simulated
1. **German decimal notation**: `1.250,5` (thousands separator = `.`, decimal = `,`) — handled via `str.replace(',', '.')`.
2. **Plant code lookup**: Plant `DE01` must be resolved to a location (`Munich, Germany`) to select the correct regional emission factor.
3. **Material-to-fuel mapping**: SAP material numbers (e.g., `DIESEL-001`) must be mapped to emission factor keys.
4. **Mixed units**: Same fuel type reported in L, KG, or M3 across different plants — normalized to Litres.

---

## Source 2: Utility Portal (Scope 2 — Electricity)

### Format
UK and EU utility portals typically export billing data in CSV format via their customer web portals. Common providers include:
- **UK Power Networks**, **Electricity North West**, **SP Energy Networks**
- Export formats vary but generally include: billing period, consumption (kWh or MWh), meter ID, and site reference.

### Simulated Format
| Column | Notes |
|---|---|
| `BillingPeriodStart` | Billing cycle start (ISO 8601) |
| `BillingPeriodEnd` | Billing cycle end |
| `SiteID` | Internal site reference |
| `SiteName` | Human-readable site name |
| `MeterID` | Half-hourly or monthly meter reference |
| `Location` | Site location (used for grid factor selection) |
| `kWh_Used` | Electricity consumption |
| `Unit` | kWh or MWh |
| `Tariff` | Business Standard / High Voltage etc. |
| `Supplier` | Energy supplier name |

### Key Pain Points Simulated
1. **Cross-month billing cycles**: A bill from Jan 15 – Feb 14 crosses a calendar month boundary. Our pro-rating engine splits it proportionally by day count.
2. **Unit variety**: Some invoices use MWh — converted to kWh on ingestion.
3. **Regional grid factors**: Different emission factors applied based on location:
   - UK: `0.20493 kgCO₂e/kWh` (DEFRA 2023)
   - EU: `0.27600 kgCO₂e/kWh` (EU average)
   - US: `0.38600 kgCO₂e/kWh` (US average)

---

## Source 3: Corporate Travel API (Scope 3 — Flights & Hotels)

### Real-World Systems
Enterprise travel is managed by platforms like:
- **SAP Concur** — Largest enterprise T&E platform. Provides REST APIs via the Concur API (OAuth 2.0). Webhook-style event notifications for new expense reports.
- **Navan (formerly TripActions)** — Modern alternative with OpenAPI-documented REST endpoints.
- **Egencia (Amex GBT)** — Similar REST/SFTP-based extraction.

### Simulated Format (Mock API)
Our `GET /api/mock-travel/` endpoint returns a JSON array simulating a Concur report export:

**Flight record:**
```json
{
  "type": "flight",
  "trip_id": "T001",
  "traveler": "Alice Smith",
  "department": "Engineering",
  "date": "2024-01-15",
  "origin": "LHR",
  "destination": "JFK",
  "cabin_class": "economy",
  "passengers": 1,
  "return_trip": true,
  "airline": "British Airways"
}
```

**Hotel record:**
```json
{
  "type": "hotel",
  "trip_id": "T003",
  "traveler": "Alice Smith",
  "department": "Engineering",
  "check_in": "2024-01-15",
  "check_out": "2024-01-18",
  "hotel_name": "The Westin New York",
  "location": "New York, USA",
  "room_category": "deluxe"
}
```

### Key Pain Points Simulated
1. **Airport codes**: Routes are given as IATA codes (`LHR` → `JFK`), not distances. The haversine formula is used to calculate great-circle distance from a pre-populated coordinate lookup table (20 airports).
2. **Cabin class differentiation**: Economy vs. Business class have different emission factors (DEFRA 2023: `0.255` vs. `0.510 kgCO₂e/passenger-km`).
3. **Return trip multiplier**: Return flights double the distance.
4. **Hotel category**: Standard (`15 kgCO₂e/night`) vs. luxury (`25 kgCO₂e/night`).
