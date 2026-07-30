"""
Readiness score aggregation.

Deliberately simple, rule-based weighting — not a learned model. This
is the "AI is lighter than FarmGate/TenderWatch" tradeoff made on
purpose: predictable, explainable scoring an officer can trust and a
student can defend in a viva, versus a black-box score nobody (including
the citizen) can question. A learned/weighted version is a reasonable
Phase 2 upgrade once there's real usage data to train against.
"""
from dataclasses import dataclass

from .consistency import FieldCheckResult

FAILED_FIELD_PENALTY = 15
MISSING_DOC_PENALTY = 10
DUPLICATE_PENALTY = 20


@dataclass
class ReadinessResult:
    score: int
    estimated_delay_days: str
    recommendation: str


def _estimate_delay(failed_field_count: int, missing_doc_count: int, duplicate_suspected: bool) -> str:
    if duplicate_suspected:
        return "7+ (manual review required)"
    issue_count = failed_field_count + missing_doc_count
    if issue_count == 0:
        return "same day"
    if issue_count == 1:
        return "1-2"
    if issue_count <= 3:
        return "3-5"
    return "7+"


def _build_recommendation(
    field_checks: list[FieldCheckResult], missing_documents: list, duplicate_suspected: bool
) -> str:
    if duplicate_suspected:
        return "This looks like a repeat submission of an existing application. Check its status instead of resubmitting."

    failed = [check for check in field_checks if check.status == "fail"]
    if failed and missing_documents:
        first_failed = failed[0]
        return (
            f"Fix the {first_failed.field.replace('_', ' ')} mismatch and upload the missing "
            f"{missing_documents[0].replace('_', ' ')} before resubmitting."
        )
    if failed:
        first_failed = failed[0]
        return f"Correct the {first_failed.field.replace('_', ' ')} mismatch, then resubmit — everything else looks good."
    if missing_documents:
        return f"Upload your {missing_documents[0].replace('_', ' ')} — that's the only thing missing."
    return "Looks complete and consistent. No action needed."


def compute_readiness(
    field_checks: list[FieldCheckResult], missing_documents: list, duplicate_suspected: bool
) -> ReadinessResult:
    failed_field_count = sum(1 for check in field_checks if check.status == "fail")
    missing_doc_count = len(missing_documents)

    score = 100
    score -= failed_field_count * FAILED_FIELD_PENALTY
    score -= missing_doc_count * MISSING_DOC_PENALTY
    if duplicate_suspected:
        score -= DUPLICATE_PENALTY
    score = max(score, 0)

    return ReadinessResult(
        score=score,
        estimated_delay_days=_estimate_delay(failed_field_count, missing_doc_count, duplicate_suspected),
        recommendation=_build_recommendation(field_checks, missing_documents, duplicate_suspected),
    )
