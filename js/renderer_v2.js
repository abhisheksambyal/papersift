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
  // Split by $...$ to protect math mode content from being highlighted
  const parts = text.split(/(\$.*?\$)/g);
  return parts.map(p => {
    if (p.startsWith('$') && p.endsWith('$')) return p;
    return p.replace(regex, '<span class="bg-ink text-paper dark:bg-paper dark:text-ink px-0.5 font-bold mx-0.5">$1</span>');
  }).join('');
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
  const venueName = venueParts[0] || 'PAPER';
  const shortYear = (String(paper.year || '')).slice(-2);

  const card = document.createElement('div');
  card.className = 'group block py-3 sm:py-2.5 px-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] border-b border-ink/5 dark:border-paper/5 last:border-0';

  card.innerHTML = `
    <div class="flex items-start gap-4 sm:gap-8 py-1">
      <div class="flex-shrink-0 w-12 sm:w-16 text-right pt-1">
        <div class="font-serif text-[0.5rem] sm:text-[0.6rem] text-ink/40 dark:text-paper/40 uppercase tracking-widest font-black leading-none">
          ${venueName}
        </div>
        <div class="font-masthead text-xl sm:text-2xl font-black text-ink/20 dark:text-paper/20 -mt-1 tabular-nums tracking-tighter">
          '${shortYear}
        </div>
      </div>
      <div class="flex-grow min-w-0 border-l border-ink/10 dark:border-paper/10 pl-4 sm:pl-8">
        <div class="flex items-start justify-between gap-4">
          <a href="${href}" target="_blank" rel="noopener noreferrer" class="hover:underline underline-offset-4 decoration-1">
            <h3 class="font-masthead font-bold leading-tight group-hover:text-ink/80 dark:group-hover:text-paper/80 capitalize text-[clamp(0.9rem,2.5vw,1.1rem)]">${title}</h3>
          </a>
          <a href="${href}" target="_blank" class="text-ink/30 dark:text-paper/30 hover:text-ink dark:hover:text-paper font-serif text-[0.8rem] font-bold flex-shrink-0 pt-0.5">&rarr;</a>
        </div>
        <div class="font-serif text-ink/50 dark:text-paper/50 italic mt-1 leading-relaxed text-[clamp(0.7rem,1.8vw,0.8rem)]">
          ${paper.authors || 'Unknown Authors'}
        </div>
        
        ${paper.abstract ? `
          <div class="mt-2.5">
            <button class="abstract-toggle text-[0.65rem] uppercase tracking-[0.15em] font-black text-ink/60 dark:text-paper/60 hover:text-ink dark:hover:text-paper hover:bg-black/[0.04] dark:hover:bg-white/[0.04] px-2 py-1 -ml-2 rounded transition-all flex items-center gap-2 group/btn">
              <span>Read Abstract</span>
              <svg class="w-2.5 h-2.5 transform transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="square" stroke-linejoin="miter" stroke-width="2.5" d="M19 9l-7 7-7-7"></path></svg>
            </button>
          </div>` : ''}
        
        ${paper.abstract ? `
          <div class="abstract-content hidden mt-4 text-[0.8rem] leading-relaxed text-ink/70 dark:text-paper/70 font-serif border-t border-ink/5 dark:border-paper/5 pt-4 abstract-expansion">
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
      abstractDiv.classList.toggle('hidden');
      arrow.classList.toggle('rotate-180');
    });
  }

  return card;
}

const CHUNK_SIZE = 40;
let currentResults = [];
let currentIndex = 0;
let currentTerms = [];
let observer = null;

/**
 * Render the next chunk of results.
 * @param {HTMLElement} container 
 */
function renderNextChunk(container) {
  if (currentIndex >= currentResults.length) return;

  const chunk = currentResults.slice(currentIndex, currentIndex + CHUNK_SIZE);
  const highlightRegex = getHighlightRegex(currentTerms);
  const fragment = document.createDocumentFragment();

  for (const paper of chunk) {
    fragment.appendChild(createCard(paper, highlightRegex));
  }

  // Remove old sentinel
  const oldSentinel = container.querySelector('#scroll-sentinel');
  if (oldSentinel) {
    observer.unobserve(oldSentinel);
    oldSentinel.remove();
  }

  container.appendChild(fragment);
  currentIndex += chunk.length;

  // Add new sentinel if more results exist
  if (currentIndex < currentResults.length) {
    const sentinel = document.createElement('div');
    sentinel.id = 'scroll-sentinel';
    sentinel.className = 'h-32 flex items-center justify-center py-8';
    sentinel.innerHTML = `
      <div class="flex flex-col items-center gap-2 opacity-20 italic text-[0.6rem] uppercase tracking-[0.2em] font-black">
        <div class="w-1 h-1 bg-ink dark:bg-paper rounded-full animate-bounce"></div>
        <span>Loading more entries</span>
      </div>
    `;
    container.appendChild(sentinel);
    observer.observe(sentinel);
  }
  
  // Trigger MathJax re-typesetting if available
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise([container]).catch((err) => console.error('MathJax typeset failed:', err));
  }
}

/**
 * Render a list of results into the DOM with infinite scroll.
 * @param {Paper[]} results
 * @param {string[]} terms
 * @param {HTMLElement} resultsList
 * @param {HTMLElement} resultsCount
 * @param {boolean} isOrSearch
 */
export function renderResults(results, terms, resultsList, resultsCount, isOrSearch = false) {
  const joiner = isOrSearch ? 'or' : 'and';
  const querySummary = terms.length > 0
    ? ` <span class="opacity-70">with</span> ${terms.map(t => `<span class="font-bold">${t}</span>`).join(` <span class="opacity-70 italic">${joiner}</span> `)}`
    : '';

  if (!results.length) {
    resultsCount.innerHTML = `<span class="opacity-70">No papers found matching</span>${querySummary}`;
    resultsList.innerHTML = '';
    return;
  }

  resultsCount.innerHTML = `
    <span class="opacity-70">Discovered</span>
    <span class="font-bold">${results.length.toLocaleString()}</span>
    <span class="opacity-70">pertinent papers</span>${querySummary}`;

  // Reset infinite scroll state
  currentResults = results;
  currentTerms = terms;
  currentIndex = 0;
  resultsList.innerHTML = '';

  if (observer) observer.disconnect();
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      renderNextChunk(resultsList);
    }
  }, { 
    rootMargin: '600px' // Start loading before the user reaches the bottom
  });

  // Initial render
  renderNextChunk(resultsList);
}
