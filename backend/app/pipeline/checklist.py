"""
Missing-document checklist.

Deliberately NOT a model — it's a lookup table. Real value here comes
from keeping this config accurate per service type, not from prediction.
US-25 (an admin screen to edit this table) is documented as a Phase 2
feature; for the MVP it's hardcoded here.
"""

SERVICE_REQUIREMENTS = {
    "income_certificate": ["aadhaar", "ration_card", "electricity_bill", "residence_proof"],
    "domicile_certificate": ["aadhaar", "residence_proof", "birth_certificate"],
}


def get_required_documents(service_type: str) -> list:
    return SERVICE_REQUIREMENTS.get(service_type, [])


def find_missing_documents(service_type: str, uploaded_doc_types: list) -> list:
    required = get_required_documents(service_type)
    return [doc for doc in required if doc not in uploaded_doc_types]
