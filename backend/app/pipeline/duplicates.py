"""
Duplicate-application detection — multi-field, with a confidence score.

Reuses the same rapidfuzz matching used in consistency.py, now checking
both name AND date of birth instead of name alone. Name-only matching
has an obvious failure mode: two different people can share a common
name. Adding DOB (already extracted by the OCR pipeline for the
consistency check — this doesn't need any new extraction work) cuts
false positives sharply, since "same name AND same DOB" is a much
stronger duplicate signal than either alone.
"""
from rapidfuzz import fuzz

NAME_MATCH_THRESHOLD = 90
FLAG_THRESHOLD = 70  # combined confidence below this doesn't get flagged at all

NAME_WEIGHT = 0.6
DOB_MATCH_BONUS = 40  # out of the same 0-100 confidence scale


def _confidence(name_score: float, date_of_birth: str = None, existing_dob: str = None) -> int:
    if date_of_birth and existing_dob:
        if date_of_birth == existing_dob:
            return 100
        else:
            return round(name_score * 0.4)
    # If DOB is not available on one or both records, base confidence on name similarity
    return round(name_score)


def find_probable_duplicate(
    citizen_name: str, service_type: str, existing_applications: list, date_of_birth: str = None
):
    """
    existing_applications: list of dicts with at least
    {"id", "citizen_name", "service_type", "date_of_birth"} — the last
    field is optional per-row (older records may not have it).
    Returns {"application": <matching dict>, "confidence": 0-100} or None.
    """
    best_match = None
    best_confidence = 0

    for application in existing_applications:
        if application["service_type"] != service_type:
            continue

        name_score = fuzz.token_sort_ratio(citizen_name.lower(), application["citizen_name"].lower())
        if name_score < NAME_MATCH_THRESHOLD:
            continue  # name has to clear its own bar regardless of DOB

        existing_dob = application.get("date_of_birth")
        confidence = _confidence(name_score, date_of_birth, existing_dob)

        if confidence > best_confidence:
            best_confidence = confidence
            best_match = application

    if best_match and best_confidence >= FLAG_THRESHOLD:
        return {"application": best_match, "confidence": best_confidence}
    return None
