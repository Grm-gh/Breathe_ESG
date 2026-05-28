# Design Decisions & Assumptions — DECISIONS.md

## Emission Factors

All emission factors are sourced from the **UK Government GHG Conversion Factors for Company Reporting (DEFRA 2023)**. These are the industry standard for UK-headquartered companies and widely accepted internationally.

| Fuel/Activity | Factor | Unit | Source |
|---|---|---|---|
| Diesel | 2.6838 | kgCO₂e / L | DEFRA 2023 Table 1 |
| Petrol | 2.3105 | kgCO₂e / L | DEFRA 2023 Table 1 |
| Natural Gas | 2.0426 | kgCO₂e / m³ | DEFRA 2023 Table 1 |
| LPG | 1.5557 | kgCO₂e / L | DEFRA 2023 Table 1 |
| Electricity (UK grid) | 0.20493 | kgCO₂e / kWh | DEFRA 2023 Table 12 |
| Electricity (EU avg) | 0.27600 | kgCO₂e / kWh | EEA 2023 average |
| Electricity (US avg) | 0.38600 | kgCO₂e / kWh | EPA eGRID 2022 |
| Flight (economy) | 0.25500 | kgCO₂e / passenger-km | DEFRA 2023 Table 16 |
| Flight (business) | 0.51000 | kgCO₂e / passenger-km | DEFRA 2023 (2× economy) |
| Hotel (standard) | 15.0 | kgCO₂e / night | IHG 2023 average |
| Hotel (luxury) | 25.0 | kgCO₂e / night | IHG 2023 average |

---

## Unit Normalization Assumptions

1. **Fuel to Litres**: When SAP reports fuel in `KG`, density conversion is applied:
   - Diesel: `1 kg = 1.18 L` (density ≈ 848 g/L)
   - Petrol: `1 kg = 1.34 L` (density ≈ 745 g/L)
   - LPG: `1 kg = 1.85 L` (density ≈ 540 g/L)
   - If fuel type unknown: default density `0.85 kg/L` is used.

2. **Natural Gas in M3**: Stored and emission-factored as cubic metres (m³). No conversion to litre-equivalent needed.

3. **MWh to kWh**: Multiply by 1000. No information loss.

---

## Plant Code Lookup

SAP plant codes are resolved to human-readable locations using a static lookup table maintained in `normalization.py`. This simulates what would normally be maintained in an MDM (Master Data Management) system.

If a plant code is not in the lookup table, the location is set to `Unknown (XXXX)` and an error is logged against the ingestion run.

---

## Flight Distance Calculation

The **haversine formula** is used to calculate the great-circle distance between airport pairs. This is the standard approach for aviation emission calculations.

Airport coordinates are stored in a static lookup table (`AIRPORT_COORDS`) covering 20 major airports. If an airport code is not found, a fallback distance of **1,000 km** is used and the anomaly is logged.

The formula assumes a **sphere** of radius 6,371 km (mean Earth radius). This introduces a small error (<0.5%) compared to WGS-84 ellipsoid models, which is acceptable for CSR/ESG reporting purposes.

---

## Hotel Stays

- The check-in date is used as the `activity_date`.
- Number of nights is `(check_out − check_in).days`.
- Room categories `luxury`, `suite`, and `5-star` use the luxury factor; all others use standard.
- **Assumption**: 1 hotel night = 1 room for 1 guest. Multi-room bookings are not modelled.

---

## Billing Period Pro-Rating

When a utility billing period spans multiple calendar months, consumption is split proportionally by the number of days in each month's share of the period.

**Example**: Bill from Jan 15 to Feb 14 (31 days), 1,000 kWh:
- Jan share: 17 days → 17/31 × 1,000 = **548.4 kWh**
- Feb share: 14 days → 14/31 × 1,000 = **451.6 kWh**

The `activity_date` for each slice is set to the **last day of the slice** (consistent with financial period-end conventions).

---

## Scope Classification

| Source Type | Scope | Rationale |
|---|---|---|
| SAP Fuel (`DIESEL-001`, `PETROL-001`, `LPG-001`, `NATURAL-GAS`) | 1 | Direct combustion in company-owned assets |
| SAP Procurement (unknown materials) | 3 | Purchased goods/services — upstream |
| Utility Electricity | 2 | Indirect emissions from purchased energy |
| Corporate Flights | 3 | Business travel — downstream |
| Corporate Hotels | 3 | Business travel — downstream |

---

## Authentication

No authentication/authorization is implemented (deferred to TRADEOFFS.md). All API endpoints are open. In production, JWT authentication via `djangorestframework-simplejwt` would be added.

---

## Default Organization

A single `Organization` object (`slug=default`, `name=Breathe Energy Ltd`) is created automatically on first ingestion. This simplifies the demo without requiring explicit org setup.
