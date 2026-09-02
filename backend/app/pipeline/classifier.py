"""
Document Type Verification & Classification Engine.

Analyzes raw OCR text to independently classify the uploaded document type,
preventing citizens from uploading incorrect documents into required slots.
Uses deterministic, weighted multi-evidence rules (primary headers, statutory
phrases, regex patterns, secondary keywords, and slot alias mappings).
"""
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

DOCUMENT_RULES = {
    "aadhaar": {
        "label": "Aadhaar Card",
        "primary_signatures": [
            (r"\baadhaar\b", 40, "Aadhaar keyword identified"),
            (r"\buidai\b", 40, "UIDAI statutory authority identified"),
            (r"unique identification", 35, "Unique Identification Authority signature"),
            (r"mera aadhaar meri pehchan", 35, "Aadhaar national motto"),
            (r"\b\d{4}\s\d{4}\s\d{4}\b", 30, "12-digit Aadhaar number format"),
            (r"government of india\b.*aadhaar", 45, "Government of India Aadhaar header"),
        ],
        "secondary_keywords": [
            ("enrollment no", 15, "Enrollment number field"),
            ("vid:", 15, "Virtual ID field"),
            ("dob", 10, "Date of birth field"),
            ("year of birth", 10, "Year of birth field"),
            ("male", 5, "Gender field"),
            ("female", 5, "Gender field"),
            ("help@uidai", 15, "UIDAI support contact"),
        ],
        "negative_signatures": [
            (r"birth certificate|certificate of birth|registration of births", 35, "Opposing Birth Certificate header"),
            (r"electricity bill\b|electric bill|discom|consumer ca no", 35, "Opposing Electricity Bill header"),
            (r"ration card|public distribution system", 35, "Opposing Ration Card header"),
        ],
    },
    "ration_card": {
        "label": "Ration Card",
        "primary_signatures": [
            (r"\bration card\b", 45, "Ration card keyword identified"),
            (r"food (?:and|&) civil supplies", 40, "Department of Food & Civil Supplies header"),
            (r"public distribution system|\bpds\b", 35, "Public Distribution System signature"),
            (r"fair price shop|\bfps\b", 30, "Fair Price Shop reference"),
            (r"antyodaya|bpl card|apl card|nfsa", 35, "NFSA/PDS card category identifier"),
        ],
        "secondary_keywords": [
            ("head of family", 15, "Head of Family member field"),
            ("card no", 15, "Ration card number"),
            ("family members", 15, "Family member details"),
            ("monthly quota", 15, "Food grain quota details"),
            ("gas connection", 10, "LPG connection status"),
            ("consumer", 5, "Consumer detail"),
        ],
        "negative_signatures": [
            (r"government of india.*aadhaar|unique identification authority", 35, "Opposing Aadhaar header"),
            (r"birth certificate|certificate of birth", 35, "Opposing Birth Certificate header"),
        ],
    },
    "electricity_bill": {
        "label": "Electricity Bill",
        "primary_signatures": [
            (r"electricity bill\b|electric bill", 45, "Electricity bill header"),
            (r"power (?:distribution|corporation|supply|transmission)|discom", 40, "Power utility Discom signature"),
            (r"consumer no\b|consumer number|ca no\b|ca number", 35, "Consumer CA account number"),
            (r"units consumed|kwh|meter reading", 35, "Meter electricity consumption metric"),
            (r"tariff|connected load|sanctioned load", 25, "Electrical tariff specification"),
        ],
        "secondary_keywords": [
            ("bill date", 10, "Bill billing date"),
            ("due date", 10, "Payment due date"),
            ("meter no", 15, "Meter serial number"),
            ("energy charges", 15, "Energy charges line item"),
            ("sub-division", 10, "Discom sub-division office"),
            ("amount payable", 10, "Total amount payable"),
        ],
        "negative_signatures": [
            (r"government of india.*aadhaar|unique identification authority", 35, "Opposing Aadhaar header"),
            (r"birth certificate|certificate of birth", 35, "Opposing Birth Certificate header"),
        ],
    },
    "birth_certificate": {
        "label": "Birth Certificate",
        "primary_signatures": [
            (r"birth certificate|certificate of birth", 50, "Birth certificate official header"),
            (r"registration of births|births (?:and|&) deaths", 40, "Registration of Births & Deaths Act header"),
            (r"form (?:no\.?\s*)?5\b", 35, "Form No. 5 statutory vital statistics"),
            (r"place of birth", 30, "Place of birth field"),
            (r"registrar (?:of )?births", 35, "Registrar of Births authority"),
        ],
        "secondary_keywords": [
            ("date of birth", 15, "Date of birth specification"),
            ("name of father", 15, "Father's name vital record"),
            ("name of mother", 15, "Mother's name vital record"),
            ("hospital", 10, "Hospital / Institutional birth record"),
            ("registration no", 15, "Birth registration serial number"),
            ("municipal corporation", 15, "Municipal vital statistics department"),
        ],
        "negative_signatures": [
            (r"electricity bill\b|electric bill|consumer ca no", 35, "Opposing Electricity Bill header"),
            (r"ration card|public distribution system", 35, "Opposing Ration Card header"),
        ],
    },
    "residence_proof": {
        "label": "Residence Proof / Domicile Certificate",
        "primary_signatures": [
            (r"certificate of residence|residence certificate|proof of residence", 45, "Residence certificate title"),
            (r"domicile certificate|certificate of domicile", 45, "Domicile certificate header"),
            (r"ordinarily resident|permanent resident", 35, "Statutory resident declaration"),
            (r"tahasildar|tehsildar|revenue department|taluk office", 30, "Revenue authority signatory"),
            (r"sub-divisional magistrate|\bsdm\b", 30, "Magisterial residence verification"),
        ],
        "secondary_keywords": [
            ("resident of", 15, "Resident location clause"),
            ("village", 10, "Village territorial specification"),
            ("district", 10, "District administrative specification"),
            ("state of", 10, "State jurisdiction"),
            ("address", 10, "Residential address record"),
        ],
        "negative_signatures": [],
    },
    "caste_proof": {
        "label": "Caste / Community Certificate",
        "primary_signatures": [
            (r"caste certificate|community certificate", 50, "Caste / Community certificate header"),
            (r"scheduled caste|scheduled tribe|other backward class|\bobc\b|\bsc/st\b", 45, "Statutory constitutional category designation"),
            (r"constitution \((?:scheduled|order)", 40, "Presidential Order reference"),
            (r"belongs to the .* (?:caste|community|tribe)", 35, "Statutory caste membership declaration"),
        ],
        "secondary_keywords": [
            ("sub-caste", 15, "Sub-caste specification"),
            ("resolution no", 15, "Government resolution Gazette notification"),
            ("revenue officer", 15, "Issuing Revenue Officer authority"),
            ("ordinarily resides", 10, "Residential nexus clause"),
        ],
        "negative_signatures": [],
    },
    "income_proof": {
        "label": "Income Proof / Certificate",
        "primary_signatures": [
            (r"income certificate|certificate of income", 50, "Income certificate header"),
            (r"salary slip|payslip|pay slip", 45, "Salary slip compensation record"),
            (r"form 16|income tax return|\bitr\b", 45, "ITR Form 16 financial verification"),
            (r"annual income|family income", 35, "Annual family income declaration"),
            (r"gross salary|net salary|basic pay", 35, "Salary compensation breakdown"),
        ],
        "secondary_keywords": [
            ("financial year", 15, "Financial Year specification"),
            ("assessment year", 15, "Assessment Year specification"),
            ("employer", 15, "Employer establishment details"),
            ("deductions", 10, "Tax and statutory deductions"),
            ("rupees", 10, "Monetary amount denomination"),
        ],
        "negative_signatures": [],
    },
    "age_proof": {
        "label": "Age Proof (10th / School Record)",
        "primary_signatures": [
            (r"school leaving certificate|transfer certificate|\btc\b", 45, "School leaving education certificate"),
            (r"secondary school examination|matriculation certificate|10th (?:standard|class|board)", 45, "10th board age proof"),
            (r"board of secondary education|cbse|icse", 35, "Education Board authority"),
            (r"certificate of age|age certificate", 45, "Official age certification"),
        ],
        "secondary_keywords": [
            ("date of birth", 15, "Date of birth declaration"),
            ("roll no", 15, "Board roll number"),
            ("school name", 10, "Educational institution"),
            ("passed", 10, "Examination passing record"),
        ],
        "negative_signatures": [],
    },
    "disability_certificate": {
        "label": "Disability Certificate",
        "primary_signatures": [
            (r"disability certificate|certificate of disability", 50, "Disability certificate title"),
            (r"medical board|district medical board", 45, "Medical Board authority signature"),
            (r"percentage of disability|disability percentage", 40, "Statutory disability percentage assessment"),
            (r"benchmark disability|rights of persons with disabilities", 40, "RPwD Act statutory specification"),
        ],
        "secondary_keywords": [
            ("locomotor", 15, "Locomotor disability category"),
            ("visual impairment|blindness", 15, "Visual disability category"),
            ("hearing impairment", 15, "Hearing impairment category"),
            ("permanent disability", 15, "Permanence specification"),
            ("chief medical officer|\bcmo\b", 15, "Chief Medical Officer signature"),
        ],
        "negative_signatures": [],
    },
    "id_proof": {
        "label": "Photo ID Proof (Voter ID / PAN)",
        "primary_signatures": [
            (r"election commission of india|elector photo identity card|\bepic\b|voter id", 50, "Election Commission Voter ID header"),
            (r"income tax department.*permanent account number|\bpan card\b|\bpan\b", 50, "Income Tax Department PAN card header"),
            (r"driving licence|driving license", 45, "Motor Vehicles Driving Licence"),
            (r"passport.*republic of india", 45, "Passport Republic of India"),
        ],
        "secondary_keywords": [
            ("father's name", 10, "Parent name detail"),
            ("signature", 10, "Cardholder signature"),
            ("epic no", 20, "Voter EPIC number"),
            ("permanent account number", 20, "PAN number"),
        ],
        "negative_signatures": [],
    },
}

# Mapping of acceptable document types for flexible / composite slot types
SLOT_ACCEPTABLE_TYPES: Dict[str, List[str]] = {
    "aadhaar": ["aadhaar"],
    "ration_card": ["ration_card"],
    "electricity_bill": ["electricity_bill"],
    "residence_proof": ["residence_proof", "electricity_bill", "ration_card", "aadhaar"],
    "birth_certificate": ["birth_certificate"],
    "caste_proof": ["caste_proof"],
    "income_proof": ["income_proof"],
    "age_proof": ["age_proof", "birth_certificate", "aadhaar"],
    "disability_certificate": ["disability_certificate"],
    "id_proof": ["id_proof", "aadhaar"],
    "affidavit": ["affidavit", "residence_proof"],
}


@dataclass
class ClassificationResult:
    expected_type: str
    detected_type: str
    confidence: float  # 0.0 to 1.0
    status: str  # MATCH | LIKELY_MATCH | UNCERTAIN | MISMATCH
    evidence: List[str] = field(default_factory=list)
    is_valid_for_slot: bool = True
    authenticity_disclaimer: str = "Automated pre-verification only. Official authenticity has not been independently verified."
    is_authentic_verified: bool = False


def classify_document_type(raw_text: str, expected_type: str) -> ClassificationResult:
    """
    Independently verifies the document type against the expected slot type.
    Uses positive evidence signatures, negative counter-signatures, and structural cues.
    """
    clean_text = raw_text.strip().lower()
    if not clean_text:
        return ClassificationResult(
            expected_type=expected_type,
            detected_type="empty",
            confidence=0.0,
            status="MISMATCH",
            evidence=["Document contains no readable text."],
            is_valid_for_slot=False,
        )

    scores: Dict[str, Tuple[int, List[str]]] = {}

    for doc_type, rule in DOCUMENT_RULES.items():
        doc_score = 0
        doc_evidence = []

        # Check primary signatures (regex patterns)
        for pattern, weight, desc in rule["primary_signatures"]:
            if re.search(pattern, clean_text, re.IGNORECASE):
                doc_score += weight
                doc_evidence.append(desc)

        # Check secondary keywords
        for keyword, weight, desc in rule["secondary_keywords"]:
            if keyword in clean_text:
                doc_score += weight
                doc_evidence.append(desc)

        # Apply negative counter-signatures
        for pattern, neg_weight, desc in rule.get("negative_signatures", []):
            if re.search(pattern, clean_text, re.IGNORECASE):
                doc_score = max(0, doc_score - neg_weight)

        scores[doc_type] = (doc_score, doc_evidence)

    # Sort candidates by score descending
    sorted_scores = sorted(scores.items(), key=lambda x: x[1][0], reverse=True)
    top_type, (top_score, top_evidence) = sorted_scores[0]
    second_score = sorted_scores[1][1][0] if len(sorted_scores) > 1 else 0

    # Minimum threshold to claim any confident detection
    MIN_DETECTION_SCORE = 20

    if top_score < MIN_DETECTION_SCORE:
        return ClassificationResult(
            expected_type=expected_type,
            detected_type="unknown",
            confidence=round(max(0.1, top_score / 100.0), 2),
            status="UNCERTAIN",
            evidence=["No conclusive document-type signatures recognized in OCR text."],
            is_valid_for_slot=False,
        )

    # Calculate confidence ratio
    confidence = round(min(0.99, max(0.45, top_score / (top_score + second_score + 10.0))), 2)

    acceptable_types = SLOT_ACCEPTABLE_TYPES.get(expected_type, [expected_type])

    # Case 1: Exact expected match or acceptable alias
    if top_type == expected_type or top_type in acceptable_types:
        if confidence >= 0.65:
            status = "MATCH"
        else:
            status = "LIKELY_MATCH"
        
        evidence = top_evidence
        if top_type != expected_type:
            evidence = [f"{DOCUMENT_RULES.get(top_type, {}).get('label', top_type)} recognized as valid {expected_type}."] + evidence

        return ClassificationResult(
            expected_type=expected_type,
            detected_type=top_type,
            confidence=confidence,
            status=status,
            evidence=evidence,
            is_valid_for_slot=True,
        )

    # Case 2: Clear mismatch with strong confidence
    if confidence >= 0.50 and top_score >= 30:
        expected_label = DOCUMENT_RULES.get(expected_type, {}).get("label", expected_type)
        detected_label = DOCUMENT_RULES.get(top_type, {}).get("label", top_type)
        return ClassificationResult(
            expected_type=expected_type,
            detected_type=top_type,
            confidence=confidence,
            status="MISMATCH",
            evidence=[f"Document appears to be {detected_label} instead of {expected_label}."] + top_evidence,
            is_valid_for_slot=False,
        )

    # Case 3: Ambiguous or weak signals across document types
    return ClassificationResult(
        expected_type=expected_type,
        detected_type=top_type,
        confidence=confidence,
        status="UNCERTAIN",
        evidence=[f"Inconclusive signatures for {expected_type}; possible {top_type}."] + top_evidence,
        is_valid_for_slot=False,
    )
