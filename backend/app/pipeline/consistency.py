"""
Consistency engine — the actual differentiator.

Takes the extracted fields from every document in one citizen's bundle
and cross-checks each field across every document that mentions it,
using fuzzy string matching (handles minor OCR noise and formatting
differences without flagging them as real mismatches).
"""
import re
from dataclasses import dataclass
from rapidfuzz import fuzz

# Below this similarity score (0-100), two values count as a genuine
# mismatch rather than OCR noise. Tuned against the synthetic test set;
# revisit if real-world documents produce noisier OCR text.
MATCH_THRESHOLD = 85


def _digit_tokens(value: str) -> list:
    """Pulls out number sequences, e.g. house numbers, PIN codes."""
    return re.findall(r"\d+", value)


def _numbers_disagree(value_a: str, value_b: str) -> bool:
    """
    Plain fuzzy-ratio scoring rates '12 MG Road' vs '14 MG Road' as a 94%
    match — only 2 characters differ in an otherwise-long, identical
    string. That's exactly backwards for an address: the house number is
    the part that actually matters. If both values contain digit
    sequences and any of them differ, that's a real mismatch regardless
    of how similar the surrounding text looks.
    """
    digits_a, digits_b = _digit_tokens(value_a), _digit_tokens(value_b)
    if not digits_a or not digits_b:
        return False
    return digits_a != digits_b


@dataclass
class FieldCheckResult:
    field: str
    status: str  # "pass" | "fail"
    detail: str


def check_field_consistency(field_name: str, values_by_doc: dict) -> FieldCheckResult:
    """
    values_by_doc: {doc_type: value} for every document that has this field.
    Compares every pair; reports the first (or worst) disagreement found.
    """
    doc_types = list(values_by_doc.keys())

    if len(doc_types) < 2:
        return FieldCheckResult(
            field=field_name,
            status="pass",
            detail="Only one document mentions this field — nothing to cross-check yet.",
        )

    worst_pair = None
    worst_score = 100

    for i in range(len(doc_types)):
        for j in range(i + 1, len(doc_types)):
            doc_a, doc_b = doc_types[i], doc_types[j]
            value_a, value_b = values_by_doc[doc_a], values_by_doc[doc_b]

            if _numbers_disagree(value_a, value_b):
                score = 0  # force a fail regardless of how similar the rest of the string looks
            else:
                score = fuzz.token_sort_ratio(value_a.lower(), value_b.lower())

            if score < worst_score:
                worst_score = score
                worst_pair = (doc_a, value_a, doc_b, value_b)

    if worst_score >= MATCH_THRESHOLD:
        return FieldCheckResult(
            field=field_name,
            status="pass",
            detail="Matches across documents",
        )

    doc_a, value_a, doc_b, value_b = worst_pair
    return FieldCheckResult(
        field=field_name,
        status="fail",
        detail=f'{doc_a.replace("_", " ").title()} lists "{value_a}"; '
               f'{doc_b.replace("_", " ").title()} lists "{value_b}"',
    )


def run_consistency_check(fields_by_doc: dict) -> list[FieldCheckResult]:
    """
    fields_by_doc: {doc_type: {field_name: value}} for every uploaded
    document. Returns one FieldCheckResult per field that appears in
    at least one document.
    """
    all_fields = set()
    for doc_fields in fields_by_doc.values():
        all_fields.update(doc_fields.keys())

    results = []
    for field_name in sorted(all_fields):
        values_by_doc = {
            doc_type: doc_fields[field_name]
            for doc_type, doc_fields in fields_by_doc.items()
            if field_name in doc_fields
        }
        results.append(check_field_consistency(field_name, values_by_doc))

    return results
