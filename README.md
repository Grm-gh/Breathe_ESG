# Breathe ESG Platform 🌍

Breathe ESG is an enterprise-grade carbon accounting and audit platform designed to ingest activity data, normalize units, apply DEFRA emission factors, and maintain a strict compliance audit trail.

---

## 🚀 Key Features

* **Multi-Tenant Architecture**: Built around an `Organization` model to isolate data safely.
* **Immutable Raw Storage**: Verbatim source records are stored as `RawRecord` JSON, providing an audit-ready ground truth.
* **Normalization Engine**: Standardizes incoming unit formats into metric conversions:
  * Fuel / Liquid volume → **Litres (L)**
  * Electricity → **Kilowatt-hours (kWh)**
  * Air Travel → **Passenger-kilometres (pass-km)**
  * Hotel lodging → **Nights**
* **Day-Based Pro-Rating**: Automatically splits utility billing periods crossing calendar months proportionally by day count.
* **Auditor Review Desk**: Allows analysts to flag, edit, or approve records. Includes an append-only `AuditLog` of every single modification.

---

## ⚙️ Tech Stack

* **Frontend**: React (v19) + Vite + TypeScript / JSX, styled with Vanilla CSS, using Recharts for data visualizations.
* **Backend**: Python (v3) + Django (v6) + Django REST Framework + WhiteNoise.
* **Database**: SQLite (for local development) / PostgreSQL (for production).

---

## 📂 Repository Structure

```
├── backend/                  # Django project root
│   ├── breathe/              # Django settings, WSGI, URLs
│   ├── esg/                  # Core app (models, views, parsers, serializers)
│   ├── manage.py             # CLI utility
│   └── requirements.txt      # Python dependencies
├── frontend/                 # Vite + React client root
│   ├── src/
│   │   ├── api/              # Axios client calls
│   │   ├── components/       # UI Views (Dashboard, Ingestion, ReviewDesk)
│   │   ├── App.jsx           # Routing & Layout wrapper
│   │   └── index.css         # Custom styling sheet
│   ├── package.json          # Node dependencies
│   └── vercel.json           # Single Page App routing config
├── docs/                     # Design decisions, trade-offs, and models
└── sample_data/              # Sample CSVs for ingestion testing
```

---

## 💻 Local Development Setup

### 1. Prerequisites
* Python 3.10+ installed
* Node.js 18+ installed

### 2. Backend Setup (Django)
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   # On Windows:
   .venv\Scripts\activate
   # On macOS/Linux:
   source .venv/bin/activate
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run migrations:
   ```bash
   python manage.py migrate
   ```
5. Start the development server:
   ```bash
   python manage.py runserver
   ```
   The backend will start at `http://127.0.0.1:8000/`.

---

### 3. Frontend Setup (React + Vite)
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install node dependencies:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend will start at `http://localhost:5173/`.

---

## 📊 Ingested Data Standards

The ingestion pipeline parses standard CSV files with the following expected formats:

### SAP ERP Ingestion (Scope 1 & 3)
Expected German-headored headers mapping:
* `Buchungsdatum` (Date, maps to `posting_date`)
* `Werk` (Plant code, maps to `plant_code`)
* `Materialnummer` (Material ID, maps to `material_number`)
* `Materialbezeichnung` (Description, maps to `material_description`)
* `Menge` (Quantity, maps to `quantity`)
* `Einheit` (Unit, e.g., `L`, `KG`, `M3`, maps to `unit`)
* `Kostenstelle` (Cost center, maps to `cost_center`)

### Utility Portal Ingestion (Scope 2)
Expected headers:
* `BillingPeriodStart` (Start date, e.g. `YYYY-MM-DD`)
* `BillingPeriodEnd` (End date, e.g. `YYYY-MM-DD`)
* `SiteID` (Identifier of site)
* `kWh_Used` or `Consumption` (Quantity value)
* `Unit` (e.g. `kWh`, `MWh`)
* `Location` (Location description)
* `Tariff` (Billing tariff tier)

---

## 🚀 Production Deployment

### Backend (Render)
* **Start Command**: `python -m gunicorn breathe.wsgi`
* **Build Command**: `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
* **Environment Variables**:
  * `DATABASE_URL`: Your production PostgreSQL connection string (Neon or Supabase).
  * `DJANGO_SECRET_KEY`: A secure random secret key.
  * `DJANGO_DEBUG`: `False`.
  * `ALLOWED_HOSTS`: `<your-render-domain>.onrender.com`.

### Frontend (Vercel)
* **Framework Preset**: `Vite`
* **Root Directory**: `frontend`
* **Build Command**: `npm run build`
* **Output Directory**: `dist`
* **Environment Variables**:
  * `VITE_API_URL`: `https://<your-render-domain>.onrender.com/api`
