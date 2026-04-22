/**
 * Logic for the rotating purpose questions on the landing page.
 */

const QUESTIONS = [
  "Which papers use the ISIC 2019 dataset?",
  "Where can I find Few-Shot Learning papers?",
  "Which conferences include BRATS dataset papers?",
  "Tired of checking every conference manually?",
  "Stop scouring 40+ conference sites manually.<br>Enter the keywords and Find the papers you need — faster."
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

  const discoveryQuestions = QUESTIONS.slice(0, -1);
  const finaleQuestion = QUESTIONS[QUESTIONS.length - 1];

  shuffle(discoveryQuestions);
  // The pool is just the discovery questions for the first cycle
  const pool = [...discoveryQuestions];
  let idx = 0;

  el.classList.add('opacity-0', 'translate-y-4');

  const showFirst = () => {
    el.innerHTML = pool[idx];
    void el.offsetHeight;
    el.classList.remove('opacity-0', 'translate-y-4');
    idx++;
  };

  const cycle = () => {
    el.classList.add('opacity-0', '-translate-y-4');

    setTimeout(() => {
      if (idx < pool.length) {
        // Show next individual question
        el.innerHTML = pool[idx];
        el.classList.remove('-translate-y-4');
        el.classList.add('translate-y-4');
        void el.offsetHeight;
        el.classList.remove('opacity-0', 'translate-y-4');
        idx++;
      } else {
        // FINALE: Show 3 random questions + Solution, then STOP
        const random3 = [...discoveryQuestions].sort(() => 0.5 - Math.random()).slice(0, 3);
        const summary = random3.map(q => q.replace('?', '')).join(', ') + '?';

        el.innerHTML = `<span class="block mb-2 opacity-60">${summary}</span> ${finaleQuestion}`;
        el.classList.remove('-translate-y-4');
        el.classList.add('translate-y-4');
        void el.offsetHeight;
        el.classList.remove('opacity-0', 'translate-y-4');

        // Stop the animation
        clearInterval(intervalId);
        intervalId = null;
      }
    }, 700);
  };

  showFirst();
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
