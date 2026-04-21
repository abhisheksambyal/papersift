/**
 * @typedef {Object} Paper
 * @property {string} [title]
 * @property {string} [authors]
 * @property {string} [url]
 * @property {string} [venue]
 * @property {string} year
 * @property {string} [abstract]
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
  if (!regex || !text) return text;
  return text.replace(regex, '<span class="bg-ink text-paper px-0.5 font-bold mx-0.5">$1</span>');
}

/**
 * Create a result card element.
 * @param {Paper} paper
 * @param {RegExp | null} highlightRegex
 * @returns {HTMLElement}
 */
function createCard(paper, highlightRegex) {
  const title = highlight((paper.title || 'Untitled').toLowerCase(), highlightRegex);
  const abstract = paper.abstract ? highlight(paper.abstract, highlightRegex) : '';
  
  const href = paper.url?.startsWith('http')
    ? paper.url
    : `https://papers.miccai.org${paper.url}`;

  const venueParts = (paper.venue || '').split(' ');
  const venueName  = venueParts[0] || 'PAPER';
  const shortYear  = (String(paper.year || '')).slice(-2);

  const card = document.createElement('div');
  card.className = 'group block py-3 sm:py-2.5 px-1 hover:bg-black/[0.03] transition-colors border-b border-ink/5 last:border-0';

  card.innerHTML = `
    <div class="flex items-start gap-4 sm:gap-8 py-1">
      <div class="flex-shrink-0 w-12 sm:w-16 text-right pt-1">
        <div class="font-serif text-[0.5rem] sm:text-[0.6rem] text-ink/40 uppercase tracking-widest font-black leading-none">
          ${venueName}
        </div>
        <div class="font-masthead text-xl sm:text-2xl font-black text-ink/20 -mt-1 tabular-nums tracking-tighter">
          '${shortYear}
        </div>
      </div>
      <div class="flex-grow min-w-0 border-l border-ink/10 pl-4 sm:pl-8">
        <div class="flex items-start justify-between gap-4">
          <a href="${href}" target="_blank" rel="noopener noreferrer" class="hover:underline underline-offset-4 decoration-1">
            <h3 class="font-masthead font-bold leading-tight group-hover:text-ink/80 transition-colors capitalize text-[clamp(0.9rem,2.5vw,1.1rem)]">${title}</h3>
          </a>
          <div class="flex-shrink-0 flex items-center gap-3">
             ${paper.abstract ? `
              <button class="abstract-toggle text-[0.6rem] uppercase tracking-widest font-black text-ink/30 hover:text-ink transition-colors flex items-center gap-1">
                <span>Abstract</span>
                <svg class="w-2.5 h-2.5 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="square" stroke-linejoin="miter" stroke-width="2.5" d="M19 9l-7 7-7-7"></path></svg>
              </button>` : ''}
            <a href="${href}" target="_blank" class="text-ink/30 hover:text-ink transition-colors font-serif text-[0.8rem] font-bold">&rarr;</a>
          </div>
        </div>
        <div class="font-serif text-ink/50 italic mt-1 leading-relaxed text-[clamp(0.7rem,1.8vw,0.8rem)]">
          ${paper.authors || 'Unknown Authors'}
        </div>
        
        ${paper.abstract ? `
          <div class="abstract-content hidden mt-4 text-[0.8rem] leading-relaxed text-ink/70 font-serif border-t border-ink/5 pt-4 abstract-expansion">
            ${abstract}
          </div>
        ` : ''}
      </div>
    </div>`;

  // Add toggle functionality
  const toggleBtn = card.querySelector('.abstract-toggle');
  const abstractDiv = card.querySelector('.abstract-content');
  const arrow = toggleBtn?.querySelector('svg');

  if (toggleBtn && abstractDiv) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const isHidden = abstractDiv.classList.contains('hidden');
      abstractDiv.classList.toggle('hidden');
      arrow.classList.toggle('rotate-180');
      toggleBtn.classList.toggle('text-ink', isHidden);
      toggleBtn.classList.toggle('text-ink/30', !isHidden);
    });
  }

  return card;
}

/**
 * Render a list of results into the DOM.
 * @param {Paper[]} results
 * @param {string[]} terms
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
