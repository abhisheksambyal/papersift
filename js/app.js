/**
 * Main application entry point.
 * Orchestrates search, UI state, and interactions.
 */
import { saveRecent }                           from './history.js';
import { fetchResults, extractSearchTerms } from './search.js';
import { renderResults }                         from './renderer_v2.js';
import { renderPills, transitionToResults, resetToHome } from './ui.js';
import { initializeFilters, updateFilterHighlights } from './filters.js';
import { startPurposeLoop }                     from './purpose.js';

document.addEventListener('DOMContentLoaded', () => {

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
  };

  // ── State ─────────────────────────────────────────────────────────────────
  let hasSearched   = false;
  let debounceTimer = null;

  // ── Initialization ────────────────────────────────────────────────────────
  renderPills(domRefs.examplePills);
  initializeFilters(domRefs.conferenceFilters, domRefs.yearFilters, initiateSearch);
  startPurposeLoop(domRefs.purposeText);

  // ── Interactions ──────────────────────────────────────────────────────────
  
  // Home Reset
  domRefs.logoTitle.addEventListener('click', () => {
    if (hasSearched) {
      clearTimeout(debounceTimer);
      resetToHome(domRefs, () => { 
        hasSearched = false; 
        // Clear highlights after reset animation
        setTimeout(() => updateFilterHighlights([]), 500);
      });
    }
  });

  // Live Search
  domRefs.input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(initiateSearch, 300);
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
        updateFilterHighlights([]);
      }
      return;
    }

    if (!hasSearched) {
      transitionToResults(domRefs);
      hasSearched = true;
    }
    
    performSearch(query, selectedVenues, selectedYears);
  }

  async function performSearch(query, venues, years) {
    domRefs.resultsList.innerHTML  = '';
    domRefs.resultsCount.innerHTML = '<span class="italic opacity-60">Scanning the archives...</span>';
    
    try {
      const results = await fetchResults(query, venues, years);
      const { terms } = extractSearchTerms(query);
      
      renderResults(results, terms, domRefs.resultsList, domRefs.resultsCount);
      updateFilterHighlights(results);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Search failed:', err);
      domRefs.resultsCount.innerHTML = `Search error: ${err.message}`;
    }
  }

});
