import requests
import streamlit as st

from config import API_BASE_URL, SERVICE_TYPES

st.set_page_config(page_title="SevaSetu", page_icon="📋", layout="centered")

st.title("SevaSetu")
st.caption("Helping citizens submit complete, consistent government applications before they reach an officer.")

if "result" not in st.session_state:
    st.session_state.result = None

# ---------- Screen 1: service selection + upload ----------

if st.session_state.result is None:
    citizen_name = st.text_input("Your full name")

    service_key = st.selectbox(
        "Which service are you applying for?",
        options=list(SERVICE_TYPES.keys()),
        format_func=lambda key: SERVICE_TYPES[key]["label"],
    )
    service = SERVICE_TYPES[service_key]

    st.subheader("Required documents")
    st.write("Upload each of the following. It's fine to skip one if you don't have it yet — SevaSetu will tell you exactly what's missing.")

    uploaded_files = {}
    for doc_type, doc_label in service["required_documents"].items():
        uploaded_files[doc_type] = st.file_uploader(doc_label, type=["png", "jpg", "jpeg"], key=doc_type)

    if st.button("Check my application", type="primary", use_container_width=True):
        if not citizen_name:
            st.error("Please enter your name.")
        elif not any(uploaded_files.values()):
            st.error("Please upload at least one document.")
        else:
            files_payload = {
                doc_type: (file.name, file.getvalue(), file.type)
                for doc_type, file in uploaded_files.items()
                if file is not None
            }
            with st.spinner("Reading documents and checking consistency..."):
                try:
                    response = requests.post(
                        f"{API_BASE_URL}/api/applications",
                        data={"citizen_name": citizen_name, "service_type": service_key},
                        files=files_payload,
                        timeout=30,
                    )
                    response.raise_for_status()
                    st.session_state.result = response.json()
                    st.rerun()
                except requests.RequestException as e:
                    st.error(f"Couldn't reach SevaSetu's backend: {e}")

# ---------- Screen 2: readiness result ----------

else:
    result = st.session_state.result
    score = result["readiness_score"]

    status_label = "Ready" if score >= 90 else "Needs attention" if score >= 60 else "Not ready"
    status_color = "green" if score >= 90 else "orange" if score >= 60 else "red"

    col1, col2 = st.columns([1, 2])
    with col1:
        st.metric("Readiness score", f"{score}%")
    with col2:
        st.markdown(f"### :{status_color}[{status_label}]")
        st.caption(f"{result['service_type'].replace('_', ' ').title()} application for {result['citizen_name']}")

    if result["duplicate_suspected"]:
        st.warning("This looks like a repeat submission of an existing application.")

    st.subheader("Document checks")
    for check in result["field_checks"]:
        if check["status"] == "pass":
            st.success(f"**{check['field'].replace('_', ' ').title()}** — {check['detail']}")
        else:
            st.error(f"**{check['field'].replace('_', ' ').title()}** — {check['detail']}")

    if result["missing_documents"]:
        st.subheader("Missing documents")
        for doc in result["missing_documents"]:
            st.write(f"- {doc.replace('_', ' ').title()}")

    col_a, col_b = st.columns(2)
    col_a.metric("Estimated delay", f"{result['estimated_delay_days']} days")
    col_b.metric("Application ID", result["application_id"])

    st.info(f"**Recommendation:** {result['recommendation']}")

    if st.button("Start a new application"):
        st.session_state.result = None
        st.rerun()
