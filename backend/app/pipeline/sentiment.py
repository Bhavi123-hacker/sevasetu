"""
Feedback sentiment analysis.

VADER (rule-based, lexicon-driven), not a hosted API — chosen specifically
so this has no rate limit and no cost to exhaust, ever. It's also a
reasonable technical fit: VADER was built for short, informal text (it
was originally validated on social-media posts), which is exactly what
citizen feedback looks like. A transformer-based classifier would likely
edge it out on nuance, at the cost of a real model download and slower
inference — a fair trade to revisit later, not a must-have now.
"""
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_analyzer = SentimentIntensityAnalyzer()


def analyze_sentiment(text: str) -> dict:
    scores = _analyzer.polarity_scores(text)
    compound = scores["compound"]

    if compound >= 0.05:
        label = "positive"
    elif compound <= -0.05:
        label = "negative"
    else:
        label = "neutral"

    return {"label": label, "score": round(compound, 3)}
