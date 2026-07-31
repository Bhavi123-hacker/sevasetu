"""
Missing-document checklist.

Was a hardcoded dict; now lives in the database as RequiredDocument rows
so an Administrator can actually edit it (US-25) instead of it only ever
being changeable by editing code. Still deliberately NOT a model — this
is config, not prediction, and it shouldn't pretend otherwise.
"""
import uuid
from sqlalchemy.orm import Session

from .. import models

DEFAULT_REQUIREMENTS = {
    "income_certificate": ["aadhaar", "ration_card", "electricity_bill", "residence_proof"],
    "domicile_certificate": ["aadhaar", "residence_proof", "birth_certificate"],
}


def seed_defaults_if_empty(db: Session) -> None:
    """Runs once at startup. No-ops if the table already has data —
    safe to call every boot without duplicating rows."""
    if db.query(models.RequiredDocument).first() is not None:
        return
    for service_type, doc_types in DEFAULT_REQUIREMENTS.items():
        for doc_type in doc_types:
            db.add(models.RequiredDocument(
                id=str(uuid.uuid4())[:8],
                service_type=service_type,
                document_type=doc_type,
            ))
    db.commit()


def get_required_documents(db: Session, service_type: str) -> list:
    rows = db.query(models.RequiredDocument).filter(
        models.RequiredDocument.service_type == service_type
    ).all()
    return [row.document_type for row in rows]


def find_missing_documents(db: Session, service_type: str, uploaded_doc_types: list) -> list:
    required = get_required_documents(db, service_type)
    return [doc for doc in required if doc not in uploaded_doc_types]
