"""
Field extraction & normalization.

Turns raw OCR text into a clean {field: value} dict. This works by
matching "Label: value" style lines, which is a safe assumption for
templated documents (synthetic test docs, and most Indian ID documents
which do print labelled fields). Real-world scanned documents with
inconsistent layouts would need a more robust extractor (layout-aware
OCR, or a small trained model) — noted as a Phase 2 upgrade, not a
blocker for this MVP.
"""
import re

FIELD_PATTERNS = {
    "name": re.compile(r"name\s*[:\-]\s*(.+)", re.IGNORECASE),
    "date_of_birth": re.compile(r"(?:dob|date of birth)\s*[:\-]\s*(.+)", re.IGNORECASE),
    "address": re.compile(r"address\s*[:\-]\s*(.+)", re.IGNORECASE),
}


def normalize_value(field: str, raw_value: str) -> str:
    """Light cleanup so trivial OCR/formatting noise doesn't look like a mismatch."""
    value = raw_value.strip()
    value = re.sub(r"\s+", " ", value)

    if field == "date_of_birth":
        # Normalize common date separators: 12/05/1998, 12.05.1998 -> 12-05-1998
        value = re.sub(r"[./]", "-", value)

    return value.strip().rstrip(".")


def extract_fields(raw_text: str) -> dict:
    """
    Runs each field pattern against the OCR text and returns whatever
    matches. A document that doesn't mention a field (e.g. a bill with
    no DOB) simply won't have that key — callers must handle missing
    fields, not assume all three are always present.
    """
    fields = {}
    for field_name, pattern in FIELD_PATTERNS.items():
        match = pattern.search(raw_text)
        if match:
            fields[field_name] = normalize_value(field_name, match.group(1))
    return fields
