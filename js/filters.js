/**
 * Logic for initializing and updating search filters.
 */
import { fetchResults } from './search.js';
import { renderResults } from './renderer_v2.js';

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
 * @param {Array} results
 */
export function updateFilterHighlights(results) {
  const activeVenues = new Set();
  const activeYears = new Set();
  
  results.forEach(p => {
    const venueLower = p.venue ? p.venue.toLowerCase() : '';
    ['miccai', 'midl', 'isbi', 'neurips'].forEach(v => { if (venueLower.includes(v)) activeVenues.add(v); });
    if (p.year) activeYears.add(p.year.toString());
  });

  // Clear previous
  document.querySelectorAll('#filter-container span').forEach(span => {
    span.classList.remove('bg-[#c8e6c9]', 'dark:bg-[#1b5e20]', 'px-1.5', 'py-0.5', '-mx-1.5', 'rounded', 'font-black', 'text-black', 'dark:text-white');
  });

  // Highlight Venues
  activeVenues.forEach(v => {
    const cb = document.querySelector(`input[name="conference"][value="${v}"]`);
    if (cb) cb.nextElementSibling.classList.add('bg-[#c8e6c9]', 'dark:bg-[#1b5e20]', 'px-1.5', 'py-0.5', '-mx-1.5', 'rounded', 'font-black', 'text-black', 'dark:text-white');
  });

  // Highlight Years
  activeYears.forEach(y => {
    const cb = document.querySelector(`input[name="year"][value="${y}"]`);
    if (cb) cb.nextElementSibling.classList.add('bg-[#c8e6c9]', 'dark:bg-[#1b5e20]', 'px-1.5', 'py-0.5', '-mx-1.5', 'rounded', 'font-black', 'text-black', 'dark:text-white');
  });
}
