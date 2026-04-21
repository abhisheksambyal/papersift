/**
 * @typedef {Object} Paper
 * @property {string} [title]
 * @property {string} [authors]
 * @property {string} [url]
 * @property {string} [venue]
 * @property {string} year
 * @property {number} [score]
 */

/** Cache for escaped regex terms */
const escapeCache = new Map();

/** @type {RegExp | null} */
let highlightReCache = null;
/** @type {string} */
let cachedTermsKey = '';

/**
 * Escape special regex characters.
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  let escaped = escapeCache.get(str);
  if (escaped === undefined) {
    escaped = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    escapeCache.set(str, escaped);
    // Limit cache size to prevent unbounded growth
    if (escapeCache.size > 100) {
      const firstKey = escapeCache.keys().next().value;
      escapeCache.delete(firstKey);
    }
  }
  return escaped;
}

/**
 * Get or create cached highlight regex for terms.
 * @param {string[]} terms
 * @returns {RegExp | null}
 */
function getHighlightRegex(terms) {
  const termsKey = terms.join('|');
  if (termsKey !== cachedTermsKey) {
    cachedTermsKey = termsKey;
    highlightReCache = terms.length
      ? new RegExp(`(${terms.map(escapeRegex).join('|')})`, 'gi')
      : null;
  }
  return highlightReCache;
}

/**
 * Highlight matching terms in text.
 * @param {string} text
 * @param {RegExp | null} regex
 * @returns {string}
 */
function highlight(text, regex) {
  if (!regex) return text;
  return text.replace(regex, '<span class="bg-ink text-paper px-0.5 font-bold mx-0.5">$1</span>');
}

/**
 * Create a result card element.
 * @param {Paper} paper
 * @param {RegExp | null} highlightRegex
 * @returns {HTMLAnchorElement}
 */
function createCard(paper, highlightRegex) {
  const title = highlight((paper.title || 'Untitled').toLowerCase(), highlightRegex);
  const href = paper.url?.startsWith('http')
    ? paper.url
    : `https://papers.miccai.org${paper.url}`;

  const card = document.createElement('a');
  card.href = href;
  card.target = '_blank';
  card.rel = 'noopener noreferrer';
  card.className = 'group block py-3 sm:py-2.5 px-1 hover:bg-black/[0.03] active:bg-black/[0.05] transition-colors border-b border-ink/5 last:border-0 touch-manipulation no-tap';

  card.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div class="flex-grow min-w-0">
        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h3 class="font-masthead font-bold leading-snug group-hover:text-ink/80 transition-colors capitalize text-[clamp(0.8rem,2.5vw,1rem)]">${title}</h3>
          <div class="hidden sm:inline font-serif text-[0.6rem] text-ink/40 uppercase tracking-widest font-bold whitespace-nowrap">
            ${paper.venue} '${paper.year.slice(-2)}
          </div>
        </div>
        <div class="font-serif text-ink/40 italic mt-0.5 leading-relaxed text-[clamp(0.6rem,1.8vw,0.7rem)]">${paper.authors || 'Unknown Authors'}</div>
      </div>
      <span class="flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity font-serif text-[0.6rem] font-bold uppercase tracking-[0.2em] text-ink/60">&rarr;</span>
    </div>`;

  return card;
}

/**
 * Render a list of results into the DOM using DocumentFragment for batch insertion.
 *
 * @param {Paper[]} results
 * @param {string[]} terms - highlighted query terms
 * @param {HTMLElement} resultsList
 * @param {HTMLElement} resultsCount
 */
export function renderResults(results, terms, resultsList, resultsCount) {
  if (!results.length) {
    resultsCount.textContent = 'No papers found matching your query.';
    resultsList.innerHTML = '';
    return;
  }

  resultsCount.innerHTML = `
    <span class="opacity-70">Discovered</span>
    <span class="font-bold">${results.length}</span>
    <span class="opacity-70">pertinent papers</span>`;

  const fragment = document.createDocumentFragment();
  const highlightRegex = getHighlightRegex(terms);

  for (const paper of results) {
    fragment.appendChild(createCard(paper, highlightRegex));
  }

  resultsList.innerHTML = '';
  resultsList.appendChild(fragment);
}
