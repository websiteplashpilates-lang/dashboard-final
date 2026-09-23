/**
 * Plash Pilates — Stat Card Component
 * Dashboard KPI card displaying label, formatted value, and supporting detail.
 * @module stat-card
 */

import { createElement } from '../utils/dom.js';

/**
 * Render a stat card.
 * @param {Object} options
 * @param {string} [options.label] - Stat label (e.g. "Active Members")
 * @param {string} [options.title] - Alternative label alias
 * @param {string|number} options.value - Main value (e.g. "42" or "₹1,48,000")
 * @param {string} [options.detail] - Subtitle or trend info (e.g. "+12% this month")
 * @param {string} [options.icon] - Lucide icon name
 * @param {string} [options.color] - Custom icon color
 * @returns {HTMLElement}
 */
export function createStatCard({ label, title, value, detail, icon, color }) {
  const card = createElement('div', { className: 'stat-card' });

  const textLabel = label || title || '';

  const headerRow = createElement('div', {
    style: 'display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-2); margin-bottom: var(--space-2);'
  });

  const labelEl = createElement('div', {
    className: 'stat-card-label',
    text: textLabel,
    style: 'margin-bottom: 0;'
  });
  headerRow.appendChild(labelEl);

  if (icon) {
    const iconWrap = createElement('div', {
      style: `color: ${color || 'var(--olive)'}; display: flex; align-items: center; justify-content: center; opacity: 0.85; flex-shrink: 0;`
    });
    iconWrap.innerHTML = `<i data-lucide="${icon}" style="width: 18px; height: 18px;"></i>`;
    headerRow.appendChild(iconWrap);
  }

  const valueEl = createElement('div', {
    className: 'stat-card-value',
    text: String(value !== undefined && value !== null ? value : '0')
  });

  card.append(headerRow, valueEl);

  if (detail) {
    const detailEl = createElement('div', {
      className: 'stat-card-detail',
      text: detail
    });
    card.appendChild(detailEl);
  }

  return card;
}
