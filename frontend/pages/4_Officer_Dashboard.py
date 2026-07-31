import requests
import streamlit as st

from config import API_BASE_URL, auth_headers

st.set_page_config(page_title="SevaSetu — Officer Dashboard", page_icon="📊", layout="wide")

if not st.session_state.get("officer_logged_in"):
    st.warning("Log in from the Officer Queue page first.")
    st.stop()

st.title("Officer Dashboard")
st.caption(f"Logged in as {st.session_state.officer_name}")

try:
    stats = requests.get(f"{API_BASE_URL}/api/officer-stats", headers=auth_headers(), timeout=15).json()
    feedback = requests.get(f"{API_BASE_URL}/api/feedback", headers=auth_headers(), timeout=15).json()
except requests.RequestException as e:
    st.error(f"Couldn't reach SevaSetu's backend: {e}")
    st.stop()

st.subheader("Productivity")

c1, c2, c3, c4 = st.columns(4)
c1.metric("Total applications", stats["total_applications"])
c2.metric("Resolved", stats["resolved_count"])
c3.metric("Pending", stats["pending_count"])
c4.metric("Average readiness score", f"{stats['average_readiness_score']}%")

col_a, col_b = st.columns(2)
with col_a:
    st.write("**Resolutions by officer**")
    if stats["resolutions_by_officer"]:
        st.bar_chart(stats["resolutions_by_officer"])
    else:
        st.caption("No applications resolved yet.")
with col_b:
    st.write("**Applications by service type**")
    if stats["applications_by_service"]:
        st.bar_chart(stats["applications_by_service"])
    else:
        st.caption("No applications submitted yet.")

st.divider()
st.subheader("Feedback Insights")

sentiment_counts = stats["feedback_sentiment_counts"]
s1, s2, s3 = st.columns(3)
s1.metric("Positive", sentiment_counts.get("positive", 0))
s2.metric("Neutral", sentiment_counts.get("neutral", 0))
s3.metric("Negative", sentiment_counts.get("negative", 0))

if feedback:
    st.write("**Recent feedback**")
    for item in feedback[:10]:
        icon = {"positive": "🙂", "neutral": "😐", "negative": "🙁"}.get(item["sentiment_label"], "")
        who = item["citizen_name"] or "Anonymous"
        st.write(f"{icon} **{who}** ({item['sentiment_label']}, score {item['sentiment_score']}): {item['text']}")
else:
    st.caption("No feedback submitted yet.")
