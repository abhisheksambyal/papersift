/**
 * Animation utilities for smooth DOM transitions.
 * Abstracts away layout thrashing and nested timeouts.
 */

/**
 * Fades out an element and hides it after the transition completes.
 * @param {HTMLElement} element 
 * @param {number} duration - Match with CSS transition duration
 */
export function fadeOutAndHide(element, duration = 400) {
  if (!element) return;
  element.classList.add('opacity-0', 'pointer-events-none');
  
  setTimeout(() => {
    element.classList.add('hidden');
  }, duration);
}

/**
 * Shows an element and smoothly fades it in.
 * Uses double requestAnimationFrame to avoid synchronous layout reflows.
 * @param {HTMLElement} element 
 */
export function showAndFadeIn(element) {
  if (!element) return;
  element.classList.remove('hidden', 'invisible');
  
  // Wait a frame to ensure display:block is calculated before animating opacity
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      element.classList.remove('opacity-0', 'translate-y-4');
      element.classList.add('opacity-100', 'translate-y-0');
    });
  });
}

/**
 * Utility to safely restart a CSS keyframe animation without forcing synchronous layout (void el.offsetHeight).
 * @param {HTMLElement} element 
 * @param {string} animationClass 
 */
export function restartAnimation(element, animationClass) {
  if (!element) return;
  element.classList.remove(animationClass);
  
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      element.classList.add(animationClass);
    });
  });
}
