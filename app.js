document.addEventListener('DOMContentLoaded', () => {

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const form          = document.getElementById('search-form');
  const input         = document.getElementById('search-input');
  const headerSection = document.getElementById('header-section');
  const logoContainer = document.getElementById('logo-container');
  const logoTitle     = logoContainer.querySelector('h1');
  const subtitle      = document.getElementById('subtitle');
  const examplePills  = document.getElementById('example-pills');
  const resultsSection = document.getElementById('results-section');
  const resultsList   = document.getElementById('results-list');
  const resultsCount  = document.getElementById('results-count');

  // ── Recent-search history ─────────────────────────────────────────────────
  const STORAGE_KEY = 'medsearch_recent';
  const MAX_RECENT  = 4;
  const DEFAULTS    = ['mri', 'classification', 'calibration'];

  const getRecent = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  };

  const isValidQuery = q =>
    q.trim().split(/\s+/).every(w => /^[a-zA-Z]{3,}$/.test(w));

  const saveRecent = query => {
    if (!isValidQuery(query)) return;
    const updated = [query, ...getRecent().filter(q => q !== query)].slice(0, MAX_RECENT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const renderPills = () => {
    const terms = getRecent().length ? getRecent() : DEFAULTS;
    examplePills.innerHTML = terms
      .map(t => `<span class="pill-example bg-ink/[0.03] border border-ink/10 px-3 py-1 rounded-full cursor-pointer hover:bg-ink hover:text-paper transition-all">${t}</span>`)
      .join('');
  };

  // ── Layout transitions ────────────────────────────────────────────────────
  const transitionToResults = () => {
    headerSection.classList.replace('min-h-[70vh]', 'min-h-[10vh]');
    headerSection.classList.add('pb-4', 'pt-2');
    logoTitle.style.fontSize = 'clamp(1.2rem, 3vw, 1.8rem)';
    subtitle.classList.add('hidden');
    examplePills.classList.add('hidden');
    setTimeout(() => {
      resultsSection.classList.remove('opacity-0', 'translate-y-8', 'invisible');
      resultsSection.classList.add('opacity-100', 'translate-y-0', 'visible');
    }, 300);
  };

  const resetToHome = () => {
    headerSection.classList.replace('min-h-[10vh]', 'min-h-[70vh]');
    headerSection.classList.remove('pb-4', 'pt-2');
    logoTitle.style.fontSize = '';
    subtitle.classList.remove('hidden');
    examplePills.classList.remove('hidden');
    renderPills();
    resultsSection.classList.add('opacity-0', 'translate-y-8', 'invisible');
    resultsSection.classList.remove('opacity-100', 'translate-y-0', 'visible');
    input.value = '';
    resultsList.innerHTML = '';
    resultsCount.innerHTML = '';
    hasSearched = false;
  };

  // ── State ─────────────────────────────────────────────────────────────────
  let hasSearched   = false;
  let debounceTimer = null;
  let activeController = null;  // tracks the current in-flight fetch

  // ── Initialise ────────────────────────────────────────────────────────────
  renderPills();
  logoTitle.style.cursor = 'pointer';
  logoTitle.addEventListener('click', () => { if (hasSearched) resetToHome(); });

  // ── Search logic ──────────────────────────────────────────────────────────
  const initiateSearch = () => {
    const query = input.value.trim();
    if (!query) {
      if (hasSearched) { resultsList.innerHTML = ''; resultsCount.innerHTML = ''; }
      return;
    }
    if (!hasSearched) { transitionToResults(); hasSearched = true; }
    performSearch(query);
  };

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(initiateSearch, 300);
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    clearTimeout(debounceTimer);
    const query = input.value.trim();
    if (query) saveRecent(query);
    initiateSearch();
  });

  examplePills.addEventListener('click', e => {
    if (!e.target.classList.contains('pill-example')) return;
    const term = e.target.textContent.trim();
    input.value = term;
    saveRecent(term);
    initiateSearch();
  });

  // ── API call ──────────────────────────────────────────────────────────────
  async function performSearch(query) {
    // Abort any previous in-flight request to prevent stale results appending
    if (activeController) activeController.abort();
    activeController = new AbortController();

    resultsList.innerHTML = '';
    resultsCount.innerHTML = '<span class="italic opacity-60">Scanning the archives...</span>';
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: activeController.signal });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const results = await res.json();
      const terms   = query.toLowerCase().split(' ').filter(t => t.length > 2);
      renderResults(results, terms);
    } catch (err) {
      if (err.name === 'AbortError') return;  // cancelled — do nothing
      console.error('Search failed:', err);
      resultsCount.innerHTML = `Search error: ${err.message}`;
    }
  }

  // ── Render results ────────────────────────────────────────────────────────
  function highlight(text, terms) {
    return terms.reduce((t, term) =>
      t.replace(new RegExp(`(${term})`, 'gi'), '<span class="bg-ink text-paper px-0.5 font-bold mx-0.5">$1</span>'),
      text
    );
  }

  function renderResults(results, terms) {
    if (!results.length) {
      resultsCount.textContent = 'No papers found matching your query.';
      return;
    }

    resultsCount.innerHTML = `
      <span class="opacity-70">Discovered</span>
      <span class="font-bold">${results.length}</span>
      <span class="opacity-70">pertinent papers</span>`;

    results.forEach(paper => {
      const title = highlight((paper.title || 'Untitled').toLowerCase(), terms);
      const href  = paper.url?.startsWith('http') ? paper.url : `https://papers.miccai.org${paper.url}`;

      const card = Object.assign(document.createElement('a'), {
        href, target: '_blank', rel: 'noopener noreferrer',
        className: 'group block py-2.5 px-1 hover:bg-black/[0.03] transition-colors border-b border-ink/5 last:border-0',
      });

      card.innerHTML = `
        <div class="flex items-center justify-between gap-4">
          <div class="flex-grow overflow-hidden">
            <div class="flex items-baseline gap-3">
              <h3 class="font-masthead font-bold text-base leading-tight group-hover:text-ink/80 transition-colors truncate capitalize">${title}</h3>
              <div class="font-serif text-[0.6rem] text-ink/40 uppercase tracking-widest font-bold whitespace-nowrap">
                ${paper.venue} '${paper.year.slice(-2)}
              </div>
            </div>
            <div class="font-serif text-[0.7rem] text-ink/40 italic truncate mt-0.5">${paper.authors || 'Unknown Authors'}</div>
          </div>
          <span class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity font-serif text-[0.6rem] font-bold uppercase tracking-[0.2em] text-ink/60">&rarr;</span>
        </div>`;

      resultsList.appendChild(card);
    });
  }
});
