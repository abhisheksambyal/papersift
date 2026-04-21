/**
 * Render a list of results into the DOM.
 *
 * @param {Array}       results
 * @param {string[]}    terms        - highlighted query terms
 * @param {HTMLElement} resultsList
 * @param {HTMLElement} resultsCount
 */
export function renderResults(results, terms, resultsList, resultsCount) {
  if (!results.length) {
    resultsCount.textContent = 'No papers found matching your query.';
    return;
  }

  resultsCount.innerHTML = `
    <span class="opacity-70">Discovered</span>
    <span class="font-bold">${results.length}</span>
    <span class="opacity-70">pertinent papers</span>`;

  // Pre-compile one combined regex for all highlight terms
  const highlightRe = terms.length
    ? new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
    : null;

  // Build all cards as a single HTML string, insert once
  const html = results.map(paper => {
    const title = highlightRe
      ? (paper.title || 'Untitled').toLowerCase().replace(highlightRe, '<span class="bg-ink text-paper px-0.5 font-bold mx-0.5">$1</span>')
      : (paper.title || 'Untitled').toLowerCase();

    const href = paper.url?.startsWith('http')
      ? paper.url
      : `https://papers.miccai.org${paper.url}`;

    return `<a href="${href}" target="_blank" rel="noopener noreferrer"
      class="group block py-3 sm:py-2.5 px-1 hover:bg-black/[0.03] active:bg-black/[0.05] transition-colors border-b border-ink/5 last:border-0 touch-manipulation">
      <div class="flex items-start justify-between gap-3">
        <div class="flex-grow min-w-0">
          <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 class="font-masthead font-bold leading-snug group-hover:text-ink/80 transition-colors capitalize"
                style="font-size: clamp(0.8rem, 2.5vw, 1rem);">${title}</h3>
            <div class="hidden sm:inline font-serif text-[0.6rem] text-ink/40 uppercase tracking-widest font-bold whitespace-nowrap">
              ${paper.venue} '${paper.year.slice(-2)}
            </div>
          </div>
          <div class="font-serif text-ink/40 italic mt-0.5 leading-relaxed"
               style="font-size: clamp(0.6rem, 1.8vw, 0.7rem);">${paper.authors || 'Unknown Authors'}</div>
        </div>
        <span class="flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity font-serif text-[0.6rem] font-bold uppercase tracking-[0.2em] text-ink/60">&rarr;</span>
      </div>
    </a>`;
  }).join('');

  resultsList.innerHTML = html;
}
