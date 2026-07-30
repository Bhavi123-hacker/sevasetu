import requests
import streamlit as st

from config import API_BASE_URL

st.set_page_config(page_title="SevaSetu — Feedback", page_icon="📝")

st.title("Share Feedback")
st.caption("Tell us about your experience. This goes straight to the officer team, not into a black box.")

name = st.text_input("Your name (optional)")
application_id = st.text_input("Application ID (optional, if this is about a specific application)")
text = st.text_area("Your feedback", height=120)

if st.button("Submit feedback", type="primary"):
    if not text.strip():
        st.error("Please write something before submitting.")
    else:
        try:
            response = requests.post(
                f"{API_BASE_URL}/api/feedback",
                json={
                    "text": text,
                    "citizen_name": name or None,
                    "application_id": application_id or None,
                },
                timeout=15,
            )
            response.raise_for_status()
            st.success("Thanks — your feedback has been recorded.")
        except requests.RequestException as e:
            st.error(f"Couldn't reach SevaSetu's backend: {e}")
