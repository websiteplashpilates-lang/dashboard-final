/**
 * Plash Pilates — 500 Internal Error / System Recovery
 * Resilient error boundary screen with reload and diagnostics.
 * @module pages/error/server-error
 */

import { createElement } from '../../utils/dom.js';

export async function render(container, params = {}) {
  const errorMessage = params.message || 'An unexpected operational error occurred while rendering the studio layout.';

  const page = createElement('div', {
    className: 'page-container',
    style: 'min-height: 75vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: var(--space-8) var(--space-4);'
  });

  const card = createElement('div', {
    className: 'card',
    style: 'max-width: 540px; width: 100%; padding: var(--space-8); border-radius: var(--radius-lg); background: var(--surface); box-shadow: var(--shadow-lg); border: 1px solid var(--stone); display: flex; flex-direction: column; align-items: center;'
  });

  const iconWrap = createElement('div', {
    style: 'width: 72px; height: 72px; border-radius: 50%; background: rgba(147, 75, 45, 0.08); display: flex; align-items: center; justify-content: center; margin-bottom: var(--space-4); color: var(--rust); font-size: 28px;'
  }, [
    createElement('i', { attributes: { 'data-lucide': 'refresh-cw' }, style: 'width: 36px; height: 36px;' })
  ]);

  const codeBadge = createElement('div', {
    className: 'badge badge-neutral',
    style: 'letter-spacing: 0.1em; font-size: 11px; font-weight: var(--weight-bold); text-transform: uppercase; margin-bottom: var(--space-3); color: var(--rust);',
    text: 'STATUS CODE 500 • APPLICATION RECOVERY'
  });

  const title = createElement('h1', {
    style: 'font-family: var(--font-serif); font-size: var(--text-2xl); font-weight: var(--weight-bold); color: var(--ink); margin-bottom: var(--space-3);',
    text: 'Application Encountered An Issue'
  });

  const desc = createElement('p', {
    style: 'color: var(--ink-70); font-size: var(--text-sm); line-height: 1.6; margin-bottom: var(--space-6); max-width: 440px;',
    text: errorMessage
  });

  const actions = createElement('div', {
    style: 'display: flex; gap: var(--space-3); justify-content: center; flex-wrap: wrap; width: 100%;'
  }, [
    createElement('button', {
      className: 'btn btn-primary',
      attributes: { type: 'button' },
      style: 'min-width: 160px; justify-content: center;'
    }, [
      createElement('i', { attributes: { 'data-lucide': 'rotate-ccw' }, style: 'width: 16px; height: 16px; margin-right: 6px;' }),
      createElement('span', { text: 'Reload Application' })
    ]),
    createElement('a', {
      className: 'btn btn-outline',
      attributes: { href: '#/login' },
      style: 'min-width: 140px; justify-content: center;'
    }, [
      createElement('i', { attributes: { 'data-lucide': 'log-in' }, style: 'width: 16px; height: 16px; margin-right: 6px;' }),
      createElement('span', { text: 'Return to Login' })
    ])
  ]);

  actions.firstChild.addEventListener('click', () => {
    window.location.reload();
  });

  card.append(iconWrap, codeBadge, title, desc, actions);
  page.appendChild(card);
  container.appendChild(page);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}
