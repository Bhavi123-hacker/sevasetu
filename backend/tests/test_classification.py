import pytest
from app.pipeline.classifier import classify_document_type, ClassificationResult, DOCUMENT_RULES

def test_aadhaar_classification_match():
    ocr_text = """
    GOVERNMENT OF INDIA
    Unique Identification Authority of India
    Mera Aadhaar Meri Pehchan
    Name: Rahul Kumar
    DOB: 12-05-1998
    Gender: Male
    Aadhaar No: 4821 9920 1102
    """
    result = classify_document_type(ocr_text, expected_type="aadhaar")
    assert result.status == "MATCH"
    assert result.detected_type == "aadhaar"
    assert result.confidence >= 0.70
    assert result.is_valid_for_slot is True
    assert len(result.evidence) > 0


def test_birth_certificate_in_aadhaar_slot_mismatch():
    ocr_text = """
    MUNICIPAL CORPORATION OF DELHI
    REGISTRATION OF BIRTHS AND DEATHS
    BIRTH CERTIFICATE — FORM NO. 5
    Date of Birth: 12-05-1998
    Place of Birth: City Hospital
    Name of Father: Suresh Kumar
    Name of Mother: Sunita Devi
    Registrar of Births
    """
    result = classify_document_type(ocr_text, expected_type="aadhaar")
    assert result.status == "MISMATCH"
    assert result.detected_type == "birth_certificate"
    assert result.confidence >= 0.70
    assert result.is_valid_for_slot is False
    assert any("Birth Certificate" in ev or "birth" in ev.lower() for ev in result.evidence)


def test_electricity_bill_in_aadhaar_slot_mismatch():
    ocr_text = """
    TAMIL NADU GENERATION AND DISTRIBUTION CORPORATION (TANGEDCO)
    ELECTRICITY BILL — CONSUMER COPY
    Consumer No: 04-201-992
    Units Consumed: 240 kWh
    Meter No: MTR-9921
    Tariff: LT-1A Domestic
    Bill Date: 15-08-2026
    Due Date: 30-08-2026
    Amount Payable: Rs. 1420
    """
    result = classify_document_type(ocr_text, expected_type="aadhaar")
    assert result.status == "MISMATCH"
    assert result.detected_type == "electricity_bill"
    assert result.is_valid_for_slot is False


def test_electricity_bill_in_residence_proof_slot_accepted():
    ocr_text = """
    POWER DISTRIBUTION CORPORATION
    ELECTRICITY BILL
    Consumer No: CA-88210
    Units Consumed: 180 kWh
    Address: 12 MG Road, Vellore
    """
    result = classify_document_type(ocr_text, expected_type="residence_proof")
    assert result.status in ["MATCH", "LIKELY_MATCH"]
    assert result.detected_type == "electricity_bill"
    assert result.is_valid_for_slot is True


def test_ration_card_classification():
    ocr_text = """
    DEPARTMENT OF FOOD & CIVIL SUPPLIES
    PUBLIC DISTRIBUTION SYSTEM — STATE RATION CARD
    Card Type: BPL Card (NFSA)
    Card No: RC-992140
    Head of Family: Rahul Kumar
    Family Members: 4
    Monthly Quota: 20 KG Rice, 5 KG Wheat
    Fair Price Shop: FPS-104
    """
    result = classify_document_type(ocr_text, expected_type="ration_card")
    assert result.status == "MATCH"
    assert result.detected_type == "ration_card"
    assert result.is_valid_for_slot is True


def test_income_proof_classification():
    ocr_text = """
    GOVERNMENT OF TAMIL NADU — REVENUE DEPARTMENT
    INCOME CERTIFICATE
    Annual Family Income: Rs. 1,80,000 (One Lakh Eighty Thousand Only)
    Financial Year: 2025-2026
    Employer / Source: Private Service
    Gross Salary: Rs. 2,00,000
    """
    result = classify_document_type(ocr_text, expected_type="income_proof")
    assert result.status == "MATCH"
    assert result.detected_type == "income_proof"
    assert result.is_valid_for_slot is True


def test_caste_proof_classification():
    ocr_text = """
    REVENUE DEPARTMENT — COMMUNITY CERTIFICATE
    CASTE CERTIFICATE
    This is to certify that Rahul Kumar belongs to Scheduled Caste
    Under Constitution (Scheduled Castes) Order 1950.
    Sub-caste: Adi Dravida
    """
    result = classify_document_type(ocr_text, expected_type="caste_proof")
    assert result.status == "MATCH"
    assert result.detected_type == "caste_proof"
    assert result.is_valid_for_slot is True


def test_disability_certificate_classification():
    ocr_text = """
    DISTRICT MEDICAL BOARD
    DISABILITY CERTIFICATE
    Percentage of Disability: 45% Benchmark Disability
    Category: Locomotor Disability
    Permanent Disability assessed by Chief Medical Officer (CMO)
    """
    result = classify_document_type(ocr_text, expected_type="disability_certificate")
    assert result.status == "MATCH"
    assert result.detected_type == "disability_certificate"
    assert result.is_valid_for_slot is True


def test_empty_document():
    result = classify_document_type("", expected_type="aadhaar")
    assert result.status == "MISMATCH"
    assert result.detected_type == "empty"
    assert result.is_valid_for_slot is False


def test_uncertain_noisy_document():
    ocr_text = "The quick brown fox jumps over the lazy dog 12345."
    result = classify_document_type(ocr_text, expected_type="aadhaar")
    assert result.status == "UNCERTAIN"
    assert result.is_valid_for_slot is False
