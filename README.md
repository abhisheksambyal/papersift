# PaperSift

A high-performance research paper search engine designed for clinical and medical imaging researchers. Search across NeurIPS, MICCAI, MIDL, and ISBI proceedings instantly.

## Architecture & Project Structure

PaperSift is built as a static, client-side application for maximum performance and easy deployment.

- **`api/`**: Backend logic for scrapers, search indexing, and conference configurations.
- **`data/`**: Production data index (`papers.json` and `config.json`) consumed by the frontend.
- **`data_cache/`**: Segregated local cache (by conference/year) to enable incremental updates.
- **`js/`**: Frontend search logic, filtering, theme management, and animations.
- **`scripts/`**: Maintenance utilities for data synchronization and static site generation.
- **`index.html`**: The primary search interface with a "Newsprint" aesthetic.

## Search Tips

PaperSift supports advanced query syntax to help you find research quickly:

- **General Search**: Enter keywords to search through paper **titles** and **abstracts** (e.g., `diffusion models`).
- **Author Search**: Use the `author:` prefix to search specifically for researchers.
  - `author: sambyal` — Finds papers where "sambyal" is in the author list.
  - `author: sambyal; calibration` — Finds papers by "sambyal" that also mention "calibration" in the title or abstract.
  - `author: abhishek sambyal;` — Finds specific author names (the semicolon is optional).
- **Boolean Logic**:
  - `transformer and vision` (or just space separated) — Finds papers containing both terms.
  - `cnn or rnn` — Finds papers containing either term.
- **Filters**: Use the sidebar to narrow results by conference (NeurIPS, MICCAI, etc.) and year.

## Data Management

We use a unified synchronization pipeline to keep the database fresh.

### Synchronize Data
Fetch missing records and update the frontend index in one step:
```bash
python3 scripts/sync.py
```

### Full Rebuild
Clear the cache and re-fetch all historical data from scratch:
```bash
python3 scripts/sync.py --full
```

### Cache & Indexing Logic
- **Incremental Fetching**: The system skips existing files in `data_cache/` by default.
- **Global Index**: `full_index.json` is a merged snapshot of the cache. If deleted, run `scripts/sync.py` to rebuild it from local files without re-downloading from the web.
- **Production Index**: `data/papers.json` is a minified index optimized for browser-side search.

## Deployment

PaperSift is optimized for **GitHub Pages**. All search operations are performed client-side using the pre-built JSON index, eliminating the need for a live backend server in production.

## Development

To run the application locally with the dynamic backend:
```bash
python3 server.py
```

## Features

- **Instant Search**: Client-side filtering of 40,000+ papers with sub-millisecond latency.
- **Extensive Archive**: Full proceedings for NeurIPS (1987-2024), MICCAI, MIDL, and ISBI.
- **Dynamic Themes**: Automatic Light/Dark mode transitions based on local sunrise/sunset times.
- **LaTeX Support**: MathJax integration for rendering mathematical notation in abstracts.
- **Responsive Design**: A clean, "Newsprint" aesthetic optimized for mobile and desktop research.
