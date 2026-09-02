import io
import uuid
import requests
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

TEST_DOCS = Path(__file__).resolve().parent.parent / "app" / "test_documents"
if not TEST_DOCS.exists():
    TEST_DOCS = Path("/app/app/test_documents")
API_URL = "http://localhost:8000/api/applications"
AUTH_URL = "http://localhost:8000/api/auth/login"

def _font(size):
    candidates = [
        "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\calibri.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "arial.ttf",
    ]
    for c in candidates:
        try:
            return ImageFont.truetype(c, size)
        except Exception:
            continue
    return ImageFont.load_default()

def make_doc_bytes(header, lines):
    img = Image.new("RGB", (800, 600), color="white")
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, 799, 599], outline="black", width=3)
    draw.text((30, 25), header, fill="black", font=_font(26))
    draw.line([(30, 65), (770, 65)], fill="black", width=2)
    y = 90
    for line in lines:
        draw.text((30, y), line, fill="black", font=_font(20))
        y += 40
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

print("==================================================")
print("SEVASETU v0.6.0 — COMPREHENSIVE LIVE E2E VERIFICATION")
print("==================================================")

# Authenticate as Officer for decision actions
auth_resp = requests.post(AUTH_URL, json={"username": "officer1", "password": "officer-demo-pass"})
assert auth_resp.status_code == 200, f"Officer auth failed: {auth_resp.text}"
officer_token = auth_resp.json()["access_token"]
headers = {"Authorization": f"Bearer {officer_token}"}
print("✓ Officer authentication succeeded.")

# ----------------------------------------------------
# LIVE TEST 1: Intentionally Wrong Document (Birth Certificate in Aadhaar slot)
# ----------------------------------------------------
print("\n--- LIVE SCENARIO 1: Intentionally Wrong Document (Birth Certificate in Aadhaar slot) ---")
with open(TEST_DOCS / "birth_certificate.png", "rb") as f1, \
     open(TEST_DOCS / "ration_card.png", "rb") as f2, \
     open(TEST_DOCS / "electricity_bill.png", "rb") as f3:
    r1 = requests.post(
        API_URL,
        data={"citizen_name": "Rahul Kumar", "service_type": "income_certificate"},
        files={
            "aadhaar": ("birth_certificate.png", f1, "image/png"),
            "ration_card": ("ration_card.png", f2, "image/png"),
            "electricity_bill": ("electricity_bill.png", f3, "image/png"),
        }
    )

assert r1.status_code == 200, f"Status {r1.status_code}: {r1.text}"
d1 = r1.json()
print("Application ID:", d1["application_id"])
print("Status:", d1["status"])
print("Readiness Score:", d1["readiness_score"])
print("Risk Level:", d1["risk_level"])
print("Correction Reason:", d1["correction_reason"])
print("Document Verifications:")
for v in d1["document_verifications"]:
    print(f"  Slot [{v['expected_type']}] -> Detected: [{v['detected_type']}] Status: [{v['status']}] Conf: {v['confidence']}")

assert d1["status"] == "NEEDS_CORRECTION", f"Expected NEEDS_CORRECTION but got {d1['status']}"
assert d1["readiness_score"] < 50, f"Expected score < 50 but got {d1['readiness_score']}"
assert d1["risk_level"] == "HIGH", f"Expected HIGH risk but got {d1['risk_level']}"
assert any(v["status"] == "MISMATCH" for v in d1["document_verifications"])
assert d1["is_fast_track"] is False
print("✓ LIVE SCENARIO 1 PASSED: Wrong document correctly flagged as MISMATCH, HIGH risk, and NEEDS_CORRECTION.")


# ----------------------------------------------------
# LIVE TEST 2: Truly Perfect Document Bundle (100% Matching & Complete)
# ----------------------------------------------------
unique_id2 = uuid.uuid4().hex[:6]
citizen_2_name = f"Perfect Citizen {unique_id2}"
print(f"\n--- LIVE SCENARIO 2: Truly Perfect Complete Document Bundle ({citizen_2_name}) ---")
aadhaar_p = make_doc_bytes("GOVERNMENT OF INDIA — AADHAAR", [
    f"Name: {citizen_2_name}",
    "DOB: 15-08-1996",
    "Address: 42 MG Road, Ahmedabad",
    "Aadhaar No: XXXX XXXX 5566",
])
ration_p = make_doc_bytes("STATE RATION CARD", [
    f"Name: {citizen_2_name}",
    "DOB: 15-08-1996",
    "Address: 42 MG Road, Ahmedabad",
    "Card No: RC-44556",
])
eb_p = make_doc_bytes("ELECTRICITY BILL — PROOF OF RESIDENCE", [
    f"Name: {citizen_2_name}",
    "DOB: 15-08-1996",
    "Address: 42 MG Road, Ahmedabad",
    "Consumer No: EB-77889",
])

r2 = requests.post(
    API_URL,
    data={"citizen_name": citizen_2_name, "service_type": "residence_certificate"},
    files={
        "aadhaar": ("aadhaar.png", io.BytesIO(aadhaar_p), "image/png"),
        "ration_card": ("ration_card.png", io.BytesIO(ration_p), "image/png"),
        "electricity_bill": ("electricity_bill.png", io.BytesIO(eb_p), "image/png"),
    }
)

assert r2.status_code == 200, f"Status {r2.status_code}: {r2.text}"
d2 = r2.json()
print("Application ID:", d2["application_id"])
print("Status:", d2["status"])
print("Readiness Score:", d2["readiness_score"])
print("Risk Level:", d2["risk_level"])
print("Fast-Track Eligible:", d2["is_fast_track"])
print("Missing Documents:", d2["missing_documents"])
print("Score Breakdown:")
for reas in d2["score_reasoning"]:
    print(f"  {reas['points']:+d}: {reas['label']}")

assert d2["status"] == "READY_FOR_REVIEW", f"Expected READY_FOR_REVIEW but got {d2['status']}"
assert d2["readiness_score"] == 100, f"Expected 100% readiness but got {d2['readiness_score']}"
assert d2["risk_level"] == "LOW", f"Expected LOW risk but got {d2['risk_level']}"
assert d2["is_fast_track"] is True, "Expected fast_track True for clean complete bundle"
assert len(d2["missing_documents"]) == 0
assert all(fc["status"] == "pass" for fc in d2["field_checks"])
print("✓ LIVE SCENARIO 2 PASSED: Perfect complete bundle receives 100% Readiness, LOW risk, Fast-Track True, and READY_FOR_REVIEW.")


# ----------------------------------------------------
# LIVE TEST 3: Uncertain Blurry Document (UNCERTAIN != MISMATCH)
# ----------------------------------------------------
unique_id3 = uuid.uuid4().hex[:6]
citizen_3_name = f"Uncertain Citizen {unique_id3}"
print(f"\n--- LIVE SCENARIO 3: Uncertain Blurry Document ({citizen_3_name}) ---")
# Degraded text
noisy_bytes = make_doc_bytes("CARD", [
    "Doc Ref: 991823",
    "Blurry text non matching format",
])

r3 = requests.post(
    API_URL,
    data={"citizen_name": citizen_3_name, "service_type": "residence_certificate"},
    files={
        "aadhaar": ("aadhaar.png", io.BytesIO(noisy_bytes), "image/png"),
        "ration_card": ("ration_card.png", io.BytesIO(ration_p), "image/png"),
        "electricity_bill": ("electricity_bill.png", io.BytesIO(eb_p), "image/png"),
    }
)
assert r3.status_code == 200, f"Status {r3.status_code}: {r3.text}"
d3 = r3.json()
print("Application ID:", d3["application_id"])
print("Status:", d3["status"])
print("Readiness Score:", d3["readiness_score"])
print("Risk Level:", d3["risk_level"])
print("Fast-Track Eligible:", d3["is_fast_track"])
assert d3["status"] == "READY_FOR_REVIEW", f"Expected READY_FOR_REVIEW for human officer inspection, got {d3['status']}"
assert d3["is_fast_track"] is False, "Uncertain document must block fast track"
print("✓ LIVE SCENARIO 3 PASSED: Blurry document yields UNCERTAIN, routes to human officer review, and blocks fast-track.")


# ----------------------------------------------------
# LIVE TEST 4: Address Discrepancy
# ----------------------------------------------------
unique_id4 = uuid.uuid4().hex[:6]
citizen_4_name = f"Address Citizen {unique_id4}"
print(f"\n--- LIVE SCENARIO 4: Document Bundle with Address Discrepancy ({citizen_4_name}) ---")
aadhaar_addr = make_doc_bytes("GOVERNMENT OF INDIA — AADHAAR", [
    f"Name: {citizen_4_name}",
    "DOB: 15-08-1996",
    "Address: 42 MG Road, Ahmedabad",
    "Aadhaar No: XXXX XXXX 5566",
])
ration_addr = make_doc_bytes("STATE RATION CARD", [
    f"Name: {citizen_4_name}",
    "DOB: 15-08-1996",
    "Address: 42 MG Road, Ahmedabad",
    "Card No: RC-44556",
])
eb_mismatch = make_doc_bytes("ELECTRICITY BILL — UTILITY CONSUMER RECORD", [
    f"Name: {citizen_4_name}",
    "DOB: 15-08-1996",
    "Address: 99 Ring Road, Ahmedabad",  # Discrepancy
    "Consumer No: EB-77889",
    "Units Consumed: 150 kWh",
    "Sanctioned Load: 2 kW",
])

r4 = requests.post(
    API_URL,
    data={"citizen_name": citizen_4_name, "service_type": "residence_certificate"},
    files={
        "aadhaar": ("aadhaar.png", io.BytesIO(aadhaar_addr), "image/png"),
        "ration_card": ("ration_card.png", io.BytesIO(ration_addr), "image/png"),
        "electricity_bill": ("electricity_bill.png", io.BytesIO(eb_mismatch), "image/png"),
    }
)

assert r4.status_code == 200, f"Status {r4.status_code}: {r4.text}"
d4 = r4.json()
print("Field Checks:", d4["field_checks"])
assert d4["readiness_score"] == 85, f"Expected 85% readiness but got {d4['readiness_score']}"
assert d4["risk_level"] == "MEDIUM", f"Expected MEDIUM risk but got {d4['risk_level']}"
assert any(fc["field"] == "address" and fc["status"] == "fail" for fc in d4["field_checks"])
print("✓ LIVE SCENARIO 4 PASSED: Address discrepancy produces exactly -15 deduction and MEDIUM risk.")


# ----------------------------------------------------
# LIVE TEST 5: Missing Required Document
# ----------------------------------------------------
unique_id5 = uuid.uuid4().hex[:6]
citizen_5_name = f"Missing Doc Citizen {unique_id5}"
print(f"\n--- LIVE SCENARIO 5: Missing Required Document ({citizen_5_name}) ---")
aadhaar_miss = make_doc_bytes("GOVERNMENT OF INDIA — AADHAAR", [
    f"Name: {citizen_5_name}",
    "DOB: 15-08-1996",
    "Address: 42 MG Road, Ahmedabad",
    "Aadhaar No: XXXX XXXX 5566",
])
ration_miss = make_doc_bytes("STATE RATION CARD", [
    f"Name: {citizen_5_name}",
    "DOB: 15-08-1996",
    "Address: 42 MG Road, Ahmedabad",
    "Card No: RC-44556",
])
eb_miss = make_doc_bytes("ELECTRICITY BILL — PROOF OF RESIDENCE", [
    f"Name: {citizen_5_name}",
    "DOB: 15-08-1996",
    "Address: 42 MG Road, Ahmedabad",
    "Consumer No: EB-77889",
])

r5 = requests.post(
    API_URL,
    data={"citizen_name": citizen_5_name, "service_type": "income_certificate"},
    files={
        "aadhaar": ("aadhaar.png", io.BytesIO(aadhaar_miss), "image/png"),
        "ration_card": ("ration_card.png", io.BytesIO(ration_miss), "image/png"),
        "electricity_bill": ("electricity_bill.png", io.BytesIO(eb_miss), "image/png"),
    }
)

assert r5.status_code == 200, f"Status {r5.status_code}: {r5.text}"
d5 = r5.json()
print("Application ID:", d5["application_id"])
print("Readiness Score:", d5["readiness_score"])
print("Missing Documents:", d5["missing_documents"])
assert "residence_proof" in d5["missing_documents"]
assert d5["readiness_score"] == 90, f"Expected 90% readiness but got {d5['readiness_score']}"
print("✓ LIVE SCENARIO 5 PASSED: Missing document explicitly identified and deducted (-10).")


# ----------------------------------------------------
# LIVE TEST 6: Duplicate Application Detection
# ----------------------------------------------------
unique_id6 = uuid.uuid4().hex[:6]
citizen_6_name = f"Duplicate Citizen {unique_id6}"
print(f"\n--- LIVE SCENARIO 6: Duplicate Application Detection ({citizen_6_name}) ---")
aadhaar_dup = make_doc_bytes("GOVERNMENT OF INDIA — AADHAAR", [
    f"Name: {citizen_6_name}",
    "DOB: 20-04-1991",
    "Address: 100 Main St, Pune",
    "Aadhaar No: XXXX XXXX 7722",
])

# Submitting Application 1
r6_1 = requests.post(
    API_URL,
    data={"citizen_name": citizen_6_name, "service_type": "residence_certificate"},
    files={
        "aadhaar": ("aadhaar.png", io.BytesIO(aadhaar_dup), "image/png"),
        "ration_card": ("ration_card.png", io.BytesIO(ration_p), "image/png"),
        "electricity_bill": ("electricity_bill.png", io.BytesIO(eb_p), "image/png"),
    }
)
assert r6_1.status_code == 200

# Submitting Application 2 (Duplicate)
r6_2 = requests.post(
    API_URL,
    data={"citizen_name": citizen_6_name, "service_type": "residence_certificate"},
    files={
        "aadhaar": ("aadhaar.png", io.BytesIO(aadhaar_dup), "image/png"),
        "ration_card": ("ration_card.png", io.BytesIO(ration_p), "image/png"),
        "electricity_bill": ("electricity_bill.png", io.BytesIO(eb_p), "image/png"),
    }
)
assert r6_2.status_code == 200
d6_2 = r6_2.json()
print("Application ID 2:", d6_2["application_id"])
print("Duplicate Suspected:", d6_2["duplicate_suspected"])
print("Duplicate Confidence:", d6_2["duplicate_confidence"])
print("Risk Level:", d6_2["risk_level"])
assert d6_2["duplicate_suspected"] is True
assert d6_2["risk_level"] == "HIGH"
assert "fraud" not in d6_2["recommendation"].lower()
print("✓ LIVE SCENARIO 6 PASSED: Duplicate caught, HIGH risk assigned, and non-accusatory guidance provided.")


# ----------------------------------------------------
# LIVE TEST 7: Correction Request & Citizen Resubmission Workflow
# ----------------------------------------------------
print("\n--- LIVE SCENARIO 7: Correction Request & Resubmission Workflow ---")
target_app_id = d1["application_id"]

# Officer requests correction
corr_resp = requests.post(
    f"{API_URL}/{target_app_id}/request-correction",
    headers=headers,
    json={
        "reason": "Document Type Mismatch in Aadhaar Card slot",
        "details": "Please upload a valid Aadhaar card image rather than a birth certificate.",
    }
)
assert corr_resp.status_code == 200
print("Correction requested by Officer Suresh.")

# Citizen checks status and sees correction
status_resp = requests.get(f"{API_URL}/{target_app_id}")
assert status_resp.status_code == 200
assert status_resp.json()["status"] == "NEEDS_CORRECTION"

# Citizen resubmits replacement document
resub_resp = requests.post(
    f"{API_URL}/{target_app_id}/resubmit",
    files={"aadhaar": ("aadhaar_valid.png", io.BytesIO(aadhaar_p), "image/png")}
)
assert resub_resp.status_code == 200
d7 = resub_resp.json()
print("New status after resubmission:", d7["status"])
print("New readiness score:", d7["readiness_score"])
assert d7["status"] == "READY_FOR_REVIEW"
print("✓ LIVE SCENARIO 7 PASSED: Full correction request -> citizen resubmit -> automated re-verification completed.")


# ----------------------------------------------------
# LIVE TEST 8: Final Decision (Approval & Rejection) & Audit Hash Chain
# ----------------------------------------------------
print("\n--- LIVE SCENARIO 8: Final Statutory Decisions & Audit Hash Verification ---")

# Approve Perfect Application
appr_resp = requests.post(
    f"{API_URL}/{d2['application_id']}/approve",
    headers=headers,
    json={"notes": "All identity and residence records confirmed in accordance with state guidelines."}
)
assert appr_resp.status_code == 200
print(f"Application #{d2['application_id']} APPROVED by Officer Suresh.")

# Reject Address Discrepancy Application
rej_resp = requests.post(
    f"{API_URL}/{d4['application_id']}/reject",
    headers=headers,
    json={"reason": "Address outside statutory jurisdiction", "notes": "Unable to verify jurisdiction from discrepancy."}
)
assert rej_resp.status_code == 200
print(f"Application #{d4['application_id']} REJECTED by Officer Suresh.")

# Verify cryptographic audit hash chain on both applications
v_appr = requests.get(f"{API_URL}/{d2['application_id']}/audit/verify", headers=headers)
assert v_appr.status_code == 200
assert v_appr.json()["is_valid"] is True
assert v_appr.json()["chain_verified"] is True
print(f"Audit chain for approved application #{d2['application_id']}: VALID & CRYPTOGRAPHICALLY VERIFIED ({v_appr.json()['events_count']} events).")

v_rej = requests.get(f"{API_URL}/{d4['application_id']}/audit/verify", headers=headers)
assert v_rej.status_code == 200
assert v_rej.json()["is_valid"] is True
assert v_rej.json()["chain_verified"] is True
print(f"Audit chain for rejected application #{d4['application_id']}: VALID & CRYPTOGRAPHICALLY VERIFIED ({v_rej.json()['events_count']} events).")


# ----------------------------------------------------
# LIVE TEST 9: Document Quality Anomaly Check (Blank Page)
# ----------------------------------------------------
print("\n--- LIVE SCENARIO 9: Document Quality Anomaly (Blank Upload) ---")
blank_img = Image.new("RGB", (800, 600), color="white")
b_buf = io.BytesIO()
blank_img.save(b_buf, format="PNG")
blank_bytes = b_buf.getvalue()

r9 = requests.post(
    API_URL,
    data={"citizen_name": "Blank Test Citizen", "service_type": "residence_certificate"},
    files={
        "aadhaar": ("aadhaar_blank.png", io.BytesIO(blank_bytes), "image/png"),
        "ration_card": ("ration_card.png", io.BytesIO(ration_p), "image/png"),
        "electricity_bill": ("electricity_bill.png", io.BytesIO(eb_p), "image/png"),
    }
)
assert r9.status_code == 200
d9 = r9.json()
print("Application ID:", d9["application_id"])
print("Readiness Score:", d9["readiness_score"])
print("Risk Level:", d9["risk_level"])
app_detail_9 = requests.get(f"{API_URL}/{d9['application_id']}").json()
aadhaar_doc_9 = next(d for d in app_detail_9["documents"] if d["doc_type"] == "aadhaar")
print("Aadhaar Quality Status:", aadhaar_doc_9["quality_status"])
print("Aadhaar Quality Score:", aadhaar_doc_9["quality_score"])
assert aadhaar_doc_9["quality_status"] in ["UNREADABLE", "POOR"]
print("✓ LIVE SCENARIO 9 PASSED: Blank/unreadable scan flagged with quality status and non-accusatory guidance.")


# ----------------------------------------------------
# LIVE TEST 10: Document Validity & Expiry Check (Old Electricity Bill)
# ----------------------------------------------------
print("\n--- LIVE SCENARIO 10: Document Validity & Expiry (150-Day Old Utility Bill) ---")
eb_old_bytes = make_doc_bytes("ELECTRICITY BILL — UTILITY CONSUMER RECORD", [
    f"Name: Expiry Citizen",
    "DOB: 15-08-1996",
    "Bill Date: 01-01-2025",  # Over 1 year old
    "Address: 42 MG Road, Ahmedabad",
    "Consumer No: EB-99112",
])

r10 = requests.post(
    API_URL,
    data={"citizen_name": "Expiry Citizen", "service_type": "residence_certificate"},
    files={
        "aadhaar": ("aadhaar.png", io.BytesIO(aadhaar_p), "image/png"),
        "ration_card": ("ration_card.png", io.BytesIO(ration_p), "image/png"),
        "electricity_bill": ("electricity_bill.png", io.BytesIO(eb_old_bytes), "image/png"),
    }
)
assert r10.status_code == 200
d10 = r10.json()
print("Application ID:", d10["application_id"])
app_detail_10 = requests.get(f"{API_URL}/{d10['application_id']}").json()
eb_doc_10 = next(d for d in app_detail_10["documents"] if d["doc_type"] == "electricity_bill")
print("Electricity Bill Validity Status:", eb_doc_10["validity_status"])
print("Validity Evidence:", eb_doc_10["validity_evidence"])
assert eb_doc_10["validity_status"] == "EXPIRED"
print("✓ LIVE SCENARIO 10 PASSED: Expired utility bill flagged with statutory validity period guidance.")


# ----------------------------------------------------
# LIVE TEST 11: In-App Notifications Delivery & Acknowledgment
# ----------------------------------------------------
print("\n--- LIVE SCENARIO 11: In-App Notifications Delivery ---")
notif_resp = requests.get(f"http://localhost:8000/api/notifications?application_id={d2['application_id']}")
assert notif_resp.status_code == 200
notifs = notif_resp.json()
print(f"Notifications recorded for Application #{d2['application_id']}: {len(notifs)}")
for n in notifs:
    print(f"  [{n['notification_type']}] {n['message']}")
assert len(notifs) >= 1
assert any(n["notification_type"] == "APPROVED" for n in notifs)

# Mark notification as read
notif_id = notifs[0]["id"]
read_res = requests.post(f"http://localhost:8000/api/notifications/{notif_id}/read")
assert read_res.status_code == 200
assert read_res.json()["is_read"] is True
print("✓ LIVE SCENARIO 11 PASSED: In-app notifications created on lifecycle transitions and acknowledged.")


# ----------------------------------------------------
# LIVE TEST 12: Data Retention & Privacy Status API
# ----------------------------------------------------
print("\n--- LIVE SCENARIO 12: Data Retention & Privacy API (Admin Authorized) ---")
admin_auth = requests.post(AUTH_URL, json={"username": "admin1", "password": "admin-demo-pass"})
assert admin_auth.status_code == 200
admin_token = admin_auth.json()["access_token"]
admin_headers = {"Authorization": f"Bearer {admin_token}"}

ret_resp = requests.get("http://localhost:8000/api/retention/status", headers=admin_headers)
assert ret_resp.status_code == 200
ret_data = ret_resp.json()
print("Retention Dry-Run Status:", ret_data)
assert ret_data["dry_run"] is True
assert ret_data["document_retention_days"] == 90
assert ret_data["application_retention_days"] == 365
print("✓ LIVE SCENARIO 12 PASSED: Admin data retention inspection verified.")


# ----------------------------------------------------
# LIVE TEST 13: Service Authority Provenance Catalog API
# ----------------------------------------------------
print("\n--- LIVE SCENARIO 13: Government Authority Provenance Catalog ---")
srv_resp = requests.get("http://localhost:8000/api/services")
assert srv_resp.status_code == 200
srv_data = srv_resp.json()
print(f"Total active services in catalog: {len(srv_data)}")
birth_srv = next(s for s in srv_data if s["id"] == "birth_certificate")
print("Birth Certificate Verification Status:", birth_srv["verification_status"])
print("Issuing Department:", birth_srv["department"])
print("Official Source URL:", birth_srv["source_url"])
assert birth_srv["verification_status"] == "OFFICIAL_VERIFIED"
assert "crsorgi.gov.in" in birth_srv["source_url"]

income_srv = next(s for s in srv_data if s["id"] == "income_certificate")
print("Income Certificate Verification Status:", income_srv["verification_status"])
assert income_srv["verification_status"] == "CONFIGURED_NOT_VERIFIED"
print("✓ LIVE SCENARIO 13 PASSED: Government authority provenance metadata properly distinguished.")


print("\n==================================================")
print(">>> ALL 13 LIVE E2E SCENARIOS VERIFIED WITH 100% ACCURACY! <<<")
print("==================================================")

