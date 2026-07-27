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

## Architecture

```
upload documents
      │
      ▼
OCR extraction  (Tesseract, or Cloud Vision as an accuracy upgrade)
      │
      ▼
field normalization  (dates, name formats, address tokens)
      │
      ▼
consistency engine  (cross-document fuzzy match — the core differentiator)
      │
      ▼
readiness score  (+ missing-document checklist, + duplicate-application check)
      │
      ▼
officer queue  (sorted by readiness, plain-language explanation attached)
```

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | FastAPI (Python) | Async-friendly, auto-generated OpenAPI docs at `/docs` |
| Database | SQLite via SQLAlchemy | Zero external dependency for the MVP; swappable for Postgres later |
| OCR | Tesseract (default) / Google Cloud Vision (optional) | Free and offline by default |
| Consistency matching | `rapidfuzz` | Same library reused for both the consistency engine and duplicate-application detection |
| Explanation layer | Bhashini API | Free, government-run, supports Indian languages |
| Containerization | Docker + Docker Compose | One command to build and run locally |

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

# build and start the backend
docker compose up --build
```

Once it's running:

- App landing page: [http://localhost:8000](http://localhost:8000)
- Health check: [http://localhost:8000/api/health](http://localhost:8000/api/health)
- Interactive API docs (Swagger UI): [http://localhost:8000/docs](http://localhost:8000/docs)

To stop the app: `Ctrl+C`, then `docker compose down`.

### Running without Docker (for quick local iteration)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Local Development Tools

| Tool | Purpose |
|---|---|
| Docker Desktop | Builds and runs the containerized backend |
| Python 3.11 | Backend language runtime |
| `uvicorn` | ASGI server running the FastAPI app |
| `rapidfuzz` | Fuzzy string matching for the consistency engine and duplicate check |
| `pytesseract` + system `tesseract-ocr` | OCR extraction from uploaded document images |
| SQLite | Local, file-based database — no separate DB server to install |
| GitHub CLI (`gh`) *(optional)* | Used by `scripts/create_github_issues.sh` to bulk-create the 25 user stories as GitHub Issues |

## Repository Structure

```
sevasetu-starter/
├── README.md
├── docker-compose.yml
├── .gitignore
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py          # FastAPI app, routes, stub readiness-check endpoint
│       ├── database.py      # SQLAlchemy session setup
│       ├── models.py        # Application, DocumentRecord, FieldMismatch tables
│       └── static/
│           └── index.html   # Landing page
├── docs/
│   ├── user_stories_moscow.md
│   └── wireframes_spec.md
└── scripts/
    └── create_github_issues.sh
```
