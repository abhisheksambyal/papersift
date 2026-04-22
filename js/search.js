let papersCache = null;
let loadingPromise = null;

const SCORE_FIELDS = [
  { field: 'title', weight: 10 },
  { field: 'authors', weight: 2 },
  { field: 'abstract', weight: 5 },
  { field: 'venue', weight: 1 }
];

const MAX_RESULTS = 100;

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
      
      // Pre-process for faster searching
      data.forEach(p => {
        p._searchable = {
          title: (p.title || '').toLowerCase(),
          authors: (p.authors || '').toLowerCase(),
          abstract: (p.abstract || '').toLowerCase(),
          venue: (p.venue || '').toLowerCase()
        };
      });
      
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
 * Fetch search results (client-side).
 *
 * @param {string} query
 * @param {string|string[]} venue
 * @param {string|string[]} year
 * @returns {Promise<Array>}
 */
export async function fetchResults(query, venue = '', year = '') {
  const papers = await loadPapers();
  
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const venueSet = venue && (Array.isArray(venue) ? venue.length > 0 : true) 
    ? new Set((Array.isArray(venue) ? venue : [venue]).map(v => v.toLowerCase())) 
    : null;
  const yearSet = year && (Array.isArray(year) ? year.length > 0 : true)
    ? new Set((Array.isArray(year) ? year : [year]).map(String)) 
    : null;

  const results = [];
  
  for (let i = 0; i < papers.length; i++) {
    const p = papers[i];
    
    // 1. Filter by Venue
    if (venueSet) {
      const pVenue = p._searchable.venue;
      let match = false;
      for (const v of venueSet) {
        if (pVenue.includes(v)) {
          match = true;
          break;
        }
      }
      if (!match) continue;
    }

    // 2. Filter by Year
    if (yearSet) {
      if (!yearSet.has(String(p.year))) continue;
    }

    // 3. Search Terms / Scoring
    let score = 0;
    if (terms.length > 0) {
      for (let j = 0; j < SCORE_FIELDS.length; j++) {
        const { field, weight } = SCORE_FIELDS[j];
        const text = p._searchable[field];
        for (let k = 0; k < terms.length; k++) {
          if (text.includes(terms[k])) {
            score += weight;
          }
        }
      }
      if (score === 0) continue; // No match found
    }

    results.push({ ...p, score });
  }

  // Sort: Year (desc), then Score (desc)
  results.sort((a, b) => {
    const yearA = parseInt(a.year) || 0;
    const yearB = parseInt(b.year) || 0;
    if (yearB !== yearA) return yearB - yearA;
    return b.score - a.score;
  });

  return results.slice(0, MAX_RESULTS);
}
