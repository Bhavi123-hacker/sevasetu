"""
Eligibility Guidance Engine for SevaSetu.
Provides explainable indicative guidance based on configured service rules.
Does not claim or make legal eligibility determinations.
"""
from typing import Dict, Any, List, Optional
from pydantic import BaseModel


class EligibilityRuleItem(BaseModel):
    key: str
    label: str
    operator: str  # GTE, LTE, EQ, IN
    value: Any
    guidance: str
    mandatory_for_guidance: bool = False


class EligibilityEvaluationResult(BaseModel):
    service_type: str
    guidance_status: str  # POTENTIALLY_RELEVANT | MORE_INFORMATION_REQUIRED | NOT_ENOUGH_INFORMATION
    is_indicatively_matched: bool
    matching_criteria: List[str]
    unmatched_criteria: List[str]
    missing_criteria: List[str]
    guidance_notes: List[str]
    provenance_source: str
    provenance_url: str
    verification_status: str
    disclaimer: str = (
        "This is preliminary guidance based on configured rules. "
        "Final eligibility is determined by the competent government authority."
    )


# Configured indicative eligibility rules by service type with provenance
SERVICE_ELIGIBILITY_RULES: Dict[str, Dict[str, Any]] = {
    "income_certificate": {
        "rules": [
            EligibilityRuleItem(
                key="state",
                label="State Jurisdiction",
                operator="EQ",
                value="Gujarat",  # configurable template
                guidance="Configured for state revenue jurisdiction. Inter-state applicants require local tehsildar assessment.",
                mandatory_for_guidance=False,
            ),
            EligibilityRuleItem(
                key="annual_income",
                label="Maximum Household Income Threshold",
                operator="LTE",
                value=800000.0,
                guidance="Typically issued for household income thresholds under ₹8,00,000 per annum for scheme benefits.",
                mandatory_for_guidance=True,
            ),
        ],
        "source_name": "Digital Gujarat Revenue Services Template",
        "source_url": "https://www.digitalgujarat.gov.in",
        "verification_status": "CONFIGURED_NOT_VERIFIED",
    },
    "domicile_certificate": {
        "rules": [
            EligibilityRuleItem(
                key="resident_years",
                label="Minimum Continuous Residence",
                operator="GTE",
                value=10,
                guidance="Requires continuous residence proof in the state for a minimum period (commonly 10+ years).",
                mandatory_for_guidance=True,
            ),
        ],
        "source_name": "State Revenue Department Domicile Rules",
        "source_url": "https://serviceonline.gov.in",
        "verification_status": "CONFIGURED_NOT_VERIFIED",
    },
    "caste_certificate": {
        "rules": [
            EligibilityRuleItem(
                key="category",
                label="Recognized Social Category",
                operator="IN",
                value=["SC", "ST", "OBC", "SEBC", "EWS"],
                guidance="Applicant must belong to a constitutionally recognized community listed in the state/central gazette.",
                mandatory_for_guidance=True,
            ),
        ],
        "source_name": "Ministry of Social Justice & Empowerment Guidelines",
        "source_url": "https://socialjustice.gov.in",
        "verification_status": "OFFICIAL_VERIFIED",
    },
    "senior_citizen_certificate": {
        "rules": [
            EligibilityRuleItem(
                key="age",
                label="Minimum Age",
                operator="GTE",
                value=60,
                guidance="Applicant must have completed 60 years of age on the date of application.",
                mandatory_for_guidance=True,
            ),
        ],
        "source_name": "Maintenance and Welfare of Parents and Senior Citizens Act",
        "source_url": "https://socialjustice.gov.in",
        "verification_status": "OFFICIAL_VERIFIED",
    },
    "disability_certificate": {
        "rules": [
            EligibilityRuleItem(
                key="has_disability",
                label="Medical Assessment Requirement",
                operator="EQ",
                value=True,
                guidance="Requires assessment by a designated government medical board / civil hospital authority.",
                mandatory_for_guidance=True,
            ),
        ],
        "source_name": "Rights of Persons with Disabilities (RPwD) Act Guidelines",
        "source_url": "https://disabilityaffairs.gov.in",
        "verification_status": "OFFICIAL_VERIFIED",
    },
    "ews_certificate": {
        "rules": [
            EligibilityRuleItem(
                key="category",
                label="Social Category Exclusion",
                operator="EQ",
                value="General",
                guidance="EWS reservation applies exclusively to candidates not covered under SC/ST/OBC categories.",
                mandatory_for_guidance=True,
            ),
            EligibilityRuleItem(
                key="annual_income",
                label="Maximum Annual Gross Income",
                operator="LTE",
                value=800000.0,
                guidance="Gross family annual income must be below ₹8,00,000 from all sources.",
                mandatory_for_guidance=True,
            ),
        ],
        "source_name": "Department of Personnel and Training (DoPT) OM No. 36039/1/2019-Estt (Res)",
        "source_url": "https://dopt.gov.in",
        "verification_status": "OFFICIAL_VERIFIED",
    },
    "birth_certificate": {
        "rules": [
            EligibilityRuleItem(
                key="event_registered",
                label="Institutional/Panchayat Birth Record",
                operator="EQ",
                value=True,
                guidance="Application applies for issuance/correction of birth record registered within the local municipal body.",
                mandatory_for_guidance=False,
            ),
        ],
        "source_name": "Registration of Births and Deaths Act (RBD)",
        "source_url": "https://crsorgi.gov.in",
        "verification_status": "OFFICIAL_VERIFIED",
    },
    "residence_certificate": {
        "rules": [
            EligibilityRuleItem(
                key="resident_years",
                label="Proof of Local Address",
                operator="GTE",
                value=1,
                guidance="Requires current active residence proof (utility bill, voter slip, or registered rent agreement).",
                mandatory_for_guidance=False,
            ),
        ],
        "source_name": "Revenue Department Guidelines",
        "source_url": "https://serviceonline.gov.in",
        "verification_status": "CONFIGURED_NOT_VERIFIED",
    },
    "character_certificate": {
        "rules": [
            EligibilityRuleItem(
                key="no_pending_criminal_cases",
                label="Clean Police Verification",
                operator="EQ",
                value=True,
                guidance="Subject to jurisdictional police verification report.",
                mandatory_for_guidance=False,
            ),
        ],
        "source_name": "State Police Verification Service Template",
        "source_url": "https://serviceonline.gov.in",
        "verification_status": "CONFIGURED_NOT_VERIFIED",
    },
    "family_membership_certificate": {
        "rules": [
            EligibilityRuleItem(
                key="ration_card_available",
                label="Family Card / Ration Card Verification",
                operator="EQ",
                value=True,
                guidance="Issued based on verification of joint ration card or family register.",
                mandatory_for_guidance=False,
            ),
        ],
        "source_name": "Civil Supplies & Revenue Service Template",
        "source_url": "https://serviceonline.gov.in",
        "verification_status": "CONFIGURED_NOT_VERIFIED",
    },
}


def evaluate_eligibility(service_type: str, user_criteria: Dict[str, Any]) -> EligibilityEvaluationResult:
    """
    Evaluates citizen's submitted criteria against configured indicative rules.
    Returns explainable guidance without making legal assertions.
    """
    config = SERVICE_ELIGIBILITY_RULES.get(service_type)
    if not config:
        return EligibilityEvaluationResult(
            service_type=service_type,
            guidance_status="NOT_ENOUGH_INFORMATION",
            is_indicatively_matched=False,
            matching_criteria=[],
            unmatched_criteria=[],
            missing_criteria=[],
            guidance_notes=["No specific indicative eligibility rules configured for this service."],
            provenance_source="Configured General Template",
            provenance_url="https://serviceonline.gov.in",
            verification_status="CONFIGURED_NOT_VERIFIED",
        )

    rules: List[EligibilityRuleItem] = config["rules"]
    matching: List[str] = []
    unmatched: List[str] = []
    missing: List[str] = []
    notes: List[str] = []

    for rule in rules:
        if rule.key not in user_criteria or user_criteria[rule.key] is None or user_criteria[rule.key] == "":
            missing.append(f"{rule.label} (Not provided)")
            continue

        user_val = user_criteria[rule.key]
        is_pass = False

        if rule.operator == "EQ":
            is_pass = str(user_val).strip().lower() == str(rule.value).strip().lower()
        elif rule.operator == "GTE":
            try:
                is_pass = float(user_val) >= float(rule.value)
            except (ValueError, TypeError):
                is_pass = False
        elif rule.operator == "LTE":
            try:
                is_pass = float(user_val) <= float(rule.value)
            except (ValueError, TypeError):
                is_pass = False
        elif rule.operator == "IN":
            if isinstance(rule.value, list):
                is_pass = str(user_val).strip().upper() in [str(x).upper() for x in rule.value]

        if is_pass:
            matching.append(f"{rule.label}: Matches criteria")
            notes.append(f"✓ {rule.guidance}")
        else:
            unmatched.append(f"{rule.label}: Value '{user_val}' may not satisfy standard threshold")
            notes.append(f"ℹ {rule.guidance}")

    # Determine guidance status
    if len(missing) == len(rules):
        status = "NOT_ENOUGH_INFORMATION"
    elif len(unmatched) > 0:
        status = "MORE_INFORMATION_REQUIRED"
    elif len(missing) > 0:
        status = "MORE_INFORMATION_REQUIRED"
    else:
        status = "POTENTIALLY_RELEVANT"

    is_matched = len(unmatched) == 0 and len(matching) > 0

    return EligibilityEvaluationResult(
        service_type=service_type,
        guidance_status=status,
        is_indicatively_matched=is_matched,
        matching_criteria=matching,
        unmatched_criteria=unmatched,
        missing_criteria=missing,
        guidance_notes=notes,
        provenance_source=config["source_name"],
        provenance_url=config["source_url"],
        verification_status=config["verification_status"],
    )
