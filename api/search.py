from api.fetcher import fetch_miccai_json, fetch_midl_json, fetch_isbi_json
from functools import lru_cache
from datetime import date

# Conference configuration
CURRENT_YEAR = date.today().year

CONFERENCES = {
    "miccai": {
        "years": tuple(range(2018, CURRENT_YEAR + 1)),
        "fetcher": fetch_miccai_json,
    },
    "midl": {
        "years": tuple(range(2018, CURRENT_YEAR + 2)), # Some MIDL years are ahead
        "fetcher": fetch_midl_json,
    },
    "isbi": {
        "years": tuple(range(2004, CURRENT_YEAR + 1)),
        "fetcher": fetch_isbi_json,
    }
}

MAX_RESULTS = 100

# Weighted fields used for relevance scoring
_SCORE_FIELDS = [
    ("title",    10), # Boost title matches as requested
    ("authors",  2),
    ("abstract", 5), # Include abstract in search relevance
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
                    "year": raw.get("year") or year_str,
                    "abstract": raw.get("abstract") or ""
                }
                
                lowered = {
                    "title": normalized["title"].lower(),
                    "authors": normalized["authors"].lower(),
                    "abstract": normalized["abstract"].lower(),
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
        # Filter by venue if provided (can be a list)
        if venue:
            venue_list = [v.lower() for v in venue] if isinstance(venue, list) else [venue.lower()]
            if not any(v in raw["venue"].lower() for v in venue_list):
                continue
        
        # Filter by year if provided (can be a list)
        if year:
            year_list = [str(y) for y in year] if isinstance(year, list) else [str(year)]
            if str(raw["year"]) not in year_list:
                continue

        if not terms:
            # If no query, just add to results (will be sliced later)
            scored.append({**raw, "score": 0})
            continue

        s = _score(lowered, terms)
        if s > 0:
            scored.append({**raw, "score": s})

    # Sort primarily by year (desc) then by relevance score (desc)
    scored.sort(key=lambda x: (x.get("year", "0"), x["score"]), reverse=True)
    return scored[:MAX_RESULTS]


@lru_cache(maxsize=1)
def get_stats():
    """Consolidated stats for all indexed conferences."""
    if _index is None: _build_index()
    return {
        "total_papers": len(_index),
        "conferences": list(CONFERENCES.keys())
    }

def get_search_config():
    """Return conference and year metadata for the UI."""
    if _index is None: _build_index()
    
    years = set()
    for _, raw in _index:
        y = raw.get("year")
        if y: years.add(int(y))
    
    return {
        "conferences": [
            {"id": "miccai", "name": "MICCAI"},
            {"id": "midl", "name": "MIDL"},
            {"id": "isbi", "name": "ISBI"}
        ],
        "years": sorted(list(years), reverse=True)
    }
