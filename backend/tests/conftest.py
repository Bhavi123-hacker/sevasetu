import os
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

TEST_DB_PATH = Path(__file__).parent / "test.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import app
from app.auth import clear_failed_attempts

OFFICER_PASSWORD = os.getenv("OFFICER_DEMO_PASSWORD", "officer-demo-pass")
ADMIN_PASSWORD = os.getenv("ADMIN_DEMO_PASSWORD", "admin-demo-pass")


@pytest.fixture
def raw_client():
    return TestClient(app)


@pytest.fixture
def citizen_token(raw_client):
    clear_failed_attempts("citizen1")
    r = raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Rahul Kumar",
        "phone_number": "+919876500001",
        "password": "citizen-test-pass",
    })
    if r.status_code == 200:
        return r.json()["access_token"]
    login_r = raw_client.post("/api/auth/citizen/login", json={
        "phone_number": "+919876500001",
        "password": "citizen-test-pass",
    })
    return login_r.json()["access_token"]


@pytest.fixture
def client(citizen_token):
    return TestClient(app, headers={"Authorization": f"Bearer {citizen_token}"})


@pytest.fixture
def officer_token(raw_client):
    clear_failed_attempts("officer1")
    r = raw_client.post("/api/auth/login", json={"username": "officer1", "password": OFFICER_PASSWORD})
    return r.json()["access_token"]


@pytest.fixture
def admin_token(raw_client):
    clear_failed_attempts("admin1")
    r = raw_client.post("/api/auth/login", json={"username": "admin1", "password": ADMIN_PASSWORD})
    return r.json()["access_token"]
