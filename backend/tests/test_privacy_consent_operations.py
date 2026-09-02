import pytest
from fastapi.testclient import TestClient
from app.main import app

def test_privacy_policy_endpoint(raw_client):
    """Verifies public privacy policy and AI scope disclosure."""
    res = raw_client.get("/api/privacy/policy")
    assert res.status_code == 200
    data = res.json()
    assert data["policy_version"] == "2026.1"
    assert "AI assists verification. Final statutory decisions remain with authorized officers." in data["statutory_principle"]
    assert "what_we_collect" in data
    assert "who_can_access" in data
    assert "ai_scope_and_boundaries" in data
    assert len(data["ai_scope_and_boundaries"]["what_ai_never_does"]) >= 3


def test_citizen_consent_lifecycle(raw_client, citizen_token):
    """Tests recording, listing, and withdrawing citizen consent."""
    headers = {"Authorization": f"Bearer {citizen_token}"}
    
    # 1. List initial consents
    res1 = raw_client.get("/api/privacy/consents", headers=headers)
    assert res1.status_code == 200
    consents = res1.json()["consents"]
    assert len(consents) >= 4
    
    # 2. Record explicit consent for notifications
    res2 = raw_client.post(
        "/api/privacy/consents",
        headers=headers,
        json={"purpose": "NOTIFICATIONS", "is_granted": True, "policy_version": "2026.1"},
    )
    assert res2.status_code == 200
    assert res2.json()["is_granted"] is True
    
    # 3. Withdraw optional consent
    res3 = raw_client.post(
        "/api/privacy/consents/withdraw",
        headers=headers,
        json={"purpose": "NOTIFICATIONS"},
    )
    assert res3.status_code == 200
    assert res3.json()["status_text"] == "WITHDRAWN"
    
    # 4. Attempt to withdraw statutory required consent should fail with HTTP 400
    res4 = raw_client.post(
        "/api/privacy/consents/withdraw",
        headers=headers,
        json={"purpose": "APPLICATION_PROCESSING"},
    )
    assert res4.status_code == 400
    assert "required for statutory application processing" in res4.json()["detail"]


def test_system_operations_health(raw_client):
    """Tests real operational health inspection without exposing internal credentials."""
    res = raw_client.get("/api/operations/system-health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ["HEALTHY", "DEGRADED"]
    assert "subsystems" in data
    assert data["subsystems"]["api_server"]["status"] == "HEALTHY"
    assert data["subsystems"]["database"]["status"] == "HEALTHY"
    assert data["subsystems"]["audit_ledger"]["algorithm"] == "SHA-256 Hash Chain"


def test_system_operations_metrics_rbac(raw_client, admin_token, citizen_token):
    """Tests live system operations metrics gathering and RBAC gating."""
    # Citizens should be rejected
    res_cit = raw_client.get("/api/operations/metrics", headers={"Authorization": f"Bearer {citizen_token}"})
    assert res_cit.status_code == 403

    # Admin should receive real database computed metrics
    res_admin = raw_client.get("/api/operations/metrics", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 200
    data = res_admin.json()
    assert "applications" in data
    assert "sla_performance" in data
    assert "grievances" in data
    assert "governance_and_privacy" in data
    assert data["governance_and_privacy"]["active_staff_officers"] >= 2


def test_integration_sandbox_identity_verify(raw_client, admin_token):
    """Tests sandbox identity verification adapter."""
    res = raw_client.post(
        "/api/integration/identity-verify",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Aarav Sharma", "dob": "1990-05-12", "document_number": "1234 5678 9012"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_verified"] is True
    assert data["is_simulation"] is True
    assert "Sandbox" in data["provider"]
