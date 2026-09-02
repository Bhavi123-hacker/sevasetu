"""
Privacy & Consent Management Layer for SevaSetu.

Provides structured, auditable citizen consent tracking by purpose and policy version.
Differentiates between mandatory service processing consents and optional notification/analytical consents.
Implements withdrawal and real-time consent verification.
"""
import uuid
import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from ..models import CitizenConsent

CURRENT_POLICY_VERSION = "2026.1"

PURPOSE_APPLICATION_PROCESSING = "APPLICATION_PROCESSING"
PURPOSE_OCR_PREVERIFICATION = "OCR_PREVERIFICATION"
PURPOSE_NOTIFICATIONS = "NOTIFICATIONS"
PURPOSE_ANALYTICS_FEEDBACK = "ANALYTICS_FEEDBACK"

CONSENT_PURPOSES: Dict[str, Dict[str, Any]] = {
    PURPOSE_APPLICATION_PROCESSING: {
        "title": "Application Data Processing",
        "description": "Allows authorized revenue and civic verification officers to inspect submitted details for statutory service determination.",
        "is_required": True,
        "category": "STATUTORY_SERVICE",
    },
    PURPOSE_OCR_PREVERIFICATION: {
        "title": "Automated OCR & Quality Pre-Verification",
        "description": "Enables local machine-assisted text extraction, quality checks, and consistency analysis before human officer review.",
        "is_required": True,
        "category": "PRE_VERIFICATION",
    },
    PURPOSE_NOTIFICATIONS: {
        "title": "Lifecycle Communications & Status Alerts",
        "description": "Permits transaction status updates, correction notices, and decision notifications via in-app alerts, email, and SMS.",
        "is_required": False,
        "category": "COMMUNICATIONS",
    },
    PURPOSE_ANALYTICS_FEEDBACK: {
        "title": "Service Quality & Sentiment Feedback",
        "description": "Permits anonymous aggregation of platform usability feedback and sentiment metrics to improve citizen service delivery.",
        "is_required": False,
        "category": "IMPROVEMENT",
    },
}


def get_privacy_policy_metadata() -> Dict[str, Any]:
    """Returns official structured privacy notice metadata and AI scope boundaries."""
    return {
        "policy_version": CURRENT_POLICY_VERSION,
        "effective_date": "2026-01-01",
        "statutory_principle": "AI assists verification. Final statutory decisions remain with authorized officers.",
        "what_we_collect": [
            {"category": "Identity & Profile", "items": ["Citizen name", "Date of birth", "Contact details (Email/Phone)", "Residential address / District"]},
            {"category": "Application Submissions", "items": ["Selected civic service", "Uploaded evidence documents (Aadhaar, Ration Card, etc.)", "Declaration acceptance"]},
            {"category": "Verification Records", "items": ["Interview responses & consistency scores", "Officer review notes & correction requests", "Audit trail timestamps"]},
        ],
        "why_we_collect": [
            "Statutory verification of civic service eligibility",
            "Pre-verification consistency and document quality inspection",
            "Human officer decision-support and case determination",
            "Immutable audit trail logging and fraud prevention",
        ],
        "who_can_access": [
            "The authenticated citizen (personal applications and grievances only)",
            "Designated Verification Officers assigned to the administrative review queue",
            "Senior Revenue Officers issuing final statutory decisions",
            "Platform Administrators maintaining audit logs and security infrastructure",
        ],
        "ai_scope_and_boundaries": {
            "what_ai_does": [
                "Extracts machine-readable text via OCR",
                "Classifies civic document types based on official templates",
                "Evaluates visual scan clarity, brightness, and resolution",
                "Identifies demographic field mismatches across documents",
                "Generates non-binding consistency scores for officer review",
            ],
            "what_ai_never_does": [
                "Does NOT make final statutory approval or rejection decisions",
                "Does NOT perform emotion detection or lie detection",
                "Does NOT perform biometric facial surveillance",
                "Does NOT autonomously deny government services",
            ],
        },
        "purposes": CONSENT_PURPOSES,
    }


def record_citizen_consent(
    db: Session,
    citizen_id: str,
    purpose: str,
    is_granted: bool = True,
    policy_version: str = CURRENT_POLICY_VERSION,
    metadata: Optional[Dict[str, Any]] = None,
) -> CitizenConsent:
    """Records or updates a structured consent entry for a citizen."""
    if purpose not in CONSENT_PURPOSES:
        purpose = PURPOSE_APPLICATION_PROCESSING

    existing = (
        db.query(CitizenConsent)
        .filter(CitizenConsent.citizen_id == citizen_id, CitizenConsent.purpose == purpose)
        .first()
    )

    if existing:
        existing.is_granted = is_granted
        existing.status = "ACTIVE" if is_granted else "WITHDRAWN"
        existing.policy_version = policy_version
        if not is_granted:
            existing.withdrawn_at = datetime.now(timezone.utc)
        else:
            existing.withdrawn_at = None
        if metadata:
            existing.metadata_json = json.dumps(metadata)
        db.flush()
        return existing

    record = CitizenConsent(
        id=f"cns-{uuid.uuid4().hex[:10]}",
        citizen_id=citizen_id,
        purpose=purpose,
        policy_version=policy_version,
        is_granted=is_granted,
        status="ACTIVE" if is_granted else "WITHDRAWN",
        withdrawn_at=None if is_granted else datetime.now(timezone.utc),
        metadata_json=json.dumps(metadata) if metadata else None,
    )
    db.add(record)
    db.flush()
    return record


def withdraw_citizen_consent(db: Session, citizen_id: str, purpose: str) -> Optional[CitizenConsent]:
    """Withdraws consent for an optional purpose."""
    # Mandatory service processing consents cannot be withdrawn while applications are active
    purpose_info = CONSENT_PURPOSES.get(purpose, {})
    if purpose_info.get("is_required", False):
        raise ValueError(f"Consent for '{purpose_info.get('title', purpose)}' is required for statutory application processing and cannot be withdrawn independently.")

    record = (
        db.query(CitizenConsent)
        .filter(CitizenConsent.citizen_id == citizen_id, CitizenConsent.purpose == purpose)
        .first()
    )
    if record:
        record.is_granted = False
        record.status = "WITHDRAWN"
        record.withdrawn_at = datetime.now(timezone.utc)
        db.flush()
    return record


def get_citizen_consents(db: Session, citizen_id: str) -> List[Dict[str, Any]]:
    """Returns the list of all consent statuses for a citizen."""
    records = db.query(CitizenConsent).filter(CitizenConsent.citizen_id == citizen_id).all()
    record_map = {r.purpose: r for r in records}

    result = []
    for p_key, p_info in CONSENT_PURPOSES.items():
        rec = record_map.get(p_key)
        result.append({
            "purpose": p_key,
            "title": p_info["title"],
            "description": p_info["description"],
            "is_required": p_info["is_required"],
            "category": p_info["category"],
            "is_granted": rec.is_granted if rec else p_info["is_required"],  # Required defaults to True
            "status": rec.status if rec else ("ACTIVE" if p_info["is_required"] else "NOT_RECORDED"),
            "policy_version": rec.policy_version if rec else CURRENT_POLICY_VERSION,
            "granted_at": rec.created_at.isoformat() if rec and rec.created_at else None,
            "withdrawn_at": rec.withdrawn_at.isoformat() if rec and rec.withdrawn_at else None,
        })
    return result


def is_consent_granted(db: Session, citizen_id: str, purpose: str) -> bool:
    """Checks if consent is actively granted for a given purpose."""
    rec = (
        db.query(CitizenConsent)
        .filter(CitizenConsent.citizen_id == citizen_id, CitizenConsent.purpose == purpose)
        .first()
    )
    if rec:
        return rec.is_granted and rec.status == "ACTIVE"
    # If not recorded, required purposes default to True, optional to False
    return CONSENT_PURPOSES.get(purpose, {}).get("is_required", False)
