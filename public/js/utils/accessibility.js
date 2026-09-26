/**
 * Plash Pilates — Accessibility Utilities (WCAG 2.1 AA / ISO 9241)
 * Focus trap, screen reader announcer, focus management.
 * @module accessibility
 */

let activeTrap = null;
let previousFocusedElement = null;

/**
 * Announce a message to screen readers via ARIA live region.
 * @param {string} message
 * @param {'polite'|'assertive'} [politeness='polite']
 */
export function announce(message, politeness = 'polite') {
  let announcer = document.getElementById('aria-announcer');
  if (!announcer) {
    announcer = document.createElement('div');
    announcer.id = 'aria-announcer';
    announcer.className = 'sr-only';
    announcer.setAttribute('aria-atomic', 'true');
    document.body.appendChild(announcer);
  }
  announcer.setAttribute('aria-live', politeness);
  announcer.textContent = '';
  // Short delay to ensure assistive technology perceives text change
  setTimeout(() => {
    announcer.textContent = message;
  }, 50);
}

/**
 * Trap focus within an element (e.g., modal).
 * @param {HTMLElement} container
 */
export function trapFocus(container) {
  previousFocusedElement = document.activeElement;

  const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  
  function handleKeyDown(e) {
    if (e.key !== 'Tab') return;

    const focusables = Array.from(container.querySelectorAll(focusableSelector))
      .filter(el => !el.disabled && el.offsetParent !== null);
    
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        last.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  }

  container.addEventListener('keydown', handleKeyDown);
  activeTrap = { container, handleKeyDown };

  // Focus the first focusable element
  const focusables = Array.from(container.querySelectorAll(focusableSelector))
    .filter(el => !el.disabled && el.offsetParent !== null);
  if (focusables.length > 0) {
    focusables[0].focus();
  } else {
    container.setAttribute('tabindex', '-1');
    container.focus();
  }
}

/**
 * Release the active focus trap.
 */
export function releaseFocus() {
  if (activeTrap) {
    activeTrap.container.removeEventListener('keydown', activeTrap.handleKeyDown);
    activeTrap = null;
  }
  if (previousFocusedElement && typeof previousFocusedElement.focus === 'function') {
    previousFocusedElement.focus();
    previousFocusedElement = null;
  }
}

/**
 * Set up skip navigation to main content.
 */
export function setupSkipNav() {
  const skipLink = document.querySelector('.skip-nav');
  const mainContent = document.getElementById('main-content');
  if (skipLink && mainContent) {
    skipLink.addEventListener('click', (e) => {
      e.preventDefault();
      mainContent.setAttribute('tabindex', '-1');
      mainContent.focus();
      mainContent.scrollIntoView({ behavior: 'smooth' });
    });
  }
}
