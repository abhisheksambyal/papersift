document.addEventListener('DOMContentLoaded', () => {
  const form          = document.getElementById('search-form');
  const input         = document.getElementById('search-input');
  const headerSection = document.getElementById('header-section');
  const logoContainer = document.getElementById('logo-container');
  const resultsSection = document.getElementById('results-section');
  const resultsList   = document.getElementById('results-list');
  const resultsCount  = document.getElementById('results-count');
  const subtitle      = document.getElementById('subtitle');
  const examplePills  = document.getElementById('example-pills');

  const STORAGE_KEY   = 'medsearch_recent';
  const MAX_RECENT    = 4;
  const DEFAULTS      = ['mri', 'classification', 'calibration'];

  function getRecent() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }

  function isValidQuery(query) {
    // Only save if every word is purely alphabetic and at least 3 chars long
    return query.trim().split(/\s+/).every(w => /^[a-zA-Z]{3,}$/.test(w));
  }

  function saveRecent(query) {
    if (!isValidQuery(query)) return;
    const recent = [query, ...getRecent().filter(q => q !== query)].slice(0, MAX_RECENT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
  }

  function renderPills() {
    const recent = getRecent();
    const terms  = recent.length ? recent : DEFAULTS;
    examplePills.innerHTML = terms.map(term =>
      `<span class="pill-example bg-ink/[0.03] border border-ink/10 px-3 py-1 rounded-full cursor-pointer hover:bg-ink hover:text-paper transition-all">${term}</span>`
    ).join('');
  }

  renderPills();

  let hasSearched = false;
  let debounceTimer;

  const transitionToResults = () => {
    headerSection.classList.replace('min-h-[70vh]', 'min-h-[10vh]');
    headerSection.classList.add('pb-4', 'pt-2');
    subtitle.classList.add('hidden');
    logoContainer.querySelector('h1').style.fontSize = 'clamp(1.2rem, 3vw, 1.8rem)';
    examplePills.classList.add('hidden');
    setTimeout(() => {
      resultsSection.classList.remove('opacity-0', 'translate-y-8', 'invisible');
      resultsSection.classList.add('opacity-100', 'translate-y-0', 'visible');
    }, 300);
  };

  const resetToHome = () => {
    // Restore header
    headerSection.classList.replace('min-h-[10vh]', 'min-h-[70vh]');
    headerSection.classList.remove('pb-4', 'pt-2');
    // Restore logo size
    logoContainer.querySelector('h1').style.fontSize = '';
    // Show subtitle and pills
    subtitle.classList.remove('hidden');
    examplePills.classList.remove('hidden');
    renderPills();
    // Hide results
    resultsSection.classList.add('opacity-0', 'translate-y-8', 'invisible');
    resultsSection.classList.remove('opacity-100', 'translate-y-0', 'visible');
    // Clear state
    input.value = '';
    resultsList.innerHTML = '';
    resultsCount.innerHTML = '';
    hasSearched = false;
  };

  logoContainer.querySelector('h1').style.cursor = 'pointer';
  logoContainer.querySelector('h1').addEventListener('click', () => {
    if (hasSearched) resetToHome();
  });

  const initiateSearch = () => {
    const query = input.value.trim();
    if (!query) {
      if (hasSearched) {
        resultsList.innerHTML = '';
        resultsCount.innerHTML = '';
      }
      return;
    }

    if (!hasSearched) {
      transitionToResults();
      hasSearched = true;
    }

    performSearch(query);
  };

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(initiateSearch, 300);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(debounceTimer);
    const query = input.value.trim();
    if (query) saveRecent(query);
    initiateSearch();
  });

  examplePills.addEventListener('click', (e) => {
    if (e.target.classList.contains('pill-example')) {
      const term = e.target.textContent.trim();
      input.value = term;
      saveRecent(term);
      initiateSearch();
    }
  });

  async function performSearch(query) {
    resultsList.innerHTML = '';
    resultsCount.innerHTML = `<span class="italic opacity-60">Scanning the archives...</span>`;

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Server error: ' + response.status);

      const results = await response.json();
      const terms = query.toLowerCase().split(' ').filter(t => t.length > 2);
      renderResults(results, terms);
    } catch (err) {
      console.error('Search failed:', err);
      resultsCount.innerHTML = `Search error: ${err.message}`;
    }
  }

  function renderResults(results, searchTerms) {
    if (results.length === 0) {
      resultsCount.textContent = 'No papers found matching your query.';
      return;
    }

    resultsCount.innerHTML = `
      <span class="opacity-70">Discovered</span>
      <span class="font-bold">${results.length}</span>
      <span class="opacity-70">pertinent papers</span>`;

    results.forEach(paper => {
      let hiTitle = paper.title || 'Untitled';

      searchTerms.forEach(term => {
        const regex = new RegExp(`(${term})`, 'gi');
        hiTitle = hiTitle.replace(regex, '<span class="bg-ink text-paper px-0.5 font-bold mx-0.5">$1</span>');
      });

      const card = document.createElement('a');
      card.href   = paper.url?.startsWith('http') ? paper.url : `https://papers.miccai.org${paper.url}`;
      card.target = '_blank';
      card.rel    = 'noopener noreferrer';
      card.className = 'group block py-2.5 px-1 hover:bg-black/[0.03] transition-colors border-b border-ink/5 last:border-0';

      card.innerHTML = `
        <div class="flex items-center justify-between gap-4">
          <div class="flex-grow overflow-hidden">
            <div class="flex items-baseline gap-3">
              <h3 class="font-masthead font-bold text-base leading-tight group-hover:text-ink/80 transition-colors truncate capitalize">
                ${hiTitle.toLowerCase()}
              </h3>
              <div class="font-serif text-[0.6rem] text-ink/40 uppercase tracking-widest font-bold whitespace-nowrap">
                ${paper.venue} '${paper.year.slice(-2)}
              </div>
            </div>
            <div class="font-serif text-[0.7rem] text-ink/40 italic truncate mt-0.5">
              ${paper.authors || 'Unknown Authors'}
            </div>
          </div>
          <span class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity font-serif text-[0.6rem] font-bold uppercase tracking-[0.2em] text-ink/60">
            &rarr;
          </span>
        </div>`;

      resultsList.appendChild(card);
    });
  }
});
