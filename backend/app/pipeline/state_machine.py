"""
SevaSetu Formalized Application State Machine and SLA Management.
Encapsulates all valid lifecycle transitions, actor role permissions,
and statutory turnaround time (SLA) calculations.
"""
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from fastapi import HTTPException, status

# State Constants
STATE_DRAFT = "DRAFT"
STATE_SUBMITTED = "SUBMITTED"
STATE_PRE_VERIFICATION = "PRE_VERIFICATION"
STATE_READY_FOR_REVIEW = "READY_FOR_REVIEW"
STATE_CORRECTION_REQUESTED = "CORRECTION_REQUESTED"
STATE_NEEDS_CORRECTION = "NEEDS_CORRECTION"
STATE_CORRECTION_SUBMITTED = "CORRECTION_SUBMITTED"
STATE_OFFICER_REVIEW = "OFFICER_REVIEW"
STATE_INTERVIEW_ELIGIBLE = "INTERVIEW_ELIGIBLE"
STATE_INTERVIEW_IN_PROGRESS = "INTERVIEW_IN_PROGRESS"
STATE_INTERVIEW_COMPLETED = "INTERVIEW_COMPLETED"
STATE_FINAL_REVIEW = "FINAL_REVIEW"
STATE_APPROVED = "APPROVED"
STATE_REJECTED = "REJECTED"

# Terminal states
TERMINAL_STATES = {STATE_APPROVED, STATE_REJECTED}

# Transition Map: FromState -> List of Permitted Target States
VALID_TRANSITIONS: Dict[str, List[str]] = {
    STATE_DRAFT: [STATE_SUBMITTED, STATE_PRE_VERIFICATION],
    STATE_SUBMITTED: [STATE_PRE_VERIFICATION, STATE_READY_FOR_REVIEW, STATE_CORRECTION_REQUESTED, STATE_NEEDS_CORRECTION],
    STATE_PRE_VERIFICATION: [STATE_READY_FOR_REVIEW, STATE_CORRECTION_REQUESTED, STATE_NEEDS_CORRECTION, STATE_INTERVIEW_ELIGIBLE],
    STATE_READY_FOR_REVIEW: [
        STATE_OFFICER_REVIEW,
        STATE_INTERVIEW_ELIGIBLE,
        STATE_CORRECTION_REQUESTED,
        STATE_NEEDS_CORRECTION,
        STATE_FINAL_REVIEW,
        STATE_APPROVED,
        STATE_REJECTED,
    ],
    STATE_OFFICER_REVIEW: [
        STATE_INTERVIEW_ELIGIBLE,
        STATE_CORRECTION_REQUESTED,
        STATE_NEEDS_CORRECTION,
        STATE_FINAL_REVIEW,
        STATE_APPROVED,
        STATE_REJECTED,
        STATE_READY_FOR_REVIEW,
    ],
    STATE_CORRECTION_REQUESTED: [STATE_CORRECTION_SUBMITTED, STATE_READY_FOR_REVIEW],
    STATE_NEEDS_CORRECTION: [STATE_CORRECTION_SUBMITTED, STATE_READY_FOR_REVIEW],
    STATE_CORRECTION_SUBMITTED: [STATE_PRE_VERIFICATION, STATE_READY_FOR_REVIEW, STATE_OFFICER_REVIEW],
    STATE_INTERVIEW_ELIGIBLE: [
        STATE_INTERVIEW_IN_PROGRESS,
        STATE_FINAL_REVIEW,
        STATE_CORRECTION_REQUESTED,
        STATE_NEEDS_CORRECTION,
        STATE_APPROVED,
        STATE_REJECTED,
    ],
    STATE_INTERVIEW_IN_PROGRESS: [STATE_INTERVIEW_COMPLETED, STATE_INTERVIEW_ELIGIBLE],
    STATE_INTERVIEW_COMPLETED: [
        STATE_FINAL_REVIEW,
        STATE_OFFICER_REVIEW,
        STATE_APPROVED,
        STATE_REJECTED,
        STATE_CORRECTION_REQUESTED,
    ],
    STATE_FINAL_REVIEW: [
        STATE_APPROVED,
        STATE_REJECTED,
        STATE_CORRECTION_REQUESTED,
        STATE_OFFICER_REVIEW,
    ],
    STATE_APPROVED: [],
    STATE_REJECTED: [],
}

# Statutory SLA defaults per service (in days)
SERVICE_SLA_DAYS: Dict[str, int] = {
    "income_certificate": 3,
    "caste_certificate": 7,
    "domicile_certificate": 5,
    "disability_certificate": 10,
    "ration_card": 15,
    "pm_kisan": 7,
    "scholarship": 14,
    "ayushman_card": 3,
    "pension_scheme": 14,
    "passport": 15,
}
DEFAULT_SLA_DAYS = 7


def get_service_sla_days(service_type: str) -> int:
    if not service_type:
        return DEFAULT_SLA_DAYS
    return SERVICE_SLA_DAYS.get(service_type.lower(), DEFAULT_SLA_DAYS)


def compute_sla_deadline(created_at: Optional[datetime], service_type: str) -> datetime:
    base_time = created_at or datetime.now(timezone.utc)
    if base_time.tzinfo is None:
        base_time = base_time.replace(tzinfo=timezone.utc)
    days = get_service_sla_days(service_type)
    return base_time + timedelta(days=days)


def compute_sla_status(
    created_at: Optional[datetime],
    sla_deadline: Optional[datetime],
    resolved_at: Optional[datetime] = None,
    current_status: Optional[str] = None,
) -> str:
    if current_status in TERMINAL_STATES or resolved_at is not None:
        if resolved_at and sla_deadline:
            res = resolved_at if resolved_at.tzinfo else resolved_at.replace(tzinfo=timezone.utc)
            dl = sla_deadline if sla_deadline.tzinfo else sla_deadline.replace(tzinfo=timezone.utc)
            return "MET" if res <= dl else "BREACHED"
        return "MET"

    if not sla_deadline or not created_at:
        return "NORMAL"

    now = datetime.now(timezone.utc)
    c_at = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
    dl = sla_deadline if sla_deadline.tzinfo else sla_deadline.replace(tzinfo=timezone.utc)

    if now > dl:
        return "OVERDUE"

    total_window = (dl - c_at).total_seconds()
    elapsed = (now - c_at).total_seconds()

    if total_window > 0 and (elapsed / total_window) >= 0.70:
        return "APPROACHING_SLA"

    return "NORMAL"


def validate_state_transition(current_state: str, target_state: str, actor_role: str = "System") -> bool:
    if current_state == target_state:
        return True

    allowed = VALID_TRANSITIONS.get(current_state)
    if allowed is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown origin state '{current_state}'.",
        )

    if target_state not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid statutory state transition from '{current_state}' to '{target_state}'. "
                f"Permitted next states: {allowed if allowed else 'None (Terminal state)'}."
            ),
        )

    return True
