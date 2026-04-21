import urllib.request
import json
from functools import lru_cache

# Shared SSL context for connection reuse
_ssl_context = None

def _get_ssl_context():
    """Get or create a shared SSL context for connection reuse."""
    global _ssl_context
    if _ssl_context is None:
        import ssl
        _ssl_context = ssl.create_default_context()
    return _ssl_context


class Fetcher:
    """Handles HTTP fetching with connection pooling and caching."""
    __slots__ = ['_cache', '_opener']

    def __init__(self):
        self._cache = {}
        # Create opener with connection pooling via HTTP handler
        https_handler = urllib.request.HTTPSHandler(
            context=_get_ssl_context(),
            # Enable connection reuse
            check_hostname=True
        )
        self._opener = urllib.request.build_opener(https_handler)

    def fetch(self, url, timeout=30):
        """Fetch URL with proper timeouts and connection reuse."""
        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
            }
        )

        try:
            with self._opener.open(req, timeout=timeout) as response:
                # Check if response is gzip encoded
                if response.headers.get('Content-Encoding') == 'gzip':
                    import gzip
                    data = gzip.decompress(response.read())
                else:
                    data = response.read()
                return json.loads(data.decode('utf-8'))
        except Exception as e:
            print(f"Error fetching {url}: {e}")
            return {} # Return empty dict to prevent attribute errors


# Global fetcher instance for connection reuse
_fetcher = Fetcher()


def fetch_miccai_json(year):
    """Fetch (and in-memory cache) the MICCAI paper list for a given year."""
    if year in _fetcher._cache.get('miccai', {}):
        return _fetcher._cache['miccai'][year]

    if 'miccai' not in _fetcher._cache: _fetcher._cache['miccai'] = {}
    
    url = f"https://papers.miccai.org/miccai-{year}/js/search.json"
    data = _fetcher.fetch(url)
    # MICCAI returns a list
    papers = data if isinstance(data, list) else []
    _fetcher._cache['miccai'][year] = papers
    return papers


def fetch_midl_json(year):
    """Fetch MIDL papers from OpenReview API."""
    if year in _fetcher._cache.get('midl', {}):
        return _fetcher._cache['midl'][year]

    if 'midl' not in _fetcher._cache: _fetcher._cache['midl'] = {}

    # 2020-2023 use API v1, 2024+ use API v2
    base_api = "api2" if year >= 2024 else "api"
    url = f"https://{base_api}.openreview.net/notes?content.venueid=MIDL.io/{year}/Conference"
    
    response = _fetcher.fetch(url)
    if not isinstance(response, dict): response = {}
    notes = response.get('notes', [])
    
    processed = []
    for n in notes:
        content = n.get('content', {})
        
        # Normalize v1 vs v2
        title = content.get('title')
        if isinstance(title, dict): title = title.get('value')
        
        authors = content.get('authors')
        if isinstance(authors, dict): authors = authors.get('value')
        
        venue = content.get('venue', {})
        if isinstance(venue, dict): venue = venue.get('value', '')
        
        # Filter accepted papers (avoid "Submitted", "under review", "Rejected")
        if not title or any(x in venue.lower() for x in ["submitted", "review", "reject"]):
            continue

        processed.append({
            "title": title,
            "authors": ", ".join(authors) if isinstance(authors, list) else authors,
            "url": f"https://openreview.net/forum?id={n['id']}",
            "venue": f"MIDL {year}",
            "year": str(year)
        })

    _fetcher._cache['midl'][year] = processed
    return processed


def fetch_isbi_json(year):
    """Fetch ISBI papers from DBLP API."""
    if year in _fetcher._cache.get('isbi', {}):
        return _fetcher._cache['isbi'][year]

    if 'isbi' not in _fetcher._cache: _fetcher._cache['isbi'] = {}

    # DBLP query for ISBI conference by year
    # h=1000 to get a large chunk of papers (ISBI usually has ~700-900)
    url = f"https://dblp.org/search/publ/api?q=venue:ISBI:year:{year}:&format=json&h=1000"
    
    response = _fetcher.fetch(url)
    if not isinstance(response, dict): response = {}
    
    hits = response.get('result', {}).get('hits', {}).get('hit', [])
    if not isinstance(hits, list): hits = [hits] if hits else []
    
    processed = []
    for h in hits:
        info = h.get('info', {})
        
        # Skip if not a paper (e.g., Editorship/Proceedings entry)
        if info.get('type') != 'Conference and Workshop Papers':
            continue
            
        title = info.get('title', '').rstrip('.')
        
        # Handle authors structure in DBLP
        authors_data = info.get('authors', {}).get('author', [])
        if isinstance(authors_data, dict): authors_data = [authors_data]
        authors_list = [a.get('text', 'Unknown') for a in authors_data]
        
        processed.append({
            "title": title,
            "authors": ", ".join(authors_list),
            "url": info.get('ee') or info.get('url') or "#",
            "venue": f"ISBI {year}",
            "year": str(year)
        })

    _fetcher._cache['isbi'][year] = processed
    return processed


def preload(config):
    """Pre-fetch and cache paper data based on conference config."""
    for conf, data in config.items():
        years = data.get('years', [])
        fetcher_fn = data.get('fetcher')
        for y in years:
            fetcher_fn(y)
            print(f"  Loaded {conf.upper()} {y}: {len(_fetcher._cache[conf].get(y, []))} papers")


@lru_cache(maxsize=1)
def get_cache_info():
    """Get cache statistics."""
    total = 0
    years_map = {}
    for conf, years in _fetcher._cache.items():
        years_map[conf] = list(years.keys())
        total += sum(len(v) for v in years.values())
    return {
        'cached_conferences': years_map,
        'total_cached': total
    }



