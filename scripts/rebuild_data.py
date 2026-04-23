import os
import shutil
import sys

# Add the project root to sys.path to import from api
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from api.fetcher import preload
from api.search import CONFERENCES

CACHE_DIR = "data_cache"

def rebuild_all():
    print("WARNING: This will delete all cached data and re-fetch from sources.")
    confirm = input("Are you sure? (y/n): ")
    if confirm.lower() != 'y':
        print("Aborted.")
        return

    # 1. Clear existing cache
    if os.path.exists(CACHE_DIR):
        print(f"Cleaning {CACHE_DIR}...")
        # We keep the directory but remove all .json files
        for f in os.listdir(CACHE_DIR):
            if f.endswith(".json"):
                os.remove(os.path.join(CACHE_DIR, f))
    else:
        os.makedirs(CACHE_DIR)

    # 2. Re-run preload
    print("Starting full data rebuild. This may take some time...")
    preload(CONFERENCES)
    print("Rebuild complete!")

if __name__ == "__main__":
    rebuild_all()
