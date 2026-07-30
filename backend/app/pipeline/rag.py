"""
Regulation RAG assistant.

Retrieval-only by design: a query gets matched against the regulation
corpus and the best-matching passage is returned as-is. There's no
generation step calling an LLM API on top of the retrieved text — that
was a deliberate choice from earlier in this build (avoids per-query API
cost/rate limits entirely, and a wrong-but-fluent generated answer is a
worse failure mode for a citizen than an honest "here's the closest
passage we found").

Embeddings are TF-IDF (scikit-learn), not a downloaded transformer model.
ChromaDB's default embedding function tries to download ~80MB of model
weights on first use — testing this in a network-restricted sandbox is
what surfaced that as a real fragility risk, not a hypothetical one.
TF-IDF needs zero downloads and zero ongoing cost, which is also just a
better fit for the free-tier constraint this project runs under.
"""
import pickle
from pathlib import Path

import chromadb
from sklearn.feature_extraction.text import TfidfVectorizer

from ..regulation_corpus import INCOME_CERTIFICATE_CORPUS

DATA_DIR = Path(__file__).parent.parent.parent / "data"
CHROMA_PATH = str(DATA_DIR / "chroma")
VECTORIZER_PATH = DATA_DIR / "tfidf_vectorizer.pkl"

_client = None
_collection = None


def _get_collection():
    global _client, _collection
    if _collection is None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(path=CHROMA_PATH)
        # embedding_function=None because we supply our own TF-IDF vectors —
        # this is what stops Chroma from trying to download a model.
        # metadata={"hnsw:space": "cosine"} matters too: Chroma defaults to
        # L2 distance, which isn't bounded to [0, 1] and made every
        # relevance score come out as 0 after clamping. Cosine distance is
        # the right metric for TF-IDF vectors anyway, and it's what makes
        # `1 - distance` a real, boundable relevance score.
        _collection = _client.get_or_create_collection(
            "regulations", embedding_function=None, metadata={"hnsw:space": "cosine"}
        )
    return _collection


def index_corpus() -> None:
    """Fits TF-IDF on the corpus and loads it into Chroma. Safe to re-run."""
    texts = [chunk["text"] for chunk in INCOME_CERTIFICATE_CORPUS]
    ids = [chunk["id"] for chunk in INCOME_CERTIFICATE_CORPUS]

    vectorizer = TfidfVectorizer()
    vectors = vectorizer.fit_transform(texts).toarray().tolist()

    with open(VECTORIZER_PATH, "wb") as f:
        pickle.dump(vectorizer, f)

    collection = _get_collection()
    existing_ids = set(collection.get()["ids"])
    if set(ids) <= existing_ids:
        return  # already indexed, nothing to do
    collection.add(documents=texts, embeddings=vectors, ids=ids)


def answer_question(query: str, top_k: int = 1) -> list[dict]:
    """
    Returns up to top_k matching passages as
    [{"id": ..., "text": ..., "relevance": 0-1}, ...], best match first.
    """
    if not VECTORIZER_PATH.exists():
        index_corpus()

    with open(VECTORIZER_PATH, "rb") as f:
        vectorizer = pickle.load(f)

    query_vector = vectorizer.transform([query]).toarray().tolist()
    collection = _get_collection()
    results = collection.query(query_embeddings=query_vector, n_results=top_k)

    matches = []
    for doc_id, text, distance in zip(
        results["ids"][0], results["documents"][0], results["distances"][0]
    ):
        matches.append({
            "id": doc_id,
            "text": text,
            "relevance": round(max(0.0, 1 - distance), 2),
        })
    return matches
