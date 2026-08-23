# SevaSetu — AI Application Readiness Platform

> Helping citizens submit complete, consistent government applications before they reach an officer.

## Overview

Most repeat trips to a government office don't happen because a document is illegible — they happen because a citizen's name is spelled differently on their Aadhaar than on their ration card, or the address on one paper doesn't match another. Today, nobody catches this until an officer manually cross-reads several documents, often after days of processing delay.

SevaSetu is a pipeline that checks a citizen's own documents **against each other** before an officer ever opens the file. A citizen uploads the document bundle for one government service; the system extracts the text (OCR), normalizes the fields, cross-checks them for consistency, checks the bundle against a required-document checklist, screens for duplicate submissions, and returns a single readiness score with a plain-language explanation of anything that needs fixing. Officers see a queue sorted by readiness instead of a first-come pile, with the exact conflict already highlighted.

## Problem It Solves

- Citizens don't discover document inconsistencies until an officer flags them, which can take days and require a return trip.
- Officers spend a large share of processing time manually cross-reading documents rather than making decisions.
- Duplicate submissions of the same request go unnoticed until late in the process, wasting officer time.
- Citizens often don't know what documents a service requires until they've already made a trip without the right ones.

## Target Users

**Meena — first-time applicant.** Applying for an income certificate for a college scholarship. Has an Aadhaar, a ration card, and an electricity bill, but her address is spelled slightly differently across two of them. She doesn't know this is a problem until SevaSetu tells her.

**Suresh — front-desk officer.** Processes 30–40 applications a day at a taluk office. Currently reads every document by hand to catch mismatches. Wants a queue that tells him which applications are clean and which need a closer look, with the specific conflict already called out.

**Priya — administrator.** Doesn't process individual applications — manages the rules those applications get checked against. When a scheme's document requirements change, she updates the checklist once, and every application submitted after that reflects it, instead of someone editing code.

**Anita — returning applicant.** Had an application rejected for a document mismatch she didn't understand. On her second attempt, she wants a clear, specific explanation of exactly what to fix — not just a rejection notice.

## Vision Statement

A future where no citizen is turned away at a government office because of a mismatch on a form they didn't know was wrong.

## Key Features / Goals

- OCR-based extraction of key fields (name, date of birth, address) from uploaded documents
- Cross-document consistency engine that fuzzy-matches those fields across a citizen's own document bundle
- Missing-document checklist, specific to the service being applied for
- Duplicate-application detection against a citizen's past submissions
- A single, unified readiness score combining all of the above
- Plain-language explanation of any flagged issue, with an option to localize it
- Officer queue sorted by readiness/risk, with an estimated processing delay per flagged application
- Regulation Q&A assistant — retrieval-based by default; an optional local model (Ollama) can generate a natural-language answer grounded in the retrieved passage, shown alongside the passage itself rather than instead of it
- Citizen feedback with automatic sentiment analysis
- Officer productivity dashboard — resolutions per officer, applications by service type, feedback sentiment trends
- Citizens can look up a submitted application's status later using its ID
- Administrators can edit the required-documents checklist per service without touching code
- Readiness score comes with an itemized reasoning breakdown (not just the number)
- OCR confidence is measured and surfaced, not assumed
- Full audit trail per application — every pipeline stage logged, not just the final status
- Downloadable PDF verification report per application
- Individual staff accounts with hashed passwords and login rate limiting — not one shared password per role anymore
- Optional PostgreSQL support, verified against a real Postgres instance
- Structured JSON logging for operational visibility, separate from the citizen-facing audit trail

## Success Metrics

- Detects at least 90% of injected field mismatches across a test set of synthetic document bundles
- Readiness score returned in under 5 seconds per application
- An officer can view a flagged application's full mismatch breakdown in 2 clicks or fewer from the queue
- `docker compose up` produces a working app on `localhost:8000` on a clean machine with no manual configuration steps beyond what's in Quick Start

## Assumptions & Constraints

- **Synthetic data only.** The MVP uses self-generated, Aadhaar-style / ration-card-style / income-proof-style documents with deliberately injected mismatches. No real citizen documents or PII are used, given India's DPDP Act and the general sensitivity of ID documents.
- **Single service type for the demo.** The missing-document checklist and demo flow are scoped to one representative service (income certificate) to keep the MVP focused; the checklist mechanism generalizes to other services later.
- **OCR default is Tesseract** — offline, free, no account required. Google Cloud Vision is an optional swap for higher accuracy on messier scans; it requires linking a billing account under GCP's free tier (1,000 units/month, no charge under that limit), which is a setup step, not a real cost.
- **Bhashini (free, government-run) powers the plain-language / multilingual explanation layer.** This is the one component that calls an external API at runtime; the core OCR → consistency → readiness pipeline runs fully offline.
- **Out of scope for this MVP** (documented here, not built): feedback sentiment analysis, an officer productivity/analytics dashboard, and learned/ML-based multilingual name matching. These are real ideas for a Phase 2, not abandoned — they're deliberately excluded so the MVP can be executed well rather than partially.
- **Frontend is React only now.** All 7 pages ported and tested (21 component tests total — form validation, real multipart submission, role-gated access checked both directions, the resolve/checklist-edit flows). The original Streamlit app still exists in `frontend/` as reference — it's not deleted — but `docker compose up` no longer runs it; `frontend-react/` is what's actually deployed.

## Architecture

```
upload documents                    citizen question           citizen feedback
      │                                    │                          │
      ▼                                    ▼                          ▼
OCR extraction                    TF-IDF + ChromaDB              VADER sentiment
      │                              retrieval                    analysis
      ▼                                    │                          │
field normalization                        ▼                          ▼
      │                          regulation passage              stored + tagged
      ▼                             (retrieval only,
consistency engine                   no LLM call)
      │
      ▼
readiness score  (+ missing-document checklist, + duplicate-application check)
      │
      ▼
officer queue + productivity dashboard
      (sorted by readiness, plain-language explanation attached,
       resolutions and feedback sentiment tracked per officer)
```

The three flows share the same backend, database, and officer-facing surface, but the regulation Q&A and feedback paths are deliberately independent of the readiness pipeline — a citizen can ask a question or leave feedback without ever uploading a document.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | FastAPI (Python) | Async-friendly, auto-generated OpenAPI docs at `/docs` |
| Frontend | React + Vite | Matches the architecture diagram's stated choice; Vite over Next.js since this is a client-side SPA with no need for server rendering. (Streamlit remains in `frontend/` as the original reference build, not part of the deployed stack.) |
| Database | SQLite via SQLAlchemy | Zero external dependency for the MVP; swappable for Postgres later |
| OCR | Tesseract (default) / Google Cloud Vision (optional) | Free and offline by default |
| Consistency matching | `rapidfuzz` | Same library reused for both the consistency engine and duplicate-application detection |
| Regulation retrieval | Hybrid: BM25 + TF-IDF (`scikit-learn`) via ChromaDB, fused with Reciprocal Rank Fusion | No downloaded model, no API call, no rate limit — see note below on what "hybrid" does and doesn't mean here |
| Answer generation (optional) | Ollama, local model (`llama3.2:1b` default) | Generates a natural-language answer on top of the retrieved passage. Free, no key, no signup — the tradeoff for that is real local compute, not a hosted API's SLA |
| Feedback sentiment | VADER (`vaderSentiment`) | Rule-based, local, zero API — built for exactly this kind of short informal text |
| Verification reports | ReportLab (PDF) | Generated on request, not stored — cheap enough to regenerate, so it's never stale |
| Testing | pytest (backend, 20 tests) + Vitest (frontend, 21 tests) | Real, repeatable regression suites, not just ad-hoc manual verification |
| CI | GitHub Actions | Backend tests, frontend tests + build, and both Docker images, on every push |
| Explanation layer | Bhashini API | Free, government-run, supports Indian languages |
| Containerization | Docker + Docker Compose | One command to build and run locally |
| Staff authentication | PyJWT + bcrypt, individual hashed-password accounts | Real backend-issued, expiring, verified tokens; role comes from the account record, not a client-selected dropdown — see security note below |
| Database (optional) | PostgreSQL, verified against a real local instance | SQLite stays the default (zero extra service for the demo); Postgres is a docker-compose override, not a rewrite |
| Logging | Structured JSON (Python `logging`) | Operational visibility — separate concern from the AuditEvent table, which is a citizen-facing business record, not an ops log |

**On the free-tier constraint:** ChromaDB's default embedding function downloads an ~80MB model from the internet the first time it runs — that surfaced as a real failure in a network-restricted sandbox while building this, not a hypothetical concern. Supplying TF-IDF vectors directly instead avoids that download entirely, alongside avoiding any per-query API cost.

**On staff authentication specifically:** the earlier version had a real gap, not just a missing nice-to-have — login took a name, a client-selected role (Officer or Administrator, picked from a dropdown), and one password shared by both roles. Nothing actually bound an identity to a role beyond that shared secret, so anyone who knew the one password could log in as *either* role. It's now two individual accounts with their own bcrypt-hashed passwords (`officer1` / `admin1`, passwords set via `OFFICER_DEMO_PASSWORD` / `ADMIN_DEMO_PASSWORD`), and role comes from the account record the username resolves to — the client never gets to assert it. Login also rate-limits after 5 failed attempts (60-second lockout). Worth knowing this rate limit is in-memory and single-process — real multi-instance production auth would need a shared store (Redis) for it, not pretended away here.

**On "hybrid retrieval" specifically:** BM25 and TF-IDF are both lexical (keyword-overlap) methods — this is not a lexical+semantic hybrid, whatever the term "hybrid" might suggest elsewhere. A true semantic layer would need embeddings from a downloaded transformer model, which runs into the same network restriction described above. Fusing BM25 with TF-IDF via Reciprocal Rank Fusion is still a real, worthwhile improvement — BM25 generally outperforms raw TF-IDF, and RRF is the actual standard fusion technique — it just isn't the "lexical + semantic" story that phrase sometimes implies. Building this surfaced a genuine RRF edge case worth knowing about: when two rankers disagree by an exact swap (one ranks document A first and B second, the other ranks B first and A second), their fused scores come out identical, and the tie gets broken by whichever ranker's results were passed first — not by which ranker is more trustworthy, unless you deliberately order the fusion input to reflect that.

**On the Ollama generation layer specifically:** this is the one piece of this codebase that wasn't run end-to-end before being committed — Ollama needs to download a model from the internet, which was blocked in the sandbox this was built in. It's written against Ollama's stable, documented REST API and designed to fail silently (falls back to showing the retrieved passage) if it's not reachable, but "verify this yourself first" applies here in a way it doesn't for the rest of this project.

---

## Branching Strategy — GitHub Flow

This repo follows **GitHub Flow**:

1. `main` is always deployable. Nobody commits to it directly.
2. New work happens on a feature branch, named `feature/<short-description>` (e.g. `feature/consistency-engine`, `feature/readiness-endpoint`).
3. Commit early and often on the feature branch, with clear messages.
4. Open a pull request into `main` as soon as the branch is ready for feedback — even a draft PR.
5. After review (or self-review for a solo project), merge into `main` and delete the feature branch.

Example of creating and pushing a feature branch:

```bash
git checkout -b feature/consistency-engine
# ... make changes ...
git add .
git commit -m "Add fuzzy field matching to consistency engine"
git push -u origin feature/consistency-engine
# open a pull request into main from here
```

## Quick Start — Local Development

Requirements: [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

```bash
# clone the repo
git clone <your-repo-url>
cd sevasetu-starter

# build and start both services
docker compose up --build
```

Once it's running:

- **Citizen app + staff area (React):** [http://localhost:3000](http://localhost:3000) — all 7 pages: apply, check status, ask a question, feedback, officer queue, officer dashboard, admin settings. Staff login uses the same demo password (`seva123`) and role selector (Officer / Administrator) as before, now issuing a real JWT instead of a client-side flag.
- **API landing page:** [http://localhost:8000](http://localhost:8000)
- **Health check:** [http://localhost:8000/api/health](http://localhost:8000/api/health)
- **Interactive API docs (Swagger UI):** [http://localhost:8000/docs](http://localhost:8000/docs)

To stop the app: `Ctrl+C`, then `docker compose down`.

### Enabling generated answers (optional)

The regulation assistant works without this — it'll show the matched passage directly. To get a generated natural-language answer on top of it, pull a model into the Ollama container once, after `docker compose up` is running:

```bash
docker compose exec ollama ollama pull llama3.2:1b
```

This downloads about 1.3GB the first time. After it finishes, questions asked through "Ask a Question" will show a generated answer above the retrieved passage. If this step is skipped, or the pull fails, the app keeps working exactly as before — nothing else depends on this.

### Try it with sample documents

Don't have real documents to test with? Generate a synthetic bundle (Aadhaar, ration card, electricity bill) with one deliberately injected address mismatch:

```bash
cd backend
python -m app.generate_test_documents
```

This writes three PNGs to `backend/app/test_documents/` — upload them in the citizen app to see the consistency engine catch the mismatch for real.

### Running without Docker (for quick local iteration)

```bash
# backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# frontend, in a second terminal
cd frontend-react
npm install
npm run dev
```

The old Streamlit app still runs too, if you want it: `cd frontend && pip install -r requirements.txt && streamlit run app.py`. It's not part of the Docker stack anymore, but the code hasn't been deleted.

## Deployment

`render.yaml` at the repo root is a real Render blueprint — backend, frontend, and a managed Postgres database, wired together. What it can't do: get you an actual live URL. That needs your own Render account, which I have no access to.

Steps, once you're ready:
1. Push this repo to GitHub (already covered earlier).
2. On Render: **New → Blueprint**, connect the repo. It reads `render.yaml` and proposes all 3 resources (2 services + 1 database).
3. Render generates a real `JWT_SECRET_KEY` for you (`generateValue: true`) — you won't need to set that yourself.
4. You will need to set `OFFICER_DEMO_PASSWORD` and `ADMIN_DEMO_PASSWORD` yourself in the Render dashboard (`sync: false` means Render won't auto-generate or commit these — real passwords shouldn't live in a YAML file in your repo).
5. After the backend service deploys, copy its real `.onrender.com` URL and update `VITE_API_BASE_URL` in `render.yaml`'s frontend block — the placeholder in the file can't know this URL in advance, since it doesn't exist until the backend is already created. Commit that change, redeploy the frontend.
6. Free tier note: Render's free web services spin down after inactivity and take ~30-60s to wake on the next request — expected, not a bug, if your first load after a while feels slow.

## Running Tests

```bash
# backend — 32 tests, exercises full pipeline including PDF, multi-page, RBAC, RAG & limits
cd backend
pip install -r requirements.txt
python -m app.generate_test_documents
pytest tests/ -v

# frontend — 24 tests across 5 test files
cd frontend-react
npm install
npx vitest run
```

Both suites also run automatically on every push via GitHub Actions (`.github/workflows/ci.yml`), along with a build of both Docker images.

## Local Development Tools

| Tool | Purpose |
|---|---|
| Docker Desktop | Builds and runs the containerized backend and frontend |
| Python 3.11 | Backend language runtime |
| `uvicorn` | ASGI server running the FastAPI app |
| `pypdfium2` | High-fidelity PDF page rendering (~144 DPI) for multi-page document ingestion |
| `pytesseract` + system `tesseract-ocr` | OCR extraction from uploaded document images and PDF pages |
| `rapidfuzz` | Fuzzy string matching for the consistency engine and duplicate check |
| SQLite | Local, file-based database with automatic schema column upgrades |
| Node.js 20 + npm | Builds and runs the React frontend |
| Streamlit *(legacy, optional)* | Original reference frontend — not part of the Docker stack, kept for comparison |
| GitHub CLI (`gh`) *(optional)* | Used by `scripts/create_github_issues.sh` to bulk-create the user stories as GitHub Issues |

## Repository Structure

```
sevasetu-final/
├── README.md
├── docker-compose.yml
├── docker-compose.postgres.yml     # Optional Postgres override — verified against a real instance
├── render.yaml                     # Render deployment blueprint
├── .gitignore
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py                     # FastAPI app: applications, ask, feedback, staff, officer-stats endpoints
│       ├── database.py                 # SQLAlchemy session setup with auto-upgrade SQLite migrations
│       ├── models.py                   # Application, DocumentRecord, FieldMismatch, AuditEvent, StaffUser, Feedback
│       ├── generate_test_documents.py  # Creates synthetic demo PNG and multi-page PDF documents
│       ├── regulation_corpus.py        # Illustrative regulation text the RAG assistant retrieves from
│       ├── pipeline/
│       │   ├── ocr.py            # Tesseract + pypdfium2 multi-page PDF ingestion with configurable limits
│       │   ├── fields.py         # Raw OCR text -> structured fields (Name, DOB, Address)
│       │   ├── consistency.py    # Cross-document fuzzy matching (the core differentiator)
│       │   ├── checklist.py      # Required-documents lookup per service type
│       │   ├── duplicates.py     # Fuzzy-matches against past applications
│       │   ├── scoring.py        # Aggregates everything into one readiness score
│       │   ├── rag.py            # Hybrid BM25 + TF-IDF retrieval, fused via RRF (offline fallback)
│       │   ├── generation.py     # Optional Ollama generation layer on top of retrieval
│       │   ├── sentiment.py      # VADER sentiment analysis, fully local
│       │   └── report.py         # PDF verification report generation (ReportLab)
│       └── static/
│           └── index.html
├── backend/tests/                  # pytest suite — 32 tests (100% pass)
├── .github/workflows/ci.yml        # GitHub Actions: backend tests, frontend tests+build, both Docker images
├── frontend-react/                 # The deployed frontend — React + Vite
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── App.jsx                       # Routing for all pages
│       ├── main.jsx
│       ├── index.css                     # Design tokens — civic-trust palette, not a generic template
│       ├── config.js                     # Service configurations and document types
│       ├── api/client.js                 # Axios instance, auto-attaches staff JWT token
│       ├── context/AuthContext.jsx       # Login state, persisted to localStorage
│       ├── components/Layout.jsx         # Civic header topbar and categorized navigation
│       ├── components/StaffGate.jsx      # Shared login + role gate for staff pages
│       ├── pages/CitizenUpload.jsx       # Apply: multi-format upload flow + readiness centerpiece
│       ├── pages/CheckStatus.jsx         # Citizen: look up a submitted application by ID
│       ├── pages/AskQuestion.jsx         # Citizen: regulation Q&A assistant
│       ├── pages/Feedback.jsx            # Citizen: grievance & feedback submission
│       ├── pages/OfficerQueue.jsx        # Officer: queue, KPI cards, filter/search, resolve
│       ├── pages/OfficerDashboard.jsx    # Officer/Admin: productivity + feedback insights
│       ├── pages/AdminSettings.jsx       # Admin: edit required-documents checklist rules
│       ├── pages/ManageStaff.jsx         # Admin: provision & manage staff accounts
│       └── tests/                        # 24 tests across 5 files — validation, PDF badges, role gating, resolve
├── frontend/                       # Legacy Streamlit build — kept for reference
└── scripts/
    └── create_github_issues.sh
```
