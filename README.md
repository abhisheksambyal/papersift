# PaperSift

A high-performance research paper search engine for NeurIPS, MICCAI, MIDL, and ISBI papers.

## GitHub Pages Deployment

This project is configured to work as a static site on GitHub Pages. The search functionality is handled entirely client-side using a pre-built JSON index.

### Updating the Data

If you update the scrapers or add new papers, you must regenerate the static JSON files:

1. Ensure you have the dependencies installed:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the export script:
   ```bash
   export PYTHONPATH=$PYTHONPATH:.
   python3 scripts/export_static.py
   ```

3. Commit and push the updated `data/papers.json` and `data/config.json`.

## Local Development (Dynamic API)

You can still run the dynamic backend for development:
```bash
python3 server.py
```
This will serve the API at `localhost:8000`. Note that the frontend is currently configured to use static files in `data/` to ensure compatibility with GitHub Pages.

## To-Do
- [ ] Add abstract for MICCAI and ISBI papers.
- [ ] Add neurips paper till 2024. 2025 paper is not there.
- [ ] Add more conferences (CVPR, ICCV, ECCV, NeurIPS, ICLR, ICML, IJCAI, AAAI, UAI)
- [x] Add Light/Dark mode toggle.
 

## Features

- **High-Performance Search**: Instant, client-side filtering of over 39,000 research papers.
- **Dynamic Theme**: Automatic Night/Day theme based on your location's sunset and sunrise times.
- **Manual Toggle**: Override the automatic theme at any time. Manual choices are remembered for 1 hour before reverting to astronomical time.
- **LaTeX Support**: MathJax integration for rendering complex mathematical notation in paper abstracts.
- **Extensive Archive**: Includes MICCAI, MIDL, ISBI, and a full 1987–2024 archive of NeurIPS proceedings.

### Light/Dark Mode Logic
- **Automatic Default**: Upon visiting the site, the `initTheme()` function runs. It first checks your local hour and system preference for an immediate result, then refines it by fetching your precise location and astronomical data (sunrise/sunset) via API.
- **Geolocation Powered**: It uses `https://ipapi.co/json/` for IP-based geolocation (so users aren't prompted for permission) and `https://api.sunrise-sunset.org/json` for the exact timing.
- **Timeout Logic**: Manual choices stay active for **1 hour** before the site reverts back to the automatic geolocation-based theme.
- **Verification of the Logic**:
  - No manual preference? $\rightarrow$ Follows the sun.
  - Preference older than 1 hour? $\rightarrow$ Clears preference and follows the sun.
  - Preference within 1 hour? $\rightarrow$ Respects your manual choice.

