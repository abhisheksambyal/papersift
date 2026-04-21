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

# ── Pre-computed search index ────────────────────────────────────────────────
# Built once on first search (after data is fetched/cached).
# Each entry: (pre-lowered field dict, year, raw record)
_index = None


def _build_index():
    """Build a flat list of (lowered_fields, year_str, raw) for fast scoring."""
    global _index
    entries = []
    for year in YEARS:
        year_str = str(year)
        for raw in fetch_miccai_json(year):
            lowered = {
                field: raw.get(field, "").lower()
                for field, _ in _SCORE_FIELDS
            }
            entries.append((lowered, year_str, raw))
    _index = entries


def _score(lowered, terms):
    """Return a relevance score using pre-lowered fields."""
    score = 0
    for field, weight in _SCORE_FIELDS:
        text = lowered[field]
        for term in terms:
            if term in text:
                score += weight
    return score


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
    global _index
    if _index is None:
        _build_index()

    terms = [t for t in query.split() if len(t) > 2]

    if not terms:
        return [_build(raw, year) for _, year, raw in _index[:MAX_RESULTS]]

    scored = []
    for lowered, year, raw in _index:
        s = _score(lowered, terms)
        if s > 0:
            entry = _build(raw, year)
            entry["score"] = s
            scored.append(entry)

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:MAX_RESULTS]
