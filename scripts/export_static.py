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

    # Export one file per conference (data/{id}.json) instead of a single
    # blob - keeps individual files under hosting size limits and lets the
    # browser fetch them in parallel.
    os.makedirs("data", exist_ok=True)
    by_conference = {}
    for _, raw in _index:
        conf_id = raw["venue"].split(" ")[0].lower()
        by_conference.setdefault(conf_id, []).append(raw)

    total = 0
    for conf_id, papers in by_conference.items():
        total += len(papers)
        print(f"Exporting {len(papers)} papers to data/{conf_id}.json...")
        with open(f"data/{conf_id}.json", "w") as f:
            json.dump(papers, f, separators=(',', ':'))
    print(f"Exported {total} papers across {len(by_conference)} conference files.")

    # Export config.json
    config = get_search_config()
    print("Exporting config to data/config.json...")
    with open("data/config.json", "w") as f:
        json.dump(config, f, separators=(',', ':'))
        
    print("Export complete.")

if __name__ == "__main__":
    export_static_data()
