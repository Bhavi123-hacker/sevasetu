"""
Generation layer — optional, sits on top of retrieval, never replaces it.

HONESTY NOTE: this is the one module in this project I could not test
end-to-end myself. Ollama needs to download a model from the internet,
and that's blocked in the sandbox this was built in — the same kind of
restriction that made ChromaDB's default embedder fail earlier in this
build. The code below follows Ollama's stable, documented REST API
(POST /api/generate, been stable for a long time), but "should work
based on the docs" is a different, weaker claim than everything else in
this codebase, which was actually run before being shipped. Test this
one yourself first.

Design choice that matters: if Ollama isn't running, isn't reachable, or
errors out, this fails SILENTLY and the caller falls back to the
retrieved passage as-is. A citizen-facing answer should never break
because a nice-to-have generation step failed — retrieval alone is the
tested, reliable path, and stays that way regardless of whether this
module works on any given machine.
"""
import os
import requests

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:1b")
GENERATION_TIMEOUT_SECONDS = 8  # short on purpose — a slow generation call should not hang a citizen-facing request


def generate_answer(question: str, passage: str) -> str | None:
    """
    Returns a generated natural-language answer grounded in `passage`,
    or None if generation isn't available for any reason. Callers must
    treat None as "fall back to showing the passage directly" — this
    function is never allowed to raise.
    """
    prompt = (
        "Answer the citizen's question using ONLY the passage below. "
        "If the passage doesn't actually answer the question, say so honestly "
        "instead of guessing. Keep it to 1-2 sentences.\n\n"
        f"Passage: {passage}\n\n"
        f"Question: {question}\n\n"
        "Answer:"
    )

    try:
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            timeout=GENERATION_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        text = response.json().get("response", "").strip()
        return text or None
    except (requests.RequestException, ValueError, KeyError):
        # Ollama not running, model not pulled yet, timeout, malformed
        # response — all of these mean the same thing to the caller:
        # no generated answer this time, show the retrieved passage instead.
        return None
