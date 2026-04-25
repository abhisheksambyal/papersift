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
      
      // Pre-process for high-performance searching
      for (const p of data) {
        const t = (p.title || '').toLowerCase();
        const a = (p.authors || '').toLowerCase();
        const abs = (p.abstract || '').toLowerCase();
        const v = (p.venue || '').toLowerCase();
        
        // Combined for papers (titles) and abstracts only
        p._search_paper_abstract = `${t} ${abs}`;
        
        // Individual fields kept for scoring and specific filtering
        p._searchable = { title: t, authors: a, abstract: abs, venue: v };
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
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return { terms: [], isOrSearch: false, authorTerm: null };
  
  let authorTerm = null;
  let processedQuery = lowerQuery;

  // Extract author search if present
  if (lowerQuery.includes('author:')) {
    const start = lowerQuery.indexOf('author:') + 7;
    const end = lowerQuery.indexOf(';', start);
    
    if (end !== -1) {
      authorTerm = lowerQuery.substring(start, end).trim();
      processedQuery = (lowerQuery.substring(0, lowerQuery.indexOf('author:')) + lowerQuery.substring(end + 1)).trim();
    } else {
      // No semicolon: treat everything after "author:" as the author term
      authorTerm = lowerQuery.substring(start).trim();
      processedQuery = lowerQuery.substring(0, lowerQuery.indexOf('author:')).trim();
    }
    
    if (!authorTerm) authorTerm = null;
  }

  // Handle OR search
  if (processedQuery.includes(' or ')) {
    const terms = processedQuery.split(/\s+or\s+/).map(t => t.trim()).filter(t => t.length > 0);
    return { terms, isOrSearch: true, authorTerm };
  }
  
  // Handle AND search (default)
  const normalized = processedQuery.replace(/\s+and\s+/g, ' ').replace(/,/g, ' ');
  const terms = normalized.split(/\s+/).map(t => t.trim()).filter(t => t.length > 2);
  return { terms, isOrSearch: false, authorTerm };
}

/**
 * Fetch search results (client-side).
 * @returns {Promise<{results: Array, activeVenues: Set, activeYears: Set}>}
 */
export async function fetchResults(query, venue = '', year = '') {
  const papers = await loadPapers();
  const { terms, isOrSearch, authorTerm } = extractSearchTerms(query);
  
  const venueSet = venue && (Array.isArray(venue) ? venue.length > 0 : true) 
    ? new Set((Array.isArray(venue) ? venue : [venue]).map(v => v.toLowerCase())) 
    : null;
  const yearSet = year && (Array.isArray(year) ? year.length > 0 : true)
    ? new Set((Array.isArray(year) ? year : [year]).map(String)) 
    : null;

  const results = [];
  const activeVenues = new Set();
  const activeYears = new Set();
  const hasTerms = terms.length > 0;
  
  for (let i = 0, len = papers.length; i < len; i++) {
    const p = papers[i];
    
    // 1. Venue/Year filtering
    if (venueSet) {
      let match = false;
      for (const v of venueSet) {
        if (p._searchable.venue.includes(v)) { match = true; break; }
      }
      if (!match) continue;
    }
    if (yearSet && !yearSet.has(String(p.year))) continue;

    // 2. Search matching and Scoring
    let score = 0;
    
    // A. Author Match (Strict Filter)
    if (authorTerm) {
      if (!p._searchable.authors.includes(authorTerm)) continue;
      score += WEIGHTS.AUTHOR_MATCH;
    }

    // B. Keyword Match (Searches title and abstract only)
    if (hasTerms) {
      let matchCount = 0;
      const blob = p._search_paper_abstract;
      const searchable = p._searchable;
      
      for (const term of terms) {
        if (blob.includes(term)) {
          matchCount++;
          if (searchable.title.includes(term))    score += WEIGHTS.TITLE;
          if (searchable.abstract.includes(term)) score += WEIGHTS.ABSTRACT;
        }
      }
      
      // Enforce AND/OR logic for keywords
      if (isOrSearch) {
        if (matchCount === 0) continue;
      } else {
        if (matchCount < terms.length) continue;
      }
    } 
    // If no keywords and no author term, and no filters, skip scoring
    else if (!authorTerm && !venueSet && !yearSet) {
      continue;
    }

    results.push({ ...p, score });
    
    // Track facets for filter highlighting
    const venueLower = p._searchable.venue;
    if (venueLower.includes('miccai'))  activeVenues.add('miccai');
    if (venueLower.includes('midl'))    activeVenues.add('midl');
    if (venueLower.includes('isbi'))    activeVenues.add('isbi');
    if (venueLower.includes('neurips')) activeVenues.add('neurips');
    if (p.year) activeYears.add(String(p.year));
  }

  // Optimized sort: Year (desc), then Score (desc)
  results.sort((a, b) => (b.year - a.year) || (b.score - a.score));
  
  return { results, activeVenues, activeYears };
}
