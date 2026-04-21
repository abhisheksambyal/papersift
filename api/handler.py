import http.server
import urllib.parse
import json
import io
import gzip

from api.search import run_search

# Pre-computed headers for common responses
_JSON_HEADERS = [
    ("Content-Type", "application/json; charset=utf-8"),
    ("Cache-Control", "no-store"),
    ("X-Content-Type-Options", "nosniff"),
]

_CORS_HEADERS = [
    ("Access-Control-Allow-Origin", "*"),
    ("Access-Control-Allow-Methods", "GET, OPTIONS"),
    ("Access-Control-Allow-Headers", "Content-Type"),
]


class APIHandler(http.server.SimpleHTTPRequestHandler):
    """Optimized HTTP request handler with gzip support and efficient JSON encoding."""

    # Protocol version for connection reuse
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        """Suppress per-request access logs in production."""
        pass

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        for header, value in _CORS_HEADERS:
            self.send_header(header, value)
        self.end_headers()

    def do_GET(self):
        """Handle GET requests with efficient routing."""
        parsed = urllib.parse.urlparse(self.path)

        # Fast path for API search endpoint
        if parsed.path == "/api/search":
            self._handle_search(parsed.query)
        else:
            # Static files with caching headers
            self._handle_static(parsed.path)

    def _handle_static(self, path):
        """Serve static files with optimized caching headers."""
        if path.endswith(('.woff2', '.woff', '.ttf')):
            self._cache_headers = ("Cache-Control", "public, max-age=3600, immutable")
        elif path.endswith(('.js', '.css')):
            self._cache_headers = ("Cache-Control", "no-cache, no-store, must-revalidate")
        elif path.endswith('.html') or path == '/':
            self._cache_headers = ("Cache-Control", "public, max-age=300")
        else:
            self._cache_headers = None
        super().do_GET()

    def end_headers(self):
        """Add cache and security headers."""
        if hasattr(self, '_cache_headers') and self._cache_headers:
            self.send_header(*self._cache_headers)
            delattr(self, '_cache_headers')
        super().end_headers()

    def _handle_search(self, query_string):
        """Handle search requests with optimized JSON encoding and optional gzip."""
        # Parse query efficiently
        query = urllib.parse.parse_qs(query_string).get("q", [""])[0].lower()

        # Get search results
        results = run_search(query)

        # Encode JSON efficiently
        payload = self._encode_json(results)

        # Check if client accepts gzip
        accepts_gzip = 'gzip' in self.headers.get('Accept-Encoding', '')

        if accepts_gzip and len(payload) > 1024:
            # Compress for larger payloads
            compressed = gzip.compress(payload, compresslevel=6)
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Content-Length", str(len(compressed)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            try:
                self.wfile.write(compressed)
            except BrokenPipeError:
                pass  # Client disconnected
        else:
            self.send_response(200)
            for header, value in _JSON_HEADERS:
                self.send_header(header, value)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            try:
                self.wfile.write(payload)
            except BrokenPipeError:
                pass  # Client disconnected

    @staticmethod
    def _encode_json(data):
        """Encode JSON with minimal separators for compact output."""
        # Use orjson if available (much faster), fallback to standard json
        try:
            import orjson
            return orjson.dumps(data)
        except ImportError:
            return json.dumps(data, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
