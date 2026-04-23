let papersCache = null;
let loadingPromise = null;

const SCORE_FIELDS = [
  { field: 'title', weight: 10 },
  { field: 'authors', weight: 2 },
  { field: 'abstract', weight: 5 },
  { field: 'venue', weight: 1 }
];

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
        
        // Single joined string for fast initial filtering
        p._search_joined = `${t} ${a} ${abs} ${v}`;
        
        // Individual fields kept for scoring only
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
 */
export function extractSearchTerms(query) {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return { terms: [], isOrSearch: false };
  
  if (lowerQuery.includes(' or ')) {
    const terms = lowerQuery.split(/\s+or\s+/).map(t => t.trim()).filter(t => t.length > 0);
    return { terms, isOrSearch: true };
  }
  
  const normalized = lowerQuery.replace(/\s+and\s+/g, ' ').replace(/,/g, ' ');
  const terms = normalized.split(/\s+/).map(t => t.trim()).filter(t => t.length > 2);
  return { terms, isOrSearch: false };
}

/**
 * Fetch search results (client-side).
 * @returns {Promise<{results: Array, activeVenues: Set, activeYears: Set}>}
 */
export async function fetchResults(query, venue = '', year = '') {
  const papers = await loadPapers();
  const { terms, isOrSearch } = extractSearchTerms(query);
  
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
    
    // 1. Fast Venue/Year filtering
    if (venueSet) {
      let match = false;
      for (const v of venueSet) {
        if (p._searchable.venue.includes(v)) { match = true; break; }
      }
      if (!match) continue;
    }
    if (yearSet && !yearSet.has(String(p.year))) continue;

    // 2. High-performance Search matching
    let score = 0;
    if (hasTerms) {
      let matchCount = 0;
      const joined = p._search_joined;
      
      for (const term of terms) {
        if (joined.includes(term)) {
          matchCount++;
          // Detailed scoring only if matched
          for (const { field, weight } of SCORE_FIELDS) {
            if (p._searchable[field].includes(term)) score += weight;
          }
        }
      }
      
      if (isOrSearch) {
        if (matchCount === 0) continue;
      } else {
        if (matchCount < terms.length) continue;
      }
    }

    results.push({ ...p, score });
    
    // Track facets for filter highlighting
    const venueLower = p._searchable.venue;
    if (venueLower.includes('miccai')) activeVenues.add('miccai');
    if (venueLower.includes('midl')) activeVenues.add('midl');
    if (venueLower.includes('isbi')) activeVenues.add('isbi');
    if (venueLower.includes('neurips')) activeVenues.add('neurips');
    if (p.year) activeYears.add(String(p.year));
  }

  // Optimized sort: Year (desc), then Score (desc)
  results.sort((a, b) => (b.year - a.year) || (b.score - a.score));
  
  return { results, activeVenues, activeYears };
}
