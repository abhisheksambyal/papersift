import socketserver
import threading
from api.fetcher import preload, get_cache_info
from api.handler import APIHandler
from api.search import CONFERENCES, get_stats

PORT = 8000
BIND_ADDRESS = ""


def run_server(workers=4):
    """Pre-load data and run the threaded HTTP server."""
    print(f"Pre-loading paper data...")
    preload(CONFERENCES)

    cache_info = get_cache_info()
    print(f"  Ready: {cache_info['total_cached']} papers cached.")

    server = socketserver.ThreadingTCPServer(
        (BIND_ADDRESS, PORT),
        APIHandler,
        bind_and_activate=False
    )
    server.allow_reuse_address = True
    server.allow_reuse_port = True
    server.daemon_threads = True
    server.server_bind()
    server.server_activate()

    print(f"Serving on http://localhost:{PORT} ({workers} workers)")

    server_thread = threading.Thread(target=server.serve_forever)
    server_thread.daemon = True
    server_thread.start()

    try:
        server_thread.join()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == "__main__":
    run_server()
