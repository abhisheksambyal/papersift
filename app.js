document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('search-form');
  const input = document.getElementById('search-input');
  const headerSection = document.getElementById('header-section');
  const logoContainer = document.getElementById('logo-container');
  const editionLine = document.getElementById('edition-line');
  const subtitle = document.getElementById('subtitle');
  const resultsSection = document.getElementById('results-section');
  const resultsList = document.getElementById('results-list');
  const resultsCount = document.getElementById('results-count');

  // Set the current date for the edition line
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', dateOptions);

  let hasSearched = false;

  let debounceTimer;
  
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
      // Trigger smooth compact layout transition
      headerSection.classList.replace('min-h-[70vh]', 'min-h-[10vh]');
      headerSection.classList.add('pb-4', 'pt-2');
      
      const subtitleWrapper = document.getElementById('subtitle-wrapper');
      subtitleWrapper.classList.replace('max-h-20', 'max-h-0');
      subtitleWrapper.classList.replace('opacity-100', 'opacity-0');
      
      logoContainer.querySelector('h1').style.fontSize = 'clamp(1.2rem, 3vw, 1.8rem)';
      logoContainer.classList.remove('mb-8');
      logoContainer.classList.add('mb-2');
      
      // Delay results fade-in slightly for a phased feel
      setTimeout(() => {
        resultsSection.classList.remove('opacity-0', 'translate-y-8', 'invisible');
        resultsSection.classList.add('opacity-100', 'translate-y-0', 'visible');
      }, 300);
      
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
    initiateSearch();
  });

  async function performSearch(query) {
    resultsList.innerHTML = '';
    resultsCount.innerHTML = `<span class="italic opacity-60">Scanning the archives...</span>`;
    
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("Telegraph communication failed");
      
      const results = await response.json();
      renderResults(results, query.toLowerCase().split(' ').filter(t => t.length > 2));
    } catch (err) {
      resultsCount.innerHTML = `Error dispatching queries: ${err.message}`;
    }
  }

  function renderResults(results, searchTerms) {
    if (results.length === 0) {
      resultsCount.textContent = "No chronicles found matching your inquiry.";
      return;
    }

    resultsCount.innerHTML = `<span class="opacity-70">Discovered</span> <span class="font-bold">${results.length}</span> <span class="opacity-70">pertinent chronicles</span>`;

    results.forEach((paper, index) => {
      // Highlight logic for titles only
      let hiTitle = paper.title;
      
      searchTerms.forEach(term => {
        const regex = new RegExp(`(${term})`, 'gi');
        const highlightSpan = '<span class="bg-ink text-paper px-0.5 font-bold mx-0.5">$1</span>';
        hiTitle = hiTitle.replace(regex, highlightSpan);
      });

      const card = document.createElement('a');
      card.href = paper.url.startsWith('http') ? paper.url : `https://papers.miccai.org${paper.url}`;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      
      // Compact list design (py-2.5) with authors
      card.className = "group block py-2.5 px-1 hover:bg-black/[0.03] transition-colors cursor-pointer border-b border-ink/5 last:border-0";
      
      card.innerHTML = `
        <div class="flex items-center justify-between gap-4">
          <div class="flex-grow overflow-hidden">
            <div class="flex items-baseline gap-3">
              <h3 class="font-masthead font-bold text-base leading-tight group-hover:text-ink/80 transition-colors whitespace-nowrap overflow-hidden text-overflow-ellipsis capitalize">${hiTitle.toLowerCase()}</h3>
              <div class="font-serif text-[0.6rem] text-ink/40 uppercase tracking-widest font-bold whitespace-nowrap">
                <span class="mr-1">${paper.venue}</span>
                <span>'${paper.year.slice(-2)}</span> 
              </div>
            </div>
            <div class="font-serif text-[0.7rem] text-ink/40 italic font-medium truncate mt-0.5">
              ${paper.authors}
            </div>
          </div>
          <div class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
             <span class="font-serif text-[0.6rem] font-bold uppercase tracking-[0.2em] text-ink/60">
                &rarr;
             </span>
          </div>
        </div>
      `;

      resultsList.appendChild(card);
    });
  }
});
