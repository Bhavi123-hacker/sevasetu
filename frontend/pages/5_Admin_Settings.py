import requests
import streamlit as st

from config import API_BASE_URL, SERVICE_TYPES, auth_headers

st.set_page_config(page_title="SevaSetu — Admin Settings", page_icon="⚙️")

if not st.session_state.get("officer_logged_in"):
    st.warning("Log in from the Officer Queue page first.")
    st.stop()

if st.session_state.get("staff_role") != "Administrator":
    st.warning("This page is for Administrators. You're logged in as an Officer — go to Officer Queue instead.")
    st.stop()

st.title("Admin Settings")
st.caption(f"Logged in as {st.session_state.officer_name} (Administrator)")
st.write("Edit which documents are required per service. Changes apply immediately — the next citizen who submits an application is checked against whatever's saved here, not a hardcoded list.")

try:
    current = requests.get(f"{API_BASE_URL}/api/service-requirements", headers=auth_headers(), timeout=15).json()
except requests.RequestException as e:
    st.error(f"Couldn't reach SevaSetu's backend: {e}")
    st.stop()

ALL_KNOWN_DOCS = ["aadhaar", "ration_card", "electricity_bill", "residence_proof", "birth_certificate"]

for service_key, service_info in SERVICE_TYPES.items():
    st.subheader(service_info["label"])
    existing = current.get(service_key, [])

    selected = st.multiselect(
        "Required documents",
        options=ALL_KNOWN_DOCS,
        default=existing,
        key=f"docs_{service_key}",
        format_func=lambda d: d.replace("_", " ").title(),
    )

    if st.button(f"Save {service_info['label']}", key=f"save_{service_key}"):
        try:
            r = requests.put(
                f"{API_BASE_URL}/api/service-requirements/{service_key}",
                json={"document_types": selected},
                headers=auth_headers(),
                timeout=15,
            )
            r.raise_for_status()
            st.success(f"Saved. {service_info['label']} now requires: {', '.join(d.replace('_', ' ').title() for d in selected)}")
        except requests.RequestException as e:
            st.error(f"Couldn't save: {e}")

    st.divider()
