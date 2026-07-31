import os

# Inside Docker Compose, "backend" resolves via the compose network.
# Running outside Docker (plain `streamlit run`), it falls back to localhost.
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")


def auth_headers():
    """Bearer-token header for staff-only endpoints. Call after login —
    st.session_state.staff_token is set by the login flow in
    1_Officer_Queue.py."""
    import streamlit as st
    token = st.session_state.get("staff_token")
    return {"Authorization": f"Bearer {token}"} if token else {}


SERVICE_TYPES = {
    "income_certificate": {
        "label": "Income Certificate",
        "required_documents": {
            "aadhaar": "Aadhaar card",
            "ration_card": "Ration card",
            "electricity_bill": "Electricity bill",
            "residence_proof": "Residence proof",
        },
    },
    "domicile_certificate": {
        "label": "Domicile Certificate",
        "required_documents": {
            "aadhaar": "Aadhaar card",
            "residence_proof": "Residence proof",
            "birth_certificate": "Birth certificate",
        },
    },
}
