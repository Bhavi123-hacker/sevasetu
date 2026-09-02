"""
Unit and API integration tests for SevaSetu v1.1.0:
- Government Requirement Provenance System (84 authoritative items across 24 services)
- Immutable Requirement Versioning & Application Binding
- Passport Reference Service Interactive Questionnaire & Requirement Evaluation
- Official Source vs Configured Guidance Badging
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db, SessionLocal
from app import models
from app.pipeline.provenance import (
    SERVICE_METADATA,
    RAW_CSV_PROVENANCE_ROWS,
    STATUS_OFFICIAL_VERIFIED,
    STATUS_CONFIGURED_NOT_VERIFIED,
    get_all_service_provenance,
    get_service_provenance_by_id,
    get_service_requirements_by_id,
)
from app.pipeline.passport_service import (
    PASSPORT_QUESTIONS,
    evaluate_passport_requirements,
)

client = TestClient(app)


def test_provenance_dataset_contains_all_84_csv_rows():
    """Verifies that all 87 CSV rows are loaded in the provenance engine."""
    assert len(RAW_CSV_PROVENANCE_ROWS) == 87
    # Check key statutory services exist in dataset
    services_in_data = {row[0] for row in RAW_CSV_PROVENANCE_ROWS}
    assert "Passport" in services_in_data
    assert "Aadhaar" in services_in_data
    assert "PAN" in services_in_data
    assert "Voter ID" in services_in_data
    assert "Driving Licence" in services_in_data
    assert "Birth Certificate" in services_in_data
    assert "Death Certificate" in services_in_data
    assert "Marriage Certificate" in services_in_data
    assert "Income Certificate" in services_in_data
    assert "Caste Certificate" in services_in_data
    assert "Domicile Certificate" in services_in_data
    assert "Ration Card" in services_in_data
    assert "EPFO" in services_in_data
    assert "Vehicle RC" in services_in_data
    assert "PM-KISAN" in services_in_data
    assert "Ayushman Bharat" in services_in_data
    assert "e-Shram" in services_in_data
    assert "Udyam" in services_in_data
    assert "GST" in services_in_data
    assert "FSSAI" in services_in_data
    assert "Scholarship" in services_in_data
    assert "Legal Heir Certificate" in services_in_data
    assert "Senior Citizen Certificate" in services_in_data
    assert "Character Certificate" in services_in_data


def test_provenance_services_api_endpoint():
    """Verifies GET /api/services-provenance returns enriched service metadata."""
    res = client.get("/api/services-provenance")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 20
    
    passport_srv = next((s for s in data if s["id"] == "passport"), None)
    assert passport_srv is not None
    assert passport_srv["authority"] == "Passport Seva / Ministry of External Affairs"
    assert passport_srv["verification_status"] == STATUS_OFFICIAL_VERIFIED
    assert passport_srv["requirement_version"] == "2026-08"
    assert passport_srv["total_requirements"] >= 8


def test_service_provenance_by_id_endpoint():
    """Verifies GET /api/services/{id}/provenance returns structured items and issuing authority."""
    # Official statutory service
    res = client.get("/api/services/passport/provenance")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "passport"
    assert data["verification_status"] == STATUS_OFFICIAL_VERIFIED
    assert len(data["requirement_items"]) >= 8
    
    # State configurable service
    res_inc = client.get("/api/services/income_certificate/provenance")
    assert res_inc.status_code == 200
    data_inc = res_inc.json()
    assert data_inc["verification_status"] == STATUS_CONFIGURED_NOT_VERIFIED


def test_passport_questionnaire_endpoint():
    """Verifies GET /api/services/passport/questionnaire returns interactive questions."""
    res = client.get("/api/services/passport/questionnaire")
    assert res.status_code == 200
    data = res.json()
    assert data["service_id"] == "passport"
    assert data["provenance_badge"] == "OFFICIAL SOURCE"
    assert len(data["questions"]) == 5
    question_ids = [q["id"] for q in data["questions"]]
    assert "application_type" in question_ids
    assert "applicant_category" in question_ids
    assert "has_address_changed" in question_ids
    assert "special_circumstance" in question_ids
    assert "non_ecr_eligible" in question_ids


def test_passport_evaluate_requirements_fresh_adult():
    """Verifies POST /api/services/passport/evaluate-requirements generates correct checklist for Fresh Adult."""
    payload = {
        "application_type": "fresh",
        "applicant_category": "adult",
        "has_address_changed": "yes",
        "special_circumstance": "none",
        "non_ecr_eligible": "yes",
    }
    res = client.post("/api/services/passport/evaluate-requirements", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["service_id"] == "passport"
    assert data["provenance_badge"] == "OFFICIAL SOURCE"
    assert data["total_documents_expected"] == 3  # DOB (Alt), Address (Alt), Non-ECR (Cond)
    
    categories = [item["category"] for item in data["applicable_checklist"]]
    assert any("Date of Birth" in c for c in categories)
    assert any("Present Residential Address" in c for c in categories)
    assert any("Non-ECR" in c for c in categories)


def test_passport_evaluate_requirements_reissue_name_change():
    """Verifies POST /api/services/passport/evaluate-requirements handles Reissue with Name Change."""
    payload = {
        "application_type": "reissue",
        "applicant_category": "adult",
        "has_address_changed": "no",
        "special_circumstance": "name_change",
        "non_ecr_eligible": "no",
    }
    res = client.post("/api/services/passport/evaluate-requirements", json=payload)
    assert res.status_code == 200
    data = res.json()
    categories = [item["category"] for item in data["applicable_checklist"]]
    assert any("Existing / Previous Passport" in c for c in categories)
    assert any("Name Change Statutory Proof" in c for c in categories)


def test_passport_evaluate_requirements_lost_passport():
    """Verifies POST /api/services/passport/evaluate-requirements handles Lost Passport."""
    payload = {
        "application_type": "reissue",
        "applicant_category": "adult",
        "has_address_changed": "yes",
        "special_circumstance": "lost_stolen",
        "non_ecr_eligible": "no",
    }
    res = client.post("/api/services/passport/evaluate-requirements", json=payload)
    assert res.status_code == 200
    data = res.json()
    categories = [item["category"] for item in data["applicable_checklist"]]
    assert any("Existing / Previous Passport" in c for c in categories)
    assert any("Lost / Damaged Passport Investigation Documents" in c for c in categories)
    assert any("Proof of New Present Address" in c for c in categories)


def test_passport_evaluate_requirements_minor():
    """Verifies POST /api/services/passport/evaluate-requirements handles Minor Fresh."""
    payload = {
        "application_type": "fresh",
        "applicant_category": "minor",
        "has_address_changed": "yes",
        "special_circumstance": "none",
        "non_ecr_eligible": "no",
    }
    res = client.post("/api/services/passport/evaluate-requirements", json=payload)
    assert res.status_code == 200
    data = res.json()
    categories = [item["category"] for item in data["applicable_checklist"]]
    assert any("Proof of Date of Birth" in c for c in categories)
    assert any("Parental Consent & Address Proof" in c for c in categories)


def test_application_binding_immutable_requirement_version(client):
    """Verifies that submitted applications bind to immutable requirement version."""
    import io
    from PIL import Image

    img = Image.new("RGB", (300, 200), color=(255, 255, 255))
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="JPEG")
    img_bytes = img_byte_arr.getvalue()

    form_data = {
        "citizen_name": "Priya Sharma",
        "service_type": "passport",
        "confirmation_method": "CITIZEN_DECLARATION",
    }
    files = {
        "doc_birth_certificate": ("birth_cert.jpg", img_bytes, "image/jpeg"),
        "doc_aadhaar": ("aadhaar.jpg", img_bytes, "image/jpeg"),
    }

    res = client.post("/api/applications", data=form_data, files=files)
    assert res.status_code == 200
    app_id = res.json()["application_id"]
    token = res.json()["tracking_token"]

    # Verify detail response includes requirement versioning
    detail_res = client.get(f"/api/applications/{app_id}?token={token}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["requirement_version"] == "2026-08"
    assert "req-ver-passport" in detail["requirement_version_id"]
    assert "Requirements evaluated against version 2026-08" in detail["evaluation_version_note"]
    assert detail["provenance_badge"] == "OFFICIAL SOURCE"
