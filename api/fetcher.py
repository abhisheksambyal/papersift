
import urllib.request
import json
import os
from functools import lru_cache

CACHE_DIR = "data_cache"
os.makedirs(CACHE_DIR, exist_ok=True)

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
    """Fetch (and cache) the MICCAI paper list for a given year."""
    if year in _fetcher._cache.get('miccai', {}):
        return _fetcher._cache['miccai'][year]

    if 'miccai' not in _fetcher._cache: _fetcher._cache['miccai'] = {}
    
    # Try disk cache first
    cache_path = os.path.join(CACHE_DIR, f"miccai_{year}.json")
    if os.path.exists(cache_path):
        with open(cache_path, 'r') as f:
            papers = json.load(f)
            _fetcher._cache['miccai'][year] = papers
            return papers

    # 1. Try official papers.miccai.org (usually 2024+)
    url = f"https://papers.miccai.org/miccai-{year}/js/search.json"
    data = _fetcher.fetch(url)
    
    if isinstance(data, list) and len(data) > 0:
        papers = data
    else:
        # 2. Fallback to DBLP for older years
        print(f"  Official MICCAI {year} not found, falling back to DBLP...")
        url = f"https://dblp.org/search/publ/api?q=venue:MICCAI:year:{year}:&format=json&h=1000"
        response = _fetcher.fetch(url)
        if not isinstance(response, dict): response = {}
        hits = response.get('result', {}).get('hits', {}).get('hit', [])
        if not isinstance(hits, list): hits = [hits] if hits else []
        
        papers = []
        for h in hits:
            info = h.get('info', {})
            if info.get('type') != 'Conference and Workshop Papers':
                continue
            
            authors_data = info.get('authors', {}).get('author', [])
            if isinstance(authors_data, dict): authors_data = [authors_data]
            authors_list = [a.get('text', 'Unknown') for a in authors_data]
            
            papers.append({
                "title": info.get('title', '').rstrip('.'),
                "authors": ", ".join(authors_list),
                "url": info.get('ee') or info.get('url') or "#",
                "venue": f"MICCAI {year}",
                "year": str(year)
            })

    # Save to disk
    if papers:
        with open(cache_path, 'w') as f:
            json.dump(papers, f)

    _fetcher._cache['miccai'][year] = papers
    return papers


def fetch_midl_json(year):
    """Fetch MIDL papers from OpenReview API."""
    if year in _fetcher._cache.get('midl', {}):
        return _fetcher._cache['midl'][year]

    if 'midl' not in _fetcher._cache: _fetcher._cache['midl'] = {}

    # Try disk cache first
    cache_path = os.path.join(CACHE_DIR, f"midl_{year}.json")
    if os.path.exists(cache_path):
        with open(cache_path, 'r') as f:
            processed = json.load(f)
            _fetcher._cache['midl'][year] = processed
            return processed

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
        
        if not title or any(x in venue.lower() for x in ["submitted", "review", "reject"]):
            continue

        processed.append({
            "title": title,
            "authors": ", ".join(authors) if isinstance(authors, list) else authors,
            "url": f"https://openreview.net/forum?id={n['id']}",
            "venue": f"MIDL {year}",
            "year": str(year)
        })

    # Save to disk
    if processed:
        with open(cache_path, 'w') as f:
            json.dump(processed, f)

    _fetcher._cache['midl'][year] = processed
    return processed


def fetch_isbi_json(year):
    """Fetch ISBI papers from DBLP API."""
    if year in _fetcher._cache.get('isbi', {}):
        return _fetcher._cache['isbi'][year]

    if 'isbi' not in _fetcher._cache: _fetcher._cache['isbi'] = {}

    # Try disk cache first
    cache_path = os.path.join(CACHE_DIR, f"isbi_{year}.json")
    if os.path.exists(cache_path):
        with open(cache_path, 'r') as f:
            processed = json.load(f)
            _fetcher._cache['isbi'][year] = processed
            return processed

    # DBLP query for ISBI conference by year
    url = f"https://dblp.org/search/publ/api?q=venue:ISBI:year:{year}:&format=json&h=1000"
    
    response = _fetcher.fetch(url)
    if not isinstance(response, dict): response = {}
    hits = response.get('result', {}).get('hits', {}).get('hit', [])
    if not isinstance(hits, list): hits = [hits] if hits else []
    
    processed = []
    for h in hits:
        info = h.get('info', {})
        if info.get('type') != 'Conference and Workshop Papers':
            continue
        title = info.get('title', '').rstrip('.')
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

    # Save to disk
    if processed:
        with open(cache_path, 'w') as f:
            json.dump(processed, f)

    _fetcher._cache['isbi'][year] = processed
    return processed


def preload(config):
    """Pre-fetch and cache paper data in parallel."""
    from concurrent.futures import ThreadPoolExecutor
    
    tasks = []
    for conf, data in config.items():
        years = data.get('years', [])
        fetcher_fn = data.get('fetcher')
        for y in years:
            tasks.append((conf, y, fetcher_fn))

    print(f"Pre-loading {len(tasks)} conference years...")
    
    def _run_task(task):
        conf, y, fetcher_fn = task
        data = fetcher_fn(y)
        return conf, y, len(data)

    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(_run_task, tasks))
    
    for conf, y, count in results:
        print(f"  Loaded {conf.upper()} {y}: {count} papers")


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



