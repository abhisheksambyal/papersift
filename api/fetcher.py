import urllib.request
import urllib.error
import urllib.parse
import html
import json
import os
import time
import random
import gzip
import ssl
from functools import lru_cache

CACHE_DIR = "data_cache"
os.makedirs(CACHE_DIR, exist_ok=True)

# Shared SSL context for connection reuse
_ssl_context = ssl.create_default_context()
_ssl_context.check_hostname = False
_ssl_context.verify_mode = ssl.CERT_NONE

import re
from concurrent.futures import ThreadPoolExecutor, as_completed

class Fetcher:
    """Handles HTTP fetching with connection pooling and retries."""
    __slots__ = ['_cache', '_opener']

    def __init__(self):
        self._cache = {}
        # Create opener with connection pooling via HTTP handler
        https_handler = urllib.request.HTTPSHandler(context=_ssl_context)
        self._opener = urllib.request.build_opener(https_handler)

    def fetch(self, url, timeout=30, max_retries=3):
        """Fetch URL with proper timeouts, connection reuse, and retries."""
        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip',
                'Connection': 'keep-alive',
            }
        )

        for attempt in range(max_retries):
            try:
                with self._opener.open(req, timeout=timeout) as response:
                    data = response.read()
                    if response.headers.get('Content-Encoding') == 'gzip':
                        data = gzip.decompress(data)
                    return json.loads(data.decode('utf-8'))
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt < max_retries - 1:
                    wait = (2 ** attempt) + random.random()
                    time.sleep(wait)
                    continue
                if e.code == 404: return {}
                print(f"  Fetch failed for {url}: HTTP {e.code}")
                return {}
            except Exception as e:
                if attempt < max_retries - 1:
                    time.sleep(0.5)
                    continue
                print(f"  Fetch failed for {url}: {e}")
                return {}
        return {}


# Global fetcher instance for connection reuse
_fetcher = Fetcher()


def _reconstruct_abstract(inverted_index):
    """Reconstruct plain text from OpenAlex's abstract_inverted_index format."""
    if not inverted_index:
        return ""
    max_pos = max(pos for positions in inverted_index.values() for pos in positions)
    words = [""] * (max_pos + 1)
    for word, positions in inverted_index.items():
        for pos in positions:
            words[pos] = word
    return " ".join(w for w in words if w)


def _fetch_openalex_abstracts(dois):
    """Look up abstracts for a batch of DOIs via the OpenAlex API (50 DOIs/request)."""
    abstracts = {}
    unique_dois = list(dict.fromkeys(d for d in dois if d))
    for i in range(0, len(unique_dois), 50):
        batch = unique_dois[i:i + 50]
        filt = "|".join(batch)
        url = f"https://api.openalex.org/works?filter=doi:{filt}&select=doi,abstract_inverted_index&per_page=50"
        data = _fetcher.fetch(url)
        if not isinstance(data, dict):
            continue
        for result in data.get("results", []):
            doi_url = result.get("doi") or ""
            doi = doi_url.replace("https://doi.org/", "").lower()
            abstract = _reconstruct_abstract(result.get("abstract_inverted_index"))
            if abstract:
                abstracts[doi] = abstract
    return abstracts


def _fetch_html(url, timeout=30, max_retries=3):
    """Fetch a URL and return raw HTML text, with retries (mirrors Fetcher.fetch but for HTML, not JSON)."""
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return res.read().decode('utf-8', errors='replace')
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(1)
                continue
            print(f"  Fetch failed for {url}: {e}")
            return ""
    return ""


def _fetch_dblp_hits_once(venue, year, facet):
    """Single pass at paging through all hits for a venue/year from DBLP.

    DBLP's search API caps each response at 100 hits regardless of the
    requested `h`, so we page through with `f` (offset) until @total is met.
    Returns (hits, total_reported) — total_reported is 0 if we never got a
    successful first page, letting the caller tell "genuinely empty" apart
    from "gave up early".
    """
    hits = []
    first = 0
    page_size = 100
    total = 0
    while True:
        url = f"https://dblp.org/search/publ/api?q={facet}:{venue}:year:{year}:&format=json&h={page_size}&f={first}"
        response = None
        for attempt in range(6):
            response = _fetcher.fetch(url, timeout=45)
            if isinstance(response, dict) and response.get('result'):
                break
            time.sleep(min(2 ** attempt, 20))
        if not isinstance(response, dict) or not response.get('result'):
            print(f"  Giving up on {venue} {year} page at offset {first} after repeated failures.")
            break
        result_hits = response.get('result', {}).get('hits', {})
        page_hits = result_hits.get('hit', [])
        if not isinstance(page_hits, list):
            page_hits = [page_hits] if page_hits else []
        hits.extend(page_hits)
        total = int(result_hits.get('@total', 0) or 0)
        if not page_hits or len(hits) >= total or first > 5000:
            break
        first += page_size
        time.sleep(0.4)
    return hits, total


def _fetch_dblp_hits(venue, year, facet="venue"):
    """Fetch all publication hits for a venue/year from DBLP, retrying the
    whole year (not just the failing page) when DBLP's flakiness causes a
    pass to give up before reaching the reported total.

    `facet` selects the DBLP facet used to scope the query: "venue" (default,
    e.g. "venue:MICCAI:") works for most conferences, but some (e.g. ICLR)
    500-error on the venue facet and need "stream" instead (e.g.
    "stream:streams/conf/iclr:").
    """
    best_hits, best_total = [], 0
    for pass_num in range(3):
        hits, total = _fetch_dblp_hits_once(venue, year, facet)
        if len(hits) > len(best_hits):
            best_hits, best_total = hits, total
        if total and len(best_hits) >= total:
            break
        if pass_num < 2:
            print(f"  {venue} {year} incomplete ({len(hits)}/{total or '?'}), retrying whole year...")
            time.sleep(5)
    return best_hits


_openalex_budget_exhausted = False


def _fetch_openalex_title_abstract(title):
    """Best-effort abstract lookup by title via OpenAlex (used when no DOI is available).

    Makes its own request (rather than going through the shared, retrying
    `_fetcher.fetch`) so it can detect OpenAlex's daily budget being
    exhausted and stop hitting the network for the rest of the run instead
    of burning 3 retries with backoff on every single title.
    """
    global _openalex_budget_exhausted
    if _openalex_budget_exhausted:
        return ""
    try:
        # OpenAlex treats "?" and "*" as wildcards even when URL-encoded, which
        # 400s on title.search (a stemmed field); strip them since they're
        # rarely meaningful in a paper title anyway.
        query = title.replace("?", "").replace("*", "")
        url = f"https://api.openalex.org/works?filter=title.search:{urllib.parse.quote(query)}&select=title,abstract_inverted_index&per_page=1"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as res:
            data = json.loads(res.read().decode('utf-8'))
        results = data.get("results", [])
        if results:
            return _reconstruct_abstract(results[0].get("abstract_inverted_index"))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        if "Insufficient budget" in body or "dailyRemainingUsd\":0" in body:
            _openalex_budget_exhausted = True
            print("  OpenAlex daily budget exhausted; skipping remaining title lookups for this run.")
        elif e.code != 400:
            print(f"  Failed OpenAlex title lookup for '{title}': HTTP {e.code}")
    except Exception as e:
        print(f"  Failed OpenAlex title lookup for '{title}': {e}")
    return ""


def _fetch_miccai_abstract(url):
    """Fetch a MICCAI paper detail page and extract its abstract text."""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as res:
            html = res.read().decode('utf-8', errors='replace')
        match = re.search(r'<h1 id="abstract-id">Abstract</h1>\s*<p>(.*?)<br', html, re.DOTALL)
        if match:
            return re.sub(r'<[^>]+>', '', match.group(1)).strip()
    except Exception as e:
        print(f"  Failed to fetch MICCAI abstract from {url}: {e}")
    return ""


def fetch_miccai_json(year):
    """Fetch (and cache) the MICCAI paper list for a given year."""
    if year in _fetcher._cache.get('miccai', {}):
        return _fetcher._cache['miccai'][year]

    if 'miccai' not in _fetcher._cache: _fetcher._cache['miccai'] = {}
    
    # Segregated disk cache
    conf_dir = os.path.join(CACHE_DIR, "miccai")
    os.makedirs(conf_dir, exist_ok=True)
    cache_path = os.path.join(conf_dir, f"{year}.json")
    
    if os.path.exists(cache_path):
        with open(cache_path, 'r') as f:
            papers = json.load(f)
            _fetcher._cache['miccai'][year] = papers
            return papers

    # 1. Try official papers.miccai.org (usually 2024+)
    url = f"https://papers.miccai.org/miccai-{year}/js/search.json"
    data = _fetcher.fetch(url)
    
    if isinstance(data, list) and len(data) > 0:
        papers = []
        for p in data:
            papers.append({
                "title": p.get("title") or "Untitled",
                "authors": p.get("authors") or p.get("tags") or "Unknown",
                "url": p.get("pdflink") or p.get("url") or "#",
                "venue": f"MICCAI {year}",
                "year": str(year),
                "abstract": p.get("description") or p.get("discription") or p.get("abstract") or ""
            })
        print(f"  Loaded official MICCAI {year} data. Fetching abstracts from detail pages...")

        # The official search.json never populates description/abstract, so
        # fetch each paper's detail page and scrape the real abstract text.
        detail_base = "https://papers.miccai.org"
        with ThreadPoolExecutor(max_workers=10) as executor:
            future_to_idx = {}
            for i, p in enumerate(data):
                rel_url = p.get("url")
                if rel_url:
                    detail_url = detail_base + rel_url
                    future_to_idx[executor.submit(_fetch_miccai_abstract, detail_url)] = i
            for future in as_completed(future_to_idx):
                idx = future_to_idx[future]
                try:
                    abstract = future.result()
                    if abstract:
                        papers[idx]["abstract"] = abstract
                except Exception:
                    continue
        with_abstract = sum(1 for x in papers if x["abstract"])
        print(f"  Fetched abstracts for {with_abstract}/{len(papers)} MICCAI {year} papers.")
    else:
        # 2. Fallback to DBLP for older years
        hits = _fetch_dblp_hits("MICCAI", year)
        
        papers = []
        dois = []
        for h in hits:
            info = h.get('info', {})
            if info.get('type') != 'Conference and Workshop Papers':
                continue

            authors_data = info.get('authors', {}).get('author', [])
            if isinstance(authors_data, dict): authors_data = [authors_data]
            authors_list = [a.get('text', 'Unknown') for a in authors_data]

            papers.append({
                "title": info.get('title', '').rstrip('.'),
                "authors": ", ".join(authors_list),
                "url": info.get('ee') or info.get('url') or "#",
                "venue": f"MICCAI {year}",
                "year": str(year),
                "abstract": ""
            })
            dois.append(info.get('doi'))

        # DBLP has no abstract data. Springer rarely shares MICCAI abstracts
        # with OpenAlex, but check anyway in case some individual papers do.
        if dois:
            abstracts_by_doi = _fetch_openalex_abstracts(dois)
            found = 0
            for paper, doi in zip(papers, dois):
                if doi and doi.lower() in abstracts_by_doi:
                    paper["abstract"] = abstracts_by_doi[doi.lower()]
                    found += 1
            if found:
                print(f"  Backfilled {found}/{len(papers)} MICCAI {year} abstracts from OpenAlex.")

    # Save to disk
    if papers:
        with open(cache_path, 'w') as f:
            json.dump(papers, f)

    _fetcher._cache['miccai'][year] = papers
    return papers


def fetch_midl_json(year):
    """Fetch MIDL papers from DBLP (OpenReview is blocked by a bot-challenge)."""
    if year in _fetcher._cache.get('midl', {}):
        return _fetcher._cache['midl'][year]

    if 'midl' not in _fetcher._cache: _fetcher._cache['midl'] = {}

    conf_dir = os.path.join(CACHE_DIR, "midl")
    os.makedirs(conf_dir, exist_ok=True)
    cache_path = os.path.join(conf_dir, f"{year}.json")

    if os.path.exists(cache_path):
        with open(cache_path, 'r') as f:
            processed = json.load(f)
            _fetcher._cache['midl'][year] = processed
            return processed

    hits = _fetch_dblp_hits("MIDL", year)

    processed = []
    urls = []
    for h in hits:
        info = h.get('info', {})
        if info.get('type') != 'Conference and Workshop Papers':
            continue

        authors_data = info.get('authors', {}).get('author', [])
        if isinstance(authors_data, dict): authors_data = [authors_data]
        authors_list = [a.get('text', 'Unknown') for a in authors_data]
        url = info.get('ee') or info.get('url') or "#"

        processed.append({
            "title": info.get('title', '').rstrip('.'),
            "authors": ", ".join(authors_list),
            "url": url,
            "venue": f"MIDL {year}",
            "year": str(year),
            "abstract": ""
        })
        urls.append(url)

    # MIDL papers are hosted on PMLR, whose pages include the abstract text.
    if urls:
        with ThreadPoolExecutor(max_workers=10) as executor:
            future_to_idx = {
                executor.submit(_fetch_pmlr_abstract, url): i
                for i, url in enumerate(urls) if url.startswith("https://proceedings.mlr.press")
            }
            for future in as_completed(future_to_idx):
                idx = future_to_idx[future]
                try:
                    abstract = future.result()
                    if abstract:
                        processed[idx]["abstract"] = abstract
                except Exception:
                    continue
        found = sum(1 for x in processed if x["abstract"])
        if found:
            print(f"  Fetched abstracts for {found}/{len(processed)} MIDL {year} papers.")

    if processed:
        with open(cache_path, 'w') as f:
            json.dump(processed, f)

    _fetcher._cache['midl'][year] = processed
    return processed


def fetch_isbi_json(year):
    """Fetch ISBI papers from DBLP API."""
    if year in _fetcher._cache.get('isbi', {}):
        return _fetcher._cache['isbi'][year]

    if 'isbi' not in _fetcher._cache: _fetcher._cache['isbi'] = {}

    conf_dir = os.path.join(CACHE_DIR, "isbi")
    os.makedirs(conf_dir, exist_ok=True)
    cache_path = os.path.join(conf_dir, f"{year}.json")

    if os.path.exists(cache_path):
        with open(cache_path, 'r') as f:
            processed = json.load(f)
            _fetcher._cache['isbi'][year] = processed
            return processed

    hits = _fetch_dblp_hits("ISBI", year)
    
    processed = []
    dois = []
    for h in hits:
        info = h.get('info', {})
        if info.get('type') != 'Conference and Workshop Papers':
            continue
        title = info.get('title', '').rstrip('.')
        authors_data = info.get('authors', {}).get('author', [])
        if isinstance(authors_data, dict): authors_data = [authors_data]
        authors_list = [a.get('text', 'Unknown') for a in authors_data]

        processed.append({
            "title": title,
            "authors": ", ".join(authors_list),
            "url": info.get('ee') or info.get('url') or "#",
            "venue": f"ISBI {year}",
            "year": str(year),
            "abstract": ""
        })
        dois.append(info.get('doi'))

    # DBLP has no abstract data; backfill from OpenAlex, which has good
    # coverage for IEEE-published ISBI papers.
    if dois:
        abstracts_by_doi = _fetch_openalex_abstracts(dois)
        found = 0
        for paper, doi in zip(processed, dois):
            if doi and doi.lower() in abstracts_by_doi:
                paper["abstract"] = abstracts_by_doi[doi.lower()]
                found += 1
        if found:
            print(f"  Backfilled {found}/{len(processed)} ISBI {year} abstracts from OpenAlex.")

    if processed:
        with open(cache_path, 'w') as f:
            json.dump(processed, f)

    _fetcher._cache['isbi'][year] = processed
    return processed


def _fetch_iclr_virtual_detail(year, paper_id):
    """Fetch an ICLR virtual-site poster page and extract its authors + abstract."""
    url = f"https://iclr.cc/virtual/{year}/poster/{paper_id}"
    authors = ""
    abstract = ""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as res:
            html_text = res.read().decode('utf-8', errors='replace')

        ld_match = re.search(r'<script type="application/ld\+json">(.*?)</script>', html_text, re.DOTALL)
        if ld_match:
            try:
                ld = json.loads(ld_match.group(1))
                authors = ", ".join(a.get('name', '') for a in ld.get('author', []) if a.get('name'))
            except Exception:
                pass

        abs_match = re.search(r'abstract-text-inner">\s*<p>(.*?)</p>', html_text, re.DOTALL)
        if abs_match:
            abstract = html.unescape(re.sub(r'<[^>]+>', '', abs_match.group(1))).strip()
    except Exception as e:
        print(f"  Failed to fetch ICLR poster detail from {url}: {e}")
    return url, authors, abstract


def _fetch_iclr_virtual(year):
    """Fetch ICLR papers directly from iclr.cc's virtual conference site (2020+).

    This is the authoritative listing (matches the official accepted-paper
    count) and sidesteps both OpenReview's bot-challenge and OpenAlex's
    metered API entirely, since abstracts live on iclr.cc's own pages.
    """
    listing_url = f"https://iclr.cc/virtual/{year}/papers.html"
    listing = _fetch_html(listing_url)
    if not listing:
        return []

    pairs = re.findall(rf'<a href="/virtual/{year}/poster/(\d+)">([^<]+)</a>', listing)
    if not pairs:
        return []

    processed = [{
        "title": html.unescape(title).strip(),
        "authors": "",
        "url": f"https://iclr.cc/virtual/{year}/poster/{paper_id}",
        "venue": f"ICLR {year}",
        "year": str(year),
        "abstract": ""
    } for paper_id, title in pairs]
    ids = [paper_id for paper_id, _ in pairs]

    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_idx = {
            executor.submit(_fetch_iclr_virtual_detail, year, paper_id): i
            for i, paper_id in enumerate(ids)
        }
        for future in as_completed(future_to_idx):
            idx = future_to_idx[future]
            try:
                _, authors, abstract = future.result()
                if authors:
                    processed[idx]["authors"] = authors
                if abstract:
                    processed[idx]["abstract"] = abstract
            except Exception:
                continue

    found = sum(1 for p in processed if p["abstract"])
    print(f"  Fetched {len(processed)} ICLR {year} papers from iclr.cc, {found} with abstracts.")
    return processed


def _fetch_iclr_schedule_detail(year, event_id):
    """Fetch an ICLR Conferences/{year}/Schedule event detail and extract its abstract."""
    url = f"https://iclr.cc/Conferences/{year}/Schedule?showEvent={event_id}"
    abstract = ""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as res:
            html_text = res.read().decode('utf-8', errors='replace')
        abs_match = re.search(r'abstractContainer"><p>(.*?)</p>', html_text, re.DOTALL)
        if abs_match:
            abstract = html.unescape(re.sub(r'<[^>]+>', '', abs_match.group(1))).strip()
    except Exception as e:
        print(f"  Failed to fetch ICLR schedule abstract from {url}: {e}")
    return abstract


def _fetch_iclr_schedule(year):
    """Fetch ICLR papers from iclr.cc's older Schedule-based conference site (2018-2019)."""
    # No type filter: the unfiltered Schedule page includes both oral and
    # poster presentations (accepted papers), excluding "break"/"workshop"
    # cards which aren't accepted research papers.
    listing_url = f"https://iclr.cc/Conferences/{year}/Schedule"
    listing = _fetch_html(listing_url)
    if not listing:
        return []

    processed = []
    ids = []
    card_re = re.compile(
        r'<div class="maincard narrower (?:oral|poster)" id="maincard_(\d+)">.*?'
        r'<div class="maincardBody">([^<]+)</div>.*?'
        r'<div class="maincardFooter">([^<]*)</div>',
        re.DOTALL
    )
    for m in card_re.finditer(listing):
        event_id, title, authors_raw = m.groups()
        authors = ", ".join(a.strip() for a in html.unescape(authors_raw).split("·") if a.strip())
        processed.append({
            "title": html.unescape(title).strip(),
            "authors": authors,
            "url": f"https://iclr.cc/Conferences/{year}/Schedule?showEvent={event_id}",
            "venue": f"ICLR {year}",
            "year": str(year),
            "abstract": ""
        })
        ids.append(event_id)

    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_idx = {
            executor.submit(_fetch_iclr_schedule_detail, year, event_id): i
            for i, event_id in enumerate(ids)
        }
        for future in as_completed(future_to_idx):
            idx = future_to_idx[future]
            try:
                abstract = future.result()
                if abstract:
                    processed[idx]["abstract"] = abstract
            except Exception:
                continue

    found = sum(1 for p in processed if p["abstract"])
    print(f"  Fetched {len(processed)} ICLR {year} papers from iclr.cc, {found} with abstracts.")
    return processed


def fetch_iclr_json(year):
    """Fetch ICLR papers. OpenReview itself is blocked by a bot-challenge, so:
    - 2020+: iclr.cc's virtual conference site (authoritative, has abstracts)
    - 2018-2019: iclr.cc's older Schedule-based site (also has abstracts)
    - pre-2018: DBLP + best-effort OpenAlex title search (small volume, and
      iclr.cc doesn't have a scrapable listing that far back)
    """
    if year in _fetcher._cache.get('iclr', {}):
        return _fetcher._cache['iclr'][year]

    if 'iclr' not in _fetcher._cache: _fetcher._cache['iclr'] = {}

    conf_dir = os.path.join(CACHE_DIR, "iclr")
    os.makedirs(conf_dir, exist_ok=True)
    cache_path = os.path.join(conf_dir, f"{year}.json")

    if os.path.exists(cache_path):
        with open(cache_path, 'r') as f:
            processed = json.load(f)
            _fetcher._cache['iclr'][year] = processed
            return processed

    if year >= 2020:
        processed = _fetch_iclr_virtual(year)
    elif year >= 2018:
        processed = _fetch_iclr_schedule(year)
    else:
        hits = _fetch_dblp_hits("streams/conf/iclr", year, facet="stream")
        processed = []
        titles = []
        for h in hits:
            info = h.get('info', {})
            if info.get('type') != 'Conference and Workshop Papers':
                continue
            title = info.get('title', '').rstrip('.')
            authors_data = info.get('authors', {}).get('author', [])
            if isinstance(authors_data, dict): authors_data = [authors_data]
            authors_list = [a.get('text', 'Unknown') for a in authors_data]

            processed.append({
                "title": title,
                "authors": ", ".join(authors_list),
                "url": info.get('ee') or info.get('url') or "#",
                "venue": f"ICLR {year}",
                "year": str(year),
                "abstract": ""
            })
            titles.append(title)

        # DBLP's pre-2018 ICLR entries link to OpenReview (blocked) and have
        # no DOI, so the DOI-batch OpenAlex lookup doesn't apply here. Most
        # are cross-posted to arXiv and indexed by OpenAlex, so fall back to
        # a best-effort per-title search instead.
        if titles:
            with ThreadPoolExecutor(max_workers=4) as executor:
                future_to_idx = {
                    executor.submit(_fetch_openalex_title_abstract, title): i
                    for i, title in enumerate(titles) if title
                }
                found = 0
                for future in as_completed(future_to_idx):
                    idx = future_to_idx[future]
                    try:
                        abstract = future.result()
                        if abstract:
                            processed[idx]["abstract"] = abstract
                            found += 1
                    except Exception:
                        continue
            if found:
                print(f"  Backfilled {found}/{len(processed)} ICLR {year} abstracts from OpenAlex.")

    if processed:
        with open(cache_path, 'w') as f:
            json.dump(processed, f)

    _fetcher._cache['iclr'][year] = processed
    return processed


def fetch_neurips_json(year):
    """Fetch NeurIPS papers for a given year (1987-2024)."""
    if year in _fetcher._cache.get('neurips', {}):
        return _fetcher._cache['neurips'][year]

    if 'neurips' not in _fetcher._cache: _fetcher._cache['neurips'] = {}

    conf_dir = os.path.join(CACHE_DIR, "neurips")
    os.makedirs(conf_dir, exist_ok=True)
    cache_path = os.path.join(conf_dir, f"{year}.json")

    if os.path.exists(cache_path):
        with open(cache_path, 'r') as f:
            papers = json.load(f)
            _fetcher._cache['neurips'][year] = papers
            return papers

    print(f"Fetching NeurIPS {year}...")
    base_url = "https://papers.nips.cc"
    index_url = f"{base_url}/paper_files/paper/{year}"

    # We use a slightly different approach for NeurIPS as it's large
    req = urllib.request.Request(index_url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with _fetcher._opener.open(req, timeout=30) as response:
            html = response.read().decode('utf-8')
    except Exception as e:
        print(f"  Error fetching NeurIPS {year} index: {e}")
        return []

    # Starting with 2025, the year page only lists secondary tracks inline and
    # links the bulk of papers out to per-volume pages (e.g. "vol38-main-conference").
    # Older years list everything directly on the year page, so this is a no-op then.
    volume_pattern = re.compile(rf'href="(/paper_files/paper/{year}/vol[^"]+)"')
    volume_urls = sorted(set(volume_pattern.findall(html)))
    html_parts = [html]
    for vol_path in volume_urls:
        vol_req = urllib.request.Request(base_url + vol_path, headers={'User-Agent': 'Mozilla/5.0'})
        try:
            with _fetcher._opener.open(vol_req, timeout=30) as response:
                html_parts.append(response.read().decode('utf-8'))
        except Exception as e:
            print(f"  Error fetching NeurIPS {year} volume {vol_path}: {e}")

    # Regex to find papers: href="{url}">{title}</a> ... paper-authors">{authors}</span>
    # Note: Structure varies slightly over 30 years, so we try to be robust.
    paper_pattern = re.compile(r'href="(?P<url>/paper_files/paper/\d+/hash/[^"]+Abstract[^"]*)">(?P<title>[^<]+)</a>.*?paper-authors">(?P<authors>[^<]+)</span>', re.DOTALL)

    matches = []
    seen_urls = set()
    for html_part in html_parts:
        for m in paper_pattern.finditer(html_part):
            if m.group('url') not in seen_urls:
                seen_urls.add(m.group('url'))
                matches.append(m)
    print(f"  Found {len(matches)} papers for NeurIPS {year}. Fetching abstracts...")
    
    papers = []
    
    def _fetch_abstract(match):
        rel_url = match.group('url')
        paper_url = base_url + rel_url
        title = match.group('title').strip()
        authors = match.group('authors').strip()
        
        # The user requested the paper webpage (HTML) instead of the PDF.
        # Note: NeurIPS uses /hash/ for HTML pages and /file/ for PDFs.
        # Since the webpage is requested, we use the original URL which contains /hash/.
        final_url = paper_url
        
        abstract = ""
        try:
            # Fetch the abstract page to get the abstract text
            abs_req = urllib.request.Request(paper_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(abs_req, timeout=15) as abs_res:
                abs_html = abs_res.read().decode('utf-8')
                
                # Extract abstract text
                abs_match = re.search(r'class="paper-abstract">(.*?)</p>', abs_html, re.DOTALL)
                if abs_match:
                    abstract = re.sub(r'<[^>]+>', '', abs_match.group(1)).strip()
                else:
                    abs_match = re.search(r'Abstract</h2>\s*<p>(.*?)</p>', abs_html, re.DOTALL | re.IGNORECASE)
                    if not abs_match:
                        abs_match = re.search(r'Abstract</h4>\s*<p>(.*?)</p>', abs_html, re.DOTALL | re.IGNORECASE)
                    if abs_match:
                        abstract = re.sub(r'<[^>]+>', '', abs_match.group(1)).strip()
        except Exception as e:
            print(f"  Failed to fetch NeurIPS abstract from {paper_url}: {e}")
        
        return {
            "title": title,
            "authors": authors,
            "url": final_url,
            "venue": f"NeurIPS {year}",
            "year": str(year),
            "abstract": abstract
        }

    # Fetch abstracts in parallel
    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_paper = {executor.submit(_fetch_abstract, m): m for m in matches}
        for i, future in enumerate(as_completed(future_to_paper)):
            try:
                res = future.result()
                if res: papers.append(res)
            except Exception:
                continue
            if (i + 1) % 100 == 0:
                print(f"    Processed {i+1}/{len(matches)} abstracts...")

    if papers:
        # Sort by title for consistency
        papers.sort(key=lambda x: x['title'])
        with open(cache_path, 'w') as f:
            json.dump(papers, f)

    _fetcher._cache['neurips'][year] = papers
    return papers


# PMLR volume number for each ICML year (each conference/workshop gets its
# own volume; there's no year->volume formula, so this is looked up from
# https://proceedings.mlr.press/'s own volume index).
_ICML_VOLUME_MAP = {
    2013: 28, 2014: 32, 2015: 37, 2016: 48, 2017: 70, 2018: 80,
    2019: 97, 2020: 119, 2021: 139, 2022: 162, 2023: 202, 2024: 235, 2025: 267,
}


def _fetch_pmlr_abstract(url):
    """Fetch a PMLR (proceedings.mlr.press) paper page and extract its abstract."""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as res:
            html = res.read().decode('utf-8', errors='replace')
        match = re.search(r'<div id="abstract" class="abstract">(.*?)</div>', html, re.DOTALL)
        if match:
            return re.sub(r'<[^>]+>', '', match.group(1)).strip()
    except Exception as e:
        print(f"  Failed to fetch ICML abstract from {url}: {e}")
    return ""


def fetch_icml_json(year):
    """Fetch ICML papers from PMLR (proceedings.mlr.press)."""
    if year in _fetcher._cache.get('icml', {}):
        return _fetcher._cache['icml'][year]
    if 'icml' not in _fetcher._cache: _fetcher._cache['icml'] = {}

    conf_dir = os.path.join(CACHE_DIR, "icml")
    os.makedirs(conf_dir, exist_ok=True)
    cache_path = os.path.join(conf_dir, f"{year}.json")

    if os.path.exists(cache_path):
        with open(cache_path, 'r') as f:
            papers = json.load(f)
            _fetcher._cache['icml'][year] = papers
            return papers

    volume = _ICML_VOLUME_MAP.get(year)
    if not volume:
        _fetcher._cache['icml'][year] = []
        return []

    index_url = f"https://proceedings.mlr.press/v{volume}/"
    req = urllib.request.Request(index_url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with _fetcher._opener.open(req, timeout=30) as response:
            html = response.read().decode('utf-8')
    except Exception as e:
        print(f"  Error fetching ICML {year} index: {e}")
        return []

    pattern = re.compile(
        r'<p class="title">(?P<title>.*?)</p>\s*<p class="details">\s*'
        r'<span class="authors">(?P<authors>.*?)</span>.*?'
        r'<p class="links">\s*\[<a href="(?P<url>[^"]+)">abs</a>',
        re.DOTALL
    )
    matches = list(pattern.finditer(html))
    print(f"  Found {len(matches)} papers for ICML {year}. Fetching abstracts...")

    papers = []

    def _fetch_one(m):
        title = re.sub(r'<[^>]+>', '', m.group('title')).strip()
        authors = re.sub(r'&nbsp;', ' ', m.group('authors'))
        authors = re.sub(r'<[^>]+>', '', authors).strip()
        return {
            "title": title,
            "authors": authors,
            "url": m.group('url'),
            "venue": f"ICML {year}",
            "year": str(year),
            "abstract": _fetch_pmlr_abstract(m.group('url'))
        }

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(_fetch_one, m) for m in matches]
        for i, future in enumerate(as_completed(futures)):
            try:
                res = future.result()
                if res: papers.append(res)
            except Exception:
                continue
            if (i + 1) % 200 == 0:
                print(f"    Processed {i+1}/{len(matches)} ICML {year} abstracts...")

    if papers:
        with open(cache_path, 'w') as f:
            json.dump(papers, f)

    _fetcher._cache['icml'][year] = papers
    return papers


def _fetch_cvf_abstract(url):
    """Fetch a CVF Open Access paper page and extract its abstract."""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as res:
            html = res.read().decode('utf-8', errors='replace')
        match = re.search(r'<div id="abstract"\s*>(.*?)</div>', html, re.DOTALL)
        if match:
            return re.sub(r'<[^>]+>', '', match.group(1)).strip()
    except Exception as e:
        print(f"  Failed to fetch CVF abstract from {url}: {e}")
    return ""


def _fetch_cvf_json(conf, year):
    """Shared fetcher for CVF Open Access venues (CVPR, ICCV)."""
    key = conf.lower()
    if year in _fetcher._cache.get(key, {}):
        return _fetcher._cache[key][year]
    if key not in _fetcher._cache: _fetcher._cache[key] = {}

    conf_dir = os.path.join(CACHE_DIR, key)
    os.makedirs(conf_dir, exist_ok=True)
    cache_path = os.path.join(conf_dir, f"{year}.json")

    if os.path.exists(cache_path):
        with open(cache_path, 'r') as f:
            papers = json.load(f)
            _fetcher._cache[key][year] = papers
            return papers

    base_url = "https://openaccess.thecvf.com"
    index_url = f"{base_url}/{conf}{year}?day=all"
    req = urllib.request.Request(index_url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with _fetcher._opener.open(req, timeout=30) as response:
            html = response.read().decode('utf-8')
    except Exception as e:
        print(f"  Error fetching {conf} {year} index: {e}")
        return []

    # A few years' backends reject "day=all" outright ("Error 1525") - fall
    # back to discovering and merging each individual conference day's page.
    if 'ptitle' not in html:
        try:
            base_req = urllib.request.Request(f"{base_url}/{conf}{year}", headers={'User-Agent': 'Mozilla/5.0'})
            with _fetcher._opener.open(base_req, timeout=30) as response:
                base_html = response.read().decode('utf-8')
            day_values = sorted(set(re.findall(r'day=(\d{4}-\d{2}-\d{2})', base_html)))
            html_parts = []
            for day in day_values:
                day_req = urllib.request.Request(f"{base_url}/{conf}{year}?day={day}", headers={'User-Agent': 'Mozilla/5.0'})
                with _fetcher._opener.open(day_req, timeout=30) as response:
                    html_parts.append(response.read().decode('utf-8'))
            if html_parts:
                html = "\n".join(html_parts)
                print(f"  {conf} {year}: day=all unsupported, merged {len(day_values)} per-day pages instead.")
        except Exception as e:
            print(f"  Error fetching {conf} {year} per-day pages: {e}")

    pattern = re.compile(
        r'<dt class="ptitle"><br><a href="(?P<url>[^"]+)">(?P<title>.*?)</a></dt>\s*'
        r'<dd>(?P<authors_block>.*?)</dd>',
        re.DOTALL
    )
    matches = list(pattern.finditer(html))
    print(f"  Found {len(matches)} papers for {conf} {year}. Fetching abstracts...")

    papers = []

    def _fetch_one(m):
        title = re.sub(r'<[^>]+>', '', m.group('title')).strip()
        authors = re.findall(r'<a href="#"[^>]*>([^<]+)</a>', m.group('authors_block'))
        rel_url = m.group('url')
        if rel_url.startswith('http'):
            paper_url = rel_url
        elif rel_url.startswith('/'):
            paper_url = base_url + rel_url
        else:
            paper_url = f"{base_url}/{rel_url}"
        return {
            "title": title,
            "authors": ", ".join(a.strip() for a in authors),
            "url": paper_url,
            "venue": f"{conf} {year}",
            "year": str(year),
            "abstract": _fetch_cvf_abstract(paper_url)
        }

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(_fetch_one, m) for m in matches]
        for i, future in enumerate(as_completed(futures)):
            try:
                res = future.result()
                if res: papers.append(res)
            except Exception:
                continue
            if (i + 1) % 200 == 0:
                print(f"    Processed {i+1}/{len(matches)} {conf} {year} abstracts...")

    if papers:
        with open(cache_path, 'w') as f:
            json.dump(papers, f)

    _fetcher._cache[key][year] = papers
    return papers


def fetch_cvpr_json(year):
    return _fetch_cvf_json("CVPR", year)


def fetch_iccv_json(year):
    return _fetch_cvf_json("ICCV", year)


# ECVA hosts every ECCV open-access year on a single page, so we fetch it
# once per process and slice out the requested year from that cache.
_eccv_page_cache = None


def _get_eccv_page():
    global _eccv_page_cache
    if _eccv_page_cache is not None:
        return _eccv_page_cache
    try:
        req = urllib.request.Request("https://www.ecva.net/papers.php", headers={'User-Agent': 'Mozilla/5.0'})
        with _fetcher._opener.open(req, timeout=30) as response:
            _eccv_page_cache = response.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f"  Error fetching ECCV papers.php: {e}")
        _eccv_page_cache = ""
    return _eccv_page_cache


def fetch_eccv_json(year):
    """Fetch ECCV papers from the ECVA open-access archive."""
    if year in _fetcher._cache.get('eccv', {}):
        return _fetcher._cache['eccv'][year]
    if 'eccv' not in _fetcher._cache: _fetcher._cache['eccv'] = {}

    conf_dir = os.path.join(CACHE_DIR, "eccv")
    os.makedirs(conf_dir, exist_ok=True)
    cache_path = os.path.join(conf_dir, f"{year}.json")

    if os.path.exists(cache_path):
        with open(cache_path, 'r') as f:
            papers = json.load(f)
            _fetcher._cache['eccv'][year] = papers
            return papers

    html = _get_eccv_page()
    base_url = "https://www.ecva.net/"

    pattern = re.compile(
        rf'<dt class="ptitle"><br>\s*<a href=[\'"]?(?P<url>papers/eccv_{year}/[^\'">\s]+)[\'"]?>\s*'
        r'(?P<title>.*?)</a>\s*</dt><dd>\s*(?P<authors>.*?)</dd>',
        re.DOTALL
    )
    matches = list(pattern.finditer(html))
    print(f"  Found {len(matches)} papers for ECCV {year}. Fetching abstracts...")

    papers = []

    def _fetch_one(m):
        title = re.sub(r'<[^>]+>', '', m.group('title')).strip()
        authors = re.sub(r'<[^>]+>', '', m.group('authors')).strip()
        paper_url = base_url + m.group('url').strip("'\"")
        abstract = ""
        try:
            req = urllib.request.Request(paper_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=15) as res:
                paper_html = res.read().decode('utf-8', errors='replace')
            abs_match = re.search(r'<div id="abstract">(.*?)</div>', paper_html, re.DOTALL)
            if abs_match:
                abstract = re.sub(r'<[^>]+>', '', abs_match.group(1)).strip().strip('"')
        except Exception as e:
            print(f"  Failed to fetch ECCV abstract from {paper_url}: {e}")
        return {
            "title": title,
            "authors": authors,
            "url": paper_url,
            "venue": f"ECCV {year}",
            "year": str(year),
            "abstract": abstract
        }

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(_fetch_one, m) for m in matches]
        for i, future in enumerate(as_completed(futures)):
            try:
                res = future.result()
                if res: papers.append(res)
            except Exception:
                continue
            if (i + 1) % 200 == 0:
                print(f"    Processed {i+1}/{len(matches)} ECCV {year} abstracts...")

    if papers:
        with open(cache_path, 'w') as f:
            json.dump(papers, f)

    _fetcher._cache['eccv'][year] = papers
    return papers


# The OAI feed's <datestamp> is when a record was added/modified in OJS,
# not the paper's actual AAAI year - it does not correlate with publication
# year, so date-range selective harvesting can't be used to fetch "one
# year" at a time. Instead we harvest the whole "AAAI" set once (all pages)
# and bucket each record by its own <dc:date> into the right year.
_aaai_harvest_cache = None


def _harvest_aaai():
    global _aaai_harvest_cache
    if _aaai_harvest_cache is not None:
        return _aaai_harvest_cache

    base = "https://ojs.aaai.org/index.php/AAAI/oai"
    url = f"{base}?verb=ListRecords&metadataPrefix=oai_dc&set=AAAI"
    by_year = {}
    seen_ids = set()

    for page in range(300):  # safety cap on pagination
        xml = None
        for attempt in range(5):
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            try:
                with urllib.request.urlopen(req, timeout=30) as res:
                    xml = res.read().decode('utf-8', errors='replace')
                break
            except Exception as e:
                print(f"  Error fetching AAAI OAI page {page} (attempt {attempt + 1}): {e}")
                time.sleep(5 * (attempt + 1))
        if xml is None:
            print(f"  Giving up on AAAI OAI page {page} after retries; harvest incomplete.")
            break

        for rec in re.finditer(r'<record>(.*?)</record>', xml, re.DOTALL):
            block = rec.group(1)
            id_m = re.search(r'<identifier>(.*?)</identifier>', block)
            record_id = id_m.group(1) if id_m else None
            if record_id:
                if record_id in seen_ids:
                    continue
                seen_ids.add(record_id)

            title_m = re.search(r'<dc:title[^>]*>(.*?)</dc:title>', block, re.DOTALL)
            date_m = re.search(r'<dc:date>(\d{4})', block)
            if not title_m or not date_m:
                continue
            year = int(date_m.group(1))

            authors = re.findall(r'<dc:creator>(.*?)</dc:creator>', block, re.DOTALL)
            desc_m = re.search(r'<dc:description[^>]*>(.*?)</dc:description>', block, re.DOTALL)
            url_m = re.search(r'<dc:identifier>(https://ojs\.aaai\.org[^<]+)</dc:identifier>', block)

            by_year.setdefault(year, []).append({
                "title": re.sub(r'<[^>]+>', '', title_m.group(1)).strip(),
                "authors": ", ".join(re.sub(r'<[^>]+>', '', a).strip() for a in authors),
                "url": url_m.group(1) if url_m else "#",
                "venue": f"AAAI {year}",
                "year": str(year),
                "abstract": re.sub(r'<[^>]+>', '', desc_m.group(1)).strip() if desc_m else ""
            })

        token_m = re.search(r'<resumptionToken[^>]*>([^<]*)</resumptionToken>', xml)
        harvested = sum(len(v) for v in by_year.values())
        print(f"  AAAI OAI harvest: page {page + 1}, {harvested} papers so far...")
        if not token_m or not token_m.group(1):
            break
        url = f"{base}?verb=ListRecords&resumptionToken={token_m.group(1)}"
        time.sleep(1.0)

    _aaai_harvest_cache = by_year
    return by_year


def fetch_aaai_json(year):
    """Fetch AAAI papers via the ojs.aaai.org OAI-PMH metadata feed (2020+)."""
    if year in _fetcher._cache.get('aaai', {}):
        return _fetcher._cache['aaai'][year]
    if 'aaai' not in _fetcher._cache: _fetcher._cache['aaai'] = {}

    conf_dir = os.path.join(CACHE_DIR, "aaai")
    os.makedirs(conf_dir, exist_ok=True)
    cache_path = os.path.join(conf_dir, f"{year}.json")

    if os.path.exists(cache_path):
        with open(cache_path, 'r') as f:
            papers = json.load(f)
            _fetcher._cache['aaai'][year] = papers
            return papers

    papers = _harvest_aaai().get(year, [])

    if papers:
        with open(cache_path, 'w') as f:
            json.dump(papers, f)

    _fetcher._cache['aaai'][year] = papers
    return papers


def fetch_ijcai_json(year):
    """Fetch IJCAI papers from ijcai.org's proceedings pages."""
    if year in _fetcher._cache.get('ijcai', {}):
        return _fetcher._cache['ijcai'][year]
    if 'ijcai' not in _fetcher._cache: _fetcher._cache['ijcai'] = {}

    conf_dir = os.path.join(CACHE_DIR, "ijcai")
    os.makedirs(conf_dir, exist_ok=True)
    cache_path = os.path.join(conf_dir, f"{year}.json")

    if os.path.exists(cache_path):
        with open(cache_path, 'r') as f:
            papers = json.load(f)
            _fetcher._cache['ijcai'][year] = papers
            return papers

    base_url = "https://www.ijcai.org"
    index_url = f"{base_url}/proceedings/{year}/"
    req = urllib.request.Request(index_url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with _fetcher._opener.open(req, timeout=30) as response:
            html = response.read().decode('utf-8')
    except Exception as e:
        print(f"  Error fetching IJCAI {year} index: {e}")
        return []

    pattern = re.compile(
        r'<div class="title">(?P<title>.*?)</div><div class="authors">(?P<authors>.*?)</div>'
        r'<div class="details">\(<a href="[^"]+">PDF</a> \| <a href="(?P<url>/proceedings/\d+/\d+)">',
        re.DOTALL
    )
    matches = list(pattern.finditer(html))
    print(f"  Found {len(matches)} papers for IJCAI {year}. Fetching abstracts...")

    papers = []

    def _fetch_one(m):
        title = re.sub(r'<[^>]+>', '', m.group('title')).strip()
        authors = re.sub(r'<[^>]+>', '', m.group('authors')).strip()
        paper_url = base_url + m.group('url')
        abstract = ""
        try:
            req = urllib.request.Request(paper_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=15) as res:
                paper_html = res.read().decode('utf-8', errors='replace')
            abs_match = re.search(
                r'<hr>\s*<div class="row">\s*<div class="col-md-12">\s*(.*?)\s*</div>\s*<div class="col-md-12">\s*<div class="keywords">',
                paper_html, re.DOTALL
            )
            if abs_match:
                abstract = re.sub(r'<[^>]+>', '', abs_match.group(1)).strip()
        except Exception as e:
            print(f"  Failed to fetch IJCAI abstract from {paper_url}: {e}")
        return {
            "title": title,
            "authors": authors,
            "url": paper_url,
            "venue": f"IJCAI {year}",
            "year": str(year),
            "abstract": abstract
        }

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(_fetch_one, m) for m in matches]
        for i, future in enumerate(as_completed(futures)):
            try:
                res = future.result()
                if res: papers.append(res)
            except Exception:
                continue
            if (i + 1) % 200 == 0:
                print(f"    Processed {i+1}/{len(matches)} IJCAI {year} abstracts...")

    if papers:
        with open(cache_path, 'w') as f:
            json.dump(papers, f)

    _fetcher._cache['ijcai'][year] = papers
    return papers


def preload(config):
    """Pre-fetch and cache paper data with a 24-hour global cache."""
    from concurrent.futures import ThreadPoolExecutor, as_completed
    import time

    global_cache_path = os.path.join(CACHE_DIR, "full_index.json")
    
    # 1. Try to load from global cache if it exists and is fresh (< 24h)
    if os.path.exists(global_cache_path):
        file_age = time.time() - os.path.getmtime(global_cache_path)
        if file_age < 86400: # 24 hours
            print("Loading paper index from global cache (up to date)...")
            try:
                with open(global_cache_path, 'r') as f:
                    full_data = json.load(f)
                    for conf, years in full_data.items():
                        _fetcher._cache[conf] = {int(y): papers for y, papers in years.items()}
                    
                    total = sum(len(y) for c in _fetcher._cache.values() for y in c.values())
                    print(f"  Instant load: {total} papers from global cache.")
                    return
            except Exception as e:
                print(f"  Global cache corrupted: {e}. Re-indexing...")
        else:
            print("Global cache is older than 24 hours. Refreshing from sources...")

    tasks = []
    for conf, data in config.items():
        years = data.get('years', [])
        fetcher_fn = data.get('fetcher')
        for y in years:
            tasks.append((conf, y, fetcher_fn))

    print(f"Pre-loading {len(tasks)} conference years...")
    
    from concurrent.futures import ThreadPoolExecutor, as_completed

    def _run_task(task):
        conf, y, fetcher_fn = task
        try:
            data = fetcher_fn(y)
            return conf, y, len(data)
        except Exception:
            return conf, y, 0

    with ThreadPoolExecutor(max_workers=4) as executor:
        future_to_task = {executor.submit(_run_task, task): task for task in tasks}
        for future in as_completed(future_to_task):
            conf, y, count = future.result()
            if count > 0:
                print(f"  Loaded {conf.upper()} {y}: {count} papers")

    # 2. Save the full index to a global cache file for next time
    print("Saving global paper index...")
    try:
        with open(global_cache_path, 'w') as f:
            json.dump(_fetcher._cache, f)
    except Exception as e:
        print(f"  Failed to save global cache: {e}")


@lru_cache(maxsize=1)
def get_cache_info():
    """Get cache statistics."""
    total = 0
    years_map = {}
    for conf, years in _fetcher._cache.items():
        years_map[conf] = list(years.keys())
        total += sum(len(v) for v in years.values())
    return {
        'cached_conferences': years_map,
        'total_cached': total
    }
