import { saveRecent, fetchResults, extractSearchTerms } from './core.js';
import { renderResults, renderPills, transitionToResults, resetToHome, initializeFilters, updateFilterHighlights, startPurposeLoop } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

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
    searchHints:       document.getElementById('search-hints')
  };

  let hasSearched = false, debounceTimer = null, transitionPromise = Promise.resolve();

  renderPills(domRefs.examplePills);
  initializeFilters(domRefs.conferenceFilters, domRefs.yearFilters, initiateSearch);
  startPurposeLoop(domRefs.purposeText);

  const getSelectedFilters = () => ({
    venues: [...document.querySelectorAll('input[name="conference"]:checked')].map(cb => cb.value),
    years: [...document.querySelectorAll('input[name="year"]:checked')].map(cb => cb.value)
  });

  const logoBranding = document.getElementById('logo-branding');
  logoBranding.addEventListener('click', () => {
    if (!hasSearched) return;
    clearTimeout(debounceTimer);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    resetToHome(domRefs, () => { 
      hasSearched = false; 
      transitionPromise = Promise.resolve();
      setTimeout(() => updateFilterHighlights([]), 500);
    });
  });

  domRefs.input.addEventListener('input', () => {
    const query = domRefs.input.value.trim();
    const { venues, years } = getSelectedFilters();
    if (!hasSearched && (query || venues.length || years.length)) {
      transitionPromise = transitionToResults(domRefs);
      hasSearched = true;
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(initiateSearch, 400);
  });

  domRefs.form.addEventListener('submit', e => {
    e.preventDefault();
    const q = domRefs.input.value.trim();
    if (q) saveRecent(q);
    initiateSearch();
  });

  domRefs.examplePills.addEventListener('click', e => {
    const pill = e.target.closest('.pill-example');
    if (!pill) return;
    const term = pill.textContent.trim();
    domRefs.input.value = term;
    saveRecent(term);
    if (!hasSearched) {
      transitionPromise = transitionToResults(domRefs);
      hasSearched = true;
    }
    initiateSearch();
  });

  function initiateSearch() {
    const query = domRefs.input.value.trim();
    const { venues, years } = getSelectedFilters();

    if (!query && !venues.length && !years.length) {
      if (hasSearched) {
        domRefs.resultsList.innerHTML = domRefs.resultsCount.innerHTML = '';
        updateFilterHighlights();
      }
      return;
    }

    if (!hasSearched) {
      transitionPromise = transitionToResults(domRefs);
      hasSearched = true;
    }
    
    transitionPromise.then(() => performSearch(query, venues, years));
  }

  async function performSearch(query, venues, years) {
    domRefs.resultsList.innerHTML = '';
    domRefs.resultsCount.innerHTML = '<span class="italic opacity-60">Scanning archive...</span>';
    
    try {
      const { results, activeVenues, activeYears } = await fetchResults(query, venues, years);
      const { terms, isOrSearch, authorTerm, authorSubTerms } = extractSearchTerms(query);
      
      const counts = results.reduce((acc, p) => {
        if (p.year) acc.years[p.year] = (acc.years[p.year] || 0) + 1;
        if (p.venue) {
          const v = p.venue.toLowerCase();
          ['miccai', 'midl', 'isbi', 'neurips'].forEach(id => {
            if (v.includes(id)) acc.venues[id] = (acc.venues[id] || 0) + 1;
          });
        }
        return acc;
      }, { years: {}, venues: {} });

      renderResults(results, terms, domRefs, isOrSearch, authorTerm, authorSubTerms);
      updateFilterHighlights(activeVenues, activeYears, counts.years, counts.venues);
    } catch (err) {
      if (err.name === 'AbortError') return;
      domRefs.resultsCount.innerHTML = `Error: ${err.message}`;
    }
  }
});
