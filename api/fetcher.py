import urllib.request
import json

_cache = {}


def fetch_miccai_json(year):
    """Fetch (and in-memory cache) the MICCAI paper list for a given year."""
    if year in _cache:
        return _cache[year]

    url = f"https://papers.miccai.org/miccai-{year}/js/search.json"
    try:
        with urllib.request.urlopen(urllib.request.Request(url)) as r:
            data = json.loads(r.read().decode('utf-8'))
            _cache[year] = data
            return data
    except Exception as e:
        print(f"Failed fetching {year} data: {e}")
        return []


def preload(years):
    """Pre-fetch and cache paper data for the given years at startup."""
    for year in years:
        if year not in _cache:
            fetch_miccai_json(year)
            print(f"  Loaded {year}: {len(_cache.get(year, []))} papers")
