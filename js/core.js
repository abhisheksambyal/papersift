let papersCache = null;
let loadingPromise = null;

/**
 * Search field weights for relevance scoring.
 */
const WEIGHTS = {
  TITLE: 10,
  ABSTRACT: 5,
  AUTHOR_MATCH: 100 // High priority for explicit author prefix search
};

/**
 * Load papers from the static JSON file.
 * Returns a promise that resolves when loading is complete.
 */
async function loadPapers() {
  if (papersCache) return papersCache;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const res = await fetch('data/papers.json');
      if (!res.ok) throw new Error(`Failed to load paper data: ${res.status}`);
      const data = await res.json();
      
      // Pre-process for performance
      for (const p of data) {
        const t = (p.title || '').toLowerCase();
        const a = (p.authors || '').toLowerCase();
        const abs = (p.abstract || '').toLowerCase();
        p._search_blob = `${t} ${abs}`;
        p._searchable = { title: t, authors: a, abstract: abs, venue: (p.venue || '').toLowerCase() };
      }
      papersCache = data;
      return papersCache;
    } catch (err) {
      loadingPromise = null;
      throw err;
    }
  })();

  return loadingPromise;
}

/**
 * Extract search terms and determine logic (AND vs OR).
 * Supports author: prefix (semicolon optional).
 */
export function extractSearchTerms(query) {
  const q = query.toLowerCase().trim();
  if (!q) return { terms: [], isOrSearch: false, authorTerm: null, authorSubTerms: [] };
  
  let authorTerm = null;
  let processed = q;

  const authorIdx = q.indexOf('author:');
  if (authorIdx !== -1) {
    const start = authorIdx + 7;
    const end = q.indexOf(',', start);
    authorTerm = end !== -1 ? q.substring(start, end).trim() : q.substring(start).trim();
    processed = (q.substring(0, authorIdx) + (end !== -1 ? q.substring(end + 1) : '')).trim();
  }

  const authorSubTerms = authorTerm ? authorTerm.split(/\s+/).filter(Boolean) : [];
  const isOrSearch = /\s+or\s+/.test(processed);
  const terms = isOrSearch 
    ? processed.split(/\s+or\s+/).map(t => t.trim()).filter(Boolean)
    : processed.replace(/\s+and\s+/g, ' ').replace(/,/g, ' ').split(/\s+/).map(t => t.trim()).filter(t => t.length > 2);

  return { terms, isOrSearch, authorTerm, authorSubTerms };
}

/**
 * Fetch search results (client-side).
 * @returns {Promise<{results: Array, activeVenues: Set, activeYears: Set}>}
 */
export async function fetchResults(query, venue = '', year = '') {
  const papers = await loadPapers();
  const { terms, isOrSearch, authorSubTerms } = extractSearchTerms(query);
  
  const venueSet = venue && (Array.isArray(venue) ? venue.length > 0 : true) 
    ? (Array.isArray(venue) ? venue : [venue]).map(v => v.toLowerCase()) 
    : null;
  const yearSet = year && (Array.isArray(year) ? year.length > 0 : true)
    ? new Set((Array.isArray(year) ? year : [year]).map(String)) 
    : null;

  const results = [];
  const activeVenues = new Set();
  const activeYears = new Set();
  const hasKeywords = terms.length > 0;
  const hasAuthorTerms = authorSubTerms.length > 0;
  
  for (let i = 0, len = papers.length; i < len; i++) {
    const p = papers[i];
    const searchable = p._searchable;
    
    // 1. Venue/Year filtering
    if (venueSet && !venueSet.some(v => searchable.venue.includes(v))) continue;
    if (yearSet && !yearSet.has(String(p.year))) continue;

    // 2. Search matching and Scoring
    let score = 0;
    
    // A. Author Match (Strict Filter - All terms must match)
    if (hasAuthorTerms) {
      if (!authorSubTerms.every(t => searchable.authors.includes(t))) continue;
      score += WEIGHTS.AUTHOR_MATCH;
    }

    // B. Keyword Match
    if (hasKeywords) {
      let matchCount = 0;
      const blob = p._search_blob;
      
      for (const term of terms) {
        if (blob.includes(term)) {
          matchCount++;
          if (searchable.title.includes(term))    score += WEIGHTS.TITLE;
          if (searchable.abstract.includes(term)) score += WEIGHTS.ABSTRACT;
        }
      }
      if (isOrSearch ? matchCount === 0 : matchCount < terms.length) continue;
    } 
    else if (!hasAuthorTerms && !venueSet && !yearSet) continue;

    results.push({ ...p, score });
    
    // Track facets
    const v = searchable.venue;
    ['miccai', 'midl', 'isbi', 'neurips'].forEach(id => {
      if (v.includes(id)) activeVenues.add(id);
    });
    if (p.year) activeYears.add(String(p.year));
  }

  // Optimized sort: Year (desc), then Score (desc)
  results.sort((a, b) => (b.year - a.year) || (b.score - a.score));
  
  return { results, activeVenues, activeYears };
}
const STORAGE_KEY = 'medsearch_recent';
const MAX_RECENT  = 4;

export const DEFAULTS = ['mri', 'classification', 'calibration'];

/** Returns true only if every word in the query is 3+ alphabetic characters. */
const isValidQuery = query =>
  query.trim().split(/\s+/).every(w => /^[a-zA-Z]{3,}$/.test(w));

/** Read the stored recent-search list (newest first). */
export function getRecent() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

/** Prepend a query to history, deduplicating and capping at MAX_RECENT. */
export function saveRecent(query) {
  if (!isValidQuery(query)) return;
  const updated = [query, ...getRecent().filter(q => q !== query)].slice(0, MAX_RECENT);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}
