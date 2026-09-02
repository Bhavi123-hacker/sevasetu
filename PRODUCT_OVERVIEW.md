# SevaSetu — Product Overview & Institutional Capabilities

> **Statutory Principle**: *AI assists verification. Final statutory decisions remain with authorized officers.*

---

## 1. Executive Summary

**SevaSetu** is an accountable, human-in-the-loop civic service verification and case management platform. It helps public administrations, municipal corporations, e-Governance agencies, and welfare organizations digitize document verification, streamline officer workflows, provide real-time citizen tracking, and resolve civic grievances under strict statutory SLAs.

### Core Value Proposition
- **For Citizens**: Immediate document pre-verification feedback, preventing repeat visits for blurry or incorrect scans; full lifecycle milestone tracking; and formal grievance redressal with auditable escalation.
- **For Verification Officers**: A unified workbench with side-by-side evidence inspection, deterministic demographic matching, OCR quality scores, and structured correction workflows.
- **For Senior Administrators & Supervisors**: Real-time operational telemetry computed directly from relational database records, multi-officer assignment controls, statutory SLA breach monitoring, and tamper-evident SHA-256 audit ledgers.

---

## 2. Platform Architecture & Workflow

```
[ Citizen Application ]
         │ (Document Upload & Format Screening)
         ▼
[ Explainable Pre-Verification Engine ] ──► (Tesseract OCR + Laplacian Variance + Consistency Scoring)
         │
         ▼
[ Officer Review Workbench ] ──────────► (Side-by-Side Inspection / Structured Correction Requests)
         │ (Officer Approves Pre-Screening)
         ▼
[ Statutory Interview Gate ] ──────────► (5 Grounded Confirmation Questions + Accessible Text Mode)
         │ (Interview Completed & Evaluated)
         ▼
[ Senior Officer Determination ] ──────► (Issuance of Verifiable Certificate or Formal Notice)
         │
         ▼
[ Civic Grievance & Redressal ] ───────► (8-State Escalation Lifecycle + Multi-Tier Senior Review)
```

---

## 3. Key Modules & Capabilities

| Module | Purpose | Key Features |
| :--- | :--- | :--- |
| **Document Intelligence** | Automated OCR & Quality Checks | Tesseract OCR, Laplacian blur detection, negative keyword matching across Indian documents. |
| **Requirements Engine** | Statutory Rule Compliance | 84 authoritative requirement items grounded in state & central gazettes, ONE_OF/ALL_OF rules. |
| **Human-in-the-Loop Workbench** | Officer Case Review | Side-by-side evidence inspection, discrepancy highlighting, non-destructive correction requests. |
| **Statutory Interview Gate** | Citizen Declaration Confirmation | Dynamic browser audio/video interview with transcript consistency evaluation and text fallback. |
| **SLA & Queue Management** | Workload & Turnaround Control | Priority queues, automatic SLA status (Normal, Approaching SLA, Overdue), officer assignment. |
| **Grievance Redressal** | Accountable Citizen Escalation | 8-state lifecycle (`OPEN` $\to$ `CLOSED`), internal staff notes isolation, bounded reconsideration ($\le 2$). |
| **Cryptographic Audit Ledger** | Legal & Compliance Verifiability | Immutable SHA-256 hash chain recording all state transitions, document replacements, and officer actions. |
| **Privacy & Consent Center** | Data Governance & DPDP Compliance | Purpose-bound consent tracking, retention scrubbing with cryptographic ledger integrity preservation. |
| **Operational Impact Telemetry** | Performance Transparency | Live real database metrics (processing duration, SLA compliance, officer turnaround, citizen sentiment). |

---

## 4. Responsible AI Boundaries

SevaSetu strictly enforces algorithmic boundaries to ensure ethical, explainable governance:

### What AI May Do (Assistance)
1. Extract text and dates from document scans using Optical Character Recognition (OCR).
2. Compute image resolution, contrast, and Laplacian blur variance to flag unreadable scans.
3. Detect cross-document discrepancies in names, birthdates, and residential addresses.
4. Highlight document type mismatches against required statutory slots.
5. Prioritize review queues based on readiness scores and exception flags.

### What AI Must Not Do (Prohibited)
1. **Never autonomously approve civic applications or statutory certificates.**
2. **Never autonomously reject citizen applications without human officer determination.**
3. **Never perform facial recognition, emotion detection, or demographic profiling.**
4. **Never infer applicant truthfulness or replace legal affidavits.**
5. **Never override human officer discretion, appeals, or statutory waivers.**

---

## 5. Deployment Truthfulness & Integration Roadmap

| Tier | Status | Description |
| :--- | :--- | :--- |
| **Available Now** | `ACTIVE_NATIVE` | Full civic application lifecycle, 84 statutory rules, Tesseract OCR pre-verification, staff review, interview gate, 8-state grievance engine, SHA-256 audit ledger, live impact telemetry. |
| **Integration Ready** | `SANDBOX_READY` | Decoupled Integration Gateway with standard Identity Verification, Digital Document Repository, and Resend email adapters ready for enterprise API credentials. |
| **Requires Official Partnership** | `PARTNERSHIP_REQUIRED` | Production UIDAI biometric/OTP e-KYC, national DigiLocker enterprise API tokens, state treasury payment gateways, and direct bilateral database synchronization. |

---

## 6. Target Deployers & Stakeholders

1. **District & Tehsil Revenue Administrations**: Certificate issuance, revenue case management, and counter queue reduction.
2. **Municipal Corporations & Urban Local Bodies**: Citizen welfare scheme intake and utility document verification.
3. **State e-Governance Directorates**: Standardized pre-verification criteria, SLA turnaround enforcement, and auditable case histories.
4. **Public Service Centers (CSCs / CFCs)**: Guided citizen submission with instant format and blur feedback.
5. **Public Interest NGOs**: Assisting vulnerable citizens in pre-verifying prerequisites and lodging tracked grievances.
6. **Government System Integrators**: Plug-and-play verification and case-management engine.
