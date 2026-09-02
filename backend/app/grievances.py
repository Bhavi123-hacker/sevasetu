"""
SevaSetu Civic Grievance, Support & Escalation Module.
Provides deterministic state machine rules, SLA tracking, reference generation,
and auditable lifecycle management for citizen grievances.
"""
from datetime import datetime, timezone, timedelta
import uuid
from typing import Optional, Dict, Any, Tuple, List
from sqlalchemy.orm import Session
from . import models

# Grievance Lifecycle Statuses
STATUS_OPEN = "OPEN"
STATUS_ACKNOWLEDGED = "ACKNOWLEDGED"
STATUS_ASSIGNED = "ASSIGNED"
STATUS_UNDER_REVIEW = "UNDER_REVIEW"
STATUS_AWAITING_CITIZEN = "AWAITING_CITIZEN"
STATUS_ESCALATED = "ESCALATED"
STATUS_SENIOR_REVIEW = "SENIOR_REVIEW"
STATUS_RESOLVED = "RESOLVED"
STATUS_CLOSED = "CLOSED"
STATUS_REOPENED = "REOPENED"

VALID_GRIEVANCE_STATUSES = {
    STATUS_OPEN,
    STATUS_ACKNOWLEDGED,
    STATUS_ASSIGNED,
    STATUS_UNDER_REVIEW,
    STATUS_AWAITING_CITIZEN,
    STATUS_ESCALATED,
    STATUS_SENIOR_REVIEW,
    STATUS_RESOLVED,
    STATUS_CLOSED,
    STATUS_REOPENED,
}

# Strict State Machine Transition Rules
VALID_TRANSITIONS: Dict[str, List[str]] = {
    STATUS_OPEN: [STATUS_ACKNOWLEDGED, STATUS_ASSIGNED, STATUS_UNDER_REVIEW, STATUS_ESCALATED, STATUS_RESOLVED, STATUS_CLOSED],
    STATUS_ACKNOWLEDGED: [STATUS_ASSIGNED, STATUS_UNDER_REVIEW, STATUS_ESCALATED, STATUS_RESOLVED, STATUS_CLOSED],
    STATUS_ASSIGNED: [STATUS_UNDER_REVIEW, STATUS_ESCALATED, STATUS_RESOLVED, STATUS_CLOSED],
    STATUS_UNDER_REVIEW: [STATUS_AWAITING_CITIZEN, STATUS_ESCALATED, STATUS_SENIOR_REVIEW, STATUS_RESOLVED, STATUS_CLOSED],
    STATUS_AWAITING_CITIZEN: [STATUS_UNDER_REVIEW, STATUS_ESCALATED, STATUS_RESOLVED, STATUS_CLOSED],
    STATUS_ESCALATED: [STATUS_SENIOR_REVIEW, STATUS_RESOLVED, STATUS_CLOSED],
    STATUS_SENIOR_REVIEW: [STATUS_AWAITING_CITIZEN, STATUS_RESOLVED, STATUS_CLOSED],
    STATUS_RESOLVED: [STATUS_CLOSED, STATUS_REOPENED, STATUS_ESCALATED],
    STATUS_REOPENED: [STATUS_UNDER_REVIEW, STATUS_SENIOR_REVIEW, STATUS_ESCALATED, STATUS_RESOLVED, STATUS_CLOSED],
    STATUS_CLOSED: [],  # Terminal
}

# Grievance Categories
CATEGORIES = {
    "APPLICATION_DELAYED": "Application Delayed",
    "DOCUMENT_REJECTED": "Document Rejected",
    "CORRECTION_REQUEST_ISSUE": "Correction Request Issue",
    "INTERVIEW_ISSUE": "Interview Issue",
    "DECISION_DISPUTE": "Decision Dispute",
    "TECHNICAL_PROBLEM": "Technical Problem",
    "NOTIFICATION_PROBLEM": "Notification Problem",
    "OTHER": "Other",
}

# Priorities
PRIORITIES = {"LOW", "NORMAL", "HIGH", "URGENT"}

# Default SLA duration in days
DEFAULT_GRIEVANCE_SLA_DAYS = 7
MAX_REOPEN_LIMIT = 2


def validate_grievance_transition(current_status: str, target_status: str) -> Tuple[bool, Optional[str]]:
    """Validates if transitioning from current_status to target_status is permitted."""
    current = (current_status or "").upper()
    target = (target_status or "").upper()

    if current == target:
        return True, None

    if current == STATUS_CLOSED:
        return False, "Closed grievances cannot be modified."

    allowed = VALID_TRANSITIONS.get(current, [])
    if target not in allowed:
        return False, f"Invalid grievance transition from '{current}' to '{target}'. Permitted: {allowed}"

    return True, None


def generate_grievance_reference(db: Session) -> str:
    """Generates a non-sequential, professional civic grievance reference: SS-GRV-YYYY-XXXXXX."""
    year = datetime.now(timezone.utc).year
    # Count current year records to produce clean formatted sequence with random entropy prefix
    count = db.query(models.Grievance).count() + 1
    random_hex = uuid.uuid4().hex[:4].upper()
    return f"SS-GRV-{year}-{count:04d}-{random_hex}"


def compute_grievance_sla_deadline(created_at: Optional[datetime] = None, days: int = DEFAULT_GRIEVANCE_SLA_DAYS) -> datetime:
    """Calculates SLA deadline for a grievance."""
    base = created_at or datetime.now(timezone.utc)
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)
    return base + timedelta(days=days)


def compute_grievance_sla_status(
    created_at: Optional[datetime],
    sla_deadline: Optional[datetime],
    resolved_at: Optional[datetime],
    status: str,
) -> str:
    """
    Computes SLA compliance status for a grievance:
    - NORMAL: within safe SLA window
    - APPROACHING_SLA: <= 48 hours remaining
    - OVERDUE: past SLA deadline and unresolved
    - MET: resolved before SLA deadline
    - BREACHED: resolved after SLA deadline
    """
    if not created_at or not sla_deadline:
        return "NORMAL"

    now = datetime.now(timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    if sla_deadline.tzinfo is None:
        sla_deadline = sla_deadline.replace(tzinfo=timezone.utc)

    if status in [STATUS_RESOLVED, STATUS_CLOSED]:
        if resolved_at:
            if resolved_at.tzinfo is None:
                resolved_at = resolved_at.replace(tzinfo=timezone.utc)
            return "MET" if resolved_at <= sla_deadline else "BREACHED"
        return "MET"

    if now > sla_deadline:
        return "OVERDUE"

    remaining = sla_deadline - now
    if remaining <= timedelta(hours=48):
        return "APPROACHING_SLA"

    return "NORMAL"
