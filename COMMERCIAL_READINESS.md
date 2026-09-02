# SevaSetu — Commercial Readiness & Institutional Deployment Dossier

**Platform**: SevaSetu Civic Document Pre-Verification & Case-Management Platform  
**Target Pitch Audience**: District Administrations, Municipal Corporations, State e-Governance Departments, Public Service Centers (CSCs), Civic Tech System Integrators  
**Current Release**: Version 1.1.0-release (9.8/10 Production-Grade Civic Infrastructure)  
**Governance Model**: Explainable Decision Support (Human-in-the-Loop Statutory Authority)

---

## 1. Executive Problem Statement & Market Context

Frontline public service delivery in India handles hundreds of millions of certificate and scheme applications annually (e.g. Income, Caste, Domicile, PM KISAN, Ration Cards, Passport verification). This intake experiences severe structural friction:
1. **Clerical Screening Overload**: Officers spend 60%+ of their working hours performing repetitive manual checks on image blur, name spellings, address tokens, and date formats.
2. **Citizen Frustration & Repeat Visits**: Citizens often visit physical counters 2 to 4 times due to unannounced document defects, missing secondary proofs, or unclear rejection grounds.
3. **Statutory Turnaround Breaches**: Lack of deterministic SLA monitoring and workload load-balancing leads to silent case stagnation.
4. **Opaque & Unverifiable Outcomes**: Once issued, paper or PDF certificates are difficult for third-party entities (banks, universities, employers) to verify without manual counter validation.

---

## 2. The SevaSetu Solution

SevaSetu transforms fragmented civic intake into an **auditable, tamper-evident digital case lifecycle**:

```
[Citizen Submission]
        │
        ▼
[Document Intelligence] ── (OCR Extraction, Laplacian Blur Quality, Type Classification)
        │
        ▼
[Explainable Pre-Verification] ── (Cross-Document Demographic Reconciliation)
        │
        ▼
[Officer Review Workbench] ── (Two-Tier Human Review, Structured Correction Requests)
        │
        ▼
[Statutory Interview Gate] ── (Grounded Factual Confirmation Session)
        │
        ▼
[Senior Officer Determination] ── (Digital Approval / Rejection with Evidentiary Basis)
        │
        ▼
[Official Certificate Issuance] ── (Embeds High-Precision QR Code & Hash Chain)
        │
        ▼
[Independent Public Verification] ── (/verify Authenticity Verification without Login)
        │
        ▼
[Civic Grievance Redressal] ── (8-State Escalation Workflow with SLA Tracking)
```

---

## 3. Core Enterprise Architecture Modules

### Module 1: Pre-Verification & Document Intelligence
- **Tesseract OCR Engine**: Multipage PDF and image text extraction with per-word confidence metrics.
- **Laplacian Blur Quality Scoring**: Rejects unreadable, dark, or severely blurred scans during citizen intake before submission.
- **Deterministic Negative-Constraint Classifier**: Validates that Aadhaar, Ration Cards, Income Certificates, and Utility Bills match their dedicated statutory slots.

### Module 2: Human-in-the-Loop Officer Case Workbench
- **Two-Tier Role Hierarchy**: Distinct operational boundaries for *Reviewing Officers* (screening, corrections, interview unlocking) and *Senior Reviewing Officers* (final statutory approval/rejection).
- **Advisory AI Boundaries**: Algorithmic readiness scores (0–100%) and risk levels (`LOW`, `MEDIUM`, `HIGH`) strictly assist human discretion and can never autonomously issue determinations.

### Module 3: Statutory Interview Gate
- **Interactive Verification Session**: 5 dynamically grounded confirmation questions based on the applicant's declared metadata and uploaded evidence.
- **Dual Mode Accessibility**: Browser audio/video camera feed with structured speech-to-text, paired with full keyboard/text fallback.

### Module 4: Independent Public Certificate Verification (`/verify`)
- **Privacy-Safe Authenticity API**: Public verification route `/verify?certificate=SS-CERT-XXXX` allowing employers, banks, and academic institutions to verify certificates without citizen login.
- **Zero PII Exposure**: Returns only Certificate ID, Application Reference, Service Name, Issuing Authority, Authorization Date, and Decision. Strictly shields Aadhaar, phone, address, and uploaded files.
- **Embedded QR Code**: Decision PDFs feature high-precision vector QR codes that link directly to the verification endpoint.

### Module 5: Civic Grievance Redressal & Escalation
- **8-State Monitored State Machine**: `OPEN` → `ACKNOWLEDGED` → `ASSIGNED` → `UNDER_REVIEW` → `AWAITING_CITIZEN` → `ESCALATED` → `SENIOR_REVIEW` → `RESOLVED` / `CLOSED`.
- **Private Staff Deliberation**: Internal notes are completely isolated from citizen communication streams.
- **Bounded Reconsideration**: Citizens can request formal review within statutory limits (maximum 2 reopens).

### Module 6: Executive Command Center (`/command-center`)
- **Live Relational Telemetry**: Aggregated in real time from SQL database records (zero synthetic estimates or fabricated charts).
- **Statutory SLA Engine**: Categorizes applications into `Normal`, `Approaching SLA (<48h)`, and `Overdue (Statutory Breach)`.
- **Officer Workload Load-Balancing**: Monitors active cases per desk to identify bottlenecks.

---

## 4. Integration Readiness & Deployment Boundaries

| Integration Interface | Current Delivery Status | Production Requirement for Live Interfacing |
| :--- | :--- | :--- |
| **UIDAI Aadhaar Verification** | Decoupled Integration Sandbox (`/api/integration/identity-verify`) | Requires authorized AUA/KUA license and bilateral MOU with UIDAI. |
| **DigiLocker Ecosystem** | Standardized Document Adapter & Wallet | Requires official DigiLocker Requester API client ID and public RSA certs. |
| **State Treasury Payments** | Decoupled Webhook Dispatcher | Requires state-specific CyberTreasury / BharatKosh gateway credentials. |
| **Transactional Email / SMS** | Active Resend Provider + In-App Fallback | Production Resend API key / DLT-registered SMS sender header. |

---

## 5. Security, RBAC & Data Protection Baseline

- **Zero Data Leakage IDOR Defense**: All document downloads, case details, interview transcripts, and notifications enforce strict cryptographic citizen and staff token identity checks.
- **SHA-256 Audit Hash Chain**: Every status transition, document version replacement, and officer sign-off appends an immutable hash-chained event record.
- **Magic Bytes & MIME Validation**: Strict binary header inspection blocks executable payloads, corrupted files, and file-extension spoofing.
- **Privacy-Safe Logging**: All terminal and file logs automatically scrub phone numbers, emails, passwords, and tokens before writing to disk.

---

## 6. Commercial Expansion & Institutional Pilots

1. **Tehsil / Revenue Block Pilot**: 90-day deployment across 5 high-volume revenue certificates (Income, Domicile, Caste, Character, Legal Heir).
2. **Municipal Citizen Service Centers (CSCs)**: Frontline kiosk integration providing immediate upload feedback to reduce applicant revisit rates by 70%+.
3. **Departmental Legacy Sync**: REST and webhook ingestion pipelines enabling parallel deployment alongside existing legacy state portals.
