# OS Reports (v2 — independent rebuild)

Insurance document upload → OCR extraction → template autofill, for OS2 Studio.

This is a ground-up rebuild on a completely different stack from the original version — different language, database, AI provider, hosting platform, frontend architecture, and auth pattern. No code, dependencies, or structure is shared with any other OS2 project.

## Stack

| Layer | Choice |
|---|---|
| Backend | **Node.js + Express** |
| Database | **MongoDB** (Mongoose) — documents embedded (report → documents array), not joined tables |
| File storage | **MongoDB GridFS** — uploaded documents, templates, and generated outputs all live alongside the data, no external object storage |
| OCR / extraction | **GPT-4o-mini** via OpenAI's Responses API — accepts PDFs and images natively (no rasterization step needed) |
| Auth | **Passwordless magic-link email** — no passwords stored anywhere; session cookies (not JWT) via `express-session` + `connect-mongo` |
| Email delivery | **Resend** |
| Document generation | **docxtemplater** + a custom raw-XML pass for label-style placeholders |
| Frontend | **React + Vite**, component-based, client-side routed with `react-router-dom` |
| Hosting | **Render** (`render.yaml` included for both services) |

## How it works

1. Sign in with just your email — no password. First time, add your name; a one-time link is emailed to you (15 min expiry, single use). The **first person to ever sign in becomes admin automatically**.
2. Upload a `.docx` template. It's scanned for two placeholder styles, mixed freely:
   - Tag style: `{{ Policy Number }}`
   - Label style: `Policy Number:` (blank paragraph, underscores, or an empty table cell next to a label cell)
3. Create a report against that template, then upload any mix of documents — policy papers, medical bills, ID cards, claim forms.
4. Each document is sent to GPT-4o-mini with the template's field list, so extraction is guided by meaning ("Sum Insured" → `sum_insured`) rather than raw character matching. Results from all documents are merged — first non-empty value per field wins, and the review screen shows which document each value came from.
5. Review/edit the merged fields, then generate — the original template is filled in place and becomes downloadable.

## Roles

Three roles: `admin`, `reviewer`, `user`.
- **User** — own reports only, full upload → extract → review → generate flow.
- **Reviewer** — full parity with an owner on every report (upload, extract, edit, generate, download, delete), plus a team-wide "Team Reports" view.
- **Admin** — everything a reviewer can do, plus an Overview stats page and a Users page to change anyone's role.

## Local setup

### Backend
```bash
cd backend
npm install
copy .env.example .env      # fill in MONGODB_URI, OPENAI_API_KEY, RESEND_API_KEY, etc.
npm run dev
```
Runs at `http://localhost:4000`.

You'll need a MongoDB instance — either local (`mongodb://localhost:27017/osreports`) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster for the connection string.

Without `RESEND_API_KEY` set, magic links are printed to the console instead of emailed — handy for local testing.

### Frontend
```bash
cd frontend
npm install
copy .env.example .env      # set VITE_API_BASE to http://localhost:4000/api
npm run dev
```
Runs at `http://localhost:5173`.

## Deploying (Render)

Both `backend/render.yaml` and `frontend/render.yaml` are ready to use with Render's "New from render.yaml" flow, or set up manually:

**Backend (Web Service):**
1. New Web Service → connect the repo, root directory `backend/`
2. Build command: `npm install` · Start command: `node server.js`
3. Set env vars: `MONGODB_URI` (Atlas connection string), `SESSION_SECRET` (long random string — Render can auto-generate), `OPENAI_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL`, `BACKEND_URL`, `NODE_ENV=production`

**Frontend (Static Site):**
1. New Static Site → connect the repo, root directory `frontend/`
2. Build command: `npm install && npm run build` · Publish directory: `dist`
3. Set `VITE_API_BASE` to your backend's Render URL **before the build runs** — Vite bakes env vars into the build output, so this can't be changed afterward without rebuilding
4. Add a rewrite rule `/* → /index.html` so client-side routing works on page refresh (already in `render.yaml`)

**Important cross-origin cookie note:** since frontend and backend are on different Render domains, the session cookie is set with `sameSite: "none"; secure: true` in production (see `server.js`). This requires both services to be served over HTTPS, which Render provides by default — no extra config needed.

## What's not built yet

- Storage is GridFS (fine for MongoDB Atlas free tier at this scale) — move to a dedicated object store if document volume grows large enough that GridFS read/write starts competing with the DB's working set.
- Extraction runs as an in-process async function (fire-and-forget after the `/extract` call returns) — fine for current scale; move to a proper job queue (BullMQ + Redis) if report volume grows.
- No rate limiting on `/auth/request-link` yet — worth adding before this is publicly reachable, so someone can't spam magic-link emails to an address they don't own.
