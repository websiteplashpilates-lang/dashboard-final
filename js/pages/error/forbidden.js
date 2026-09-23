/**
 * Plash Pilates — 403 Forbidden / Access Denied
 * Displays clear role authorization boundary and guidance.
 * @module pages/error/forbidden
 */

import { createElement } from '../../utils/dom.js';
import * as auth from '../../core/auth.js';

export async function render(container) {
  const currentRole = auth.getCurrentRole();
  const defaultRoute = auth.getDefaultRoute();

  const roleLabels = {
    member: 'Studio Member',
    trainer: 'Studio Trainer',
    partner: 'Physicq 57 Partner Coach',
    admin: 'Studio Administrator'
  };

  const page = createElement('div', {
    className: 'page-container',
    style: 'min-height: 75vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: var(--space-8) var(--space-4);'
  });

  const card = createElement('div', {
    className: 'card',
    style: 'max-width: 540px; width: 100%; padding: var(--space-8); border-radius: var(--radius-lg); background: var(--surface); box-shadow: var(--shadow-lg); border: 1px solid var(--stone); display: flex; flex-direction: column; align-items: center;'
  });

  const iconWrap = createElement('div', {
    style: 'width: 72px; height: 72px; border-radius: 50%; background: rgba(193, 75, 59, 0.08); display: flex; align-items: center; justify-content: center; margin-bottom: var(--space-4); color: var(--rose); font-size: 28px;'
  }, [
    createElement('i', { attributes: { 'data-lucide': 'shield-alert' }, style: 'width: 36px; height: 36px;' })
  ]);

  const codeBadge = createElement('div', {
    className: 'badge badge-rose',
    style: 'letter-spacing: 0.1em; font-size: 11px; font-weight: var(--weight-bold); text-transform: uppercase; margin-bottom: var(--space-3);',
    text: 'STATUS CODE 403 • ACCESS RESTRICTED'
  });

  const title = createElement('h1', {
    style: 'font-family: var(--font-serif); font-size: var(--text-2xl); font-weight: var(--weight-bold); color: var(--ink); margin-bottom: var(--space-3);',
    text: 'Restricted Studio Area'
  });

  const desc = createElement('p', {
    style: 'color: var(--ink-70); font-size: var(--text-sm); line-height: 1.6; margin-bottom: var(--space-4); max-width: 420px;',
    text: `Your active profile is authenticated as "${roleLabels[currentRole] || currentRole}". You do not have security clearance for this management module.`
  });

  const infoBox = createElement('div', {
    style: 'background: var(--stone); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-4); font-size: 12px; color: var(--ink-70); margin-bottom: var(--space-6); display: flex; align-items: center; gap: 8px;'
  }, [
    createElement('i', { attributes: { 'data-lucide': 'info' }, style: 'width: 16px; height: 16px; color: var(--taupe); flex-shrink: 0;' }),
    createElement('span', { text: 'To request administrative elevated privileges, contact studio.admin@plashpilates.com.' })
  ]);

  const actions = createElement('div', {
    style: 'display: flex; gap: var(--space-3); justify-content: center; flex-wrap: wrap; width: 100%;'
  }, [
    createElement('a', {
      className: 'btn btn-primary',
      attributes: { href: defaultRoute },
      style: 'min-width: 160px; justify-content: center;'
    }, [
      createElement('i', { attributes: { 'data-lucide': 'arrow-left' }, style: 'width: 16px; height: 16px; margin-right: 6px;' }),
      createElement('span', { text: 'Back to Authorized Area' })
    ]),
    createElement('button', {
      className: 'btn btn-outline',
      attributes: { type: 'button' },
      style: 'min-width: 140px; justify-content: center;'
    }, [
      createElement('i', { attributes: { 'data-lucide': 'log-out' }, style: 'width: 16px; height: 16px; margin-right: 6px;' }),
      createElement('span', { text: 'Switch Account' })
    ])
  ]);

  actions.lastChild.addEventListener('click', () => {
    auth.logout();
  });

  card.append(iconWrap, codeBadge, title, desc, infoBox, actions);
  page.appendChild(card);
  container.appendChild(page);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}
