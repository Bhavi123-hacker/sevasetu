import requests
import streamlit as st

from config import API_BASE_URL

st.set_page_config(page_title="SevaSetu — Ask a Question", page_icon="💬")

st.title("Ask a Question")
st.caption("Answers come from the actual regulation text, not a generated guess — if nothing matches well, you'll see a low relevance score rather than a confident-sounding wrong answer.")

question = st.text_input("What do you want to know?", placeholder="e.g. How long does processing take?")

if st.button("Ask", type="primary") and question.strip():
    with st.spinner("Searching regulations..."):
        try:
            response = requests.post(f"{API_BASE_URL}/api/ask", json={"question": question}, timeout=15)
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as e:
            st.error(f"Couldn't reach SevaSetu's backend: {e}")
            st.stop()

    for match in data["matches"]:
        confidence = "High" if match["relevance"] > 0.3 else "Low" if match["relevance"] < 0.1 else "Moderate"
        st.info(f"**{confidence} match**\n\n{match['text']}")

    if data["matches"] and data["matches"][0]["relevance"] < 0.1:
        st.caption("None of the regulation passages matched this well — try rephrasing, or this may not be covered yet.")

st.divider()
st.caption("Try: \"what documents do I need\", \"is there a fee\", \"can I appeal a rejection\", \"how long is the certificate valid\"")
