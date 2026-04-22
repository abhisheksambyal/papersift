/**
 * Logic for the rotating purpose questions on the landing page.
 */

const QUESTIONS = [
  "Which papers use the ISIC 2019 dataset?",
  "Where can I find Few-Shot Learning papers?",
  "Which conferences include BRATS dataset papers?",
  "Tired of checking every conference manually?",
  "Stop scouring 40+ conference sites manually.<br>Find the papers you need — faster."
];

let intervalId = null;

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Start the rotating purpose questions.
 * @param {HTMLElement} el - The element to populate with questions.
 */
export function startPurposeLoop(el) {
  if (!el) return;

  // Create a copy and shuffle
  const pool = [...QUESTIONS];
  shuffle(pool);

  let idx = 0;

  const cycle = () => {
    // Phase 1: Fade out and slide up
    el.classList.add('opacity-0', '-translate-y-4');

    setTimeout(() => {
      // Phase 2: Change text while hidden and reset to bottom position instantly
      el.innerHTML = pool[idx];
      el.classList.remove('-translate-y-4');
      el.classList.add('translate-y-4');

      // Force reflow
      void el.offsetHeight;

      // Phase 3: Fade in and slide to center
      el.classList.remove('opacity-0', 'translate-y-4');
      idx = (idx + 1) % pool.length;
    }, 700);
  };

  cycle();
  intervalId = setInterval(cycle, 5000);
}

/**
 * Stop the loop if needed (e.g. on unmount or navigation).
 */
export function stopPurposeLoop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
