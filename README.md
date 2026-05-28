# Breathe ESG Platform

Breathe ESG is a full-stack web application for ingesting and processing ESG activity data from different enterprise sources like SAP exports and utility billing systems.

The project focuses on handling raw records safely, normalizing inconsistent units, and maintaining a review/audit workflow for sustainability reporting.

---

## Features

* Upload and process CSV files from SAP ERP systems
* Utility bill ingestion with monthly prorating support
* Unit normalization for fuel, electricity, travel, and lodging data
* Immutable raw record storage for audit tracking
* Reviewer workflow for approving or editing records
* Multi-organization data separation
* REST API built using Django REST Framework
* Interactive frontend dashboard using React and Recharts

---

## Tech Stack

### Frontend

* React + Vite
* JavaScript / JSX
* Vanilla CSS
* Recharts

### Backend

* Django
* Django REST Framework
* Gunicorn
* WhiteNoise

### Database

* SQLite (local)
* PostgreSQL (production)

### Deployment

* Vercel (frontend)
* Render (backend)

---

## Project Structure

```bash
backend/
├── breathe/
├── esg/
├── manage.py
└── requirements.txt

frontend/
├── src/
├── package.json
└── vercel.json
```

---

## Running Locally

### Backend Setup

```bash
cd backend

python -m venv .venv
```

Activate virtual environment:

Windows:

```bash
.venv\Scripts\activate
```

Linux/macOS:

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run migrations:

```bash
python manage.py migrate
```

Start backend server:

```bash
python manage.py runserver
```

Backend runs on:

```bash
http://127.0.0.1:8000
```

---

### Frontend Setup

Open another terminal:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Run frontend:

```bash
npm run dev
```

Frontend runs on:

```bash
http://localhost:5173
```

---

## Sample Data Formats

### SAP ERP CSV

Expected columns:

* Buchungsdatum
* Werk
* Materialnummer
* Materialbezeichnung
* Menge
* Einheit
* Kostenstelle

---

### Utility Billing CSV

Expected columns:

* BillingPeriodStart
* BillingPeriodEnd
* SiteID
* kWh_Used / Consumption
* Unit
* Location
* Tariff

---

## API Base URL

Production backend:

```bash
https://<your-render-domain>.onrender.com/api
```

---

## Environment Variables

### Backend

```env
DATABASE_URL=
DJANGO_SECRET_KEY=
DJANGO_DEBUG=False
ALLOWED_HOSTS=
```

### Frontend

```env
VITE_API_URL=
```

---

## Deployment

### Backend (Render)

Build command:

```bash
pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
```

Start command:

```bash
python -m gunicorn breathe.wsgi
```

### Frontend (Vercel)

Framework preset:

```bash
Vite
```

Build command:

```bash
npm run build
```

Output directory:

```bash
dist
```

---

## Future Improvements

* Authentication and role-based access
* Async/background ingestion jobs
* Docker support
* Automated tests
* API documentation
* Export reports and analytics

---

## Author

Gyanu Rajmaniar
