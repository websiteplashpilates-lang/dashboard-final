/**
 * Plash Pilates — Empty State Component
 * Brand-aligned empty states (strictly no emojis, clean iconography and typography).
 * @module empty-state
 */

import { createElement } from '../utils/dom.js';

/**
 * Create an empty state component.
 * @param {Object} options
 * @param {string} [options.icon='calendar-x'] - Lucide icon name
 * @param {string} options.title - Header text
 * @param {string} options.description - Explanatory text
 * @param {HTMLElement} [options.action] - Optional button or link element
 * @returns {HTMLElement}
 */
export function createEmptyState({ icon = 'calendar-x', title, description, action }) {
  const container = createElement('div', {
    className: 'empty-state',
    style: 'text-align: center; padding: var(--space-12) var(--space-6); background: white; border: 1px dashed var(--ink-20); border-radius: var(--radius-sm);'
  });

  const iconEl = createElement('div', {
    style: 'width: 48px; height: 48px; margin: 0 auto var(--space-4); display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--stone); color: var(--moss);'
  }, [
    createElement('i', { attributes: { 'data-lucide': icon } })
  ]);

  const titleEl = createElement('h4', {
    style: 'font-family: var(--font-serif); font-size: var(--text-lg); font-weight: var(--weight-semibold); color: var(--ink); margin-bottom: var(--space-2);',
    text: title
  });

  const descEl = createElement('p', {
    style: 'font-size: var(--text-sm); color: var(--ink-50); max-width: 420px; margin: 0 auto var(--space-6); line-height: 1.6;',
    text: description
  });

  container.append(iconEl, titleEl, descEl);

  if (action) {
    container.appendChild(action);
  }

  return container;
}
