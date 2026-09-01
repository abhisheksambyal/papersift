from api.fetcher import (
    fetch_miccai_json, fetch_midl_json, fetch_isbi_json, fetch_neurips_json,
    fetch_icml_json, fetch_cvpr_json, fetch_iccv_json, fetch_eccv_json,
    fetch_aaai_json, fetch_ijcai_json, fetch_iclr_json, fetch_tmi_json,
)
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
    },
    "tmi": {
        "years": tuple(range(1992, CURRENT_YEAR + 1)),
        "fetcher": fetch_tmi_json,
    },
    "neurips": {
        "years": tuple(range(1987, CURRENT_YEAR + 1)),
        "fetcher": fetch_neurips_json,
    },
    "icml": {
        "years": tuple(range(2013, CURRENT_YEAR + 1)),
        "fetcher": fetch_icml_json,
    },
    "cvpr": {
        "years": tuple(range(2013, CURRENT_YEAR + 1)),
        "fetcher": fetch_cvpr_json,
    },
    "iccv": {
        "years": tuple(y for y in range(2013, CURRENT_YEAR + 1) if y % 2 == 1), # Biennial (odd years)
        "fetcher": fetch_iccv_json,
    },
    "eccv": {
        "years": tuple(y for y in range(2018, CURRENT_YEAR + 1) if y % 2 == 0), # Biennial (even years)
        "fetcher": fetch_eccv_json,
    },
    "aaai": {
        "years": tuple(range(2020, CURRENT_YEAR + 1)), # OAI feed only covers 2020+
        "fetcher": fetch_aaai_json,
    },
    "ijcai": {
        "years": tuple(range(2017, CURRENT_YEAR + 1)), # No per-paper listing before 2017
        "fetcher": fetch_ijcai_json,
    },
    "iclr": {
        "years": tuple(range(2013, CURRENT_YEAR + 1)), # DBLP's ICLR stream starts in 2013
        "fetcher": fetch_iclr_json,
    },
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
                # Normalize record
                normalized = {
                    "title": raw.get("title") or "Untitled",
                    "authors": raw.get("authors") or raw.get("tags") or "Unknown Authors",
                    "url": raw.get("url") or raw.get("pdflink") or "#",
                    "venue": raw.get("venue") or f"{conf_id.upper()} {year}",
                    "year": raw.get("year") or year_str,
                    "abstract": raw.get("abstract") or ""
                }
                
                # Pre-join all searchable text for ultra-fast initial filtering
                search_blob = f"{normalized['title']} {normalized['authors']} {normalized['abstract']} {normalized['venue']}".lower()
                
                # Keep individual fields for detailed scoring
                lowered = {
                    "title": normalized["title"].lower(),
                    "authors": normalized["authors"].lower(),
                    "abstract": normalized["abstract"].lower(),
                    "venue": normalized["venue"].lower(),
                    "_all": search_blob
                }
                entries.append((lowered, normalized))
    _index = entries


def run_search(query, venue=None, year=None):
    """Search cross-conference papers with relevance ranking and filters."""
    global _index
    if _index is None: _build_index()

    terms = [t.lower() for t in query.split() if len(t) > 2]
    
    # Pre-process filters
    venue_set = set(v.lower() for v in (venue if isinstance(venue, list) else [venue])) if venue else None
    year_set = set(str(y) for y in (year if isinstance(year, list) else [year])) if year else None
    
    scored = []
    for lowered, raw in _index:
        # 1. Fast Filter Checks
        if venue_set and not any(v in lowered["venue"] for v in venue_set):
            continue
        if year_set and str(raw["year"]) not in year_set:
            continue

        if not terms:
            scored.append({**raw, "score": 0})
            continue

        # 2. Optimized Search matching
        s = 0
        search_all = lowered["_all"]
        match_count = 0
        for term in terms:
            if term in search_all:
                match_count += 1
                # Detailed scoring only for matches
                for field, weight in _SCORE_FIELDS:
                    if term in lowered[field]:
                        s += weight
        
        if match_count == len(terms):
            scored.append({**raw, "score": s})

    # Chronological sort (primary) then relevance (secondary)
    scored.sort(key=lambda x: (int(x.get("year", 0)), x["score"]), reverse=True)
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
            {"id": "isbi", "name": "ISBI"},
            {"id": "tmi", "name": "TMI"},
            {"id": "neurips", "name": "NeurIPS"},
            {"id": "icml", "name": "ICML"},
            {"id": "cvpr", "name": "CVPR"},
            {"id": "iccv", "name": "ICCV"},
            {"id": "eccv", "name": "ECCV"},
            {"id": "aaai", "name": "AAAI"},
            {"id": "ijcai", "name": "IJCAI"},
            {"id": "iclr", "name": "ICLR"}
        ],
        "years": sorted(list(years), reverse=True)
    }
