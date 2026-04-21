from api.fetcher import fetch_miccai_json, fetch_midl_json
from functools import lru_cache

# Conference configuration
CONFERENCES = {
    "miccai": {
        "years": (2024, 2025),
        "fetcher": fetch_miccai_json,
    },
    "midl": {
        "years": (2020, 2021, 2022, 2023, 2024, 2025, 2026),
        "fetcher": fetch_midl_json,
    }
}

MAX_RESULTS = 100

# Weighted fields used for relevance scoring
_SCORE_FIELDS = [
    ("title",    10), # Boost title matches as requested
    ("authors",  2),
    ("venue",    1),
]

_index = None

def _build_index():
    """Build and normalize the search index for all conferences."""
    global _index
    entries = []
    for conf_id, config in CONFERENCES.items():
        fetcher = config["fetcher"]
        for year in config["years"]:
            papers = fetcher(year)
            year_str = str(year)
            for raw in papers:
                # Ensure every record has a 'year' and 'venue' field even if source differs
                normalized = {
                    "title": raw.get("title") or "Untitled",
                    "authors": raw.get("authors") or raw.get("tags") or "Unknown Authors",
                    "url": raw.get("url") or raw.get("pdflink") or "#",
                    "venue": raw.get("venue") or f"{conf_id.upper()} {year}",
                    "year": raw.get("year") or year_str
                }
                
                lowered = {
                    "title": normalized["title"].lower(),
                    "authors": normalized["authors"].lower(),
                    "venue": normalized["venue"].lower(),
                }
                entries.append((lowered, normalized))
    _index = entries


def _score(lowered, terms):
    """Relevance scoring with higher weight for title matches."""
    score = 0
    for field, weight in _SCORE_FIELDS:
        text = lowered.get(field, "")
        for term in terms:
            if term in text:
                score += weight
    return score


def run_search(query, venue=None, year=None):
    """Search cross-conference papers with relevance ranking and filters."""
    global _index
    if _index is None: _build_index()

    terms = [t.lower() for t in query.split() if len(t) > 2]
    
    scored = []
    for lowered, raw in _index:
        # Filter by venue if provided
        if venue and venue.lower() not in raw["venue"].lower():
            continue
        
        # Filter by year if provided
        if year and str(year) != str(raw["year"]):
            continue

        if not terms:
            # If no query, just add to results (will be sliced later)
            scored.append({**raw, "score": 0})
            continue

        s = _score(lowered, terms)
        if s > 0:
            scored.append({**raw, "score": s})

    # Sort by score (desc) then by year (desc) if scores are equal
    scored.sort(key=lambda x: (x["score"], x.get("year", "0")), reverse=True)
    return scored[:MAX_RESULTS]


@lru_cache(maxsize=1)
def get_stats():
    """Consolidated stats for all indexed conferences."""
    if _index is None: _build_index()
    return {
        "total_papers": len(_index),
        "conferences": list(CONFERENCES.keys())
    }
