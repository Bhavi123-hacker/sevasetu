import requests
import streamlit as st

from config import API_BASE_URL

st.set_page_config(page_title="SevaSetu — Check Status", page_icon="🔎")

st.title("Check Application Status")
st.caption("Look up an application you already submitted using its Application ID.")

application_id = st.text_input("Application ID", placeholder="e.g. 5bce7434")

if st.button("Check status", type="primary") and application_id.strip():
    try:
        response = requests.get(f"{API_BASE_URL}/api/applications/{application_id.strip()}", timeout=15)
        if response.status_code == 404:
            st.error("No application found with that ID. Double-check it — it's the ID you were shown right after submitting.")
            st.stop()
        response.raise_for_status()
        detail = response.json()
    except requests.RequestException as e:
        st.error(f"Couldn't reach SevaSetu's backend: {e}")
        st.stop()

    status_display = {
        "submitted": "Submitted — awaiting officer review" if detail["readiness_score"] < 90 else "Submitted — looks clean, should move quickly",
        "reviewed": "Under officer review",
        "resolved": "Resolved",
    }.get(detail["status"], detail["status"])

    st.metric("Status", status_display)
    st.metric("Readiness score", f"{detail['readiness_score']}%")

    if detail["missing_documents"]:
        st.write("**Still missing:** " + ", ".join(d.replace("_", " ").title() for d in detail["missing_documents"]))

    failed_checks = [c for c in detail["field_checks"] if c["status"] == "fail"]
    if failed_checks:
        st.write("**Unresolved flags:**")
        for check in failed_checks:
            st.warning(f"{check['field'].replace('_', ' ').title()} — {check['detail']}")
    elif detail["status"] != "resolved":
        st.success("No open flags — waiting on officer processing, not on you.")
