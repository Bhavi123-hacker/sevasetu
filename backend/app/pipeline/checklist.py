"""
Missing-document checklist & Centralized Civic Service Catalog.

Manages the service catalog and required documents in the database so
Administrators can configure and edit requirements per service dynamically.
"""
import uuid
from typing import Dict, List, Optional
from sqlalchemy.orm import Session

from .. import models

DOCUMENT_LABELS = {
    "aadhaar": "Aadhaar Card",
    "ration_card": "Ration Card",
    "electricity_bill": "Electricity Bill",
    "residence_proof": "Residence Proof",
    "birth_certificate": "Birth Certificate",
    "income_proof": "Income Proof / Salary Slip",
    "caste_proof": "Community / Caste Proof",
    "age_proof": "Age Proof (10th Certificate / Birth Record)",
    "disability_certificate": "Medical Disability Certificate",
    "id_proof": "Photo ID Proof (Voter ID / PAN)",
    "affidavit": "Self-Declaration Affidavit",
}

DEFAULT_SERVICES = [
    {
        "id": "income_certificate",
        "name": "Income Certificate",
        "category": "Revenue & Welfare",
        "description": "Proof of family annual income for scholarships, fee concessions, and government welfare benefits.",
        "required_documents": ["aadhaar", "ration_card", "electricity_bill", "residence_proof"],
    },
    {
        "id": "domicile_certificate",
        "name": "Domicile Certificate",
        "category": "Citizenship & Residence",
        "description": "Proof of permanent state residency for government jobs, educational admissions, and state quotas.",
        "required_documents": ["aadhaar", "residence_proof", "birth_certificate"],
    },
    {
        "id": "caste_certificate",
        "name": "Caste Certificate",
        "category": "Social Welfare",
        "description": "Official community certification for claiming statutory reservation and affirmative action schemes.",
        "required_documents": ["aadhaar", "ration_card", "residence_proof", "caste_proof"],
    },
    {
        "id": "residence_certificate",
        "name": "Residence Certificate",
        "category": "Citizenship & Residence",
        "description": "Certification of local residential address for municipal services and domestic utility connections.",
        "required_documents": ["aadhaar", "electricity_bill", "ration_card"],
    },
    {
        "id": "birth_certificate",
        "name": "Birth Certificate",
        "category": "Vital Statistics",
        "description": "Official government record of birth registration for identity establishment and school admissions.",
        "required_documents": ["aadhaar", "residence_proof", "birth_certificate"],
    },
    {
        "id": "ews_certificate",
        "name": "Economically Weaker Section (EWS) Certificate",
        "category": "Revenue & Welfare",
        "description": "Eligibility certificate for 10% EWS reservation in central and state educational and employment institutions.",
        "required_documents": ["aadhaar", "income_proof", "residence_proof", "electricity_bill"],
    },
    {
        "id": "senior_citizen_certificate",
        "name": "Senior Citizen Certificate",
        "category": "Social Welfare",
        "description": "Certification for citizens aged 60+ to access public transport concessions and senior citizen welfare benefits.",
        "required_documents": ["aadhaar", "age_proof", "residence_proof"],
    },
    {
        "id": "disability_certificate",
        "name": "Disability Certificate",
        "category": "Health & Empowerment",
        "description": "Medical authority certification for persons with benchmark disabilities to access assistive devices and quotas.",
        "required_documents": ["aadhaar", "disability_certificate", "residence_proof"],
    },
    {
        "id": "character_certificate",
        "name": "Character Certificate",
        "category": "General Administration",
        "description": "Verification of conduct and character for government employment, license applications, and educational admissions.",
        "required_documents": ["aadhaar", "residence_proof", "id_proof"],
    },
    {
        "id": "family_membership_certificate",
        "name": "Family Member Certificate",
        "category": "Revenue & Welfare",
        "description": "Official certificate listing recognized members of a household for family benefits and succession claims.",
        "required_documents": ["aadhaar", "ration_card", "residence_proof", "birth_certificate"],
    },
]

DEFAULT_REQUIREMENTS = {s["id"]: s["required_documents"] for s in DEFAULT_SERVICES}


def seed_defaults_if_empty(db: Session) -> None:
    """Seeds services and default document requirements if not already present."""
    # Seed services
    for s_data in DEFAULT_SERVICES:
        existing_srv = db.query(models.ServiceDefinition).filter(models.ServiceDefinition.id == s_data["id"]).first()
        if not existing_srv:
            db.add(models.ServiceDefinition(
                id=s_data["id"],
                name=s_data["name"],
                category=s_data["category"],
                description=s_data["description"],
                is_active=True,
            ))

    # Seed required documents
    for service_type, doc_types in DEFAULT_REQUIREMENTS.items():
        existing_reqs = db.query(models.RequiredDocument).filter(
            models.RequiredDocument.service_type == service_type
        ).all()
        if not existing_reqs:
            for doc_type in doc_types:
                db.add(models.RequiredDocument(
                    id=str(uuid.uuid4())[:8],
                    service_type=service_type,
                    document_type=doc_type,
                ))
    db.commit()


def get_service_catalog(db: Session, active_only: bool = True) -> List[Dict]:
    """Returns the service catalog with document requirements for each service."""
    query = db.query(models.ServiceDefinition)
    if active_only:
        query = query.filter(models.ServiceDefinition.is_active == True)
    services = query.order_by(models.ServiceDefinition.category.asc(), models.ServiceDefinition.name.asc()).all()

    req_rows = db.query(models.RequiredDocument).all()
    reqs_by_service: Dict[str, List[str]] = {}
    for r in req_rows:
        reqs_by_service.setdefault(r.service_type, []).append(r.document_type)

    result = []
    for s in services:
        doc_keys = reqs_by_service.get(s.id, DEFAULT_REQUIREMENTS.get(s.id, ["aadhaar"]))
        required_docs = [
            {
                "key": d_key,
                "label": DOCUMENT_LABELS.get(d_key, d_key.replace("_", " ").title()),
                "is_required": True,
            }
            for d_key in doc_keys
        ]
        result.append({
            "id": s.id,
            "name": s.name,
            "category": s.category,
            "description": s.description,
            "is_active": s.is_active,
            "required_documents": required_docs,
        })
    return result


def get_required_documents(db: Session, service_type: str) -> List[str]:
    """Returns the list of required document keys for a specific service."""
    rows = db.query(models.RequiredDocument).filter(
        models.RequiredDocument.service_type == service_type
    ).all()
    if rows:
        return [row.document_type for row in rows]
    return DEFAULT_REQUIREMENTS.get(service_type, ["aadhaar"])


def find_missing_documents(db: Session, service_type: str, uploaded_doc_types: List[str]) -> List[str]:
    """Identifies which required documents are missing from the uploaded bundle."""
    required = get_required_documents(db, service_type)
    return [doc for doc in required if doc not in uploaded_doc_types]
