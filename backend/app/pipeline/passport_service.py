"""
SevaSetu Reference Service: Indian Passport Discovery & Applicable Requirement Evaluation.

Authoritative document advisor grounded in official Ministry of External Affairs (MEA)
Passport Seva guidelines and Passports Act, 1967 rules.
"""
from typing import Dict, List, Optional, Any
from .provenance import SERVICE_METADATA, get_service_requirements_by_id, STATUS_OFFICIAL_VERIFIED

PASSPORT_QUESTIONS = [
    {
        "id": "application_type",
        "question": "What type of passport application are you applying for?",
        "options": [
            {"value": "fresh", "label": "Fresh Passport (Never had an Indian passport before)"},
            {"value": "reissue", "label": "Reissue of Passport (Already have / had an Indian passport)"},
        ],
        "default": "fresh",
    },
    {
        "id": "applicant_category",
        "question": "What is the age category of the applicant?",
        "options": [
            {"value": "adult", "label": "Adult (18 years of age or older)"},
            {"value": "minor", "label": "Minor (Below 18 years of age)"},
        ],
        "default": "adult",
    },
    {
        "id": "has_address_changed",
        "question": "Is there a change in your current residential address or is this a fresh address?",
        "options": [
            {"value": "yes", "label": "Yes, present address needs verification"},
            {"value": "no", "label": "No change (same as existing records)"},
        ],
        "default": "yes",
    },
    {
        "id": "special_circumstance",
        "question": "Do any of the following special circumstances apply to your application?",
        "options": [
            {"value": "none", "label": "Standard Application (No name change, damage, or loss)"},
            {"value": "name_change", "label": "Change in Name / Surname (Post-marriage, adoption, or gazette change)"},
            {"value": "lost_stolen", "label": "Passport Lost / Stolen / Damaged beyond recognition"},
        ],
        "default": "none",
    },
    {
        "id": "non_ecr_eligible",
        "question": "Are you eligible for Non-ECR (Emigration Check Not Required) category?",
        "help_text": "Matriculation (10th standard) pass certificate holders, degree holders, taxpayers, or persons above 50 years qualify for Non-ECR.",
        "options": [
            {"value": "yes", "label": "Yes (Have passed Class 10 / Matriculation or higher qualification)"},
            {"value": "no", "label": "No / Not Applicable"},
        ],
        "default": "yes",
    },
]


def evaluate_passport_requirements(answers: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates applicant answers against authoritative Passport Seva rules and generates
    the custom applicable document checklist.
    """
    app_type = answers.get("application_type", "fresh")
    category = answers.get("applicant_category", "adult")
    address_check = answers.get("has_address_changed", "yes") == "yes"
    special = answers.get("special_circumstance", "none")
    non_ecr = answers.get("non_ecr_eligible", "yes") == "yes"

    passport_meta = SERVICE_METADATA["passport"]
    raw_reqs = get_service_requirements_by_id("passport")

    checklist = []

    # 1. Fresh Application Workflow
    if app_type == "fresh":
        if category == "adult":
            # Date of Birth Proof (Alternative group DOB-01)
            checklist.append({
                "category": "Proof of Date of Birth (DOB)",
                "requirement_type": "Alternative",
                "alternative_group": "DOB-01",
                "primary_document": "Birth Certificate (issued by Registrar of Births & Deaths)",
                "allowed_alternatives": [
                    "Birth Certificate issued by Municipal Authority / CRS",
                    "Matriculation / Secondary School Leaving Certificate (10th Standard)",
                    "PAN Card issued by Income Tax Department with printed DOB",
                    "Driving Licence containing Date of Birth",
                ],
                "mandatory": True,
                "reason": "Statutory verification of age and birth eligibility under Passports Act, 1967.",
                "issuing_authority": "Registrar of Births / CBSE / Income Tax Department",
                "condition": "Provide any ONE valid accepted document from this group.",
                "verification_note": "Special date-of-birth rules apply for applicants born on or after 26-01-1989.",
            })

            # Present Address Proof (Alternative group ADDR-01)
            checklist.append({
                "category": "Proof of Present Residential Address",
                "requirement_type": "Alternative",
                "alternative_group": "ADDR-01",
                "primary_document": "Aadhaar Card (with current residential address)",
                "allowed_alternatives": [
                    "Aadhaar Card / e-Aadhaar with matching present address",
                    "Electors Photo Identity Card (Voter ID Card)",
                    "Electricity Bill (Recent utility bill in applicant's name / parent's name)",
                    "Registered Rent Agreement (Valid for more than 1 year duration)",
                    "Passbook of running Bank Account with photo (Scheduled Public/Private Bank)",
                ],
                "mandatory": True,
                "reason": "Required for police jurisdictional verification and address record.",
                "issuing_authority": "UIDAI / ECI / State Electricity Distribution Company",
                "condition": "Provide any ONE valid accepted present-address document.",
                "verification_note": "Must establish continuous stay at present address for at least the last 1 year.",
            })

            # Non-ECR Proof (if applicable)
            if non_ecr:
                checklist.append({
                    "category": "Non-ECR Category Evidence",
                    "requirement_type": "Conditional",
                    "alternative_group": "NON-ECR-01",
                    "primary_document": "Matriculation (10th Pass) / Higher Educational Degree Certificate",
                    "allowed_alternatives": [
                        "Class 10 (Matriculation) Pass Certificate / Marksheet",
                        "Graduation / Post-Graduation Degree Certificate",
                        "Income Tax Assessment Order / ITR Proof of last 1 year",
                    ],
                    "mandatory": False,
                    "reason": "Exempts holder from Emigration Check requirements when travelling abroad for employment.",
                    "issuing_authority": "Recognized Educational Board / University / Income Tax Department",
                    "condition": "Required only if applicant claims Non-ECR status.",
                    "verification_note": "If not submitted, passport will be stamped with ECR (Emigration Check Required).",
                })

        else:  # Minor Fresh
            checklist.append({
                "category": "Proof of Date of Birth (DOB)",
                "requirement_type": "Required",
                "alternative_group": "DOB-MIN-01",
                "primary_document": "Birth Certificate issued by Registrar of Births and Deaths",
                "allowed_alternatives": ["Official Birth Certificate with child & parent names"],
                "mandatory": True,
                "reason": "Compulsory birth proof for all minor applicants under Passport Rules.",
                "issuing_authority": "Registrar of Births and Deaths",
                "condition": "Mandatory for all minor applicants.",
                "verification_note": "Must reflect both parents' names matching their identity records.",
            })
            checklist.append({
                "category": "Parental Consent & Address Proof",
                "requirement_type": "Required",
                "alternative_group": "POR-MIN-01",
                "primary_document": "Annexure 'D' / 'C' Parental Declaration & Parent's Passport Copies",
                "allowed_alternatives": ["Valid Passport copy of Father / Mother", "Aadhaar Card of Parent with current address"],
                "mandatory": True,
                "reason": "Statutory parental consent for minor passport issuance.",
                "issuing_authority": "Passport Seva / Parents",
                "condition": "Both parents must consent or statutory single-parent Annexure C must be executed.",
                "verification_note": "Minor's present address proof can be supported by parents' address documents.",
            })

    # 2. Reissue Application Workflow
    else:
        checklist.append({
            "category": "Existing / Previous Passport",
            "requirement_type": "Required",
            "alternative_group": "PASSPORT-OLD-01",
            "primary_document": "Original Old Passport (First two and last two pages self-attested)",
            "allowed_alternatives": ["Original booklet with ECR/Non-ECR observation page"],
            "mandatory": True,
            "reason": "Required for physical cancellation and validation of existing booklet.",
            "issuing_authority": "Passport Seva / Regional Passport Office",
            "condition": "Must present original booklet at Passport Seva Kendra (PSK/POPSK).",
            "verification_note": "If passport validity expired more than 3 years ago, fresh police verification will apply.",
        })

        if address_check:
            checklist.append({
                "category": "Proof of New Present Address",
                "requirement_type": "Required",
                "alternative_group": "ADDR-01",
                "primary_document": "Aadhaar Card / Electricity Bill with updated residential address",
                "allowed_alternatives": ["Aadhaar", "Voter ID", "Electricity Bill", "Registered Rent Agreement"],
                "mandatory": True,
                "reason": "Required because residential address has changed from the previous passport.",
                "issuing_authority": "UIDAI / ECI / State Utility",
                "condition": "Must establish present residency at the new address.",
                "verification_note": "Police verification will be initiated for new jurisdictional location.",
            })

        if special == "name_change":
            checklist.append({
                "category": "Name Change Statutory Proof",
                "requirement_type": "Conditional",
                "alternative_group": "NAME-01",
                "primary_document": "Official Gazette Notification of Name Change / Marriage Certificate",
                "allowed_alternatives": [
                    "Gazette Notification published in Union / State Official Gazette",
                    "Registered Marriage Certificate with spouse name endorsement",
                    "Two original newspaper advertisements (one daily English, one local vernacular)",
                ],
                "mandatory": True,
                "reason": "Statutory requirement to record official change of name under Passport Rules.",
                "issuing_authority": "Department of Publication / Marriage Registrar",
                "condition": "Mandatory for name change cases.",
                "verification_note": "Newspaper clippings must contain complete advertisement with date and paper name.",
            })
        elif special == "lost_stolen":
            checklist.append({
                "category": "Lost / Damaged Passport Investigation Documents",
                "requirement_type": "Conditional",
                "alternative_group": "LOST-01",
                "primary_document": "Police FIR / Lost Article Report & Annexure 'F' Affidavit",
                "allowed_alternatives": [
                    "Certified Police Report with GD/FIR Number",
                    "Sworn Affidavit (Annexure F) stating circumstances of passport loss",
                ],
                "mandatory": True,
                "reason": "Security protocol to prevent unauthorized duplication and misuse of lost travel documents.",
                "issuing_authority": "Local Police Station / Executive Magistrate",
                "condition": "Mandatory when original passport booklet is unavailable.",
                "verification_note": "Detailed enquiry may be conducted by Regional Passport Office prior to issuance.",
            })

    return {
        "service_id": "passport",
        "service_name": "Indian Passport",
        "application_type": app_type,
        "applicant_category": category,
        "jurisdiction": passport_meta["jurisdiction"],
        "department": passport_meta["department"],
        "authority": passport_meta["authority"],
        "requirement_version": passport_meta["requirement_version"],
        "effective_from": passport_meta["effective_from"],
        "source_name": passport_meta["source_name"],
        "source_url": passport_meta["source_url"],
        "verification_status": passport_meta["verification_status"],
        "provenance_badge": "OFFICIAL SOURCE",
        "provenance_description": "Requirements sourced from official Ministry of External Affairs (MEA) Passport Seva guidelines.",
        "disclaimer": "Informational document checklist advisor. Automated pre-verification only. Final issuance decision rests exclusively with the authorized Passport Officer (MEA).",
        "applicable_checklist": checklist,
        "total_documents_expected": len(checklist),
    }
