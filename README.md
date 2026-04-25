# 📰 PaperSift

A high-performance, monochromatic research search engine designed for clinical and medical imaging researchers. PaperSift provides sub-millisecond access to over 40,000 papers from major conferences including NeurIPS, MICCAI, MIDL, and ISBI.

## ✨ Key Features

- **⚡ Instant Search**: Client-side filtering of 40,000+ papers with negligible latency.
- **📚 Extensive Archive**: Full proceedings for NeurIPS (1987-2024), MICCAI, MIDL, and ISBI.
- **🎨 Newsprint Aesthetic**: A clean, monochromatic interface optimized for focus.
- **🌓 Adaptive Themes**: Automatic Light/Dark mode transitions based on local sunrise/sunset.
- **🔢 LaTeX Support**: Integrated KaTeX for rendering complex mathematical abstracts.
- **🚀 Static Architecture**: Optimized for GitHub Pages with zero-server dependency in production.

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

PaperSift is built as a **Static Web Application**. Search indexing and filtering are performed entirely in the browser using an optimized JSON blob.

- **`js/`**: Core search logic and rendering engine.
- **`data/`**: Minified production index (`papers.json`).
- **`api/`**: Backend ingestion logic and configuration.
- **`scripts/`**: Maintenance utilities for data sync and site generation.

## 🚢 Deployment

Optimized for **GitHub Pages**. Since all search operations are client-side, the project requires no live backend server in production.

---

## 📜 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for the full text.

---

*Designed for researchers, by researchers.*
