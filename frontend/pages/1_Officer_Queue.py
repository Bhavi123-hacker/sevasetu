import requests
import streamlit as st

from config import API_BASE_URL, SERVICE_TYPES, auth_headers

st.set_page_config(page_title="SevaSetu — Officer Queue", page_icon="🗂️", layout="wide")

# --- Access gate ---
# Real JWT now: login calls the backend, which returns a signed token.
# Every protected call below sends it as a Bearer header — the backend
# verifies it independently, this page can't just claim a role anymore.
if "officer_logged_in" not in st.session_state:
    st.session_state.officer_logged_in = False
    st.session_state.officer_name = None
    st.session_state.staff_role = None
    st.session_state.staff_token = None

if not st.session_state.officer_logged_in:
    st.title("Staff Login")
    st.caption("Real JWT auth — one shared demo password per role, not per-user accounts yet.")
    officer_name = st.text_input("Your name")
    role = st.radio("Role", ["Officer", "Administrator"], horizontal=True)
    password = st.text_input("Password", type="password")
    if st.button("Log in", type="primary"):
        if not officer_name.strip():
            st.error("Enter your name — it's used to attribute resolved applications.")
        else:
            try:
                r = requests.post(
                    f"{API_BASE_URL}/api/auth/login",
                    json={"name": officer_name.strip(), "role": role, "password": password},
                    timeout=15,
                )
                if r.status_code == 401:
                    st.error("Incorrect password.")
                else:
                    r.raise_for_status()
                    data = r.json()
                    st.session_state.officer_logged_in = True
                    st.session_state.officer_name = data["name"]
                    st.session_state.staff_role = data["role"]
                    st.session_state.staff_token = data["access_token"]
                    st.rerun()
            except requests.RequestException as e:
                st.error(f"Couldn't reach SevaSetu's backend: {e}")
    st.stop()

if st.session_state.staff_role == "Administrator":
    st.info("Logged in as **Administrator**. Officer-specific actions (resolving applications) are hidden — that's an Officer task. Go to **Admin Settings** in the sidebar to edit the required-documents checklist.")

# --- Queue ---

st.title("Officer Queue")
st.caption(f"Logged in as {st.session_state.officer_name} ({st.session_state.staff_role})")

try:
    r = requests.get(f"{API_BASE_URL}/api/applications", headers=auth_headers(), timeout=15)
    if r.status_code == 401:
        st.session_state.officer_logged_in = False
        st.warning("Session expired — log in again.")
        st.rerun()
    r.raise_for_status()
    applications = r.json()
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
        # Status-check endpoint stays public (citizens use it too), so no auth header needed here.
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
                    r = requests.post(
                        f"{API_BASE_URL}/api/applications/{detail['id']}/resolve",
                        headers=auth_headers(),
                        timeout=15,
                    )
                    if r.status_code == 403:
                        st.error("Server rejected this — your token doesn't have Officer rights for this action.")
                    else:
                        st.rerun()
        else:
            st.caption(f"Resolved{' by ' + detail['resolved_by'] if detail.get('resolved_by') else ''}")
