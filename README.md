# PaperSift

A high-performance research paper search engine for MICCAI, MIDL, and ISBI papers.

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

# To-Do
- [ ] Add abstract for MICCAI and ISBI papers.
- [ ] Add more conferences (CVPR, ICCV, ECCV, NeurIPS, ICLR, ICML, IJCAI, AAAI, UAI)