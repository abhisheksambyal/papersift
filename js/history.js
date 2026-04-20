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
