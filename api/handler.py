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

    def _handle_search(self, query_string):
        query = urllib.parse.parse_qs(query_string).get("q", [""])[0].lower()
        results = run_search(query)

        payload = json.dumps(results).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-type", "application/json")
        self.end_headers()
        try:
            self.wfile.write(payload)
        except BrokenPipeError:
            pass  # browser cancelled the in-flight request
