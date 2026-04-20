import socketserver
from api.handler import APIHandler

PORT = 8000

if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), APIHandler) as httpd:
        print(f"Serving on http://localhost:{PORT}")
        httpd.serve_forever()
