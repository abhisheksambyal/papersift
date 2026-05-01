import { DEFAULTS, getRecent } from './core.js';

export function fadeOutAndHide(el, dur = 400) {
  if (!el) return;
  el.classList.add('opacity-0', 'pointer-events-none');
  setTimeout(() => el.classList.add('hidden'), dur);
}

export function showAndFadeIn(el) {
  if (!el) return;
  el.classList.remove('hidden', 'invisible');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.classList.remove('opacity-0', 'translate-y-4', 'pointer-events-none');
    el.classList.add('opacity-100', 'translate-y-0');
  }));
}

export function restartAnimation(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add(cls)));
}

/**
 * Logic for the rotating purpose questions on the landing page.
 */


const QUESTIONS = [
  "Which MICCAI 2024 papers use the BraTS dataset?",
  "Where can I find Few-Shot Learning papers?",
  "Which papers are based on cardiac data?",
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
  // Critical: prevent multiple timers from stacking on navigation
  stopPurposeLoop();

  const specificQuestion = "Tired of checking every conference manually?";
  const discoveryQuestions = QUESTIONS.filter(q => q !== specificQuestion && q !== QUESTIONS[QUESTIONS.length - 1]);
  const finaleQuestion = QUESTIONS[QUESTIONS.length - 1];

  shuffle(discoveryQuestions);
  // The pool is the shuffled questions followed by the specific trigger question
  const pool = [...discoveryQuestions, specificQuestion];
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

export async function initializeFilters(confContainer, yearContainer, onSearch) {
  try {
    const config = await (await fetch('data/config.json')).json();
    const tpl = (name, val, label, checked = false) => `
      <label class="flex items-center gap-2 cursor-pointer group no-tap">
        <input type="checkbox" name="${name}" value="${val}" class="hidden peer" ${checked ? 'checked' : ''}>
        <span class="text-[0.7rem] uppercase tracking-widest text-ink/40 dark:text-paper/40 peer-checked:text-ink dark:peer-checked:text-paper peer-checked:font-black group-hover:text-ink/70 dark:group-hover:text-paper/70 transition-all border-b border-transparent peer-checked:border-ink/20 dark:peer-checked:border-paper/20">${label}</span>
      </label>`;

    confContainer.innerHTML = tpl('conference-all', 'all', 'All', true) + config.conferences.map(c => tpl('conference', c.id, c.name)).join('');
    yearContainer.innerHTML = tpl('year-all', 'all', 'All', true) + config.years.map(y => tpl('year', y, y)).join('');

    [confContainer, yearContainer].forEach(c => c.addEventListener('change', e => {
      const isAll = e.target.name.endsWith('-all'), group = e.target.name.replace('-all', '');
      if (isAll && e.target.checked) document.querySelectorAll(`input[name="${group}"]`).forEach(cb => cb.checked = false);
      else if (!isAll && e.target.checked) {
        const all = document.querySelector(`input[name="${group}-all"]`);
        if (all) all.checked = false;
      }
      const none = !document.querySelectorAll(`input[name="${group}"]:checked`).length;
      const all = document.querySelector(`input[name="${group}-all"]`);
      if (none && all) all.checked = true;
      onSearch();
    }));
  } catch (err) { console.error('Filter init failed:', err); }
}

export function updateFilterHighlights(activeVenues = new Set(), activeYears = new Set(), yearCounts = null, venueCounts = null) {
  const cls = ['bg-[#c8e6c9]', 'dark:bg-[#1b5e20]', 'px-1.5', 'py-0.5', '-mx-1.5', 'rounded', 'font-black', 'text-black', 'dark:text-white'];
  document.querySelectorAll('#filter-container span').forEach(s => {
    s.classList.remove(...cls);
    s.style.fontSize = s.style.opacity = '';
  });

  const apply = (name, set) => set.forEach(v => {
    const el = document.querySelector(`input[name="${name}"][value="${v}"]`);
    if (el) el.nextElementSibling.classList.add(...cls);
  });

  apply('conference', activeVenues);
  apply('year', activeYears);

  const applyDist = (name, set, counts) => {
    if (!counts || set.size <= 1) return;
    const freqs = Object.values(counts), max = Math.max(...freqs), min = Math.min(...freqs);
    set.forEach(v => {
      const el = document.querySelector(`input[name="${name}"][value="${v}"]`);
      if (el) {
        const s = el.nextElementSibling, c = counts[v] || 0, r = max === min ? 0.5 : (c - min) / (max - min);
        s.style.fontSize = `${0.65 + r * 0.3}rem`;
        s.style.opacity = `${0.8 + r * 0.2}`;
      }
    });
  };
  applyDist('year', activeYears, yearCounts);
  applyDist('conference', activeVenues, venueCounts);
}

const escapeCache = new Map();
function escapeRegex(str) {
  let esc = escapeCache.get(str);
  if (!esc) {
    esc = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    escapeCache.set(str, esc);
    if (escapeCache.size > 100) escapeCache.delete(escapeCache.keys().next().value);
  }
  return esc;
}

function highlight(text, re) {
  if (!re || !text) return text;
  return text.split(/(\$.*?\$)/g).map(p => (p.startsWith('$') && p.endsWith('$')) ? p : p.replace(re, '<span class="bg-ink text-paper dark:bg-paper dark:text-ink px-0.5 font-bold mx-0.5">$1</span>')).join('');
}

function createCard(p, re, authorRe) {
  const title = highlight(p.title || 'Untitled', re), authors = authorRe ? highlight(p.authors || 'Unknown', authorRe) : (p.authors || 'Unknown');
  const abstract = p.abstract ? highlight(p.abstract, re) : '', url = p.url?.startsWith('http') ? p.url : `https://papers.miccai.org${p.url}`;
  const [venue] = (p.venue || 'PAPER').split(' '), yr = String(p.year || '').slice(-2);

  const card = document.createElement('div');
  card.className = 'group block py-3 sm:py-2.5 px-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] border-b border-ink/5 dark:border-paper/5 last:border-0';
  card.innerHTML = `
    <div class="flex items-start gap-4 sm:gap-8 py-1">
      <div class="flex-shrink-0 w-12 sm:w-16 text-right pt-1">
        <div class="font-serif text-[0.5rem] sm:text-[0.6rem] text-ink/40 dark:text-paper/40 uppercase tracking-widest font-black leading-none">${venue}</div>
        <div class="font-masthead text-xl sm:text-2xl font-black text-ink/20 dark:text-paper/20 -mt-1 tabular-nums tracking-tighter">'${yr}</div>
      </div>
      <div class="flex-grow min-w-0 border-l border-ink/10 dark:border-paper/10 pl-4 sm:pl-8">
        <div class="flex items-start justify-between gap-4">
          <a href="${url}" target="_blank" rel="noopener" class="hover:underline underline-offset-4 decoration-1">
            <h3 class="font-masthead font-bold leading-tight capitalize text-[clamp(0.9rem,2.5vw,1.1rem)]">${title}</h3>
          </a>
          <span class="text-ink/30 font-serif text-[0.8rem] font-bold">&rarr;</span>
        </div>
        <div class="font-serif text-ink/50 dark:text-paper/50 italic mt-1 text-[clamp(0.7rem,1.8vw,0.8rem)]">${authors}</div>
        ${p.abstract ? `
          <div class="mt-2.5">
            <button class="abstract-toggle text-[0.65rem] uppercase tracking-[0.15em] font-black text-ink/60 dark:text-paper/60 hover:text-ink px-2 py-1 -ml-2 rounded flex items-center gap-2">
              <span>Abstract</span>
              <svg class="w-2 h-2 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="square" stroke-width="3" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            <div class="abstract-content hidden mt-4 text-[0.8rem] leading-relaxed italic border-t border-ink/5 pt-4">${abstract}</div>
          </div>` : ''}
      </div>
    </div>`;

  const btn = card.querySelector('.abstract-toggle');
  if (btn) btn.onclick = () => {
    card.querySelector('.abstract-content').classList.toggle('hidden');
    btn.querySelector('svg').classList.toggle('rotate-180');
  };
  return card;
}

const CHUNK = 10;
let results = [], idx = 0, terms = [], authorSub = [], observer = null;

function renderNext(container) {
  if (idx >= results.length) return;
  const chunk = results.slice(idx, idx + CHUNK), re = terms.length ? new RegExp(`(${terms.map(escapeRegex).join('|')})`, 'gi') : null;
  const authorRe = authorSub.length ? new RegExp(`(${authorSub.map(escapeRegex).join('|')})`, 'gi') : null;
  const frag = document.createDocumentFragment();
  chunk.forEach(p => frag.appendChild(createCard(p, re, authorRe)));

  const sentinel = container.querySelector('#scroll-sentinel');
  if (sentinel) { observer.unobserve(sentinel); sentinel.remove(); }

  const newEls = [...frag.children];
  container.appendChild(frag);
  idx += chunk.length;

  if (idx < results.length) {
    const s = document.createElement('div');
    s.id = 'scroll-sentinel';
    s.className = 'h-32 flex items-center justify-center opacity-20 italic text-[0.6rem] font-black';
    s.innerHTML = '<div class="w-1 h-1 bg-current rounded-full animate-bounce"></div>';
    container.appendChild(s);
    observer.observe(s);
  }

  if (window.renderMathInElement) newEls.forEach(el => window.renderMathInElement(el, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false }));
}

function generateSummary(terms, isOr, author) {
  const joiner = isOr ? 'or' : 'and';
  return (author ? ` <span class="opacity-70">by</span> <span class="font-bold">${author}</span>` : '') +
    (terms.length ? ` <span class="opacity-70">${author ? 'and' : 'with'}</span> ${terms.map(t => `<span class="font-bold">${t}</span>`).join(` <span class="opacity-70 italic">${joiner}</span> `)}` : '');
}

export function renderResults(res, t, refs, isOr = false, author = null, sub = []) {
  const { resultsList: list, resultsCount: count } = refs, summary = generateSummary(t, isOr, author);
  if (!res.length) { count.innerHTML = `<span class="opacity-70">No matching papers</span>${summary}`; list.innerHTML = ''; return; }
  count.innerHTML = `<span class="opacity-70">Found</span> <span class="font-bold">${res.length.toLocaleString()}</span> <span class="opacity-70">papers</span>${summary}`;
  results = res; terms = t; authorSub = sub; idx = 0; list.innerHTML = '';
  if (observer) observer.disconnect();
  observer = new IntersectionObserver(e => e[0].isIntersecting && renderNext(list), { rootMargin: '600px' });
  renderNext(list);
}

export function renderPills(el) {
  const t = getRecent().length ? getRecent() : DEFAULTS;
  el.innerHTML = t.map(v => `<span class="pill-example bg-ink/[0.03] dark:bg-paper/[0.03] border border-ink/10 dark:border-paper/10 px-3 py-2 rounded-full cursor-pointer hover:bg-ink hover:text-paper dark:hover:bg-paper dark:hover:text-ink transition-all touch-manipulation no-tap">${v}</span>`).join('');
}

export async function transitionToResults(refs) {
  const { headerSection, logoTitle, subtitle, examplePills, purposeSection, resultsSection } = refs;
  headerSection.classList.replace('header-landing', 'header-compact');
  logoTitle.classList.replace('title-landing', 'title-compact');
  subtitle.classList.replace('subtitle-landing', 'subtitle-compact');
  setTimeout(() => { fadeOutAndHide(examplePills); fadeOutAndHide(purposeSection); stopPurposeLoop(); setTimeout(() => showAndFadeIn(resultsSection), 500); }, 500);
}

export function resetToHome(refs, onReset) {
  const { headerSection, logoTitle, subtitle, examplePills, purposeSection, resultsSection, input, resultsList, resultsCount, searchHints } = refs;
  fadeOutAndHide(resultsSection);
  setTimeout(() => {
    headerSection.classList.replace('header-compact', 'header-landing');
    logoTitle.classList.replace('title-compact', 'title-landing');
    subtitle.classList.replace('subtitle-compact', 'subtitle-landing');
    showAndFadeIn(examplePills); showAndFadeIn(purposeSection); if (searchHints) showAndFadeIn(searchHints);
    renderPills(examplePills); startPurposeLoop(purposeSection.querySelector('p'));
  }, 400);
  input.value = '';
  document.querySelectorAll('input[type="checkbox"]:not([name$="-all"])').forEach(cb => cb.checked = false);
  document.querySelectorAll('input[name$="-all"]').forEach(cb => cb.checked = true);
  resultsList.innerHTML = resultsCount.innerHTML = '';
  onReset();
}
