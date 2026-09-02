"""
Readiness score aggregation.

Deliberately simple, rule-based weighting — not a learned model. This
is the "AI is lighter than FarmGate/TenderWatch" tradeoff made on
purpose: predictable, explainable scoring an officer can trust and a
student can defend in a viva, versus a black-box score nobody (including
the citizen) can question.
"""
from dataclasses import dataclass, field
from typing import Optional, List

from .consistency import FieldCheckResult

FAILED_FIELD_PENALTY = 15
MISSING_DOC_PENALTY = 10
DUPLICATE_PENALTY = 20
DOC_TYPE_MISMATCH_PENALTY = 30
DOC_TYPE_UNCERTAIN_PENALTY = 5
DOC_QUALITY_UNREADABLE_PENALTY = 15
DOC_QUALITY_POOR_PENALTY = 5
DOC_EXPIRED_PENALTY = 15


@dataclass
class ScoreReason:
    points: int  # positive or negative
    label: str


@dataclass
class ReadinessResult:
    score: int
    estimated_delay_days: str
    recommendation: str
    reasoning: list = field(default_factory=list)  # list[ScoreReason] — same math as `score`, just itemized
    risk_level: str = "LOW"  # "LOW" | "MEDIUM" | "HIGH"
    risk_factors: list = field(default_factory=list)  # list[str]
    is_fast_track: bool = False


def is_fast_track_eligible(
    readiness_score: int,
    missing_documents: list,
    doc_verifications: Optional[list] = None,
    field_checks: Optional[list] = None,
    duplicate_suspected: bool = False,
    integrity_warnings: Optional[list] = None,
    quality_results: Optional[list] = None,
    validity_results: Optional[list] = None,
    status: Optional[str] = None,
) -> bool:
    """
    Explicit, testable safety predicate for fast-track queue routing.
    Fast-track MUST NEVER happen if there is:
    - readiness score < 85
    - any missing required document
    - any document type MISMATCH or UNCERTAIN
    - unresolved critical identity mismatch (DOB or name)
    - unresolved duplicate suspicion
    - status is NEEDS_CORRECTION or REJECTED
    - blocking structural integrity warnings
    - unreadable / poor document scan quality
    - expired mandatory documents
    """
    if readiness_score < 85:
        return False
    if missing_documents and len(missing_documents) > 0:
        return False
    if doc_verifications and any(getattr(v, "status", None) in ["MISMATCH", "UNCERTAIN"] for v in doc_verifications):
        return False
    if field_checks and any(c.status == "fail" for c in field_checks):
        return False
    if duplicate_suspected:
        return False
    if status in ["NEEDS_CORRECTION", "REJECTED"]:
        return False
    if integrity_warnings and any("suspicious" in str(w).lower() for w in integrity_warnings):
        return False
    if quality_results and any(getattr(q, "status", None) in ["UNREADABLE", "POOR", "UNCERTAIN"] for q in quality_results):
        return False
    if validity_results and any(getattr(v, "is_expired", False) for v in validity_results):
        return False
    return True


def _estimate_delay(failed_field_count: int, missing_doc_count: int, duplicate_suspected: bool, mismatch_count: int = 0) -> str:
    if duplicate_suspected or mismatch_count > 0:
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
    field_checks: list[FieldCheckResult],
    missing_documents: list,
    duplicate_suspected: bool,
    doc_verifications: Optional[list] = None,
    quality_results: Optional[list] = None,
    validity_results: Optional[list] = None,
) -> str:
    if duplicate_suspected:
        return "This looks like a repeat submission of an existing application. Check its status instead of resubmitting."

    mismatches = [v for v in (doc_verifications or []) if getattr(v, "status", None) == "MISMATCH"]
    if mismatches:
        first = mismatches[0]
        return f"Replace the incorrect document in your {first.expected_type.replace('_', ' ')} slot (detected as {first.detected_type.replace('_', ' ')})."

    expired = [v for v in (validity_results or []) if getattr(v, "is_expired", False)]
    if expired:
        return "One or more documents appear expired. Please upload recent, valid certificates if requested by an officer."

    unreadable = [q for q in (quality_results or []) if getattr(q, "status", None) in ["UNREADABLE", "POOR"]]
    if unreadable:
        return "One or more document scans have low clarity. You may be requested to upload a higher-resolution scan."

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


def compute_risk_level(
    field_checks: list[FieldCheckResult],
    duplicate_suspected: bool,
    doc_verifications: Optional[list] = None,
    quality_results: Optional[list] = None,
    validity_results: Optional[list] = None,
) -> tuple[str, list[str]]:
    """
    Computes statutory risk level ("LOW" | "MEDIUM" | "HIGH") based on discrepancy severity.
    Never describes risk as an accusation of fraud — indicates officer review attention required.
    """
    factors = []
    mismatches = [v for v in (doc_verifications or []) if getattr(v, "status", None) == "MISMATCH"]
    uncertains = [v for v in (doc_verifications or []) if getattr(v, "status", None) == "UNCERTAIN"]
    failed_fields = [c for c in field_checks if c.status == "fail"]

    if mismatches:
        factors.append(f"{len(mismatches)} document type mismatch(es) detected")
    if duplicate_suspected:
        factors.append("Probable duplicate citizen submission")
    
    for c in failed_fields:
        if c.field == "date_of_birth":
            factors.append("Date of Birth discrepancy across submitted records")
        elif c.field == "name":
            factors.append("Name variation across documents")
        elif c.field == "address":
            factors.append("Residential address discrepancy")

    if uncertains:
        factors.append(f"{len(uncertains)} document(s) with inconclusive classification")

    if quality_results:
        unreadable_count = sum(1 for q in quality_results if getattr(q, "status", None) == "UNREADABLE")
        poor_count = sum(1 for q in quality_results if getattr(q, "status", None) == "POOR")
        if unreadable_count > 0:
            factors.append(f"{unreadable_count} unreadable scan(s) detected")
        elif poor_count > 0:
            factors.append(f"{poor_count} scan(s) with low clarity")

    if validity_results:
        expired_count = sum(1 for v in validity_results if getattr(v, "is_expired", False))
        if expired_count > 0:
            factors.append(f"{expired_count} potentially expired document(s)")

    # Determine risk level
    if (
        mismatches
        or duplicate_suspected
        or any(c.field in ["date_of_birth"] for c in failed_fields)
        or (validity_results and any(getattr(v, "is_expired", False) for v in validity_results))
    ):
        risk_level = "HIGH"
    elif (
        len(failed_fields) > 0
        or uncertains
        or (quality_results and any(getattr(q, "status", None) in ["POOR", "UNREADABLE"] for q in quality_results))
    ):
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    return risk_level, factors


def compute_readiness(
    field_checks: list[FieldCheckResult],
    missing_documents: list,
    duplicate_suspected: bool,
    doc_verifications: Optional[list] = None,
    quality_results: Optional[list] = None,
    validity_results: Optional[list] = None,
) -> ReadinessResult:
    reasoning = [ScoreReason(points=100, label="Base score (all requirements met)")]
    score = 100

    # Document type verification penalties & reasoning
    mismatch_count = 0
    if doc_verifications:
        for v in doc_verifications:
            v_status = getattr(v, "status", None)
            expected = getattr(v, "expected_type", "document")
            detected = getattr(v, "detected_type", "unknown")
            if v_status == "MISMATCH":
                mismatch_count += 1
                score -= DOC_TYPE_MISMATCH_PENALTY
                reasoning.append(
                    ScoreReason(
                        points=-DOC_TYPE_MISMATCH_PENALTY,
                        label=f"Document mismatch: {expected.replace('_', ' ').title()} slot contains {detected.replace('_', ' ').title()}",
                    )
                )
            elif v_status == "UNCERTAIN":
                score -= DOC_TYPE_UNCERTAIN_PENALTY
                reasoning.append(
                    ScoreReason(
                        points=-DOC_TYPE_UNCERTAIN_PENALTY,
                        label=f"Uncertain document type in {expected.replace('_', ' ').title()} slot",
                    )
                )

    # Document Quality Penalties
    if quality_results:
        for q in quality_results:
            q_status = getattr(q, "status", None)
            if q_status == "UNREADABLE":
                score -= DOC_QUALITY_UNREADABLE_PENALTY
                reasoning.append(ScoreReason(points=-DOC_QUALITY_UNREADABLE_PENALTY, label="Unreadable document scan quality"))
            elif q_status == "POOR":
                score -= DOC_QUALITY_POOR_PENALTY
                reasoning.append(ScoreReason(points=-DOC_QUALITY_POOR_PENALTY, label="Low document scan resolution / clarity"))

    # Document Validity Penalties
    if validity_results:
        for v in validity_results:
            if getattr(v, "is_expired", False):
                score -= DOC_EXPIRED_PENALTY
                reasoning.append(ScoreReason(points=-DOC_EXPIRED_PENALTY, label="Expired document detected"))

    for check in field_checks:
        if check.status == "fail":
            score -= FAILED_FIELD_PENALTY
            reasoning.append(ScoreReason(points=-FAILED_FIELD_PENALTY, label=f"{check.field.replace('_', ' ').title()} mismatch"))
        else:
            reasoning.append(ScoreReason(points=0, label=f"{check.field.replace('_', ' ').title()} verified consistent"))

    for doc in missing_documents:
        score -= MISSING_DOC_PENALTY
        reasoning.append(ScoreReason(points=-MISSING_DOC_PENALTY, label=f"Missing {doc.replace('_', ' ')}"))

    if duplicate_suspected:
        score -= DUPLICATE_PENALTY
        reasoning.append(ScoreReason(points=-DUPLICATE_PENALTY, label="Possible duplicate application"))

    score = max(score, 0)
    failed_field_count = sum(1 for check in field_checks if check.status == "fail")
    missing_doc_count = len(missing_documents)

    risk_level, risk_factors = compute_risk_level(field_checks, duplicate_suspected, doc_verifications, quality_results, validity_results)

    fast_track = is_fast_track_eligible(
        readiness_score=score,
        missing_documents=missing_documents,
        doc_verifications=doc_verifications,
        field_checks=field_checks,
        duplicate_suspected=duplicate_suspected,
        quality_results=quality_results,
        validity_results=validity_results,
    )

    return ReadinessResult(
        score=score,
        estimated_delay_days=_estimate_delay(failed_field_count, missing_doc_count, duplicate_suspected, mismatch_count),
        recommendation=_build_recommendation(field_checks, missing_documents, duplicate_suspected, doc_verifications, quality_results, validity_results),
        reasoning=reasoning,
        risk_level=risk_level,
        risk_factors=risk_factors,
        is_fast_track=fast_track,
    )
