/**
 * Plash Pilates — Modal Component (WCAG 2.1 AA compliant)
 * Focus trapped, Escape key to close, animated transition.
 * @module modal
 */

import { createElement } from '../utils/dom.js';
import { trapFocus, releaseFocus } from '../utils/accessibility.js';

let activeModal = null;

/**
 * Open a modal dialog.
 * @param {Object} options
 * @param {string} options.title - Modal title
 * @param {HTMLElement|string} options.content - Modal body content
 * @param {Array<HTMLElement>} [options.actions] - Action buttons for footer
 * @param {Function} [options.onClose] - Callback when closed
 * @param {string} [options.maxWidth] - Optional custom max-width (e.g. '700px')
 * @returns {Object} { close, overlay, panel }
 */
export function openModal({ title, content, actions = [], onClose, maxWidth }) {
  if (activeModal) {
    activeModal.close();
  }

  const root = document.getElementById('modal-root') || document.body;

  const overlay = createElement('div', {
    className: 'modal-overlay',
    attributes: {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'modal-title-heading'
    }
  });

  const panel = createElement('div', { className: 'modal-panel' });
  if (maxWidth) panel.style.maxWidth = maxWidth;

  // Header
  const header = createElement('div', { className: 'modal-header' });
  const titleHeading = createElement('h3', {
    id: 'modal-title-heading',
    className: 'modal-title',
    text: title
  });

  const closeBtn = createElement('button', {
    className: 'modal-close',
    attributes: { 'aria-label': 'Close dialog', type: 'button' }
  }, [
    createElement('i', { attributes: { 'data-lucide': 'x' } })
  ]);

  header.append(titleHeading, closeBtn);

  // Body
  const body = createElement('div', { className: 'modal-body' });
  if (typeof content === 'string') {
    const p = createElement('p', { text: content });
    body.appendChild(p);
  } else if (content instanceof HTMLElement) {
    body.appendChild(content);
  }

  panel.append(header, body);

  // Footer (optional)
  if (actions && actions.length > 0) {
    const footer = createElement('div', { className: 'modal-footer' });
    actions.forEach(btn => {
      const btnType = btn.getAttribute ? btn.getAttribute('type') : btn.type;
      if (btnType === 'submit') {
        btn.addEventListener('click', (e) => {
          const form = (content instanceof HTMLFormElement)
            ? content
            : (content instanceof HTMLElement ? content.querySelector('form') : null);
          if (form) {
            e.preventDefault();
            if (typeof form.requestSubmit === 'function') {
              form.requestSubmit();
            } else {
              form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
          }
        });
      }
      footer.appendChild(btn);
    });
    panel.appendChild(footer);
  }

  overlay.appendChild(panel);
  root.appendChild(overlay);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: overlay });
  }

  function close() {
    overlay.classList.remove('open');
    releaseFocus();
    document.removeEventListener('keydown', handleKeyDown);
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (typeof onClose === 'function') onClose();
      activeModal = null;
    }, 200);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      close();
    }
  });

  document.addEventListener('keydown', handleKeyDown);

  // Show
  requestAnimationFrame(() => {
    overlay.classList.add('open');
    trapFocus(panel);
  });

  activeModal = { close, overlay, panel };
  return activeModal;
}

/**
 * Close active modal if any.
 */
export function closeModal() {
  if (activeModal) {
    activeModal.close();
  }
}
