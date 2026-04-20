let activeController = null;

/**
 * Fetch search results from the backend.
 * Aborts any previous in-flight request before starting a new one.
 *
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function fetchResults(query) {
  if (activeController) activeController.abort();
  activeController = new AbortController();

  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
    signal: activeController.signal,
  });

  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json();
}
