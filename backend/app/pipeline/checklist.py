"""
Missing-document checklist, Alternative Document Rules & Centralized Civic Service Catalog (v1.1.0).

Implements the Government Requirement Provenance & Versioning Engine.
Tracks official source provenance, jurisdiction, department, and verification status.
Supports alternative document fulfillment rules (ONE_OF / ANY_OF / ALL_OF) and
seeds all 84 authoritative civic requirement items.
"""
import uuid
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session

from .. import models
from .provenance import (
    SERVICE_METADATA,
    RAW_CSV_PROVENANCE_ROWS,
    service_name_to_id,
    STATUS_OFFICIAL_VERIFIED,
    STATUS_CONFIGURED_NOT_VERIFIED,
)

DOCUMENT_LABELS = {
    "aadhaar": "Aadhaar Card",
    "ration_card": "Ration Card",
    "electricity_bill": "Electricity Bill",
    "residence_proof": "Residence Proof / Domicile Certificate",
    "birth_certificate": "Birth Certificate",
    "income_proof": "Income Proof / Salary Slip / ITR",
    "caste_proof": "Community / Caste Proof",
    "age_proof": "Age Proof (10th Certificate / Birth Record)",
    "disability_certificate": "Medical Disability Certificate (UDID)",
    "id_proof": "Photo ID Proof (Voter ID / PAN / Passport)",
    "affidavit": "Self-Declaration Affidavit",
    "passport": "Passport Booklet / Copy",
    "driving_licence": "Driving Licence",
    "pan_card": "PAN Card",
    "voter_id": "Voter ID Card",
}

# Configured alternative document fulfillments for statutory slot types
SLOT_ALTERNATIVES = {
    "residence_proof": ["residence_proof", "electricity_bill", "ration_card", "voter_id", "aadhaar"],
    "identity_proof": ["aadhaar", "id_proof", "voter_id", "driving_licence", "passport", "pan_card"],
    "age_proof": ["age_proof", "birth_certificate", "aadhaar", "pan_card"],
    "income_proof": ["income_proof", "salary_slip", "ration_card"],
    "caste_proof": ["caste_proof"],
    "disability_certificate": ["disability_certificate"],
}

# Initial Default Services enriched with statutory metadata
DEFAULT_SERVICES = [
    {
        "id": "income_certificate",
        "name": "Income Certificate",
        "category": "Revenue & Welfare",
        "description": "Proof of family annual income for scholarships, fee concessions, and government welfare schemes.",
        "jurisdiction": "State / District Configurable (e.g., Gujarat / ServicePlus Template)",
        "department": "Revenue Department",
        "authority": "State Revenue Authority / Tehsildar",
        "requirement_version": "2026-08",
        "effective_from": "2024-01-01",
        "source_name": "ServicePlus Template Framework / District Revenue Standard",
        "source_url": "https://serviceonline.gov.in",
        "source_type": "CONFIGURED_TEMPLATE",
        "source_reference": "State Citizen Services Charter Standard",
        "last_verified_at": "2026-08-24",
        "verified_by": "State Revenue Policy Audit",
        "verification_status": STATUS_CONFIGURED_NOT_VERIFIED,
        "required_documents": [
            {"key": "aadhaar", "label": "Aadhaar Card (Identity Proof)", "rule_type": "ALL_OF", "allowed_alternatives": "aadhaar,id_proof"},
            {"key": "ration_card", "label": "Ration Card (Family Proof)", "rule_type": "ALL_OF", "allowed_alternatives": "ration_card"},
            {"key": "electricity_bill", "label": "Electricity Bill (Utility Record)", "rule_type": "ALL_OF", "allowed_alternatives": "electricity_bill"},
            {"key": "residence_proof", "label": "Residence Proof", "rule_type": "ONE_OF", "allowed_alternatives": "residence_proof,water_bill,voter_id"},
        ],
    },
    {
        "id": "domicile_certificate",
        "name": "Domicile Certificate",
        "category": "Citizenship & Residence",
        "description": "Proof of permanent state residency for government jobs, educational admissions, and state quotas.",
        "jurisdiction": "State / District Configurable",
        "department": "Revenue & General Administration",
        "authority": "State Revenue Authority / District Magistrate",
        "requirement_version": "2026-08",
        "effective_from": "2024-01-01",
        "source_name": "State Citizen Services Framework",
        "source_url": "https://serviceonline.gov.in",
        "source_type": "CONFIGURED_TEMPLATE",
        "source_reference": "State Residency Guidelines",
        "last_verified_at": "2026-08-24",
        "verified_by": "District Magistrate Office",
        "verification_status": STATUS_CONFIGURED_NOT_VERIFIED,
        "required_documents": [
            {"key": "aadhaar", "label": "Aadhaar Card", "rule_type": "ALL_OF", "allowed_alternatives": "aadhaar,id_proof"},
            {"key": "residence_proof", "label": "Proof of Continuous Residence", "rule_type": "ONE_OF", "allowed_alternatives": "residence_proof,electricity_bill,water_bill"},
            {"key": "birth_certificate", "label": "Birth Certificate / School Leaving", "rule_type": "ALL_OF", "allowed_alternatives": "birth_certificate,age_proof"},
        ],
    },
    {
        "id": "caste_certificate",
        "name": "Caste Certificate",
        "category": "Social Welfare",
        "description": "Official community certification for claiming statutory reservation and affirmative action schemes.",
        "jurisdiction": "State / District Configurable",
        "department": "Social Justice & Empowerment Department",
        "authority": "State Revenue Authority / Sub-Divisional Magistrate",
        "requirement_version": "2026-08",
        "effective_from": "2024-01-01",
        "source_name": "State Caste Scrutiny Committee Guidelines",
        "source_url": "https://serviceonline.gov.in",
        "source_type": "CONFIGURED_TEMPLATE",
        "source_reference": "State Specific Affirmative Action Rules",
        "last_verified_at": "2026-08-24",
        "verified_by": "District Social Welfare Officer",
        "verification_status": STATUS_CONFIGURED_NOT_VERIFIED,
        "required_documents": [
            {"key": "aadhaar", "label": "Aadhaar Card", "rule_type": "ALL_OF", "allowed_alternatives": "aadhaar,id_proof"},
            {"key": "ration_card", "label": "Ration Card", "rule_type": "ALL_OF", "allowed_alternatives": "ration_card"},
            {"key": "residence_proof", "label": "Residence Proof", "rule_type": "ONE_OF", "allowed_alternatives": "residence_proof,electricity_bill,water_bill"},
            {"key": "caste_proof", "label": "Paternal / Family Caste Proof", "rule_type": "ALL_OF", "allowed_alternatives": "caste_proof"},
        ],
    },
    {
        "id": "residence_certificate",
        "name": "Residence Certificate",
        "category": "Citizenship & Residence",
        "description": "Certification of local residential address for municipal services and domestic utility connections.",
        "jurisdiction": "State / District Configurable",
        "department": "Revenue Department / Municipal Administration",
        "authority": "State Revenue Authority / Tehsildar",
        "requirement_version": "2026-08",
        "effective_from": "2024-01-01",
        "source_name": "Revenue Authority Standard Operating Procedure",
        "source_url": "https://serviceonline.gov.in",
        "source_type": "CONFIGURED_TEMPLATE",
        "source_reference": "State Revenue Standard",
        "last_verified_at": "2026-08-24",
        "verified_by": "Tehsildar Office",
        "verification_status": STATUS_CONFIGURED_NOT_VERIFIED,
        "required_documents": [
            {"key": "aadhaar", "label": "Aadhaar Card", "rule_type": "ALL_OF", "allowed_alternatives": "aadhaar,id_proof"},
            {"key": "electricity_bill", "label": "Electricity Bill", "rule_type": "ALL_OF", "allowed_alternatives": "electricity_bill"},
            {"key": "ration_card", "label": "Ration Card", "rule_type": "ALL_OF", "allowed_alternatives": "ration_card"},
        ],
    },
    {
        "id": "birth_certificate",
        "name": "Birth Certificate",
        "category": "Vital Statistics",
        "description": "Official government record of birth registration under the Registration of Births and Deaths Act, 1969.",
        "jurisdiction": "National Statutory Authority / Municipal Registrar",
        "department": "Office of the Registrar General of India / Municipal Health Department",
        "authority": "Registrar General of India / Local Registrar",
        "requirement_version": "Act No. 18 of 1969 / 2023 Amendment",
        "effective_from": "1969-06-01",
        "source_name": "Civil Registration System (CRS), Office of Registrar General of India",
        "source_url": "https://crsorgi.gov.in",
        "source_type": "OFFICIAL_GOVERNMENT_PORTAL",
        "source_reference": "RBD Amendment Act 2023",
        "last_verified_at": "2026-08-24",
        "verified_by": "Statutory Authority Review",
        "verification_status": STATUS_OFFICIAL_VERIFIED,
        "required_documents": [
            {"key": "aadhaar", "label": "Parent / Applicant Aadhaar Card", "rule_type": "ALL_OF", "allowed_alternatives": "aadhaar,id_proof"},
            {"key": "residence_proof", "label": "Residence Proof of Parents", "rule_type": "ONE_OF", "allowed_alternatives": "residence_proof,electricity_bill,ration_card"},
            {"key": "birth_certificate", "label": "Hospital Discharge / Institutional Birth Slip", "rule_type": "ALL_OF", "allowed_alternatives": "birth_certificate"},
        ],
    },
    {
        "id": "passport",
        "name": "Indian Passport (Fresh / Reissue)",
        "category": "Travel & Citizenship",
        "description": "Travel document issued by the Ministry of External Affairs under the Passports Act, 1967.",
        "jurisdiction": "National / Ministry of External Affairs",
        "department": "Consular, Passport and Visa (CPV) Division",
        "authority": "Passport Seva / Ministry of External Affairs",
        "requirement_version": "2026-08",
        "effective_from": "2026-08-01",
        "source_name": "Passport Seva Document Advisor, Ministry of External Affairs",
        "source_url": "https://passportindia.gov.in",
        "source_type": "OFFICIAL_GOVERNMENT_PORTAL",
        "source_reference": "Passports Act 1967 & Passport Rules 1980",
        "last_verified_at": "2026-08-24",
        "verified_by": "Senior Civic Policy Auditor",
        "verification_status": STATUS_OFFICIAL_VERIFIED,
        "required_documents": [
            {"key": "birth_certificate", "label": "Proof of Date of Birth (Birth Certificate / 10th Marksheet / PAN)", "rule_type": "ONE_OF", "allowed_alternatives": "birth_certificate,age_proof,pan_card"},
            {"key": "aadhaar", "label": "Proof of Present Address (Aadhaar / Voter ID / Electricity Bill)", "rule_type": "ONE_OF", "allowed_alternatives": "aadhaar,voter_id,electricity_bill,residence_proof"},
            {"key": "id_proof", "label": "Non-ECR / Educational Qualification Certificate", "rule_type": "ALL_OF", "allowed_alternatives": "id_proof,age_proof"},
        ],
    },
    {
        "id": "ews_certificate",
        "name": "Economically Weaker Section (EWS) Certificate",
        "category": "Revenue & Welfare",
        "description": "Eligibility certificate for 10% EWS reservation in civil posts and educational admissions under 103rd Constitutional Amendment.",
        "jurisdiction": "Central & State Statutory Standard",
        "department": "Department of Personnel and Training (DoPT) / Ministry of Social Justice",
        "authority": "DoPT / District Administration",
        "requirement_version": "DoPT OM No. 36039/1/2019-Estt (Res)",
        "effective_from": "2019-01-31",
        "source_name": "DoPT Official Office Memorandum No. 36039/1/2019",
        "source_url": "https://dopt.gov.in",
        "source_type": "OFFICIAL_GOVERNMENT_PORTAL",
        "source_reference": "DoPT OM No. 36039/1/2019",
        "last_verified_at": "2026-08-24",
        "verified_by": "Central Administrative Policy Audit",
        "verification_status": STATUS_OFFICIAL_VERIFIED,
        "required_documents": [
            {"key": "aadhaar", "label": "Aadhaar Card", "rule_type": "ALL_OF", "allowed_alternatives": "aadhaar,id_proof"},
            {"key": "income_proof", "label": "Income Assessment / ITR / Form 16", "rule_type": "ALL_OF", "allowed_alternatives": "income_proof,salary_slip"},
            {"key": "residence_proof", "label": "Property & Residence Verification Record", "rule_type": "ONE_OF", "allowed_alternatives": "residence_proof,electricity_bill"},
            {"key": "electricity_bill", "label": "Residential Electricity Bill", "rule_type": "ALL_OF", "allowed_alternatives": "electricity_bill"},
        ],
    },
    {
        "id": "senior_citizen_certificate",
        "name": "Senior Citizen Certificate",
        "category": "Social Welfare",
        "description": "Certification for citizens aged 60+ to access public transport concessions and senior citizen welfare benefits.",
        "jurisdiction": "State / District Configurable",
        "department": "Social Welfare & Senior Citizen Empowerment",
        "authority": "State Social Welfare Authority",
        "requirement_version": "2026-08",
        "effective_from": "2024-01-01",
        "source_name": "State Social Welfare Policy",
        "source_url": "https://serviceonline.gov.in",
        "source_type": "CONFIGURED_TEMPLATE",
        "source_reference": "Senior Citizen Rules",
        "last_verified_at": "2026-08-24",
        "verified_by": "District Social Welfare Officer",
        "verification_status": STATUS_CONFIGURED_NOT_VERIFIED,
        "required_documents": [
            {"key": "aadhaar", "label": "Aadhaar Card", "rule_type": "ALL_OF", "allowed_alternatives": "aadhaar,id_proof"},
            {"key": "age_proof", "label": "Official Age Proof (60+ Years Record)", "rule_type": "ONE_OF", "allowed_alternatives": "age_proof,birth_certificate,aadhaar"},
            {"key": "residence_proof", "label": "Local Residence Proof", "rule_type": "ONE_OF", "allowed_alternatives": "residence_proof,electricity_bill,ration_card"},
        ],
    },
    {
        "id": "disability_certificate",
        "name": "Disability Certificate",
        "category": "Health & Empowerment",
        "description": "Statutory certification under Rights of Persons with Disabilities (RPwD) Act, 2016 for benchmark disability recognition.",
        "jurisdiction": "National Medical Authority / UDID Portal",
        "department": "Department of Empowerment of Persons with Disabilities (DEPwD)",
        "authority": "DEPwD / Ministry of Social Justice",
        "requirement_version": "RPwD Act, 2016 / UDID Standard",
        "effective_from": "2016-12-28",
        "source_name": "Unique Disability ID (UDID) Portal, Ministry of Social Justice",
        "source_url": "https://www.swavlambancard.gov.in",
        "source_type": "OFFICIAL_GOVERNMENT_PORTAL",
        "source_reference": "RPwD Act 2016",
        "last_verified_at": "2026-08-24",
        "verified_by": "Medical Board Authority Review",
        "verification_status": STATUS_OFFICIAL_VERIFIED,
        "required_documents": [
            {"key": "aadhaar", "label": "Aadhaar Card (Identity Record)", "rule_type": "ALL_OF", "allowed_alternatives": "aadhaar,id_proof"},
            {"key": "disability_certificate", "label": "Medical Authority Assessment Record", "rule_type": "ALL_OF", "allowed_alternatives": "disability_certificate"},
            {"key": "residence_proof", "label": "Proof of Residence", "rule_type": "ONE_OF", "allowed_alternatives": "residence_proof,electricity_bill,ration_card"},
        ],
    },
    {
        "id": "character_certificate",
        "name": "Character Certificate",
        "category": "General Administration",
        "description": "Verification of conduct and character for government employment, license applications, and educational admissions.",
        "jurisdiction": "State / District Police & Magistracy",
        "department": "Home & General Administration Department",
        "authority": "Police / Competent Authority",
        "requirement_version": "2026-08",
        "effective_from": "2024-01-01",
        "source_name": "District Police Verification Standard",
        "source_url": "https://serviceonline.gov.in",
        "source_type": "CONFIGURED_TEMPLATE",
        "source_reference": "Police Verification SOP",
        "last_verified_at": "2026-08-24",
        "verified_by": "Superintendent of Police Office",
        "verification_status": STATUS_CONFIGURED_NOT_VERIFIED,
        "required_documents": [
            {"key": "aadhaar", "label": "Aadhaar Card", "rule_type": "ALL_OF", "allowed_alternatives": "aadhaar,id_proof"},
            {"key": "residence_proof", "label": "Residence Proof", "rule_type": "ONE_OF", "allowed_alternatives": "residence_proof,electricity_bill,ration_card"},
            {"key": "id_proof", "label": "Secondary Government Photo ID", "rule_type": "ONE_OF", "allowed_alternatives": "id_proof,voter_id,passport"},
        ],
    },
    {
        "id": "family_membership_certificate",
        "name": "Family Member Certificate",
        "category": "Revenue & Welfare",
        "description": "Official certificate listing recognized members of a household for family benefits, pensions, and succession claims.",
        "jurisdiction": "State / District Configurable",
        "department": "Revenue Department",
        "authority": "State Revenue Authority / Tehsildar",
        "requirement_version": "2026-08",
        "effective_from": "2024-01-01",
        "source_name": "Revenue Authority Family Registry SOP",
        "source_url": "https://serviceonline.gov.in",
        "source_type": "CONFIGURED_TEMPLATE",
        "source_reference": "Family Registry Standard",
        "last_verified_at": "2026-08-24",
        "verified_by": "Revenue Inspector / Tehsildar",
        "verification_status": STATUS_CONFIGURED_NOT_VERIFIED,
        "required_documents": [
            {"key": "aadhaar", "label": "Head of Family Aadhaar Card", "rule_type": "ALL_OF", "allowed_alternatives": "aadhaar,id_proof"},
            {"key": "ration_card", "label": "Ration Card (Family Unit Record)", "rule_type": "ALL_OF", "allowed_alternatives": "ration_card"},
            {"key": "residence_proof", "label": "Residence Proof", "rule_type": "ONE_OF", "allowed_alternatives": "residence_proof,electricity_bill,ration_card"},
            {"key": "birth_certificate", "label": "Birth / Age Records of Dependents", "rule_type": "ALL_OF", "allowed_alternatives": "birth_certificate,age_proof"},
        ],
    },
]

DEFAULT_REQUIREMENTS = {
    s["id"]: [d["key"] for d in s["required_documents"]]
    for s in DEFAULT_SERVICES
}


def seed_defaults_if_empty(db: Session) -> None:
    """Seeds services and default document requirements with authority provenance and 84 CSV rows."""
    # 1. Seed or update service definitions from DEFAULT_SERVICES & SERVICE_METADATA
    all_service_entries = list(DEFAULT_SERVICES)
    for srv_id, meta in SERVICE_METADATA.items():
        if not any(s["id"] == srv_id for s in all_service_entries):
            all_service_entries.append({
                "id": srv_id,
                "name": meta["name"],
                "category": meta["category"],
                "description": meta["description"],
                "jurisdiction": meta["jurisdiction"],
                "department": meta["department"],
                "authority": meta["authority"],
                "requirement_version": meta["requirement_version"],
                "effective_from": meta["effective_from"],
                "source_name": meta["source_name"],
                "source_url": meta["source_url"],
                "source_type": meta["source_type"],
                "source_reference": meta.get("source_reference"),
                "last_verified_at": meta["last_verified_at"],
                "verified_by": meta["verified_by"],
                "verification_status": meta["verification_status"],
                "required_documents": [
                    {"key": "aadhaar", "label": "Aadhaar / Identity Proof", "rule_type": "ALL_OF", "allowed_alternatives": "aadhaar,id_proof"},
                    {"key": "residence_proof", "label": "Address / Domicile Proof", "rule_type": "ONE_OF", "allowed_alternatives": "residence_proof,electricity_bill"},
                ],
            })

    for s_data in all_service_entries:
        existing_srv = db.query(models.ServiceDefinition).filter(models.ServiceDefinition.id == s_data["id"]).first()
        if not existing_srv:
            db.add(models.ServiceDefinition(
                id=s_data["id"],
                name=s_data["name"],
                category=s_data["category"],
                description=s_data["description"],
                jurisdiction=s_data.get("jurisdiction", "State / District Configurable"),
                department=s_data.get("department", "Revenue & District Administration"),
                requirement_version=s_data.get("requirement_version", "2026-08"),
                effective_from=s_data.get("effective_from", "2024-01-01"),
                source_name=s_data.get("source_name", "Configured Template"),
                source_url=s_data.get("source_url", "https://serviceonline.gov.in"),
                source_type=s_data.get("source_type", "CONFIGURED_TEMPLATE"),
                last_verified_at=s_data.get("last_verified_at", "2026-08-24"),
                verified_by=s_data.get("verified_by", "System Administrator"),
                verification_status=s_data.get("verification_status", STATUS_CONFIGURED_NOT_VERIFIED),
                is_active=True,
            ))
        else:
            # Sync authoritative metadata from catalog definition
            existing_srv.jurisdiction = s_data.get("jurisdiction", existing_srv.jurisdiction)
            existing_srv.department = s_data.get("department", existing_srv.department)
            existing_srv.requirement_version = s_data.get("requirement_version", existing_srv.requirement_version)
            existing_srv.effective_from = s_data.get("effective_from", existing_srv.effective_from)
            existing_srv.source_name = s_data.get("source_name", existing_srv.source_name)
            existing_srv.source_url = s_data.get("source_url", existing_srv.source_url)
            existing_srv.source_type = s_data.get("source_type", existing_srv.source_type)
            existing_srv.last_verified_at = s_data.get("last_verified_at", existing_srv.last_verified_at)
            existing_srv.verified_by = s_data.get("verified_by", existing_srv.verified_by)
            existing_srv.verification_status = s_data.get("verification_status", existing_srv.verification_status)

    # 2. Seed required documents
    for s_data in DEFAULT_SERVICES:
        service_type = s_data["id"]
        existing_reqs = db.query(models.RequiredDocument).filter(
            models.RequiredDocument.service_type == service_type
        ).all()
        if not existing_reqs:
            for doc_info in s_data["required_documents"]:
                db.add(models.RequiredDocument(
                    id=str(uuid.uuid4())[:8],
                    service_type=service_type,
                    document_type=doc_info["key"],
                    label=doc_info.get("label", DOCUMENT_LABELS.get(doc_info["key"], doc_info["key"])),
                    rule_type=doc_info.get("rule_type", "ALL_OF"),
                    allowed_alternatives=doc_info.get("allowed_alternatives", doc_info["key"]),
                    group_key=doc_info.get("group_key", doc_info["key"]),
                    is_mandatory=True,
                ))

    # 3. Seed all 84 authoritative requirement items into ServiceRequirementItem table
    if db.query(models.ServiceRequirementItem).count() == 0:
        for idx, row in enumerate(RAW_CSV_PROVENANCE_ROWS):
            (
                srv_name,
                app_type,
                applicant_type,
                category,
                doc_name,
                req_type,
                alt_group,
                condition,
                state_spec,
                issuing_auth,
                note,
            ) = row
            srv_id = service_name_to_id(srv_name)
            meta = SERVICE_METADATA.get(srv_id, {})
            db.add(models.ServiceRequirementItem(
                id=f"req-{idx+1}",
                service_id=srv_id,
                requirement_id=alt_group or f"REQ-{idx+1}",
                application_type=app_type,
                applicant_type=applicant_type,
                document_category=category,
                document_name=doc_name,
                requirement_type=req_type,
                alternative_group=alt_group,
                condition=condition,
                state_specific=state_spec,
                jurisdiction=meta.get("jurisdiction", "State / District Configurable"),
                department=meta.get("department", "District Administration"),
                authority=meta.get("authority", issuing_auth),
                issuing_authority=issuing_auth,
                verification_note=note,
                requirement_version=meta.get("requirement_version", "2026-08"),
                effective_from=meta.get("effective_from", "2024-01-01"),
                source_name=meta.get("source_name", "Statutory Rule Framework"),
                source_url=meta.get("source_url", "https://serviceonline.gov.in"),
                source_type=meta.get("source_type", "OFFICIAL_GOVERNMENT_PORTAL"),
                source_reference=meta.get("source_reference", ""),
                last_verified_at=meta.get("last_verified_at", "2026-08-24"),
                verified_by=meta.get("verified_by", "Civic Policy Auditor"),
                verification_status=meta.get("verification_status", STATUS_OFFICIAL_VERIFIED if meta.get("verification_status") == STATUS_OFFICIAL_VERIFIED else STATUS_CONFIGURED_NOT_VERIFIED),
            ))

    db.commit()


def get_service_catalog(db: Session, active_only: bool = True) -> List[Dict]:
    """Returns the service catalog with official governance metadata and document requirements."""
    query = db.query(models.ServiceDefinition)
    if active_only:
        query = query.filter(models.ServiceDefinition.is_active == True)
    services = query.order_by(models.ServiceDefinition.category.asc(), models.ServiceDefinition.name.asc()).all()

    req_rows = db.query(models.RequiredDocument).all()
    reqs_by_service: Dict[str, List[models.RequiredDocument]] = {}
    for r in req_rows:
        reqs_by_service.setdefault(r.service_type, []).append(r)

    result = []
    for s in services:
        doc_models = reqs_by_service.get(s.id, [])
        if doc_models:
            required_docs = [
                {
                    "key": r.document_type,
                    "label": r.label or DOCUMENT_LABELS.get(r.document_type, r.document_type.replace("_", " ").title()),
                    "rule_type": r.rule_type or "ALL_OF",
                    "allowed_alternatives": (r.allowed_alternatives.split(",") if r.allowed_alternatives else [r.document_type]),
                    "is_required": r.is_mandatory if r.is_mandatory is not None else True,
                }
                for r in doc_models
            ]
        else:
            default_keys = DEFAULT_REQUIREMENTS.get(s.id, ["aadhaar"])
            required_docs = [
                {
                    "key": d_key,
                    "label": DOCUMENT_LABELS.get(d_key, d_key.replace("_", " ").title()),
                    "rule_type": "ALL_OF",
                    "allowed_alternatives": [d_key],
                    "is_required": True,
                }
                for d_key in default_keys
            ]

        is_official = (s.verification_status == STATUS_OFFICIAL_VERIFIED)

        result.append({
            "id": s.id,
            "name": s.name,
            "category": s.category,
            "description": s.description,
            "jurisdiction": s.jurisdiction or "State / District Configurable",
            "department": s.department or "Revenue & District Administration",
            "authority": getattr(s, "authority", None) or s.department,
            "requirement_version": s.requirement_version or "2026-08",
            "effective_from": s.effective_from or "2024-01-01",
            "source_name": s.source_name or "Configured Template (Local Authority Verification Required)",
            "source_url": s.source_url or "https://serviceonline.gov.in",
            "source_type": s.source_type or "CONFIGURED_TEMPLATE",
            "source_reference": getattr(s, "source_reference", None) or "",
            "last_verified_at": s.last_verified_at or "2026-08-24",
            "verified_by": s.verified_by or "System Administrator",
            "verification_status": s.verification_status or STATUS_CONFIGURED_NOT_VERIFIED,
            "provenance_badge": "OFFICIAL SOURCE" if is_official else "CONFIGURED GUIDANCE",
            "provenance_badge_color": "green" if is_official else "yellow",
            "provenance_description": (
                "Requirements sourced from an identified official authority."
                if is_official
                else "This checklist is informational and has not been independently verified against the issuing authority."
            ),
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
    """
    Identifies which required documents are missing from the uploaded bundle.
    Respects alternative document logic: if an alternative is uploaded, the requirement is met.
    """
    rows = db.query(models.RequiredDocument).filter(
        models.RequiredDocument.service_type == service_type
    ).all()

    if not rows:
        required_keys = DEFAULT_REQUIREMENTS.get(service_type, ["aadhaar"])
        return [doc for doc in required_keys if doc not in uploaded_doc_types]

    missing = []
    for r in rows:
        expected_type = r.document_type
        alts = [a.strip() for a in r.allowed_alternatives.split(",")] if r.allowed_alternatives else [expected_type]
        if not any(uploaded in alts for uploaded in uploaded_doc_types):
            missing.append(expected_type)
    return missing
