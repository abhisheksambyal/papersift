import { getRecent, DEFAULTS } from './history.js';

/** Re-render the example/recent-search pills. */
export function renderPills(examplePills) {
  const terms = getRecent().length ? getRecent() : DEFAULTS;
  examplePills.innerHTML = terms
    .map(t => `<span class="pill-example bg-ink/[0.03] dark:bg-paper/[0.03] border border-ink/10 dark:border-paper/10 px-3 py-2 rounded-full cursor-pointer hover:bg-ink hover:text-paper dark:hover:bg-paper dark:hover:text-ink active:bg-ink active:text-paper dark:active:bg-paper dark:active:text-ink transition-all touch-manipulation no-tap">${t}</span>`)
    .join('');
}

/**
 * Collapse the header into compact search mode and reveal the results section.
 * @param {{ headerSection, logoTitle, subtitle, examplePills, resultsSection }} refs
 */
export function transitionToResults(refs) {
  const { headerSection, logoTitle, subtitle, examplePills, purposeSection, resultsSection, searchHints, appContainer } = refs;
  requestAnimationFrame(() => {
    appContainer.classList.remove('justify-center');
    headerSection.classList.add('pb-4', 'pt-2');
    
    // Toggle title size classes
    logoTitle.classList.remove('title-landing');
    logoTitle.classList.add('title-compact');
    
    // Instead of hiding immediately, fade out if needed (subtitle already has transition)
    subtitle.classList.add('opacity-0', 'pointer-events-none');
    examplePills.classList.add('opacity-0', 'pointer-events-none');
    purposeSection.classList.add('opacity-0', 'pointer-events-none');
    
    // Hide them from layout after fade
    setTimeout(() => {
      subtitle.classList.add('hidden');
      examplePills.classList.add('hidden');
      purposeSection.classList.add('hidden');
    }, 500);

    setTimeout(() => {
      resultsSection.classList.remove('hidden', 'invisible');
      resultsSection.classList.add('opacity-100', 'translate-y-0');
      resultsSection.classList.remove('opacity-0', 'translate-y-4');
    }, 200);
  });
}

/**
 * Restore the landing page layout.
 * @param {{ headerSection, logoTitle, subtitle, examplePills, purposeSection, resultsSection, input, resultsList, resultsCount }} refs
 * @param {Function} onReset - callback to reset parent state (e.g. hasSearched)
 */
export function resetToHome(refs, onReset) {
  const { headerSection, logoTitle, subtitle, examplePills, purposeSection, resultsSection, input, resultsList, resultsCount, conferenceFilters, yearFilters, searchHints, appContainer } = refs;

  requestAnimationFrame(() => {
    // Hide results first
    resultsSection.classList.add('opacity-0', 'translate-y-4');
    resultsSection.classList.remove('opacity-100', 'translate-y-0');

    setTimeout(() => {
      resultsSection.classList.add('invisible', 'hidden');
      
      appContainer.classList.add('justify-center');
      headerSection.classList.remove('pb-4', 'pt-2');

      logoTitle.classList.remove('title-compact');
      logoTitle.classList.add('title-landing');

      subtitle.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
      examplePills.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
      purposeSection.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
      if (searchHints) searchHints.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
      
      renderPills(examplePills);
    }, 400);

    input.value = '';
    // Clear all checkboxes and re-check "All" ones
    document.querySelectorAll('input[type="checkbox"]:not([name$="-all"])').forEach(cb => cb.checked = false);
    document.querySelectorAll('input[name$="-all"]').forEach(cb => cb.checked = true);
    
    resultsList.innerHTML = '';
    resultsCount.innerHTML = '';

    onReset();
  });
}
