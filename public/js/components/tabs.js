/**
 * Plash Pilates — Tabs Component (ARIA accessible)
 * Tab navigation with tabpanel toggling.
 * @module tabs
 */

import { createElement } from '../utils/dom.js';

/**
 * @typedef {Object} TabItem
 * @property {string} id - Tab identifier
 * @property {string} label - Tab display label
 * @property {HTMLElement|Function} content - Tab panel content or content creator
 * @property {boolean} [active=false] - Whether initially active
 */

/**
 * Create a tab navigation component.
 * @param {Array<TabItem>} tabs - List of tabs
 * @param {Object} [options]
 * @param {Function} [options.onTabChange] - Callback on tab select
 * @returns {HTMLElement} Container with tab bar and panels
 */
export function createTabs(tabs, { onTabChange } = {}) {
  const container = createElement('div', { className: 'tabs-container' });
  const tabBar = createElement('div', {
    className: 'tab-bar',
    attributes: { role: 'tablist' }
  });

  const panelsContainer = createElement('div', { className: 'tab-panels' });

  const tabButtons = [];
  const panelElements = [];

  tabs.forEach((tab, index) => {
    const isActive = tab.active || index === 0;

    const btn = createElement('button', {
      className: `tab-item ${isActive ? 'active' : ''}`,
      attributes: {
        role: 'tab',
        'aria-selected': isActive ? 'true' : 'false',
        'aria-controls': `tabpanel-${tab.id}`,
        id: `tab-${tab.id}`,
        type: 'button'
      },
      text: tab.label
    });

    const panel = createElement('div', {
      className: `tab-panel ${isActive ? 'active' : ''}`,
      attributes: {
        role: 'tabpanel',
        id: `tabpanel-${tab.id}`,
        'aria-labelledby': `tab-${tab.id}`
      }
    });

    const content = typeof tab.content === 'function' ? tab.content() : tab.content;
    if (content instanceof HTMLElement) {
      panel.appendChild(content);
    } else if (typeof content === 'string') {
      panel.textContent = content;
    }

    btn.addEventListener('click', () => {
      tabButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      panelElements.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      panel.classList.add('active');

      if (onTabChange) onTabChange(tab.id);
    });

    tabButtons.push(btn);
    panelElements.push(panel);
    tabBar.appendChild(btn);
    panelsContainer.appendChild(panel);
  });

  container.append(tabBar, panelsContainer);
  return container;
}
