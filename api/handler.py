import http.server
import urllib.parse
import json

from api.search import run_search


class APIHandler(http.server.SimpleHTTPRequestHandler):

    def log_message(self, fmt, *args):
        pass  # suppress per-request access logs

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == "/api/search":
            self._handle_search(parsed.query)
        else:
            super().do_GET()

    def end_headers(self):
        # Cache static assets (JS/CSS/fonts) for 1 hour; HTML for 5 min
        if not hasattr(self, '_skip_cache'):
            path = self.path.split('?')[0]
            if path.endswith(('.js', '.css', '.woff2', '.woff', '.ttf')):
                self.send_header("Cache-Control", "public, max-age=3600")
            elif path.endswith('.html') or path == '/':
                self.send_header("Cache-Control", "public, max-age=300")
        super().end_headers()

    def _handle_search(self, query_string):
        query = urllib.parse.parse_qs(query_string).get("q", [""])[0].lower()
        results = run_search(query)

        payload = json.dumps(results, separators=(',', ':')).encode("utf-8")
        self._skip_cache = True
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        del self._skip_cache
        try:
            self.wfile.write(payload)
        except BrokenPipeError:
            pass  # browser cancelled the in-flight request
