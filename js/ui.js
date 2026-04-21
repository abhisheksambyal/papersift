import { getRecent, DEFAULTS } from './history.js';

/** Re-render the example/recent-search pills. */
export function renderPills(examplePills) {
  const terms = getRecent().length ? getRecent() : DEFAULTS;
  examplePills.innerHTML = terms
    .map(t => `<span class="pill-example bg-ink/[0.03] border border-ink/10 px-3 py-2 rounded-full cursor-pointer hover:bg-ink hover:text-paper active:bg-ink active:text-paper transition-all touch-manipulation no-tap">${t}</span>`)
    .join('');
}

/**
 * Collapse the header into compact search mode and reveal the results section.
 * @param {{ headerSection, logoTitle, subtitle, examplePills, resultsSection }} refs
 */
export function transitionToResults({ headerSection, logoTitle, subtitle, examplePills, resultsSection }) {
  headerSection.classList.replace('min-h-[70vh]', 'min-h-0');
  headerSection.classList.add('pb-4', 'pt-2');
  // Toggle title size classes
  logoTitle.classList.remove('title-landing');
  logoTitle.classList.add('title-compact');
  subtitle.classList.add('hidden');
  examplePills.classList.add('hidden');

  setTimeout(() => {
    resultsSection.classList.remove('opacity-0', 'translate-y-8', 'invisible');
    resultsSection.classList.add('opacity-100', 'translate-y-0', 'visible');
  }, 300);
}

/**
 * Restore the landing page layout.
 * @param {{ headerSection, logoTitle, subtitle, examplePills, resultsSection, input, resultsList, resultsCount }} refs
 * @param {Function} onReset - callback to reset parent state (e.g. hasSearched)
 */
export function resetToHome(refs, onReset) {
  const { headerSection, logoTitle, subtitle, examplePills, resultsSection, input, resultsList, resultsCount } = refs;

  // Hide results first
  resultsSection.classList.add('opacity-0', 'translate-y-8', 'invisible');
  resultsSection.classList.remove('opacity-100', 'translate-y-0', 'visible');

  // Reset header layout after a brief delay to allow results to fade out
  setTimeout(() => {
    headerSection.classList.replace('min-h-0', 'min-h-[70vh]');
    headerSection.classList.remove('pb-4', 'pt-2');

    // Toggle back to landing title size
    logoTitle.classList.remove('title-compact');
    logoTitle.classList.add('title-landing');

    subtitle.classList.remove('hidden');
    examplePills.classList.remove('hidden');
    renderPills(examplePills);
  }, 300);

  input.value = '';
  resultsList.innerHTML = '';
  resultsCount.innerHTML = '';

  onReset();
}
