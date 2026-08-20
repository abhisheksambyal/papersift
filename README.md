# 📰 PaperSift

A high-performance, monochromatic research search engine for AI/ML and medical imaging researchers. PaperSift provides sub-millisecond access to over 120,000 papers from major conferences including NeurIPS, ICML, CVPR, ICCV, ECCV, AAAI, IJCAI, MICCAI, MIDL, and ISBI.

## ✨ Key Features

- **⚡ Instant Search**: Client-side filtering of 120,000+ papers with negligible latency.
- **📚 Extensive Archive**: Full historical proceedings across 10 conferences — see [Conference Coverage](#-conference-coverage) below.
- **🎨 Newsprint Aesthetic**: A clean, monochromatic interface optimized for focus.
- **🌓 Adaptive Themes**: Automatic Light/Dark mode transitions based on local sunrise/sunset.
- **🔢 LaTeX Support**: Integrated KaTeX for rendering complex mathematical abstracts.
- **🚀 Static Architecture**: Optimized for GitHub Pages with zero-server dependency in production.

## 📚 Conference Coverage

| Conference | Years | Source | Abstracts |
|---|---|---|---|
| NeurIPS | 1987+ | papers.nips.cc | ✅ Full |
| ICML | 2013+ | proceedings.mlr.press | ✅ Full |
| CVPR | 2013+ | openaccess.thecvf.com | ✅ Full |
| ICCV | 2013+ (odd years) | openaccess.thecvf.com | ✅ Full |
| ECCV | 2018+ (even years) | ecva.net | ✅ Full |
| AAAI | 2020+ | ojs.aaai.org (OAI-PMH) | ⚠️ Best-effort — the OAI feed's pagination has been unreliable under sustained load; coverage may be incomplete for some years |
| IJCAI | 2017+ | ijcai.org | ✅ Full |
| MICCAI | 2018+ | papers.miccai.org (2024+), DBLP (earlier) | ✅ Full for 2024+; DBLP-only years have no abstracts (Springer doesn't expose them, and its site blocks scraping) |
| MIDL | 2018+ | OpenReview | ⚠️ OpenReview's API currently requires a JS bot-challenge that blocks automated fetching — new years won't sync until this changes upstream |
| ISBI | 2004+ | DBLP + OpenAlex | ✅ Full (abstracts backfilled via OpenAlex, which has strong coverage for IEEE-published papers) |

**Not included:** ICLR — also hosted on OpenReview, blocked by the same bot-challenge as MIDL.

---

## 🔍 Search Syntax

PaperSift supports advanced query syntax for precision literature discovery:

### General Search
By default, keywords search through paper **titles** and **abstracts**.
- `diffusion models` — Finds papers containing both words in any order.
- `transformer or vision` — Finds papers containing either term.

### Author Search
Use the `author:` prefix to target specific researchers or labs.
- `author: sambyal` — Papers where "sambyal" is an author.
- `author: doe smith` — Papers co-authored by "doe" and "smith" (Nested AND search).
- `author: Hinton, deep learning` — Papers by "Hinton" containing "deep learning" in the title/abstract.
- `author: abhishek sambyal,` — Captures the name explicitly (comma is optional).

---

## 🛠️ Installation & Development

### Local Development
To run the search engine locally with the dynamic backend:
```bash
python3 server.py
```

### Data Synchronization
The database is maintained via a unified synchronization pipeline.

**Sync missing records:**
```bash
python3 scripts/sync.py
```

**Full rebuild from scratch:**
```bash
python3 scripts/sync.py --full
```

---

## 🏗️ Technical Architecture

PaperSift is built as a **Static Web Application**. Search indexing and filtering are performed entirely in the browser using per-conference JSON indexes, fetched in parallel and merged client-side.

- **`js/`**: Core search logic and rendering engine.
- **`data/`**: Minified production index, split one file per conference (`data/{id}.json`, e.g. `data/cvpr.json`) to stay under hosting file-size limits, plus `data/config.json` listing the available conferences/years.
- **`api/`**: Backend ingestion logic and configuration.
- **`scripts/`**: Maintenance utilities for data sync and site generation.

## 🚢 Deployment

Optimized for **GitHub Pages**. Since all search operations are client-side, the project requires no live backend server in production.

---

## 📜 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for the full text.

---

*Designed for researchers, by researchers.*
