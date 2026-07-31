import os

import requests
import streamlit as st

from config import API_BASE_URL, SERVICE_TYPES

st.set_page_config(page_title="SevaSetu — Officer Queue", page_icon="🗂️", layout="wide")

# --- Access gate ---
# NOTE: this is a demo-level gate, not real authentication. There's no
# password hashing, no session tokens, no rate limiting on attempts.
# Swap this for a real login endpoint (backend-issued session/JWT)
# before this ever handles real citizen data.
OFFICER_PASSWORD = os.getenv("OFFICER_DEMO_PASSWORD", "seva123")

if "officer_logged_in" not in st.session_state:
    st.session_state.officer_logged_in = False
    st.session_state.officer_name = None
    st.session_state.staff_role = None

if not st.session_state.officer_logged_in:
    st.title("Staff Login")
    st.caption("Demo access gate — not production authentication.")
    officer_name = st.text_input("Your name")
    role = st.radio("Role", ["Officer", "Administrator"], horizontal=True)
    password = st.text_input("Password", type="password")
    if st.button("Log in", type="primary"):
        if not officer_name.strip():
            st.error("Enter your name — it's used to attribute resolved applications.")
        elif password == OFFICER_PASSWORD:
            st.session_state.officer_logged_in = True
            st.session_state.officer_name = officer_name.strip()
            st.session_state.staff_role = role
            st.rerun()
        else:
            st.error("Incorrect password.")
    st.stop()

if st.session_state.staff_role == "Administrator":
    st.info("Logged in as **Administrator**. Officer-specific actions (resolving applications) are hidden — that's an Officer task. Go to **Admin Settings** in the sidebar to edit the required-documents checklist.")

# --- Queue ---

st.title("Officer Queue")
st.caption(f"Logged in as {st.session_state.officer_name}")

try:
    applications = requests.get(f"{API_BASE_URL}/api/applications", timeout=15).json()
except requests.RequestException as e:
    st.error(f"Couldn't reach SevaSetu's backend: {e}")
    st.stop()

col1, col2, col3 = st.columns([2, 2, 1])
with col1:
    service_filter = st.selectbox(
        "Filter by service",
        options=["All"] + [SERVICE_TYPES[k]["label"] for k in SERVICE_TYPES],
    )
with col2:
    search_term = st.text_input("Search by citizen name or application ID")
with col3:
    st.write("")
    st.write("")
    show_resolved = st.checkbox("Show resolved", value=False)

filtered = applications
if service_filter != "All":
    filtered = [a for a in filtered if SERVICE_TYPES.get(a["service_type"], {}).get("label") == service_filter]
if search_term:
    term = search_term.lower()
    filtered = [a for a in filtered if term in a["citizen_name"].lower() or term in a["id"].lower()]
if not show_resolved:
    filtered = [a for a in filtered if a["status"] != "resolved"]

clean_count = sum(1 for a in filtered if a["readiness_score"] and a["readiness_score"] >= 90)
flagged_count = len(filtered) - clean_count
duplicate_count = sum(1 for a in filtered if a["duplicate_suspected"])

m1, m2, m3 = st.columns(3)
m1.metric("Clean", clean_count)
m2.metric("Flagged", flagged_count)
m3.metric("Duplicates suspected", duplicate_count)

st.divider()

if not filtered:
    st.info("No applications match the current filters.")

for application in filtered:
    score = application["readiness_score"] or 0
    icon = "✅" if score >= 90 else "⚠️" if score >= 60 else "🛑"
    dup_tag = " · **duplicate suspected**" if application["duplicate_suspected"] else ""
    header = (
        f"{icon} {application['citizen_name']} — {score}% — "
        f"{SERVICE_TYPES.get(application['service_type'], {}).get('label', application['service_type'])}"
        f"{dup_tag}"
    )

    with st.expander(header):
        detail = requests.get(f"{API_BASE_URL}/api/applications/{application['id']}", timeout=15).json()

        st.write(f"**Application ID:** {detail['id']}  |  **Status:** {detail['status']}")

        st.write("**Field checks:**")
        for check in detail["field_checks"]:
            if check["status"] == "pass":
                st.success(f"{check['field'].replace('_', ' ').title()} — {check['detail']}")
            else:
                st.error(f"{check['field'].replace('_', ' ').title()} — {check['detail']}")

        if detail["missing_documents"]:
            st.write("**Missing documents:** " + ", ".join(d.replace("_", " ").title() for d in detail["missing_documents"]))

        st.write(f"**Estimated delay:** {detail['estimated_delay_days']} days")
        st.write(f"**Recommendation shown to citizen:** {detail['recommendation']}")

        if detail["status"] != "resolved":
            if st.session_state.staff_role == "Officer":
                if st.button("Mark as reviewed / resolved", key=f"resolve_{detail['id']}"):
                    requests.post(
                        f"{API_BASE_URL}/api/applications/{detail['id']}/resolve",
                        json={"officer_name": st.session_state.officer_name},
                        timeout=15,
                    )
                    st.rerun()
        else:
            st.caption(f"Resolved{' by ' + detail['resolved_by'] if detail.get('resolved_by') else ''}")
