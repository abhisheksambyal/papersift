import http.server
import socketserver
import urllib.request
import urllib.parse
import json

PORT = 8000

YEARS = (2024, 2025)


def fetch_miccai_json(year):
    url = f"https://papers.miccai.org/miccai-{year}/js/search.json"
    try:
        with urllib.request.urlopen(urllib.request.Request(url)) as r:
            return json.loads(r.read().decode('utf-8'))
    except Exception as e:
        print(f"Failed fetching {year} data: {e}")
        return []


def build_paper(raw, year):
    return {
        "title":   raw.get("title"),
        "authors": raw.get("authors") or raw.get("tags") or "Unknown Authors",
        "url":     raw.get("pdflink") or raw.get("url"),
        "venue":   "MICCAI",
        "year":    year,
    }


def score_paper(raw, terms):
    fields = [
        (raw.get("title",    "").lower(), 5),
        (raw.get("authors",  "").lower(), 2),
        (raw.get("tags",     "").lower(), 1),
        (raw.get("category", "").lower(), 1),
    ]
    return sum(w for text, w in fields for t in terms if t in text)


class APIHandler(http.server.SimpleHTTPRequestHandler):

    def log_message(self, fmt, *args):
        pass  # suppress access logs

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path != '/api/search':
            return super().do_GET()

        query = urllib.parse.parse_qs(parsed.query).get('q', [''])[0].lower()
        terms = [t for t in query.split() if len(t) > 2]

        papers = [
            (raw, str(year))
            for year in YEARS
            for raw in fetch_miccai_json(year)
        ]

        results = []
        for raw, year in papers:
            s = score_paper(raw, terms)
            if not terms or s > 0:
                entry = build_paper(raw, year)
                entry['score'] = s
                results.append(entry)

        if terms:
            results.sort(key=lambda x: x['score'], reverse=True)

        payload = json.dumps(results[:100]).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        try:
            self.wfile.write(payload)
        except BrokenPipeError:
            pass  # browser cancelled the request mid-flight


if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), APIHandler) as httpd:
        print(f"Serving on http://localhost:{PORT}")
        httpd.serve_forever()
