"""
AI Verification Interview Engine for SevaSetu.
Structured consistency evaluation comparing spoken citizen responses to OCR document data.

CRITICAL SAFETY INVARIANTS:
- NO lie detection
- NO emotion detection
- NO facial truthfulness scoring
- Evaluates factual cross-consistency with documents only
- Raw audio/video discarded by default
"""
import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from rapidfuzz import fuzz


class QuestionTemplate(BaseModel):
    category: str
    question_text: str
    expected_field: str


class AnswerComparisonResult(BaseModel):
    category: str
    question_text: str
    transcript_text: str
    expected_value: Optional[str]
    extracted_value: str
    comparison_status: str  # CONSISTENT | INCONSISTENT | UNCERTAIN | NOT_APPLICABLE
    confidence: float
    notes: str


class InterviewSummaryResult(BaseModel):
    session_id: str
    total_questions: int
    answered_count: int
    consistent_count: int
    inconsistent_count: int
    uncertain_count: int
    overall_consistency: str  # CONSISTENT | INCONSISTENT | UNCERTAIN | UNABLE_TO_VERIFY
    summary_notes: str
    disclaimer: str = (
        "AI-assisted document consistency comparison. "
        "No emotion, psychological, or lie detection is performed."
    )


def generate_interview_questions(
    citizen_name: Optional[str] = None,
    dob: Optional[str] = None,
    address: Optional[str] = None,
    service_type: Optional[str] = None,
    document_types: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Generates a structured, relevant sequence of factual questions
    grounded in the citizen's application or profile data.
    """
    questions = []
    order = 1

    # 1. Identity
    if citizen_name:
        questions.append({
            "order_num": order,
            "category": "IDENTITY",
            "question_text": "Please state your full legal name as it appears on your identity documents.",
            "expected_field": "name",
            "expected_value": citizen_name,
        })
        order += 1
    else:
        questions.append({
            "order_num": order,
            "category": "IDENTITY",
            "question_text": "Please state your full legal name.",
            "expected_field": "name",
            "expected_value": None,
        })
        order += 1

    # 2. Date of Birth
    if dob:
        questions.append({
            "order_num": order,
            "category": "DATE_OF_BIRTH",
            "question_text": "What is your date of birth?",
            "expected_field": "date_of_birth",
            "expected_value": dob,
        })
        order += 1

    # 3. Address / Residence
    if address:
        questions.append({
            "order_num": order,
            "category": "ADDRESS",
            "question_text": "What is your current residential address or district?",
            "expected_field": "address",
            "expected_value": address,
        })
        order += 1

    # 4. Service Purpose
    service_label = (service_type or "civic certificate").replace("_", " ").title()
    questions.append({
        "order_num": order,
        "category": "SERVICE_PURPOSE",
        "question_text": f"What is the primary purpose of your {service_label} application?",
        "expected_field": "purpose",
        "expected_value": service_type or "general",
    })
    order += 1

    # 5. Documents submitted
    if document_types:
        doc_names = ", ".join([d.replace("_", " ").title() for d in document_types])
        questions.append({
            "order_num": order,
            "category": "DOCUMENT_INFORMATION",
            "question_text": f"Which proof documents have you prepared for this application (e.g. {doc_names})?",
            "expected_field": "documents",
            "expected_value": doc_names,
        })
    else:
        questions.append({
            "order_num": order,
            "category": "DOCUMENT_INFORMATION",
            "question_text": "Which identity or residence documents are you submitting?",
            "expected_field": "documents",
            "expected_value": None,
        })

    return questions


def _normalize_text(text: str) -> str:
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    return " ".join(text.split())


def evaluate_answer_consistency(
    category: str,
    question_text: str,
    transcript_text: str,
    expected_value: Optional[str] = None,
) -> AnswerComparisonResult:
    """
    Compares the spoken answer transcript with expected document field data.
    Uses fuzzy token set matching and semantic date normalization.
    """
    if not transcript_text or not transcript_text.strip():
        return AnswerComparisonResult(
            category=category,
            question_text=question_text,
            transcript_text="",
            expected_value=expected_value,
            extracted_value="",
            comparison_status="UNCERTAIN",
            confidence=0.0,
            notes="No audible or transcript text recorded for this question.",
        )

    norm_trans = _normalize_text(transcript_text)
    extracted = transcript_text.strip()

    if not expected_value:
        return AnswerComparisonResult(
            category=category,
            question_text=question_text,
            transcript_text=transcript_text,
            expected_value=None,
            extracted_value=extracted,
            comparison_status="NOT_APPLICABLE",
            confidence=0.85,
            notes="Response recorded; no prior document benchmark available for direct comparison.",
        )

    norm_exp = _normalize_text(expected_value)

    # Date comparison special handling
    if category == "DATE_OF_BIRTH":
        # Extract digits/years
        trans_years = re.findall(r"\b(19\d{2}|20\d{2})\b", norm_trans)
        exp_years = re.findall(r"\b(19\d{2}|20\d{2})\b", norm_exp)
        
        # Check direct substring or token set
        score = fuzz.token_set_ratio(norm_trans, norm_exp)
        
        if trans_years and exp_years and trans_years[0] != exp_years[0]:
            return AnswerComparisonResult(
                category=category,
                question_text=question_text,
                transcript_text=transcript_text,
                expected_value=expected_value,
                extracted_value=extracted,
                comparison_status="INCONSISTENT",
                confidence=round(score / 100.0, 2),
                notes=f"Birth year mentioned ({trans_years[0]}) differs from document record ({exp_years[0]}).",
            )
        
        if score >= 75 or (trans_years and exp_years and trans_years[0] == exp_years[0]):
            return AnswerComparisonResult(
                category=category,
                question_text=question_text,
                transcript_text=transcript_text,
                expected_value=expected_value,
                extracted_value=extracted,
                comparison_status="CONSISTENT",
                confidence=round(max(score, 85) / 100.0, 2),
                notes="Spoken birth date is consistent with uploaded document record.",
            )
        else:
            return AnswerComparisonResult(
                category=category,
                question_text=question_text,
                transcript_text=transcript_text,
                expected_value=expected_value,
                extracted_value=extracted,
                comparison_status="UNCERTAIN",
                confidence=round(score / 100.0, 2),
                notes="Spoken date could not be unambiguously matched against document record.",
            )

    # General Name / Address / Token matching
    score = fuzz.token_set_ratio(norm_trans, norm_exp)
    partial_score = fuzz.partial_ratio(norm_exp, norm_trans)

    if score >= 75 or partial_score >= 80:
        return AnswerComparisonResult(
            category=category,
            question_text=question_text,
            transcript_text=transcript_text,
            expected_value=expected_value,
            extracted_value=extracted,
            comparison_status="CONSISTENT",
            confidence=round(score / 100.0, 2),
            notes="Spoken answer matches document information with high consistency.",
        )
    elif score < 45 and partial_score < 45:
        return AnswerComparisonResult(
            category=category,
            question_text=question_text,
            transcript_text=transcript_text,
            expected_value=expected_value,
            extracted_value=extracted,
            comparison_status="INCONSISTENT",
            confidence=round(score / 100.0, 2),
            notes="Spoken answer appears inconsistent with document benchmark.",
        )
    else:
        return AnswerComparisonResult(
            category=category,
            question_text=question_text,
            transcript_text=transcript_text,
            expected_value=expected_value,
            extracted_value=extracted,
            comparison_status="UNCERTAIN",
            confidence=round(score / 100.0, 2),
            notes="Partial match detected; human review recommended for verification.",
        )


def evaluate_interview_session(answers: List[AnswerComparisonResult]) -> InterviewSummaryResult:
    """
    Summarizes all answer comparisons across an interview session.
    """
    total = len(answers)
    if total == 0:
        return InterviewSummaryResult(
            session_id="",
            total_questions=0,
            answered_count=0,
            consistent_count=0,
            inconsistent_count=0,
            uncertain_count=0,
            overall_consistency="UNABLE_TO_VERIFY",
            summary_notes="No questions answered in this session.",
        )

    consistent = sum(1 for a in answers if a.comparison_status == "CONSISTENT")
    inconsistent = sum(1 for a in answers if a.comparison_status == "INCONSISTENT")
    uncertain = sum(1 for a in answers if a.comparison_status in ["UNCERTAIN", "NOT_APPLICABLE"])

    if inconsistent > 0:
        overall = "INCONSISTENT"
        notes = f"{inconsistent} answer(s) differed from document records. Officer review advised."
    elif consistent >= max(1, total - uncertain):
        overall = "CONSISTENT"
        notes = "Spoken interview responses are consistent with submitted document records."
    elif uncertain > 0:
        overall = "UNCERTAIN"
        notes = "Interview audio/transcript had partial clarity; officer manual inspection recommended."
    else:
        overall = "UNABLE_TO_VERIFY"
        notes = "Insufficient data to establish cross-document interview consistency."

    return InterviewSummaryResult(
        session_id="",
        total_questions=total,
        answered_count=total,
        consistent_count=consistent,
        inconsistent_count=inconsistent,
        uncertain_count=uncertain,
        overall_consistency=overall,
        summary_notes=notes,
    )
