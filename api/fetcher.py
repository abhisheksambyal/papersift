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
        except urllib.error.HTTPError as e:
            print(f"HTTP Error {e.code} fetching {url}: {e.reason}")
            return []
        except urllib.error.URLError as e:
            print(f"URL Error fetching {url}: {e.reason}")
            return []
        except json.JSONDecodeError as e:
            print(f"JSON decode error for {url}: {e}")
            return []
        except Exception as e:
            print(f"Unexpected error fetching {url}: {e}")
            return []


# Global fetcher instance for connection reuse
_fetcher = Fetcher()


def fetch_miccai_json(year):
    """Fetch (and in-memory cache) the MICCAI paper list for a given year."""
    # Check cache first
    if year in _fetcher._cache:
        return _fetcher._cache[year]

    url = f"https://papers.miccai.org/miccai-{year}/js/search.json"
    data = _fetcher.fetch(url)
    _fetcher._cache[year] = data
    return data


def preload(years):
    """Pre-fetch and cache paper data for the given years at startup."""
    for year in years:
        if year not in _fetcher._cache:
            fetch_miccai_json(year)
            print(f"  Loaded {year}: {len(_fetcher._cache.get(year, []))} papers")


@lru_cache(maxsize=1)
def get_cache_info():
    """Get cache statistics."""
    return {
        'cached_years': list(_fetcher._cache.keys()),
        'total_cached': sum(len(v) for v in _fetcher._cache.values())
    }



