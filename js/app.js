import { saveRecent }                           from './history.js';
import { fetchResults }                          from './search.js';
import { renderResults }                         from './renderer_v2.js';
import { renderPills, transitionToResults, resetToHome } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const form           = document.getElementById('search-form');
  const input          = document.getElementById('search-input');
  const headerSection  = document.getElementById('header-section');
  const logoContainer  = document.getElementById('logo-container');
  const logoTitle      = logoContainer.querySelector('h1');
  const subtitle       = document.getElementById('subtitle');
  const examplePills   = document.getElementById('example-pills');
  const resultsSection = document.getElementById('results-section');
  const resultsList    = document.getElementById('results-list');
  const resultsCount   = document.getElementById('results-count');

  // Shared refs object passed to UI functions
  const domRefs = { headerSection, logoTitle, subtitle, examplePills, resultsSection, input, resultsList, resultsCount };

  // ── State ─────────────────────────────────────────────────────────────────
  let hasSearched   = false;
  let debounceTimer = null;

  // ── Init ──────────────────────────────────────────────────────────────────
  renderPills(examplePills);


  logoTitle.addEventListener('click', () => {
    if (hasSearched) {

      clearTimeout(debounceTimer);
      resetToHome(domRefs, () => { hasSearched = false; });
    }
  });

  // ── Search orchestration ──────────────────────────────────────────────────
  const initiateSearch = () => {
    const query = input.value.trim();
    if (!query) {
      if (hasSearched) { resultsList.innerHTML = ''; resultsCount.innerHTML = ''; }
      return;
    }
    if (!hasSearched) { transitionToResults(domRefs); hasSearched = true; }
    performSearch(query);
  };

  // Debounced live search
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(initiateSearch, 300);
  });

  // Explicit submit saves to history
  form.addEventListener('submit', e => {
    e.preventDefault();
    clearTimeout(debounceTimer);
    const query = input.value.trim();
    if (query) saveRecent(query);
    initiateSearch();
  });

  // Pill click — fill input and search
  examplePills.addEventListener('click', e => {
    if (!e.target.classList.contains('pill-example')) return;
    const term = e.target.textContent.trim();
    input.value = term;
    saveRecent(term);
    initiateSearch();
  });

  // ── API call ──────────────────────────────────────────────────────────────
  async function performSearch(query) {
    resultsList.innerHTML  = '';
    resultsCount.innerHTML = '<span class="italic opacity-60">Scanning the archives...</span>';
    try {
      const results = await fetchResults(query);
      const terms   = query.toLowerCase().split(' ').filter(t => t.length > 2);
      renderResults(results, terms, resultsList, resultsCount);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Search failed:', err);
      resultsCount.innerHTML = `Search error: ${err.message}`;
    }
  }

});
