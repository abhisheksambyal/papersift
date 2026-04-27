/**
 * Main application entry point.
 * Orchestrates search, UI state, and interactions.
 */
import { saveRecent } from './core.js';
import { fetchResults, extractSearchTerms } from './core.js';
import { renderResults, renderPills, transitionToResults, resetToHome, initializeFilters, updateFilterHighlights, startPurposeLoop } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  // Reset scroll to top and disable automatic restoration
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);

  // ── DOM References ──────────────────────────────────────────────────────
  const domRefs = {
    form:              document.getElementById('search-form'),
    input:             document.getElementById('search-input'),
    headerSection:     document.getElementById('header-section'),
    logoTitle:         document.querySelector('#logo-container h1'),
    subtitle:          document.getElementById('subtitle'),
    examplePills:      document.getElementById('example-pills'),
    purposeSection:    document.getElementById('purpose-section'),
    purposeText:       document.getElementById('purpose-text'),
    resultsSection:    document.getElementById('results-section'),
    resultsList:       document.getElementById('results-list'),
    resultsCount:      document.getElementById('results-count'),
    conferenceFilters: document.getElementById('conference-filters'),
    yearFilters:       document.getElementById('year-filters'),
    searchHints:       document.getElementById('search-hints'),
    appContainer:      document.getElementById('app-container'),
  };

  // ── State ─────────────────────────────────────────────────────────────────
  let hasSearched   = false;
  let debounceTimer = null;
  let transitionPromise = Promise.resolve();

  // ── Initialization ────────────────────────────────────────────────────────
  renderPills(domRefs.examplePills);
  initializeFilters(domRefs.conferenceFilters, domRefs.yearFilters, initiateSearch);
  startPurposeLoop(domRefs.purposeText);

  // ── Interactions ──────────────────────────────────────────────────────────
  
  // Home Reset
  domRefs.logoTitle.addEventListener('click', () => {
    if (hasSearched) {
      clearTimeout(debounceTimer);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      resetToHome(domRefs, () => { 
        hasSearched = false; 
        transitionPromise = Promise.resolve();
        // Clear highlights after reset animation
        setTimeout(() => updateFilterHighlights([]), 500);
      });
    }
  });

  // Live Search
  domRefs.input.addEventListener('input', () => {
    const query = domRefs.input.value.trim();
    const selectedVenues = Array.from(document.querySelectorAll('input[name="conference"]:checked')).map(cb => cb.value);
    const selectedYears = Array.from(document.querySelectorAll('input[name="year"]:checked')).map(cb => cb.value);
    
    // Start transition immediately on first input to hide top elements
    if (!hasSearched && (query || selectedVenues.length || selectedYears.length)) {
      transitionPromise = transitionToResults(domRefs);
      hasSearched = true;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(initiateSearch, 500); // 500ms debounce
  });

  // History Save & Search
  domRefs.form.addEventListener('submit', e => {
    e.preventDefault();
    const query = domRefs.input.value.trim();
    if (query) saveRecent(query);
    initiateSearch();
  });

  // Pill Selection
  domRefs.examplePills.addEventListener('click', e => {
    if (!e.target.classList.contains('pill-example')) return;
    const term = e.target.textContent.trim();
    domRefs.input.value = term;
    saveRecent(term);
    
    if (!hasSearched) {
      transitionPromise = transitionToResults(domRefs);
      hasSearched = true;
    }
    initiateSearch();
  });

  // ── Search Logic ──────────────────────────────────────────────────────────
  
  function initiateSearch() {
    const query = domRefs.input.value.trim();
    const selectedVenues = Array.from(document.querySelectorAll('input[name="conference"]:checked')).map(cb => cb.value);
    const selectedYears = Array.from(document.querySelectorAll('input[name="year"]:checked')).map(cb => cb.value);

    // If nothing selected/typed, just clear if we had results
    if (!query && !selectedVenues.length && !selectedYears.length) {
      if (hasSearched) { 
        domRefs.resultsList.innerHTML = ''; 
        domRefs.resultsCount.innerHTML = ''; 
        updateFilterHighlights(new Set(), new Set());
      }
      return;
    }

    if (!hasSearched) {
      transitionPromise = transitionToResults(domRefs);
      hasSearched = true;
    }
    
    // Wait for UI layout transitions to finish before blocking main thread with results render
    transitionPromise.then(() => {
      performSearch(query, selectedVenues, selectedYears);
    });
  }

  async function performSearch(query, venues, years) {
    domRefs.resultsList.innerHTML  = '';
    domRefs.resultsCount.innerHTML = '<span class="italic opacity-60">Scanning the archives...</span>';
    
    try {
      const { results, activeVenues, activeYears } = await fetchResults(query, venues, years);
      const { terms, isOrSearch, authorTerm, authorSubTerms } = extractSearchTerms(query);
      
      renderResults(results, terms, domRefs.resultsList, domRefs.resultsCount, isOrSearch, authorTerm, authorSubTerms);
      updateFilterHighlights(activeVenues, activeYears);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Search failed:', err);
      domRefs.resultsCount.innerHTML = `Search error: ${err.message}`;
    }
  }

});
