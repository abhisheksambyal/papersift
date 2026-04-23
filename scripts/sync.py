import os
import sys
import shutil
import argparse

# Add the project root to sys.path to allow importing from api/
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from api.fetcher import CACHE_DIR, preload
from api.search import CONFERENCES
from scripts.export_static import export_static_data

def main():
    parser = argparse.ArgumentParser(description="Synchronize paper data and update frontend index.")
    parser.add_argument("--full", action="store_true", help="Perform a full rebuild by clearing the cache first.")
    args = parser.parse_args()

    # 1. Handle Full Rebuild
    if args.full:
        if os.path.exists(CACHE_DIR):
            print(f"Cleaning cache directory: {CACHE_DIR}...")
            shutil.rmtree(CACHE_DIR)
        os.makedirs(CACHE_DIR, exist_ok=True)
        print("Starting FULL rebuild (all data will be re-fetched).")
    else:
        print("Starting INCREMENTAL sync (only missing data will be fetched).")

    # 2. Fetch data
    # Note: preload() internally checks if a file exists before fetching, 
    # so it naturally supports incremental updates if the cache is not cleared.
    print("\nStep 1: Fetching data from sources...")
    try:
        preload(CONFERENCES)
    except Exception as e:
        print(f"Error during fetching: {e}")
        sys.exit(1)

    # 3. Export to frontend
    print("\nStep 2: Updating frontend index (data/papers.json)...")
    try:
        export_static_data()
    except Exception as e:
        print(f"Error during export: {e}")
        sys.exit(1)

    print("\nDone! Sync complete.")

if __name__ == "__main__":
    main()
