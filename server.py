import socketserver
from api.fetcher import preload
from api.handler import APIHandler
from api.search import YEARS

PORT = 8000

if __name__ == "__main__":
    print("Pre-loading paper data...")
    preload(YEARS)
    print("Ready.")

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), APIHandler) as httpd:
        print(f"Serving on http://localhost:{PORT}")
        httpd.serve_forever()
