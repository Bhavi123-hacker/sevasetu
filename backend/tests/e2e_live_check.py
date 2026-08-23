import requests
from pathlib import Path

TEST_DOCS = Path('/app/app/test_documents')
API_URL = 'http://localhost:8000/api/applications'

print('--- LIVE TEST 1: Intentionally Wrong Document (Birth Certificate in Aadhaar slot) ---')
with open(TEST_DOCS / 'birth_certificate.png', 'rb') as f1, \
     open(TEST_DOCS / 'ration_card.png', 'rb') as f2, \
     open(TEST_DOCS / 'electricity_bill.png', 'rb') as f3:
    r = requests.post(
        API_URL,
        data={'citizen_name': 'Wrong Doc Citizen', 'service_type': 'income_certificate'},
        files={
            'aadhaar': ('birth_certificate.png', f1, 'image/png'),
            'ration_card': ('ration_card.png', f2, 'image/png'),
            'electricity_bill': ('electricity_bill.png', f3, 'image/png'),
        }
    )

assert r.status_code == 200, f'Status {r.status_code}: {r.text}'
data = r.json()
print('Application ID:', data['application_id'])
print('Status:', data['status'])
print('Readiness Score:', data['readiness_score'])
print('Correction Reason:', data['correction_reason'])
print('Correction Details:', data['correction_details'])
print('Document Verifications:')
for v in data['document_verifications']:
    exp = v['expected_type']
    det = v['detected_type']
    st = v['status']
    conf = v['confidence']
    print(f'  Slot [{exp}] -> Detected: [{det}] Status: [{st}] Conf: {conf}')

assert data['status'] == 'NEEDS_CORRECTION', f'Expected NEEDS_CORRECTION but got {data["status"]}'
assert data['readiness_score'] < 70, f'Expected score < 70 but got {data["readiness_score"]}'
assert 'Aadhaar' in data['correction_reason'], 'Correction reason missing Aadhaar mention'

print('\n--- LIVE TEST 2: Correct Document Bundle ---')
with open(TEST_DOCS / 'aadhaar.png', 'rb') as f1, \
     open(TEST_DOCS / 'ration_card.png', 'rb') as f2, \
     open(TEST_DOCS / 'electricity_bill.png', 'rb') as f3:
    r2 = requests.post(
        API_URL,
        data={'citizen_name': 'Clean Doc Citizen', 'service_type': 'income_certificate'},
        files={
            'aadhaar': ('aadhaar.png', f1, 'image/png'),
            'ration_card': ('ration_card.png', f2, 'image/png'),
            'electricity_bill': ('electricity_bill.png', f3, 'image/png'),
        }
    )

assert r2.status_code == 200, f'Status {r2.status_code}: {r2.text}'
data2 = r2.json()
print('Application ID:', data2['application_id'])
print('Status:', data2['status'])
print('Readiness Score:', data2['readiness_score'])
print('Document Verifications:')
for v in data2['document_verifications']:
    exp = v['expected_type']
    det = v['detected_type']
    st = v['status']
    conf = v['confidence']
    print(f'  Slot [{exp}] -> Detected: [{det}] Status: [{st}] Conf: {conf}')

assert data2['status'] == 'READY_FOR_REVIEW', f'Expected READY_FOR_REVIEW but got {data2["status"]}'
print('\n>>> ALL LIVE DOCUMENT INTEGRITY CHECKS PASSED PERFECTLY! <<<')
