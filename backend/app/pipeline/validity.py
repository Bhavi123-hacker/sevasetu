"""
Document Expiry & Validity Engine.

Determines statutory validity status for uploaded civic documents based on extracted dates:
VALID | EXPIRING_SOON | EXPIRED | NOT_APPLICABLE | NOT_DETERMINABLE.

Does NOT invent dates or make auguries. When dates are unclear, returns NOT_DETERMINABLE
for human officer review rather than automated rejection.
"""
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

DOCUMENT_VALIDITY_RULES = {
    "aadhaar": {"validity_type": "PERMANENT", "max_age_days": None, "label": "Aadhaar Card"},
    "birth_certificate": {"validity_type": "PERMANENT", "max_age_days": None, "label": "Birth Certificate"},
    "caste_proof": {"validity_type": "PERMANENT", "max_age_days": None, "label": "Caste Certificate"},
    "electricity_bill": {"validity_type": "TIME_LIMITED", "max_age_days": 90, "label": "Electricity Bill", "desc": "Usually required within preceding 3 months"},
    "income_proof": {"validity_type": "TIME_LIMITED", "max_age_days": 180, "label": "Income Proof / Salary Slip", "desc": "Valid for current financial year / 6 months"},
    "residence_proof": {"validity_type": "PERMANENT_OR_UTILITY", "max_age_days": 180, "label": "Residence Proof"},
    "disability_certificate": {"validity_type": "PERMANENT_OR_TEMPORARY", "max_age_days": None, "label": "Disability Certificate"},
    "id_proof": {"validity_type": "CHECK_EXPIRY", "max_age_days": None, "label": "Government Photo ID"},
}

date_patterns = [
    r"\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b",
    r"\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b",
]

relative_patterns = {
    "issue_date": (
        r"(?:issued\s*date|date\s*of\s*issue|issued\s*on|issue\s*date|bill\s*date)[\s:\-_]*"
        r"(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})"
    ),
    "expiry_date": (
        r"(?:expiry\s*date|date\s*of\s*expiry|valid\s*upto|valid\s*till|expires\s*on)[\s:\-_]*"
        r"(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})"
    ),
}


@dataclass
class DocumentValidityResult:
    status: str  # VALID | EXPIRING_SOON | EXPIRED | NOT_APPLICABLE | NOT_DETERMINABLE
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    validity_period_days: Optional[int] = None
    is_expired: bool = False
    confidence: float = 0.0
    evidence: List[str] = field(default_factory=list)
    recommendation: str = ""
    official_validity_type: str = "PERMANENT"


def _parse_date_str(raw_str: str) -> Optional[datetime]:
    """Parses common Indian date formats (DD-MM-YYYY, YYYY-MM-DD, etc.)."""
    clean = raw_str.strip()
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y", "%Y-%m-%d", "%d-%m-%y", "%d/%m/%y"):
        try:
            return datetime.strptime(clean, fmt)
        except ValueError:
            continue
    return None


def evaluate_document_validity(
    doc_type: str,
    ocr_text: str,
    reference_date: Optional[datetime] = None,
) -> DocumentValidityResult:
    """
    Evaluates the date-validity of a document against its statutory rules.
    """
    now = reference_date or datetime.now(timezone.utc).replace(tzinfo=None)
    rule = DOCUMENT_VALIDITY_RULES.get(doc_type, {"validity_type": "PERMANENT", "max_age_days": None, "label": doc_type})
    v_type = rule["validity_type"]
    evidence = []

    # Case 1: Legally Permanent / Lifetime Documents
    if v_type == "PERMANENT":
        return DocumentValidityResult(
            status="VALID",
            is_expired=False,
            confidence=1.0,
            evidence=[f"Statutory {rule['label']} has permanent / lifetime validity."],
            recommendation="Document is lifetime valid.",
            official_validity_type="PERMANENT",
        )

    # Search for explicit issue and expiry dates in OCR text
    issue_dt_str = None
    expiry_dt_str = None

    issue_match = re.search(relative_patterns["issue_date"], ocr_text, re.IGNORECASE)
    if issue_match:
        issue_dt_str = issue_match.group(1)

    expiry_match = re.search(relative_patterns["expiry_date"], ocr_text, re.IGNORECASE)
    if expiry_match:
        expiry_dt_str = expiry_match.group(1)

    issue_dt = _parse_date_str(issue_dt_str) if issue_dt_str else None
    expiry_dt = _parse_date_str(expiry_dt_str) if expiry_dt_str else None

    # Case 2: Document with Explicit Expiry Date
    if expiry_dt:
        is_expired = expiry_dt < now
        days_left = (expiry_dt - now).days
        if is_expired:
            return DocumentValidityResult(
                status="EXPIRED",
                issue_date=issue_dt_str,
                expiry_date=expiry_dt_str,
                is_expired=True,
                confidence=0.90,
                evidence=[f"Document expired on {expiry_dt.strftime('%d-%m-%Y')} ({abs(days_left)} days ago)."],
                recommendation="Please upload an updated, currently valid document.",
                official_validity_type="TIME_LIMITED",
            )
        elif days_left <= 30:
            return DocumentValidityResult(
                status="EXPIRING_SOON",
                issue_date=issue_dt_str,
                expiry_date=expiry_dt_str,
                is_expired=False,
                confidence=0.90,
                evidence=[f"Document expires within {days_left} days (on {expiry_dt.strftime('%d-%m-%Y')})."],
                recommendation="Document is currently valid but nearing expiry.",
                official_validity_type="TIME_LIMITED",
            )
        return DocumentValidityResult(
            status="VALID",
            issue_date=issue_dt_str,
            expiry_date=expiry_dt_str,
            is_expired=False,
            confidence=0.95,
            evidence=[f"Valid until {expiry_dt.strftime('%d-%m-%Y')}."],
            recommendation="Document is currently valid.",
            official_validity_type="TIME_LIMITED",
        )

    # Case 3: Time-Limited Documents with Issue Date (e.g. Electricity Bill 90 days)
    max_days = rule.get("max_age_days")
    if max_days and issue_dt:
        effective_expiry = issue_dt + timedelta(days=max_days)
        is_old = now > effective_expiry
        age_days = (now - issue_dt).days
        if is_old:
            return DocumentValidityResult(
                status="EXPIRED",
                issue_date=issue_dt_str,
                expiry_date=effective_expiry.strftime("%d-%m-%Y"),
                validity_period_days=max_days,
                is_expired=True,
                confidence=0.85,
                evidence=[f"Bill issued {age_days} days ago (exceeds recommended {max_days}-day utility period)."],
                recommendation=f"Please provide a recent {rule['label']} issued within the last 3 months.",
                official_validity_type="TIME_LIMITED",
            )
        return DocumentValidityResult(
            status="VALID",
            issue_date=issue_dt_str,
            expiry_date=effective_expiry.strftime("%d-%m-%Y"),
            validity_period_days=max_days,
            is_expired=False,
            confidence=0.85,
            evidence=[f"Bill issued {age_days} days ago (within valid {max_days}-day window)."],
            recommendation="Document is recent and valid.",
            official_validity_type="TIME_LIMITED",
        )

    # Case 4: Time-limited requirement but date cannot be reliably determined
    if max_days:
        return DocumentValidityResult(
            status="NOT_DETERMINABLE",
            is_expired=False,
            confidence=0.40,
            evidence=["Issue / billing date could not be reliably identified in OCR text."],
            recommendation="Officer should verify billing date manually.",
            official_validity_type="TIME_LIMITED",
        )

    return DocumentValidityResult(
        status="NOT_APPLICABLE",
        is_expired=False,
        confidence=1.0,
        evidence=["Date validity not required for this document type."],
        recommendation="Document does not require an expiry date.",
        official_validity_type="NOT_APPLICABLE",
    )
