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
- **Frontend is Streamlit, not React/Next.js.** Auth is real now — a genuine backend-issued, signed JWT, verified on every protected route, not a client-side flag — but it's still one shared demo password per role (`OFFICER_DEMO_PASSWORD`), not individual hashed passwords in a database. The remaining gap against the diagram is specifically the frontend framework: porting 6 working Streamlit pages to React is a substantially larger task than everything else in this list combined, and is being done incrementally, one page at a time, not in a single pass.

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
| Database | SQLite via SQLAlchemy | Zero external dependency for the MVP; swappable for Postgres later |
| OCR | Tesseract (default) / Google Cloud Vision (optional) | Free and offline by default |
| Consistency matching | `rapidfuzz` | Same library reused for both the consistency engine and duplicate-application detection |
| Regulation retrieval | TF-IDF (`scikit-learn`) + ChromaDB | No downloaded model, no API call, no rate limit to ever hit — see note below |
| Answer generation (optional) | Ollama, local model (`llama3.2:1b` default) | Generates a natural-language answer on top of the retrieved passage. Free, no key, no signup — the tradeoff for that is real local compute, not a hosted API's SLA |
| Feedback sentiment | VADER (`vaderSentiment`) | Rule-based, local, zero API — built for exactly this kind of short informal text |
| Explanation layer | Bhashini API | Free, government-run, supports Indian languages |
| Containerization | Docker + Docker Compose | One command to build and run locally |
| Staff authentication | PyJWT, `HS256` signed tokens | Real backend-issued, expiring, verified tokens — protects officer/admin routes; citizen-facing routes stay open by design |

**On the free-tier constraint:** ChromaDB's default embedding function downloads an ~80MB model from the internet the first time it runs — that surfaced as a real failure in a network-restricted sandbox while building this, not a hypothetical concern. Supplying TF-IDF vectors directly instead avoids that download entirely, alongside avoiding any per-query API cost.

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

- **Citizen app (Streamlit):** [http://localhost:8501](http://localhost:8501) — select a service, upload documents, get a readiness score
- **Officer / Administrator staff area:** the "Officer Queue" page in the same app's sidebar — demo login password is `seva123` (set via `OFFICER_DEMO_PASSWORD`; this is a demo-level gate, not real authentication). Choose your role (Officer or Administrator) at login.
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
cd frontend
pip install -r requirements.txt
streamlit run app.py
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
| Streamlit | Frontend for both the citizen upload flow and the officer queue |
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
│       ├── main.py                     # FastAPI app: applications, ask, feedback, officer-stats endpoints
│       ├── database.py                 # SQLAlchemy session setup
│       ├── models.py                   # Application, DocumentRecord, FieldMismatch, Feedback tables
│       ├── generate_test_documents.py  # Creates synthetic demo documents with an injected mismatch
│       ├── regulation_corpus.py        # Illustrative regulation text the RAG assistant retrieves from
│       ├── pipeline/
│       │   ├── ocr.py            # Tesseract wrapper
│       │   ├── extraction.py     # Raw OCR text -> structured fields
│       │   ├── consistency.py    # Cross-document fuzzy matching (the core differentiator)
│       │   ├── checklist.py      # Required-documents lookup per service type
│       │   ├── duplicates.py     # Fuzzy-matches against past applications
│       │   ├── scoring.py        # Aggregates everything into one readiness score
│       │   ├── rag.py            # TF-IDF + ChromaDB retrieval, no API/model download needed
│       │   ├── generation.py     # Optional Ollama generation layer on top of retrieval — untested by me, see note above
│       │   └── sentiment.py      # VADER sentiment analysis, fully local
│       └── static/
│           └── index.html
├── frontend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── config.py                  # API URL + service/document definitions
│   ├── app.py                     # Citizen flow: upload + readiness result
│   └── pages/
│       ├── 1_Officer_Queue.py     # Staff login (Officer/Administrator), queue, per-application detail
│       ├── 2_Ask_A_Question.py    # Citizen regulation Q&A
│       ├── 3_Feedback.py          # Citizen feedback submission
│       ├── 4_Officer_Dashboard.py # Productivity stats + feedback insights
│       ├── 5_Admin_Settings.py    # Administrator-only: edit required-documents checklist
│       └── 6_Check_Status.py      # Citizen: look up a submitted application by ID
├── docs/
│   ├── user_stories_moscow.md
│   └── wireframes_spec.md
└── scripts/
    └── create_github_issues.sh
```
