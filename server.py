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
            data = response.read().decode('utf-8')
            return json.loads(data)
    except Exception as e:
        print(f"Failed fetching {year} JSON: {e}")
        return []

class APIHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        
        if parsed_path.path == '/api/search':
            query = urllib.parse.parse_qs(parsed_path.query).get('q', [''])[0].lower()
            query_terms = [t for t in query.split() if len(t) > 2]
            
            # Fetch ON THE FLY when the endpoint is hit!
            data_2024 = fetch_miccai_json(2024)
            data_2025 = fetch_miccai_json(2025)
            
            all_data = []
            for item in data_2024:
                item['year'] = '2024'
                all_data.append(item)
            for item in data_2025:
                item['year'] = '2025'
                all_data.append(item)
            
            results = []
            for paper in all_data:
                score = 0
                title_lower = paper.get('title', '').lower()
                authors_lower = paper.get('authors', '').lower()
                tags_lower = paper.get('tags', '').lower()
                category_lower = paper.get('category', '').lower()
                
                for term in query_terms:
                    if term in title_lower: score += 5
                    if term in authors_lower: score += 2
                    if term in tags_lower: score += 1
                    if term in category_lower: score += 1
                    if term == paper.get('year'): score += 3
                
                if not query_terms or score > 0:
                    results.append({
                        "title": paper.get("title"),
                        "authors": paper.get("authors", paper.get("tags", "Unknown Authors")),
                        "url": paper.get("pdflink", paper.get("url")),
                        "venue": f"MICCAI {paper.get('year')}",
                        "year": paper.get("year"),
                        "score": score
                    })
            
            if query_terms:
                results.sort(key=lambda x: x['score'], reverse=True)
            
            # Send response back containing maximum 100 matching items to frontend
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(results[:100]).encode('utf-8'))
        else:
            super().do_GET()

if __name__ == '__main__':
    with socketserver.TCPServer(("", PORT), APIHandler) as httpd:
        print(f"Serving on port {PORT}. Hitting search will trigger realtime fetch.")
        httpd.serve_forever()
