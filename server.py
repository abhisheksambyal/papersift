import http.server
import socketserver
import urllib.request
import urllib.parse
import json

PORT = 8000

def fetch_miccai_json(year):
    url = f"https://papers.miccai.org/miccai-{year}/js/search.json"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Failed fetching {year} data: {e}")
        return []

def build_paper(paper, year):
    return {
        "title":   paper.get("title"),
        "authors": paper.get("authors", paper.get("tags", "Unknown Authors")),
        "url":     paper.get("pdflink", paper.get("url")),
        "venue":   f"MICCAI",
        "year":    year,
    }

def score_paper(paper, query_terms):
    score = 0
    title   = paper.get('title', '').lower()
    authors = paper.get('authors', '').lower()
    tags    = paper.get('tags', '').lower()
    category = paper.get('category', '').lower()

    for term in query_terms:
        if term in title:    score += 5
        if term in authors:  score += 2
        if term in tags:     score += 1
        if term in category: score += 1
    return score

class APIHandler(http.server.SimpleHTTPRequestHandler):
    def handle_error(self, request, client_address):
        pass  # Suppress noisy BrokenPipeError from debounced browser requests

    def log_message(self, format, *args):
        pass  # Suppress per-request access logs (errors still print to stderr)
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == '/api/search':
            query = urllib.parse.parse_qs(parsed.query).get('q', [''])[0].lower()
            query_terms = [t for t in query.split() if len(t) > 2]

            all_papers = []
            for year in (2024, 2025):
                for item in fetch_miccai_json(year):
                    all_papers.append((item, str(year)))

            results = []
            for paper, year in all_papers:
                s = score_paper(paper, query_terms)
                if not query_terms or s > 0:
                    entry = build_paper(paper, year)
                    entry['score'] = s
                    results.append(entry)

            if query_terms:
                results.sort(key=lambda x: x['score'], reverse=True)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(results[:100]).encode('utf-8'))
        else:
            super().do_GET()

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), APIHandler) as httpd:
        print(f"Serving on http://localhost:{PORT}")
        httpd.serve_forever()
