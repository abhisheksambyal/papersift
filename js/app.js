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
  const purposeSection = document.getElementById('purpose-section');
  const purposeText    = document.getElementById('purpose-text');
  const resultsSection = document.getElementById('results-section');
  const resultsList    = document.getElementById('results-list');
  const resultsCount   = document.getElementById('results-count');

  const conferenceFilters = document.getElementById('conference-filters');
  const yearFilters       = document.getElementById('year-filters');

  // Shared refs object passed to UI functions
  const domRefs = { 
    headerSection, logoTitle, subtitle, examplePills, purposeSection,
    resultsSection, input, resultsList, resultsCount, conferenceFilters, yearFilters 
  };

  // ── State ─────────────────────────────────────────────────────────────────
  let hasSearched   = false;
  let debounceTimer = null;

  // ── Init ──────────────────────────────────────────────────────────────────
  renderPills(examplePills);
  initializeFilters();
  startPurposeLoop(purposeText);

  function startPurposeLoop(el) {
    const questions = [
      "Not able to find how many papers are on Few-Shot learning?",
      "Not able to find how many papers are on Calibration?",
      "Not able to find how many papers use Brats dataset?",
      "Seeking where the ISIC 2019 dataset was applied?",
      "Stop scouring 40+ conference sites manually."
    ];
    let idx = 0;
    
    const cycle = () => {
      el.classList.add('opacity-0');
      setTimeout(() => {
        el.textContent = questions[idx];
        el.classList.remove('opacity-0');
        idx = (idx + 1) % questions.length;
      }, 700);
    };
    
    cycle();
    setInterval(cycle, 5000);
  }

  async function initializeFilters() {
    try {
      const res = await fetch('/api/config');
      const config = await res.json();
      
      // Populate Conferences
      const allConfHtml = `
        <label class="flex items-center gap-2 cursor-pointer group no-tap">
          <input type="checkbox" name="conference-all" value="all" class="hidden peer" checked>
          <span class="text-[0.7rem] uppercase tracking-widest text-ink/40 peer-checked:text-ink peer-checked:font-black group-hover:text-ink/70 transition-all border-b border-transparent peer-checked:border-ink/20">
            All
          </span>
        </label>
      `;
      conferenceFilters.innerHTML = allConfHtml + config.conferences.map(c => `
        <label class="flex items-center gap-2 cursor-pointer group no-tap">
          <input type="checkbox" name="conference" value="${c.id}" class="hidden peer">
          <span class="text-[0.7rem] uppercase tracking-widest text-ink/40 peer-checked:text-ink peer-checked:font-black group-hover:text-ink/70 transition-all border-b border-transparent peer-checked:border-ink/20">
            ${c.name}
          </span>
        </label>
      `).join('');
      
      // Populate Years
      const allYearHtml = `
        <label class="flex items-center gap-2 cursor-pointer group no-tap">
          <input type="checkbox" name="year-all" value="all" class="hidden peer" checked>
          <span class="text-[0.7rem] uppercase tracking-widest text-ink/40 peer-checked:text-ink peer-checked:font-black group-hover:text-ink/70 transition-all border-b border-transparent peer-checked:border-ink/20">
            All
          </span>
        </label>
      `;
      yearFilters.innerHTML = allYearHtml + config.years.map(y => `
        <label class="flex items-center gap-2 cursor-pointer group no-tap">
          <input type="checkbox" name="year" value="${y}" class="hidden peer">
          <span class="text-[0.7rem] uppercase tracking-widest text-ink/40 peer-checked:text-ink peer-checked:font-black group-hover:text-ink/70 transition-all border-b border-transparent peer-checked:border-ink/20">
            ${y}
          </span>
        </label>
      `).join('');

      // Listen for any checkbox change
      [conferenceFilters, yearFilters].forEach(container => {
        container.addEventListener('change', (e) => {
          if (e.target.type !== 'checkbox') return;

          const isAll = e.target.name.endsWith('-all');
          const groupName = e.target.name.replace('-all', '');
          
          if (isAll && e.target.checked) {
            // Uncheck all specific items if ALL is checked
            document.querySelectorAll(`input[name="${groupName}"]`).forEach(cb => cb.checked = false);
          } else if (!isAll && e.target.checked) {
            // Uncheck ALL if a specific item is checked
            const allCb = document.querySelector(`input[name="${groupName}-all"]`);
            if (allCb) allCb.checked = false;
          }

          // If nothing is checked, re-check ALL
          const anyChecked = document.querySelectorAll(`input[name="${groupName}"], input[name="${groupName}-all"]:checked`).length > 0;
          const specificChecked = document.querySelectorAll(`input[name="${groupName}"]:checked`).length > 0;
          const allCb = document.querySelector(`input[name="${groupName}-all"]`);
          
          if (!specificChecked && allCb) allCb.checked = true;

          initiateSearch();
        });
      });
    } catch (err) {
      console.error('Failed to load filter config:', err);
    }
  }


  logoTitle.addEventListener('click', () => {
    if (hasSearched) {
      clearTimeout(debounceTimer);
      resetToHome(domRefs, () => { 
        hasSearched = false; 
        // Clear highlights
        document.querySelectorAll('#filter-container span').forEach(span => {
          span.classList.remove('bg-[#c8e6c9]', 'px-1.5', 'py-0.5', '-mx-1.5', 'rounded', 'font-black', 'text-black');
        });
      });
    }
  });

  // ── Search orchestration ──────────────────────────────────────────────────
  const initiateSearch = () => {
    const query = input.value.trim();
    
    // Collect all checked values
    const selectedVenues = Array.from(document.querySelectorAll('input[name="conference"]:checked'))
      .map(cb => cb.value);
    const selectedYears = Array.from(document.querySelectorAll('input[name="year"]:checked'))
      .map(cb => cb.value);

    if (!query && !selectedVenues.length && !selectedYears.length) {
      if (hasSearched) { resultsList.innerHTML = ''; resultsCount.innerHTML = ''; }
      return;
    }
    if (!hasSearched) { transitionToResults(domRefs); hasSearched = true; }
    performSearch(query, selectedVenues, selectedYears);
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
  async function performSearch(query, selectedVenues = [], selectedYears = []) {
    resultsList.innerHTML  = '';
    resultsCount.innerHTML = '<span class="italic opacity-60">Scanning the archives...</span>';
    try {
      const results = await fetchResults(query, selectedVenues, selectedYears);
      const terms   = query.toLowerCase().split(' ').filter(t => t.length > 2);
      renderResults(results, terms, resultsList, resultsCount);
      
      // Highlight filters that have results
      updateFilterHighlights(results);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Search failed:', err);
      resultsCount.innerHTML = `Search error: ${err.message}`;
    }
  }

  function updateFilterHighlights(results) {
    const activeVenues = new Set();
    const activeYears = new Set();
    
    results.forEach(p => {
      // Paper venue is like "MICCAI 2024"
      const venueLower = p.venue.toLowerCase();
      if (venueLower.includes('miccai')) activeVenues.add('miccai');
      if (venueLower.includes('midl')) activeVenues.add('midl');
      if (venueLower.includes('isbi')) activeVenues.add('isbi');
      
      if (p.year) activeYears.add(p.year.toString());
    });

    // Clear previous highlights
    document.querySelectorAll('#filter-container span').forEach(span => {
      span.classList.remove('bg-[#c8e6c9]', 'px-1.5', 'py-0.5', '-mx-1.5', 'rounded', 'font-black', 'text-black');
    });

    // Apply highlights to conferences
    activeVenues.forEach(v => {
      const cb = document.querySelector(`input[name="conference"][value="${v}"]`);
      if (cb) {
        const span = cb.nextElementSibling;
        span.classList.add('bg-[#c8e6c9]', 'px-1.5', 'py-0.5', '-mx-1.5', 'rounded', 'font-black', 'text-black');
      }
    });

    // Apply highlights to years
    activeYears.forEach(y => {
      const cb = document.querySelector(`input[name="year"][value="${y}"]`);
      if (cb) {
        const span = cb.nextElementSibling;
        span.classList.add('bg-[#c8e6c9]', 'px-1.5', 'py-0.5', '-mx-1.5', 'rounded', 'font-black', 'text-black');
      }
    });
  }

});
