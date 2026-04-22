let activeController = null;

/**
 * Fetch search results from the backend.
 * Aborts any previous in-flight request before starting a new one.
 *
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function fetchResults(query, venue = '', year = '') {
  if (activeController) activeController.abort();
  activeController = new AbortController();

  let url = `/api/search?q=${encodeURIComponent(query)}`;
  
  if (Array.isArray(venue)) {
    venue.forEach(v => url += `&venue=${encodeURIComponent(v)}`);
  } else if (venue) {
    url += `&venue=${encodeURIComponent(venue)}`;
  }

  if (Array.isArray(year)) {
    year.forEach(y => url += `&year=${encodeURIComponent(y)}`);
  } else if (year) {
    url += `&year=${encodeURIComponent(year)}`;
  }

  const res = await fetch(url, {
    signal: activeController.signal,
  });

  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json();
}
