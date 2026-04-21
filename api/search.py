from functools import lru_cache
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
    """Return a relevance score using substring matching for partial word search."""
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


# Cache for repeated queries
_query_cache = {}
_MAX_CACHE_SIZE = 50


def run_search(query):
    """Return up to MAX_RESULTS papers ranked by relevance to *query*."""
    global _index, _query_cache

    if _index is None:
        _build_index()

    terms = [t.lower() for t in query.split() if len(t) > 2]

    if not terms:
        return [_build(raw, year) for _, year, raw in _index[:MAX_RESULTS]]

    # Check cache for exact query
    cache_key = query.lower()
    if cache_key in _query_cache:
        return _query_cache[cache_key]

    scored = []
    for lowered, year, raw in _index:
        s = _score(lowered, terms)
        if s > 0:
            entry = _build(raw, year)
            entry["score"] = s
            scored.append(entry)

    scored.sort(key=lambda x: x["score"], reverse=True)
    results = scored[:MAX_RESULTS]

    # Cache results (simple LRU eviction)
    if len(_query_cache) >= _MAX_CACHE_SIZE:
        _query_cache.clear()
    _query_cache[cache_key] = results

    return results


@lru_cache(maxsize=1)
def get_stats():
    """Get search index statistics."""
    if _index is None:
        _build_index()
    return {
        "total_papers": len(_index),
        "years": list(YEARS)
    }
