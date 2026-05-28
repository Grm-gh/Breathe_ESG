# Trade-offs & Deliberate Omissions — TRADEOFFS.md

This document records features and capabilities that were **deliberately not implemented** due to time constraints. Each omission is justified and a production implementation path is described.

---

## 1. No Real SAP RFC/BAPI Connection

**What was omitted**: A live connection to an SAP system via RFC (Remote Function Call) using Python's `pyrfc` library.

**Why**: Setting up a live SAP system requires SAP NetWeaver, NW RFC SDK libraries, and VPN-accessible credentials — not feasible in an intern assignment context.

**What was done instead**: A realistic CSV export is simulated with German headers, European decimal notation, and plant/material lookup challenges identical to what a real SAP ALV export would produce.

**Production path**: Use `pyrfc` with function modules like `RFC_READ_TABLE` or custom ABAP reports exposed as RFC. Alternatively, use SAP Integration Suite (Cloud Integration) to schedule delta extractions via REST webhooks.

---

## 2. No PDF / Invoice Scraping

**What was omitted**: Automatic parsing of PDF utility bills (e.g., British Gas, EON invoices as PDF files).

**Why**: PDF invoice parsing requires OCR or layout-aware ML models (e.g., `pdfplumber`, `camelot`, or AWS Textract). Invoices vary wildly in structure across suppliers. Building a robust parser is a multi-week project.

**What was done instead**: A structured CSV export (as provided by utility portal self-service dashboards) is used, which is the realistic format for an automated data pipeline.

**Production path**: Use AWS Textract with custom extraction queries, or a pre-trained invoice parsing model (e.g., LayoutLM fine-tuned on utility bills). Apply confidence scoring and flag low-confidence extractions for human review.

---

## 3. No Role-Based Access Control (RBAC)

**What was omitted**: Separate user roles (e.g., Data Ingestion Operator, ESG Analyst, ESG Manager, Auditor/Read-Only).

**Why**: Implementing RBAC requires authentication (JWT/OAuth), permission decorators on every view, and a user management UI — significant scope for an intern assignment.

**What was done instead**: All API endpoints are open. The audit trail captures `changed_by` as a nullable FK, defaulting to `null`/`system` in the demo.

**Production path**: Use `djangorestframework-simplejwt` for JWT authentication. Define custom Permission classes. Create a `UserProfile` model extending Django's `auth.User` with a `role` field. Apply role checks on Approve/Lock actions (e.g., only `ESG_MANAGER` can lock records).

---

## 4. No Automated Anomaly Detection / AI Flagging

**What was omitted**: Automatic statistical flagging of records that are outliers (e.g., consumption 3× the historical site average).

**Why**: Requires historical baseline data and a statistical model — not available in a greenfield demo.

**What was done instead**: Analysts manually flag records via the Review Desk with a free-text reason. The system logs all flags with timestamps.

**Production path**: After 3+ months of data, train a simple Z-score or IQR model per site/meter. Auto-flag records where `|z| > 3`. Surface these in a dedicated "Alerts" tab. Could also use LLM-powered anomaly description (e.g., "This site's Jan 2024 consumption is 340% above its 6-month average").

---

## 5. No Multi-Currency Support

**What was omitted**: Cost tracking alongside emissions (some ESG frameworks require spend-based Scope 3 calculations).

**Why**: Requires FX rate lookups and a cost normalization layer. Out of scope for an emissions-focused MVP.

**Production path**: Add a `cost_original_currency`, `cost_currency`, and `cost_gbp` field to `ActivityRecord`. Integrate with Open Exchange Rates API for FX conversion at the ingestion date.

---

## 6. No Production Deployment Configuration

**What was omitted**: Docker, Gunicorn, Nginx, HTTPS, production `settings.py`, environment variables.

**Why**: Out of scope for a local demo. The project is intentionally runnable with `python manage.py runserver` and `npm run dev`.

**Production path**: Dockerize with a `docker-compose.yml` (Django + Postgres + Nginx), use `python-decouple` for environment variables, and deploy to GCP Cloud Run or AWS ECS.
