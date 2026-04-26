import { DEFAULTS, getRecent } from './core.js';

/**
 * Animation utilities for smooth DOM transitions.
 * Abstracts away layout thrashing and nested timeouts.
 */

/**
 * Fades out an element and hides it after the transition completes.
 * @param {HTMLElement} element 
 * @param {number} duration - Match with CSS transition duration
 */
export function fadeOutAndHide(element, duration = 400) {
  if (!element) return;
  element.classList.add('opacity-0', 'pointer-events-none');

  setTimeout(() => {
    element.classList.add('hidden');
  }, duration);
}

/**
 * Shows an element and smoothly fades it in.
 * Uses double requestAnimationFrame to avoid synchronous layout reflows.
 * @param {HTMLElement} element 
 */
export function showAndFadeIn(element) {
  if (!element) return;
  element.classList.remove('hidden', 'invisible');

  // Wait a frame to ensure display:block is calculated before animating opacity
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      element.classList.remove('opacity-0', 'translate-y-4', 'pointer-events-none');
      element.classList.add('opacity-100', 'translate-y-0');
    });
  });
}

/**
 * Utility to safely restart a CSS keyframe animation without forcing synchronous layout (void el.offsetHeight).
 * @param {HTMLElement} element 
 * @param {string} animationClass 
 */
export function restartAnimation(element, animationClass) {
  if (!element) return;
  element.classList.remove(animationClass);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      element.classList.add(animationClass);
    });
  });
}


/**
 * Logic for the rotating purpose questions on the landing page.
 */


const QUESTIONS = [
  "Which MICCAI 2024 papers use the BraTS dataset?",
  "Where can I find Few-Shot Learning papers?",
  "Which papers are based on cardiac data?",
  "Tired of checking every conference manually?",
  "Stop scouring 40+ conference sites manually.<br>Enter the keywords and Find the papers you need — faster."
];

let intervalId = null;

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Start the rotating purpose questions.
 * @param {HTMLElement} el - The element to populate with questions.
 */
export function startPurposeLoop(el) {
  if (!el) return;

  const discoveryQuestions = QUESTIONS.slice(0, -1);
  const finaleQuestion = QUESTIONS[QUESTIONS.length - 1];

  shuffle(discoveryQuestions);
  // The pool is just the discovery questions for the first cycle
  const pool = [...discoveryQuestions];
  let idx = 0;

  el.classList.add('opacity-0', 'translate-y-4');

  const showFirst = () => {
    el.innerHTML = pool[idx];
    restartAnimation(el, 'purpose-in');
    idx++;
  };

  const cycle = () => {
    el.classList.remove('purpose-in');
    el.classList.add('purpose-out');

    setTimeout(() => {
      if (idx < pool.length) {
        // Show next individual question
        el.innerHTML = pool[idx];
        el.classList.remove('purpose-out');
        restartAnimation(el, 'purpose-in');
        idx++;
      } else {
        // FINALE: Show 3 random questions + Solution, then STOP
        const random3 = [...discoveryQuestions].sort(() => 0.5 - Math.random()).slice(0, 3);
        const summary = random3.map(q => q.replace('?', '')).join(', ') + '?';

        el.innerHTML = `<span class="block mb-2 opacity-60">${summary}</span> ${finaleQuestion}`;
        el.classList.remove('purpose-out');
        restartAnimation(el, 'purpose-in');

        // Stop the animation
        clearInterval(intervalId);
        intervalId = null;
      }
    }, 400);
  };

  showFirst();
  intervalId = setInterval(cycle, 3000);
}

/**
 * Stop the loop if needed (e.g. on unmount or navigation).
 */
export function stopPurposeLoop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}


/**
 * Logic for initializing and updating search filters.
 */

/**
 * Initialize conference and year filters.
 * @param {HTMLElement} confContainer
 * @param {HTMLElement} yearContainer
 * @param {Function} onSearch - Callback to trigger search on change
 */
export async function initializeFilters(confContainer, yearContainer, onSearch) {
  try {
    const res = await fetch('data/config.json');
    const config = await res.json();

    // Populate Conferences
    const allConfHtml = `
      <label class="flex items-center gap-2 cursor-pointer group no-tap">
        <input type="checkbox" name="conference-all" value="all" class="hidden peer" checked>
        <span class="text-[0.7rem] uppercase tracking-widest text-ink/40 dark:text-paper/40 peer-checked:text-ink dark:peer-checked:text-paper peer-checked:font-black group-hover:text-ink/70 dark:group-hover:text-paper/70 transition-all border-b border-transparent peer-checked:border-ink/20 dark:peer-checked:border-paper/20">
          All
        </span>
      </label>
    `;
    confContainer.innerHTML = allConfHtml + config.conferences.map(c => `
      <label class="flex items-center gap-2 cursor-pointer group no-tap">
        <input type="checkbox" name="conference" value="${c.id}" class="hidden peer">
        <span class="text-[0.7rem] uppercase tracking-widest text-ink/40 dark:text-paper/40 peer-checked:text-ink dark:peer-checked:text-paper peer-checked:font-black group-hover:text-ink/70 dark:group-hover:text-paper/70 transition-all border-b border-transparent peer-checked:border-ink/20 dark:peer-checked:border-paper/20">
          ${c.name}
        </span>
      </label>
    `).join('');

    // Populate Years
    const allYearHtml = `
      <label class="flex items-center gap-2 cursor-pointer group no-tap">
        <input type="checkbox" name="year-all" value="all" class="hidden peer" checked>
        <span class="text-[0.7rem] uppercase tracking-widest text-ink/40 dark:text-paper/40 peer-checked:text-ink dark:peer-checked:text-paper peer-checked:font-black group-hover:text-ink/70 dark:group-hover:text-paper/70 transition-all border-b border-transparent peer-checked:border-ink/20 dark:peer-checked:border-paper/20">
          All
        </span>
      </label>
    `;
    yearContainer.innerHTML = allYearHtml + config.years.map(y => `
      <label class="flex items-center gap-2 cursor-pointer group no-tap">
        <input type="checkbox" name="year" value="${y}" class="hidden peer">
        <span class="text-[0.7rem] uppercase tracking-widest text-ink/40 dark:text-paper/40 peer-checked:text-ink dark:peer-checked:text-paper peer-checked:font-black group-hover:text-ink/70 dark:group-hover:text-paper/70 transition-all border-b border-transparent peer-checked:border-ink/20 dark:peer-checked:border-paper/20">
          ${y}
        </span>
      </label>
    `).join('');

    // Listen for any checkbox change
    [confContainer, yearContainer].forEach(container => {
      container.addEventListener('change', (e) => {
        if (e.target.type !== 'checkbox') return;

        const isAll = e.target.name.endsWith('-all');
        const groupName = e.target.name.replace('-all', '');

        if (isAll && e.target.checked) {
          document.querySelectorAll(`input[name="${groupName}"]`).forEach(cb => cb.checked = false);
        } else if (!isAll && e.target.checked) {
          const allCb = document.querySelector(`input[name="${groupName}-all"]`);
          if (allCb) allCb.checked = false;
        }

        const specificChecked = document.querySelectorAll(`input[name="${groupName}"]:checked`).length > 0;
        const allCb = document.querySelector(`input[name="${groupName}-all"]`);
        if (!specificChecked && allCb) allCb.checked = true;

        onSearch();
      });
    });
  } catch (err) {
    console.error('Failed to load filter config:', err);
  }
}

/**
 * Highlight filters that are present in the results.
 * @param {Set} activeVenues
 * @param {Set} activeYears
 */
export function updateFilterHighlights(activeVenues = new Set(), activeYears = new Set()) {
  // Clear all previous highlights in one go
  document.querySelectorAll('#filter-container span').forEach(span => {
    span.classList.remove('bg-[#c8e6c9]', 'dark:bg-[#1b5e20]', 'px-1.5', 'py-0.5', '-mx-1.5', 'rounded', 'font-black', 'text-black', 'dark:text-white');
  });

  const highlightClasses = ['bg-[#c8e6c9]', 'dark:bg-[#1b5e20]', 'px-1.5', 'py-0.5', '-mx-1.5', 'rounded', 'font-black', 'text-black', 'dark:text-white'];

  // Apply highlights to matching Venues
  activeVenues.forEach(v => {
    const el = document.querySelector(`input[name="conference"][value="${v}"]`);
    if (el) el.nextElementSibling.classList.add(...highlightClasses);
  });

  // Apply highlights to matching Years
  activeYears.forEach(y => {
    const el = document.querySelector(`input[name="year"][value="${y}"]`);
    if (el) el.nextElementSibling.classList.add(...highlightClasses);
  });
}


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
 * @param {RegExp | null} authorHighlightRegex
 * @returns {HTMLElement}
 */
function createCard(paper, highlightRegex, authorHighlightRegex) {
  const title = highlight((paper.title || 'Untitled'), highlightRegex);
  const authors = authorHighlightRegex
    ? highlight((paper.authors || 'Unknown Authors'), authorHighlightRegex)
    : (paper.authors || 'Unknown Authors');
  const abstract = paper.abstract ? highlight(paper.abstract, highlightRegex) : '';

  const href = paper.url?.startsWith('http') ? paper.url : `https://papers.miccai.org${paper.url}`;
  const [venueName] = (paper.venue || 'PAPER').split(' ');
  const shortYear = String(paper.year || '').slice(-2);

  const card = document.createElement('div');
  card.className = 'group block py-3 sm:py-2.5 px-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] border-b border-ink/5 dark:border-paper/5 last:border-0';

  card.innerHTML = `
    <div class="flex items-start gap-4 sm:gap-8 py-1">
      <div class="flex-shrink-0 w-12 sm:w-16 text-right pt-1">
        <div class="font-serif text-[0.5rem] sm:text-[0.6rem] text-ink/40 dark:text-paper/40 uppercase tracking-widest font-black leading-none">${venueName}</div>
        <div class="font-masthead text-xl sm:text-2xl font-black text-ink/20 dark:text-paper/20 -mt-1 tabular-nums tracking-tighter">'${shortYear}</div>
      </div>
      <div class="flex-grow min-w-0 border-l border-ink/10 dark:border-paper/10 pl-4 sm:pl-8">
        <div class="flex items-start justify-between gap-4">
          <a href="${href}" target="_blank" rel="noopener noreferrer" class="hover:underline underline-offset-4 decoration-1">
            <h3 class="font-masthead font-bold leading-tight group-hover:text-ink/80 dark:group-hover:text-paper/80 capitalize text-[clamp(0.9rem,2.5vw,1.1rem)]">${title}</h3>
          </a>
          <a href="${href}" target="_blank" class="text-ink/30 dark:text-paper/30 hover:text-ink dark:hover:text-paper font-serif text-[0.8rem] font-bold flex-shrink-0 pt-0.5">&rarr;</a>
        </div>
        <div class="font-serif text-ink/50 dark:text-paper/50 italic mt-1 leading-relaxed text-[clamp(0.7rem,1.8vw,0.8rem)]">${authors}</div>
        
        ${paper.abstract ? `
          <div class="mt-2.5">
            <button class="abstract-toggle text-[0.65rem] uppercase tracking-[0.15em] font-black text-ink/60 dark:text-paper/60 hover:text-ink dark:hover:text-paper hover:bg-black/[0.04] dark:hover:bg-white/[0.04] px-2 py-1 -ml-2 rounded transition-all flex items-center gap-2 group/btn">
              <span>Read Abstract</span>
              <svg class="w-2.5 h-2.5 transform transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="square" stroke-linejoin="miter" stroke-width="2.5" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            <div class="abstract-content hidden mt-4 text-[0.8rem] leading-relaxed text-ink/70 dark:text-paper/70 font-serif border-t border-ink/5 dark:border-paper/5 pt-4 abstract-expansion italic">
              ${abstract}
            </div>
          </div>` : ''}
      </div>
    </div>`;

  const toggleBtn = card.querySelector('.abstract-toggle');
  if (toggleBtn) {
    const abstractDiv = card.querySelector('.abstract-content');
    const arrow = toggleBtn.querySelector('svg');
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      abstractDiv.classList.toggle('hidden');
      arrow.classList.toggle('rotate-180');
    });
  }

  return card;
}

const CHUNK_SIZE = 10;
let currentResults = [], currentIndex = 0, currentTerms = [], currentAuthorSubTerms = [], observer = null;

/**
 * Render the next chunk of results.
 */
function renderNextChunk(container) {
  if (currentIndex >= currentResults.length) return;

  const chunk = currentResults.slice(currentIndex, currentIndex + CHUNK_SIZE);
  const regex = getHighlightRegex(currentTerms);
  const authorRegex = currentAuthorSubTerms.length
    ? new RegExp(`(${currentAuthorSubTerms.map(escapeRegex).join('|')})`, 'gi')
    : null;

  const fragment = document.createDocumentFragment();

  // Create temporary container to hold the elements for KaTeX
  const temp = document.createElement('div');
  for (const paper of chunk) {
    temp.appendChild(createCard(paper, regex, authorRegex));
  }

  // Remove old sentinel
  const oldSentinel = container.querySelector('#scroll-sentinel');
  if (oldSentinel) {
    observer.unobserve(oldSentinel);
    oldSentinel.remove();
  }

  // Move elements to fragment
  while (temp.firstChild) fragment.appendChild(temp.firstChild);

  container.appendChild(fragment);
  const newElements = Array.from(container.children).slice(currentIndex);
  currentIndex += chunk.length;

  if (currentIndex < currentResults.length) {
    const sentinel = document.createElement('div');
    sentinel.id = 'scroll-sentinel';
    sentinel.className = 'h-32 flex items-center justify-center py-8 opacity-20 italic text-[0.6rem] uppercase tracking-[0.2em] font-black';
    sentinel.innerHTML = '<div class="w-1 h-1 bg-ink dark:bg-paper rounded-full animate-bounce"></div><span class="ml-2">Loading more entries</span>';
    container.appendChild(sentinel);
    observer.observe(sentinel);
  }

  // Performance fix: Only typeset the newly added chunk
  if (window.renderMathInElement) {
    newElements.forEach(el => {
      window.renderMathInElement(el, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false
      });
    });
  }
}

/**
 * Render a list of results into the DOM with infinite scroll.
 */
export function renderResults(results, terms, resultsList, resultsCount, isOrSearch = false, authorTerm = null, authorSubTerms = []) {
  const joiner = isOrSearch ? 'or' : 'and';

  const authorSummary = authorTerm
    ? ` <span class="opacity-70">by</span> <span class="font-bold">${authorTerm}</span>`
    : '';

  const querySummary = terms.length > 0
    ? ` <span class="opacity-70">${authorTerm ? 'and' : 'with'}</span> ${terms.map(t => `<span class="font-bold">${t}</span>`).join(` <span class="opacity-70 italic">${joiner}</span> `)}`
    : '';

  const totalSummary = authorSummary + querySummary;

  if (!results.length) {
    resultsCount.innerHTML = `<span class="opacity-70">No papers found matching</span>${totalSummary}`;
    resultsList.innerHTML = '';
    return;
  }

  resultsCount.innerHTML = `
    <span class="opacity-70">Discovered</span>
    <span class="font-bold">${results.length.toLocaleString()}</span>
    <span class="opacity-70">pertinent papers</span>${totalSummary}`;

  currentResults = results;
  currentTerms = terms;
  currentAuthorSubTerms = authorSubTerms;
  currentIndex = 0;
  resultsList.innerHTML = '';

  if (observer) observer.disconnect();
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) renderNextChunk(resultsList);
  }, { rootMargin: '600px' });

  renderNextChunk(resultsList);
}



/** Re-render the example/recent-search pills. */
export function renderPills(examplePills) {
  const terms = getRecent().length ? getRecent() : DEFAULTS;
  examplePills.innerHTML = terms
    .map(t => `<span class="pill-example bg-ink/[0.03] dark:bg-paper/[0.03] border border-ink/10 dark:border-paper/10 px-3 py-2 rounded-full cursor-pointer hover:bg-ink hover:text-paper dark:hover:bg-paper dark:hover:text-ink active:bg-ink active:text-paper dark:active:bg-paper dark:active:text-ink transition-all touch-manipulation no-tap">${t}</span>`)
    .join('');
}

/**
 * Collapse the header into compact search mode and reveal the results section.
 */
export function transitionToResults(refs) {
  return new Promise(resolve => {
    const { headerSection, logoTitle, subtitle, examplePills, purposeSection, resultsSection, searchHints, appContainer } = refs;

    requestAnimationFrame(() => {
      // 1. First animate the papersift to smaller size
      appContainer.classList.add('justify-start');
      appContainer.classList.remove('justify-center');
      headerSection.classList.add('pb-4', 'pt-6', 'sm:pt-2');
      logoTitle.classList.remove('title-landing');
      logoTitle.classList.add('title-compact');
      subtitle.classList.remove('subtitle-landing');
      subtitle.classList.add('subtitle-compact');

      // 2. Then remove the example pills (0.5s later)
      setTimeout(() => {
        fadeOutAndHide(examplePills);
        fadeOutAndHide(purposeSection);
        
        // Stop background animations to save CPU overhead
        stopPurposeLoop();

        // 3. Then show the search results (another 0.5s later)
        setTimeout(() => {
          showAndFadeIn(resultsSection);
          resolve();
        }, 500);
      }, 500);
    });
  });
}

/**
 * Restore the landing page layout.
 */
export function resetToHome(refs, onReset) {
  const { headerSection, logoTitle, subtitle, examplePills, purposeSection, resultsSection, input, resultsList, resultsCount, appContainer, searchHints } = refs;

  requestAnimationFrame(() => {
    // Hide results first
    fadeOutAndHide(resultsSection);

    setTimeout(() => {
      appContainer.classList.add('justify-center');
      appContainer.classList.remove('justify-start');
      headerSection.classList.remove('pb-4', 'pt-6', 'sm:pt-2');

      logoTitle.classList.remove('title-compact');
      logoTitle.classList.add('title-landing');
      subtitle.classList.remove('subtitle-compact');
      subtitle.classList.add('subtitle-landing');

      showAndFadeIn(examplePills);
      showAndFadeIn(purposeSection);
      if (searchHints) showAndFadeIn(searchHints);

      renderPills(examplePills);
    }, 400);

    input.value = '';
    document.querySelectorAll('input[type="checkbox"]:not([name$="-all"])').forEach(cb => cb.checked = false);
    document.querySelectorAll('input[name$="-all"]').forEach(cb => cb.checked = true);

    resultsList.innerHTML = '';
    resultsCount.innerHTML = '';

    onReset();
  });
}
