import http.server
import socketserver
import threading
from api.fetcher import preload, get_cache_info
from api.handler import APIHandler, create_server
from api.search import YEARS, get_stats

PORT = 8000
BIND_ADDRESS = ""


def warmup_server():
    """Pre-load data and warmup caches."""
    print("Pre-loading paper data...")
    preload(YEARS)

    cache_info = get_cache_info()
    stats = get_stats()

    print(f"  Cached {cache_info['total_cached']} papers from {len(cache_info['cached_years'])} years")
    print("Ready.")


def run_single_threaded():
    """Run the server in single-threaded mode."""
    warmup_server()

    server = create_server(PORT, BIND_ADDRESS)
    server.server_bind()
    server.server_activate()

    print(f"Serving on http://localhost:{PORT} (single-threaded)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


def run_threaded(workers=4):
    """Run the server in multi-threaded mode for better concurrency."""
    warmup_server()

    server = socketserver.ThreadingTCPServer(
        (BIND_ADDRESS, PORT),
        APIHandler,
        bind_and_activate=False
    )
    server.allow_reuse_address = True
    server.allow_reuse_port = True
    server.daemon_threads = True  # Threads exit when main thread exits
    server.server_bind()
    server.server_activate()

    print(f"Serving on http://localhost:{PORT} (threaded, {workers} workers)")

    # Start server in a separate thread for graceful shutdown
    server_thread = threading.Thread(target=server.serve_forever)
    server_thread.daemon = True
    server_thread.start()

    try:
        server_thread.join()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == "__main__":
    # Use threaded server for better performance under load
    run_threaded()
