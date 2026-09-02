# SevaSetu — Civic Document Pre-Verification & Officer Decision-Support Platform (v1.1.1)

> Helping citizens submit complete, consistent, and well-verified applications before they reach an officer.

---

## 1. Deployment Posture & Honest Status Separation

```
========================================================================================
ENGINEERING STATUS:
  Engineering Blockers: 0
  Automated Backend Pytest Suites: 213/213 tests passing (100%)
  Frontend Vitest Unit & Integration Suites: 71/71 tests passing (100%)
  Frontend Production Build: Succeeded (0 errors)
  Multi-Role RBAC: Citizen / Verification Officer / Senior Officer / Administrator
  Public Product Landing & FAQ: Grounded civic overview, responsible AI framework (/about)
  Live Operational Impact Telemetry: Real-time database metrics (/impact)
  Citizen Experience & Feedback: 5-star rating, sentiment recognition, deduplication (/feedback)
  Service Configuration Engine: SLA days, requirement versions, audit logging (/admin-settings)
  Integration Gateway Status: Decoupled sandbox adapters with truthfulness disclaimers
  Privacy & Consent Center: Purpose-Bound Consents, Withdrawal, AI Safety Transparency
  Civic Grievance & Escalation: Real-Time Lifecycle, IDOR-Protected, Chained Audit Trail
  Database Resilience: PostgreSQL 15 + Connection Pool Pre-Ping + Auto Rollback
  Cryptographic Audit Ledger: SHA-256 Tamper-Evident Hash-Chained Events
========================================================================================
```

> **Mandatory Civic Notice:**  
> SevaSetu is an **accountable civic document pre-verification and decision-support platform**.  
> **"AI assists verification. Final statutory decisions remain with authorized officers."**  
> Official administrative determinations remain exclusively with authorized human revenue and statutory officers.

---

## 📚 Technical Documentation Index

- [🏛️ Product Overview & Capabilities](PRODUCT_OVERVIEW.md)
- [🚀 Deployment & Infrastructure Guide](DEPLOYMENT.md)
- [🔒 Security & Governance Architecture](SECURITY.md)
- [⚙️ Operations & Disaster Recovery Guide](OPERATIONS.md)
- [🎭 Demonstration & Presentation Guide](DEMO_GUIDE.md)
- [🏗️ System Architecture & Data Model](ARCHITECTURE.md)

---

## 2. Core Operating Architecture & Lifecycle

```
CITIZEN (Firebase Email Auth / Registration / Profile / Purpose-Bound Consents)
   ↓
DOCUMENT INGESTION (Magic Bytes + Size Limits + Path Sanitization)
   ↓
OCR EXTRACTION (Tesseract OCR + pypdfium2, 144 DPI)
   ↓
DETERMINISTIC DOCUMENT CLASSIFIER & NEGATIVE SIGNATURE MATCHING
   ↓
DOCUMENT QUALITY ENGINE (Laplacian Blur + Contrast + Brightness + Blank Page + DPI)
   ↓
DOCUMENT VALIDITY & EXPIRY PRE-EVALUATION (Lifetime vs Time-Limited Utility/Income Proofs)
   ↓
FIELD EXTRACTION & CROSS-DOCUMENT CONSISTENCY ENGINE (RapidFuzz Normalized Matching)
   ↓
DUPLICATE CHECK & HISTORY ANALYSIS (Multi-Signal Levenshtein Similarity)
   ↓
READINESS SCORING (0-100%) + SCRUTINY RISK LEVEL (LOW / MEDIUM / HIGH)
   ↓
OFFICER WORKBENCH (Assignment + Document Review Pass + Correction Requests)
   ↓
GROUNDED STATUTORY VERIFICATION INTERVIEW (Browser Audio/Video + Text Fallback)
   ↓
SENIOR OFFICER FINAL REVIEW (Statutory Approval / Rejection with Structured Reasons)
   ↓
OFFICIAL DECISION PDF ISSUANCE (Digital Certificate / Decision Notice)
   ↓
CIVIC GRIEVANCE & ESCALATION WORKFLOW (Disputes / Reconsideration / Investigation Queue)
   ↓
IMMUTABLE SHA-256 AUDIT CHAIN WITH CRYPTOGRAPHIC INTEGRITY VERIFICATION
```

---

## 3. Key Capabilities (v1.1.1)

### A. AI-Assisted Pre-Verification Pipeline
- **Deterministic Classifier**: Signature-based classification with strict negative rules preventing cross-document false positives.
- **Authenticity Risk Scoring**: Evaluates demographic consistency and slot alignment without autonomous rejection (**LOW** / **MEDIUM** / **HIGH**).
- **Quality & Validity Engines**: Assesses image sharpness, contrast, blank pages, and evaluates validity windows without penalizing lifetime records.
- **Fast-Track Safety Predicate**: Any discrepancy, unreadable scan, expired proof, or duplicate suspicion immediately revokes fast-track eligibility.

### B. Verification Officer & Senior Officer Workbench
- **Two-Tier Staff Review**: Verification Officers conduct initial document evidence review and unlock the statutory interview gate (`INTERVIEW_ELIGIBLE`).
- **Senior Officer Statutory Decision**: Senior Officers review applicant interview consistency and issue final statutory decisions (`APPROVED` or `REJECTED`).
- **Correction Workflow & Document Versioning**: Atomic versioning (**Version 1** $\to$ `ARCHIVED_REPLACED`, **Version 2** $\to$ `ACTIVE`) with pre-verification re-runs.

### C. Privacy, Consent & Governance Center
- **Structured Consents**: Tracks explicit citizen authorizations by statutory purpose and policy version.
- **AI Scope Transparency**: Explicitly discloses AI boundaries ("AI assists verification. Final statutory decisions remain with authorized officers.") and confirms absence of biometric facial surveillance or autonomous approvals/rejections.
- **System Operations & Real Monitoring**: Live operational health metrics computed strictly from real database records.

### D. Civic Grievance, Support & Escalation Engine
- **End-to-End Redressal**: Citizens can lodge grievances linked to applications or general inquiries with attachment uploads (PDF, PNG, JPG, WEBP).
- **State Machine & SLA**: Governed by strict transitions (`OPEN` $\to$ `ACKNOWLEDGED` $\to$ `ASSIGNED` $\to$ `UNDER_REVIEW` $\to$ `AWAITING_CITIZEN` $\to$ `ESCALATED` $\to$ `RESOLVED` $\to$ `CLOSED`).
- **Staff-Only Notes**: Internal notes are strictly isolated from citizen views with complete IDOR defense.
- **Reconsideration Limit**: Governs statutory reopen requests (maximum 2 attempts) to prevent administrative deadlock.

### E. Grounded Verification Interview Gate
- **Interactive Browser Interview**: Real-time camera/microphone interface with 5 dynamically grounded statutory questions.
- **Accessible Text Fallback**: Automatically provides keyboard accessible text mode for devices lacking media hardware.
- **Transcript Consistency Analysis**: Verifies spoken answers against document evidence without autonomous automated rejection.

### F. Security, Multi-Tenant Isolation & Audit Trail
- **Multi-Role RBAC**: Strict server-side authorization separating Citizen, Verification Officer, Senior Officer, and Administrator roles.
- **IDOR Protection**: Prevents cross-citizen access to applications, documents, version history, grievances, or decision certificates (`HTTP 403 Forbidden`).
- **Cryptographic Audit Ledger**: Every action generates an immutable SHA-256 hash-chained `AuditEvent` record.
- **Sole-Admin Lockout Prevention**: Server rejects deactivation or demotion of the sole active administrator (`HTTP 400`).

---

## 4. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | FastAPI (Python 3.11/3.12) | High-performance asynchronous REST API, OpenAPI docs at `/docs` |
| **Frontend** | React 18 + Vite | Accessible, responsive civic UI with multilingual support (EN, HI, TA) |
| **Database** | PostgreSQL 15 & SQLite | Production relational storage with connection pooling & non-destructive migrations |
| **OCR & PDF** | Tesseract OCR + `pypdfium2` | High-fidelity multi-page PDF rendering and text extraction |
| **Matching** | `rapidfuzz` | Deterministic fuzzy string matching for cross-document consistency |
| **Auth & Security** | Firebase Auth + PyJWT + bcrypt | Dual citizen Firebase email authentication and staff JWT tokens |
| **Notifications** | Resend API + In-App Center | Real email delivery with graceful offline fallback |
| **Containers** | Docker & Docker Compose | Containerized reproducible deployment with automated health checks |

---

## 5. Database Schema Management

SevaSetu implements automated runtime schema reconciliation for development and local demo deployments:
- **SQLite Runtime Reconciliation**: Automatically discovers and applies non-destructive `ALTER TABLE ADD COLUMN` migrations using SQLAlchemy metadata introspection on startup.
- **Data Preservation**: Existing rows, IDs, documents, and relational foreign keys are strictly preserved during schema updates.
- **Fail-Fast Verification**: `verify_schema_integrity()` validates that 100% of declared ORM columns exist in the active database; any migration defect triggers structured error reporting and halts startup rather than masking runtime discrepancies.
- **Production PostgreSQL Guidance**: For enterprise production environments, schema migrations should be managed via versioned migration pipelines (such as Alembic).

---

## 6. Local Setup & Verification

### Running with Docker Compose:
```bash
# 1. Start all services
docker compose up --build -d

# 2. Run backend pytest suite (209/209 passing)
docker compose exec backend pytest backend/tests -v

# 3. Run frontend Vitest test suite (68/68 passing)
docker compose exec frontend npm test -- --run
```

### Access URLs:
- **Citizen Portal & Officer Workbench:** [http://localhost:3000](http://localhost:3000)
- **Privacy & Consent Center:** [http://localhost:3000/privacy](http://localhost:3000/privacy)
- **System Operations & Health:** [http://localhost:3000/operations](http://localhost:3000/operations)
- **API Health Check:** [http://localhost:8000/api/health](http://localhost:8000/api/health)
- **Interactive Swagger Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)

### Default Staff Credentials (Demo / Testing):
- **Verification Officer:** Username: `officer1` | Password: `officer-demo-pass` (or `seva123`)
- **Senior Officer:** Username: `senior_officer1` | Password: `senior-demo-pass` (or `seva123`)
- **System Administrator:** Username: `admin1` | Password: `admin-demo-pass` (or `seva123`)
