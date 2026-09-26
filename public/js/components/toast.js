/**
 * Plash Pilates — Toast Notification System
 * Accessible toast notifications with ARIA live announcements.
 * @module toast
 */

import { createElement } from '../utils/dom.js';
import { announce } from '../utils/accessibility.js';
import { events, EVENT } from '../core/events.js';

let toastContainer = null;

function ensureContainer() {
  if (!toastContainer || !document.contains(toastContainer)) {
    toastContainer = document.getElementById('toast-root');
    if (!toastContainer) {
      toastContainer = createElement('div', {
        id: 'toast-root',
        className: 'toast-container',
        attributes: { 'aria-live': 'polite', 'aria-atomic': 'false' }
      });
      document.body.appendChild(toastContainer);
    } else {
      toastContainer.className = 'toast-container';
    }
  }
  return toastContainer;
}

/**
 * Show a toast notification.
 * @param {string} message - Message text
 * @param {'success'|'error'|'info'} [type='info'] - Toast variant
 * @param {number} [duration=4000] - Duration in ms before auto-dismiss
 */
export function showToast(message, type = 'info', duration = 4000) {
  const container = ensureContainer();

  const toast = createElement('div', {
    className: `toast toast-${type}`,
    attributes: { role: 'status' }
  });

  const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info';
  const icon = createElement('i', {
    className: 'toast-icon',
    attributes: { 'data-lucide': iconName }
  });

  const msgSpan = createElement('span', {
    className: 'toast-message',
    text: message
  });

  const closeBtn = createElement('button', {
    className: 'toast-close',
    attributes: { 'aria-label': 'Dismiss notification', type: 'button' }
  }, [
    createElement('i', { attributes: { 'data-lucide': 'x' } })
  ]);

  toast.append(icon, msgSpan, closeBtn);
  container.appendChild(toast);

  // Re-initialize Lucide icons if available
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: toast });
  }

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  // Announce to screen readers
  announce(`${type}: ${message}`);

  let timer = null;
  const dismiss = () => {
    if (timer) clearTimeout(timer);
    toast.classList.remove('visible');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  };

  closeBtn.addEventListener('click', dismiss);

  if (duration > 0) {
    timer = setTimeout(dismiss, duration);
  }
}

// Subscribe to global event bus
events.on(EVENT.TOAST_SHOW, (payload) => {
  if (typeof payload === 'string') {
    showToast(payload);
  } else if (payload && payload.message) {
    showToast(payload.message, payload.type || 'info', payload.duration || 4000);
  }
});
