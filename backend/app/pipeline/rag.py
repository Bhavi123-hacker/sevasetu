"""
Regulation RAG assistant — hybrid retrieval.

Retrieval-only by design: the best-matching passage is returned as-is
(optionally with a generated summary layered on top by generation.py —
see main.py's /api/ask). No LLM call sits in the base retrieval path,
which is what keeps this free of any per-query API cost or rate limit.

Two rankers, fused by Reciprocal Rank Fusion (RRF):
  1. TF-IDF + cosine similarity, via ChromaDB (the original approach)
  2. BM25 (rank_bm25) — a different, generally stronger lexical ranking
     function; handles term-frequency saturation and document-length
     normalization that raw TF-IDF doesn't.

HONEST NOTE on what "hybrid" means here: both rankers are lexical
(keyword-overlap) methods, not lexical+semantic. A real semantic layer
would mean embeddings from a transformer model (sentence-transformers or
similar) — which needs a model download, and that specific download is
what failed in this sandbox's restricted network earlier in this build
(same class of problem as ChromaDB's default embedder). Fusing BM25 with
TF-IDF is still a legitimate, real improvement — BM25 alone already
outperforms raw TF-IDF on most retrieval benchmarks, and RRF is the
actual industry-standard fusion technique — just don't oversell it as
"lexical + semantic" in a viva. It isn't, yet.

Embeddings/vectors here are TF-IDF (scikit-learn), not a downloaded
transformer model — no downloads, no API calls, no rate limit to ever
hit, which is also just a better fit for the free-tier constraint this
project runs under.
"""
import re
import pickle
from pathlib import Path

import chromadb
from rank_bm25 import BM25Okapi
from sklearn.feature_extraction.text import TfidfVectorizer

from ..regulation_corpus import INCOME_CERTIFICATE_CORPUS

DATA_DIR = Path(__file__).parent.parent.parent / "data"
CHROMA_PATH = str(DATA_DIR / "chroma")
VECTORIZER_PATH = DATA_DIR / "tfidf_vectorizer.pkl"

RRF_K = 60  # standard constant from the RRF literature — dampens the influence of any single rank position

_client = None
_collection = None
_bm25_index = None
_bm25_doc_ids = None


def sanitize_rag_query(query: str) -> str:
    """
    Sanitizes citizen query to neutralize prompt injection phrases and control characters.
    """
    cleaned = query.strip()
    injection_patterns = [
        r"(?i)\bignore\s+(all\s+)?(previous|prior|above)\s+instructions\b",
        r"(?i)\bsystem\s+prompt\b",
        r"(?i)\byou\s+are\s+now\b",
        r"(?i)\bdisregard\s+(all\s+)?rules\b",
        r"(?i)\boutput\s+the\s+following\s+text\b",
    ]
    for pattern in injection_patterns:
        cleaned = re.sub(pattern, "[sanitized]", cleaned)
    return cleaned


def _get_collection():
    global _client, _collection
    if _collection is None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(path=CHROMA_PATH)
        # embedding_function=None because we supply our own TF-IDF vectors —
        # this is what stops Chroma from trying to download a model.
        # metadata={"hnsw:space": "cosine"}: Chroma defaults to L2 distance,
        # which isn't bounded to [0, 1] and made every relevance score come
        # out as 0 after clamping. Cosine is the right metric for TF-IDF
        # vectors anyway, and it's what makes `1 - distance` a real score.
        _collection = _client.get_or_create_collection(
            "regulations", embedding_function=None, metadata={"hnsw:space": "cosine"}
        )
    return _collection


def _get_bm25_index():
    global _bm25_index, _bm25_doc_ids
    if _bm25_index is None:
        texts = [chunk["text"] for chunk in INCOME_CERTIFICATE_CORPUS]
        _bm25_doc_ids = [chunk["id"] for chunk in INCOME_CERTIFICATE_CORPUS]
        tokenized = [text.lower().split() for text in texts]
        _bm25_index = BM25Okapi(tokenized)
    return _bm25_index, _bm25_doc_ids


def index_corpus() -> None:
    """Fits TF-IDF on the corpus and loads it into Chroma. Safe to re-run."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

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


def _tfidf_full_ranking(query: str) -> list[str]:
    """Returns every corpus doc ID, best match first, via TF-IDF/cosine."""
    with open(VECTORIZER_PATH, "rb") as f:
        vectorizer = pickle.load(f)
    query_vector = vectorizer.transform([query]).toarray().tolist()
    collection = _get_collection()
    results = collection.query(query_embeddings=query_vector, n_results=len(INCOME_CERTIFICATE_CORPUS))
    return results["ids"][0]


def _bm25_full_ranking(query: str) -> list[str]:
    """Returns every corpus doc ID, best match first, via BM25."""
    bm25, doc_ids = _get_bm25_index()
    scores = bm25.get_scores(query.lower().split())
    ranked = sorted(zip(doc_ids, scores), key=lambda pair: -pair[1])
    return [doc_id for doc_id, _ in ranked]


def _reciprocal_rank_fusion(rankings: list[list[str]], k: int = RRF_K) -> list[tuple]:
    """
    Standard RRF: for each doc, sum 1/(k + rank) across every ranking it
    appears in (rank is 1-indexed). Returns [(doc_id, fused_score), ...]
    sorted best-first.
    """
    fused_scores = {}
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking, start=1):
            fused_scores[doc_id] = fused_scores.get(doc_id, 0.0) + 1.0 / (k + rank)
    return sorted(fused_scores.items(), key=lambda pair: -pair[1])


def answer_question(query: str, top_k: int = 1) -> list[dict]:
    """
    Returns up to top_k matching passages as
    [{"id": ..., "text": ..., "relevance": 0-1}, ...], best match first.
    `relevance` is the fused RRF score, min-max normalized against this
    query's own score range so it stays roughly comparable to the old
    single-ranker relevance numbers rather than RRF's raw (much smaller,
    less intuitive) score.
    """
    if not VECTORIZER_PATH.exists():
        index_corpus()

    clean_query = sanitize_rag_query(query)
    tfidf_ranking = _tfidf_full_ranking(clean_query)
    bm25_ranking = _bm25_full_ranking(clean_query)
    # BM25 first: when the two rankers tie exactly (e.g. one ranks a doc
    # #1/#2 and the other ranks it #2/#1 — a perfectly symmetric
    # disagreement), RRF's summed score is IDENTICAL for both docs, and
    # Python's stable sort falls back to insertion order. That's not a
    # hypothetical edge case — it happened on a real test query
    # ("what happens if I submit twice": BM25 correctly ranked
    # duplicate_submissions first, TF-IDF incorrectly ranked fees first,
    # exact tie). Listing BM25 first means ties resolve toward the
    # generally stronger method instead of toward whichever argument
    # order happened to be written first.
    fused = _reciprocal_rank_fusion([bm25_ranking, tfidf_ranking])

    corpus_by_id = {chunk["id"]: chunk["text"] for chunk in INCOME_CERTIFICATE_CORPUS}

    scores = [score for _, score in fused]
    score_min, score_max = min(scores), max(scores)
    score_range = (score_max - score_min) or 1.0  # avoid divide-by-zero if every score is identical

    matches = []
    for doc_id, score in fused[:top_k]:
        normalized = (score - score_min) / score_range
        matches.append({
            "id": doc_id,
            "text": corpus_by_id[doc_id],
            "relevance": round(normalized, 2),
        })
    return matches
