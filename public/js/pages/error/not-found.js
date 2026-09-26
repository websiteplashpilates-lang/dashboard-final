/**
 * Plash Pilates — 404 Page Not Found
 * Luxury bespoke status page for unknown routes.
 * @module pages/error/not-found
 */

import { createElement } from '../../utils/dom.js';
import * as auth from '../../core/auth.js';

export async function render(container) {
  const isAuth = auth.isAuthenticated();
  const defaultRoute = auth.getDefaultRoute();

  const page = createElement('div', {
    className: 'page-container',
    style: 'min-height: 75vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: var(--space-8) var(--space-4);'
  });

  const card = createElement('div', {
    className: 'card',
    style: 'max-width: 540px; width: 100%; padding: var(--space-8); border-radius: var(--radius-lg); background: var(--surface); box-shadow: var(--shadow-lg); border: 1px solid var(--stone); display: flex; flex-direction: column; align-items: center;'
  });

  // Studio Brand Monogram & Logo
  const logo = createElement('div', {
    style: 'margin-bottom: var(--space-5); text-align: center;'
  });
  logo.innerHTML = '<img src="assets/images/plash-logo-horizontal.png" alt="Plash Pilates" style="height: 36px; width: auto; max-width: 200px; object-fit: contain; display: block; margin: 0 auto;" />';

  const iconWrap = createElement('div', {
    style: 'width: 64px; height: 64px; border-radius: 50%; background: rgba(147, 75, 45, 0.08); display: flex; align-items: center; justify-content: center; margin-bottom: var(--space-3); color: var(--rust); font-size: 26px;'
  }, [
    createElement('i', { attributes: { 'data-lucide': 'compass' }, style: 'width: 32px; height: 32px;' })
  ]);

  const codeBadge = createElement('div', {
    className: 'badge badge-neutral',
    style: 'letter-spacing: 0.1em; font-size: 11px; font-weight: var(--weight-bold); text-transform: uppercase; margin-bottom: var(--space-3); color: var(--taupe);',
    text: 'STATUS CODE 404 • ROUTE UNRESOLVED'
  });

  const title = createElement('h1', {
    style: 'font-family: var(--font-serif); font-size: var(--text-2xl); font-weight: var(--weight-bold); color: var(--ink); margin-bottom: var(--space-3);',
    text: 'Studio Room Not Found'
  });

  const desc = createElement('p', {
    style: 'color: var(--ink-70); font-size: var(--text-sm); line-height: 1.6; margin-bottom: var(--space-6); max-width: 420px;',
    text: 'The page or studio resource you are attempting to access does not exist, has moved, or was mistyped. Allow our concierge to redirect you.'
  });

  const actions = createElement('div', {
    style: 'display: flex; gap: var(--space-3); justify-content: center; flex-wrap: wrap; width: 100%;'
  }, [
    createElement('a', {
      className: 'btn btn-primary',
      attributes: { href: defaultRoute },
      style: 'min-width: 160px; justify-content: center;'
    }, [
      createElement('i', { attributes: { 'data-lucide': 'home' }, style: 'width: 16px; height: 16px; margin-right: 6px;' }),
      createElement('span', { text: isAuth ? 'Go to Dashboard' : 'Return to Home' })
    ]),
    createElement('a', {
      className: 'btn btn-outline',
      attributes: { href: isAuth ? '#/portal/packages' : '#/login' },
      style: 'min-width: 160px; justify-content: center;'
    }, [
      createElement('i', { attributes: { 'data-lucide': isAuth ? 'layers' : 'log-in' }, style: 'width: 16px; height: 16px; margin-right: 6px;' }),
      createElement('span', { text: isAuth ? 'View Packages' : 'Member Login' })
    ])
  ]);

  card.append(logo, iconWrap, codeBadge, title, desc, actions);
  page.appendChild(card);
  container.appendChild(page);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}
