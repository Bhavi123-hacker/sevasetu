# SevaSetu — Security Posture & Governance Architecture

SevaSetu implements defense-in-depth security engineered for public administration compliance, Indian Digital Personal Data Protection (DPDP) principles, and zero-trust authorization.

---

## 1. Authentication & Role-Based Access Control (RBAC)

### Role Hierarchy & Privilege Matrix

| Role | Permissions | Access Scope |
| :--- | :--- | :--- |
| **Citizen** | Submit applications, upload own documents, track own cases, complete interviews, lodge grievances. | Strict IDOR boundary: Can ONLY read/modify own citizen records. |
| **Verification Officer** | Inspect assigned applications, review document scans, request corrections, advance cases to interview gate. | Assigned applications and officer queue. Cannot configure global services or deactivate staff. |
| **Senior Officer** | Reassign applications, review escalated grievances, issue final determinations and certificates. | Departmental queue, escalated grievances, senior review. |
| **Administrator** | Configure service catalog, edit SLA targets, manage staff user accounts, view system health. | Global administration with sole-admin lockout defense. |

### Token Security & Cryptographic Standards
- **Staff Authentication**: PyJWT with `HS256`, 8-hour expiration, salted password hashing using `bcrypt` / `argon2`.
- **Citizen Authentication**: Firebase Auth ID Token verification with fallback local OTP challenge.
- **Tracking Tokens**: Cryptographically secure URL-safe tokens for citizen status lookups with session validation.

---

## 2. Insecure Direct Object Reference (IDOR) Defense

All data access queries on citizen profiles, applications, documents, interview answers, notifications, and grievances strictly enforce ownership validation at the ORM layer:
```python
# Citizen application isolation check
if user.get("type") == "citizen":
    if app_record.citizen_profile_id != user.get("id"):
        raise HTTPException(status_code=403, detail="Forbidden: You do not have permission to access this application.")
```

---

## 3. Cryptographic Audit Ledger (SHA-256 Hash Chaining)

Every statutory action, document replacement, status change, and officer deliberation is recorded as an immutable `AuditEvent`:
$$\text{hash}_n = \text{SHA256}(\text{hash}_{n-1} + \text{event\_type} + \text{actor} + \text{timestamp} + \text{detail})$$
- Cryptographic chaining guarantees retroactive tampering or log alteration is immediately detected.
- Audit records are permanently preserved even when citizen operational files undergo DPDP retention redaction.

---

## 4. Privacy & PII Protection (DPDP Principles)

### Purpose-Bound Consent Lifecycle
1. Citizens explicitly register purpose-bound consents during onboarding (`CONSENT_GRANTED`).
2. Citizens can inspect granted consents and request withdrawal (`CONSENT_WITHDRAWN`).
3. Automated retention sweeps redact expired operational PII while preserving cryptographically chained audit events.

### Log Sanitization Scrubber
The centralized logger automatically scrubs sensitive keys before writing to standard streams:
- `password`, `token`, `jwt`, `api_key`, `secret`, `aadhaar_number`, `otp`, `salt`, `image_bytes`, `ocr_raw_text`.

---

## 5. Document Upload & File Integrity Security

1. **Magic Bytes Validation**: Enforces MIME type verification via binary header inspection (PDF `%PDF-`, PNG `\x89PNG`, JPG `\xFF\xD8\xFF`), rejecting disguised executable payloads.
2. **Path Traversal Defense**: All filenames are sanitized using regex stripping (`[^a-zA-Z0-9._-]`), blocking directory traversal (`../../etc/passwd`).
3. **Payload Size Guard**: Hard 10 MB per-document limit and 5-page PDF rasterization cap preventing Denial of Service.
4. **Document Access Isolation**: Documents are served strictly through authenticated FastAPI endpoints with verified access tokens.
