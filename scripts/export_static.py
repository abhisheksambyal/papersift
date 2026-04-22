import json
import os
from api.search import _build_index, get_search_config, CONFERENCES
from api.fetcher import preload

def export_static_data():
    print("Pre-loading data...")
    preload(CONFERENCES)
    
    print("Building index...")
    _build_index()
    
    from api.search import _index
    
    # Export papers.json
    papers = [raw for lowered, raw in _index]
    os.makedirs("data", exist_ok=True)
    
    print(f"Exporting {len(papers)} papers to data/papers.json...")
    with open("data/papers.json", "w") as f:
        json.dump(papers, f, separators=(',', ':'))
        
    # Export config.json
    config = get_search_config()
    print("Exporting config to data/config.json...")
    with open("data/config.json", "w") as f:
        json.dump(config, f, separators=(',', ':'))
        
    print("Export complete.")

if __name__ == "__main__":
    export_static_data()
