import argparse
import datetime
import json
import os
import sys

# Allow running this file directly (python3 scripts/export_static.py), not just
# as a module imported by scripts/sync.py.
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

def export_static_data():
    # Imported lazily so --stats-only, which only reads the already-exported
    # data/*.json, doesn't need the scrape pipeline or its dependencies.
    from api.search import _build_index, get_search_config, CONFERENCES
    from api.fetcher import preload

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

    # Coverage counts for the About page, derived from the files just written.
    build_stats()

    print("Export complete.")


def build_stats():
    """Merge a `stats` block into data/config.json for the About page.

    Derived from the exported data/{id}.json files rather than the in-memory
    index, so this can run standalone (--stats-only) without re-fetching
    anything. Purely additive: js/core.js and js/ui.js read only `conferences`
    and `years`, so an extra key can't break the search UI.
    """
    config_path = "data/config.json"
    with open(config_path) as f:
        config = json.load(f)

    venues, total = {}, 0
    for conf in config["conferences"]:
        conf_id = conf["id"]
        path = f"data/{conf_id}.json"
        if not os.path.exists(path):
            print(f"  ! {path} missing, skipping in stats.")
            continue
        with open(path) as f:
            papers = json.load(f)
        years = [int(p["year"]) for p in papers if p.get("year")]
        if not papers:
            continue
        total += len(papers)
        venues[conf_id] = {
            "name": conf["name"],
            "count": len(papers),
            "first": min(years) if years else None,
            "last": max(years) if years else None,
        }

    spans = [y for v in venues.values() for y in (v["first"], v["last"]) if y]
    stats = {
        "total": total,
        "generated": datetime.date.today().isoformat(),
        "years": {"first": min(spans), "last": max(spans)} if spans else {},
        "venues": venues,
    }

    # `generated` means "when the numbers last actually changed", not "when this
    # last ran". The weekly workflow calls this on a schedule, so without the
    # comparison every run would rewrite the date, produce a commit, and tell
    # the About page the index was updated on a week nothing was added.
    previous = config.get("stats")
    if previous and {k: v for k, v in previous.items() if k != "generated"} == \
                    {k: v for k, v in stats.items() if k != "generated"}:
        print(f"Stats unchanged ({total} papers across {len(venues)} venues); "
              f"{config_path} left as-is.")
        return

    config["stats"] = stats
    with open(config_path, "w") as f:
        json.dump(config, f, separators=(',', ':'))
    print(f"Wrote stats to {config_path}: {total} papers across {len(venues)} venues.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export the static frontend index.")
    parser.add_argument(
        "--stats-only",
        action="store_true",
        help="Only recompute the coverage stats in data/config.json from the "
             "existing data/*.json files (no fetching, no re-export).",
    )
    args = parser.parse_args()

    if args.stats_only:
        build_stats()
    else:
        export_static_data()
