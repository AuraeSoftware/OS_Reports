# OS Reports

Insurance document upload → OCR extraction → template autofill, for OS2 Studio.

## How it works

1. Upload a `.docx` template. It's scanned for two placeholder styles, mixed freely:
   - Tag style: `{{ Policy Number }}`
   - Label style: `Policy Number:` (blank paragraph, underscores, or an empty table cell next to a label cell — common in insurance forms)
2. Create a report against that template, then upload any mix of documents — policy papers, medical bills, ID cards, claim forms.
3. Each document is sent to **Gemini 2.5 Flash** with the template's field list, so extraction is guided by meaning ("Sum Insured" → `sum_insured`) rather than raw character matching. Results from all documents are merged — first non-empty value per field wins, and the review screen shows which document each value came from.
4. You review/edit the merged fields, then generate — the original template is filled in place (placeholders removed, values inserted) and becomes downloadable.

## Stack

Matches the rest of the OS2 in-house apps:
- **Backend:** FastAPI + async SQLAlchemy + PostgreSQL, JWT auth, Railway deploy
- **OCR/extraction:** Gemini 2.5 Flash (`google-generativeai`) — same provider already used in RapidReportz
- **Template engine:** `python-docx`, custom placeholder detection/fill (see `backend/app/template_service.py`)
- **Frontend:** single-file responsive HTML/JS SPA (same pattern as the EMS app) — no build step, deploys as a static file

## Local setup

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows PowerShell: venv\Scripts\Activate.ps1
pip install -r requirements.txt --break-system-packages
copy .env.example .env       # then fill in DATABASE_URL, JWT_SECRET, GEMINI_API_KEY
uvicorn app.main:app --reload
```
Runs at `http://localhost:8000`. Docs at `/docs`.

### Frontend
Open `frontend/index.html` directly, or serve it with any static server. It talks to `http://localhost:8000/api` automatically when running on `localhost`.

## Deploying (Railway, same pattern as EMS/WashPro/PlotPro)

1. Push `backend/` to its own GitHub repo (or a subfolder Railway project).
2. New Railway service → attach a PostgreSQL plugin → Railway sets `DATABASE_URL` automatically.
3. Set env vars: `JWT_SECRET` (long random string), `GEMINI_API_KEY`, `GEMINI_MODEL` (defaults to `gemini-2.5-flash`).
4. `.python-version` pins 3.12 (avoids wheel build failures, same as PlotPro).
5. Deploy the frontend as a second Railway static service (or Netlify) — before deploying, edit the `API_BASE` constant near the top of `frontend/index.html`'s `<script>` to point at the backend's Railway URL.

## Extraction accuracy note

Gemini-based extraction typically lands in the 80-90% field-accuracy range on mixed, real-world scans (phone photos, faxes, photocopies) because it reasons about meaning rather than doing raw character recognition. Two things push accuracy up further if needed later:
- Tightening the prompt in `ocr_service.py` per document category once you see which fields are commonly missed.
- Falling back to Google Document AI for a specific document type if Gemini underperforms on it — the `extract_from_document()` function is isolated so swapping the provider for one category doesn't touch the rest of the pipeline.

## Roles & dashboards

Three roles: `admin`, `reviewer`, `user`. The **first person to register becomes admin automatically** (no manual DB edit needed to bootstrap). Admins can promote/demote anyone else from the Users page.

- **User** — sees only their own reports, uploads templates, runs the full new-report wizard.
- **Reviewer** — sees every report across the team ("Team Reports") and can do everything an owner can on any report — upload documents, trigger extraction, edit fields, generate, download, delete.
- **Admin** — everything a reviewer can do, plus an Overview page (org-wide stats: total reports, pending review, completed, team size, reports this month) and a Users page to change anyone's role.

Permission boundaries live in `backend/app/auth.py` (`require_roles(...)`) and `backend/app/routers/reports.py` (`_get_accessible_report` — owner, or admin/reviewer).

## Brand

Colors match OS2 Studio's own identity: amber `#FFB600` (primary actions, active states), charcoal `#231F20` (sidebar, ink), lime green `#B5DE00` (success/completed states, avatar accents). Type: Space Grotesk (display), Inter (body), IBM Plex Mono (data/reference labels) — same type role split as the rest of the OS2 in-house stack.

## What's not built yet

- Storage is local disk (`backend/storage/`) — fine for Railway's ephemeral filesystem short-term, but move to S3/GCS before real volume, same as RapidReportz's GCS setup.
- Extraction runs as a FastAPI `BackgroundTask` (in-process) — fine for current scale; move to a proper queue (Celery/RQ) if report volume grows.
- No password-reset flow yet (RapidReportz's Twilio OTP or WashPro's pattern could be reused here).
