
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
    """Handles HTTP fetching with connection pooling, caching, and retries."""
    __slots__ = ['_cache', '_opener']

    def __init__(self):
        self._cache = {}
        # Create opener with connection pooling via HTTP handler
        https_handler = urllib.request.HTTPSHandler(
            context=_get_ssl_context(),
            check_hostname=True
        )
        self._opener = urllib.request.build_opener(https_handler)

    def fetch(self, url, timeout=30, max_retries=3):
        """Fetch URL with proper timeouts, connection reuse, and retries for 429s."""
        import time
        import random

        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
            }
        )

        for attempt in range(max_retries):
            try:
                with self._opener.open(req, timeout=timeout) as response:
                    if response.headers.get('Content-Encoding') == 'gzip':
                        import gzip
                        data = gzip.decompress(response.read())
                    else:
                        data = response.read()
                    return json.loads(data.decode('utf-8'))
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt < max_retries - 1:
                    wait = (2 ** attempt) + random.random()
                    print(f"  Rate limited (429) on {url}. Retrying in {wait:.1f}s...")
                    time.sleep(wait)
                    continue
                if e.code == 404:
                    return {} # Return empty for 404
                print(f"HTTP Error {e.code} fetching {url}: {e}")
                return {}
            except Exception as e:
                if attempt < max_retries - 1:
                    time.sleep(1)
                    continue
                print(f"Error fetching {url}: {e}")
                return {}
        return {}


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
        papers = []
        for p in data:
            papers.append({
                "title": p.get("title") or "Untitled",
                "authors": p.get("authors") or p.get("tags") or "Unknown",
                "url": p.get("pdflink") or p.get("url") or "#",
                "venue": f"MICCAI {year}",
                "year": str(year),
                "abstract": p.get("description") or p.get("discription") or p.get("abstract") or ""
            })
        print(f"  Loaded official MICCAI {year} data with abstracts.")
    else:
        # 2. Fallback to DBLP for older years
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
                "year": str(year),
                "abstract": ""
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

    cache_path = os.path.join(CACHE_DIR, f"midl_{year}.json")
    if os.path.exists(cache_path):
        with open(cache_path, 'r') as f:
            processed = json.load(f)
            _fetcher._cache['midl'][year] = processed
            return processed

    base_api = "api2" if year >= 2024 else "api"
    url = f"https://{base_api}.openreview.net/notes?content.venueid=MIDL.io/{year}/Conference"
    
    response = _fetcher.fetch(url)
    if not isinstance(response, dict): response = {}
    notes = response.get('notes', [])
    
    processed = []
    for n in notes:
        content = n.get('content', {})
        title = content.get('title')
        if isinstance(title, dict): title = title.get('value')
        authors = content.get('authors')
        if isinstance(authors, dict): authors = authors.get('value')
        venue = content.get('venue', {})
        if isinstance(venue, dict): venue = venue.get('value', '')
        
        if not title or any(x in venue.lower() for x in ["submitted", "review", "reject"]):
            continue

        abstract = content.get('abstract')
        if isinstance(abstract, dict): abstract = abstract.get('value')

        processed.append({
            "title": title,
            "authors": ", ".join(authors) if isinstance(authors, list) else authors,
            "url": f"https://openreview.net/forum?id={n['id']}",
            "venue": f"MIDL {year}",
            "year": str(year),
            "abstract": abstract or ""
        })

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

    cache_path = os.path.join(CACHE_DIR, f"isbi_{year}.json")
    if os.path.exists(cache_path):
        with open(cache_path, 'r') as f:
            processed = json.load(f)
            _fetcher._cache['isbi'][year] = processed
            return processed

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
            "year": str(year),
            "abstract": ""
        })

    if processed:
        with open(cache_path, 'w') as f:
            json.dump(processed, f)

    _fetcher._cache['isbi'][year] = processed
    return processed


def preload(config):
    """Pre-fetch and cache paper data with a 24-hour global cache."""
    from concurrent.futures import ThreadPoolExecutor, as_completed
    import time

    global_cache_path = os.path.join(CACHE_DIR, "full_index.json")
    
    # 1. Try to load from global cache if it exists and is fresh (< 24h)
    if os.path.exists(global_cache_path):
        file_age = time.time() - os.path.getmtime(global_cache_path)
        if file_age < 86400: # 24 hours
            print("Loading paper index from global cache (up to date)...")
            try:
                with open(global_cache_path, 'r') as f:
                    full_data = json.load(f)
                    for conf, years in full_data.items():
                        _fetcher._cache[conf] = {int(y): papers for y, papers in years.items()}
                    
                    total = sum(len(y) for c in _fetcher._cache.values() for y in c.values())
                    print(f"  Instant load: {total} papers from global cache.")
                    return
            except Exception as e:
                print(f"  Global cache corrupted: {e}. Re-indexing...")
        else:
            print("Global cache is older than 24 hours. Refreshing from sources...")

    tasks = []
    for conf, data in config.items():
        years = data.get('years', [])
        fetcher_fn = data.get('fetcher')
        for y in years:
            tasks.append((conf, y, fetcher_fn))

    print(f"Pre-loading {len(tasks)} conference years...")
    
    def _run_task(task):
        import random
        conf, y, fetcher_fn = task
        time.sleep(random.random() * 0.5)
        try:
            data = fetcher_fn(y)
            return conf, y, len(data)
        except Exception:
            return conf, y, 0

    with ThreadPoolExecutor(max_workers=4) as executor:
        future_to_task = {executor.submit(_run_task, task): task for task in tasks}
        for future in as_completed(future_to_task):
            conf, y, count = future.result()
            if count > 0:
                print(f"  Loaded {conf.upper()} {y}: {count} papers")

    # 2. Save the full index to a global cache file for next time
    print("Saving global paper index...")
    try:
        with open(global_cache_path, 'w') as f:
            json.dump(_fetcher._cache, f)
    except Exception as e:
        print(f"  Failed to save global cache: {e}")


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
