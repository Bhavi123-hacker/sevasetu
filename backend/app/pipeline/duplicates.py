"""
Duplicate-application detection.

Deliberately reuses the same rapidfuzz matching used in consistency.py —
just pointed at *past* applications instead of *within* one bundle. If a
citizen with a very similar name has already applied for the same
service, this is almost certainly the same person re-submitting rather
than a coincidence.
"""
from rapidfuzz import fuzz

NAME_MATCH_THRESHOLD = 90


def find_probable_duplicate(citizen_name: str, service_type: str, existing_applications: list):
    """
    existing_applications: list of dicts with at least
    {"id", "citizen_name", "service_type"} — i.e. rows already in the DB.
    Returns the matching application dict, or None.
    """
    for application in existing_applications:
        if application["service_type"] != service_type:
            continue
        score = fuzz.token_sort_ratio(citizen_name.lower(), application["citizen_name"].lower())
        if score >= NAME_MATCH_THRESHOLD:
            return application
    return None
