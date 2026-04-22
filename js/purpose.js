/**
 * Logic for the rotating purpose questions on the landing page.
 */

const QUESTIONS = [
  "Not able to find how many papers are on Few-Shot learning?",
  "Not able to find how many papers are on Calibration?",
  "Not able to find how many papers use Brats dataset?",
  "Seeking where the ISIC 2019 dataset was applied?",
  "Stop scouring 40+ conference sites manually."
];

let intervalId = null;

/**
 * Start the rotating purpose questions.
 * @param {HTMLElement} el - The element to populate with questions.
 */
export function startPurposeLoop(el) {
  if (!el) return;
  
  let idx = 0;
  
  const cycle = () => {
    // Phase 1: Fade out and slide up
    el.classList.add('opacity-0', '-translate-y-4');
    
    setTimeout(() => {
      // Phase 2: Change text while hidden and reset to bottom position instantly
      el.textContent = QUESTIONS[idx];
      el.classList.remove('-translate-y-4');
      el.classList.add('translate-y-4');
      
      // Force reflow
      void el.offsetHeight; 
      
      // Phase 3: Fade in and slide to center
      el.classList.remove('opacity-0', 'translate-y-4');
      idx = (idx + 1) % QUESTIONS.length;
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
