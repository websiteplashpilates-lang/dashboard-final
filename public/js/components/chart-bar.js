/**
 * Plash Pilates — CSS Bar Chart Component
 * Lightweight, semantic, accessible horizontal bar chart for metrics & utilization.
 * @module chart-bar
 */

import { createElement } from '../utils/dom.js';

/**
 * @typedef {Object} ChartBarItem
 * @property {string} label - Bar label (e.g. "Reformer Pilates")
 * @property {number} value - Numeric value
 * @property {string} [displayValue] - Formatted value text (e.g. "82%")
 * @property {string} [color] - Optional bar color (defaults to var(--rust))
 */

/**
 * Render a horizontal bar chart.
 * @param {Object} options
 * @param {string} [options.title] - Chart section title
 * @param {Array<ChartBarItem>} options.items - Data points
 * @param {number} [options.maxValue] - Maximum scale value (defaults to max of items)
 * @returns {HTMLElement}
 */
export function createChartBar({ title, items = [], maxValue }) {
  const container = createElement('div', {
    className: 'chart-bar-widget',
    style: 'background: white; border: 1px solid var(--ink-10); border-radius: var(--radius-sm); padding: var(--space-5);'
  });

  if (title) {
    const titleEl = createElement('h4', {
      style: 'font-family: var(--font-serif); font-size: var(--text-base); font-weight: var(--weight-semibold); color: var(--ink); margin-bottom: var(--space-4);',
      text: title
    });
    container.appendChild(titleEl);
  }

  const max = maxValue || Math.max(...items.map(i => i.value), 1);
  const list = createElement('div', {
    style: 'display: flex; flex-direction: column; gap: var(--space-3);'
  });

  items.forEach(item => {
    const row = createElement('div', {
      style: 'display: flex; flex-direction: column; gap: var(--space-1);'
    });

    const header = createElement('div', {
      style: 'display: flex; justify-content: space-between; font-size: var(--text-xs); font-weight: var(--weight-medium); color: var(--ink);'
    });

    const label = createElement('span', { text: item.label });
    const valText = createElement('span', {
      style: 'color: var(--ink-50);',
      text: item.displayValue || String(item.value)
    });

    header.append(label, valText);

    const track = createElement('div', {
      style: 'height: 8px; background: var(--stone); border-radius: 4px; overflow: hidden;'
    });

    const pct = Math.min(100, Math.round((item.value / max) * 100));
    const fill = createElement('div', {
      style: `height: 100%; width: ${pct}%; background: ${item.color || 'var(--rust)'}; border-radius: 4px; transition: width var(--t-slow);`
    });

    track.appendChild(fill);
    row.append(header, track);
    list.appendChild(row);
  });

  container.appendChild(list);
  return container;
}
