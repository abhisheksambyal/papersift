from api.fetcher import fetch_miccai_json

YEARS = (2024, 2025)
MAX_RESULTS = 100

# Weighted fields used for relevance scoring
_SCORE_FIELDS = [
    ("title",    5),
    ("authors",  2),
    ("tags",     1),
    ("category", 1),
]


def _score(raw, terms):
    """Return a relevance score for a paper given the query terms."""
    return sum(
        weight
        for field, weight in _SCORE_FIELDS
        for term in terms
        if term in raw.get(field, "").lower()
    )


def _build(raw, year):
    """Normalise a raw API record into the shape expected by the frontend."""
    return {
        "title":   raw.get("title"),
        "authors": raw.get("authors") or raw.get("tags") or "Unknown Authors",
        "url":     raw.get("pdflink") or raw.get("url"),
        "venue":   "MICCAI",
        "year":    year,
    }


def run_search(query):
    """Return up to MAX_RESULTS papers ranked by relevance to *query*."""
    terms = [t for t in query.split() if len(t) > 2]

    results = []
    for year in YEARS:
        for raw in fetch_miccai_json(year):
            s = _score(raw, terms)
            if not terms or s > 0:
                entry = _build(raw, str(year))
                entry["score"] = s
                results.append(entry)

    if terms:
        results.sort(key=lambda x: x["score"], reverse=True)

    return results[:MAX_RESULTS]
