/**
 * Plash Pilates — Badge Component
 * Status indicators with semantic styling and dot indicators.
 * @module badge
 */

import { createElement } from '../utils/dom.js';

/**
 * Render a badge element.
 * @param {Object} options
 * @param {string} options.text - Display text
 * @param {string} [options.status='active'] - Status variant (active, pending, expired, paused, cancelled, completed, no-show, full, upcoming, master, lead, standard)
 * @param {boolean} [options.showDot=false] - Whether to show colored dot
 * @returns {HTMLElement}
 */
export function createBadge({ text, label, status, variant = 'active', showDot = false }) {
  const badgeText = text !== undefined ? text : (label !== undefined ? label : '');
  const badgeStatus = status || variant || 'active';
  const badge = createElement('span', {
    className: `badge badge-${badgeStatus}`
  });

  if (showDot) {
    badge.appendChild(createElement('span', { className: 'badge-dot' }));
  }

  badge.appendChild(document.createTextNode(badgeText));
  return badge;
}
