/**
 * Plash Pilates — Pass Card Component
 * Displays active pass name, remaining session progress bars per discipline, and expiry.
 * @module pass-card
 */

import { createElement } from '../utils/dom.js';
import { formatDate } from '../utils/format.js';
import * as store from '../core/store.js';

/**
 * Render a pass card for a member.
 * @param {Object} pass - Member pass object
 * @param {Array} credits - Array of credit objects { discipline, included, used, remaining }
 * @returns {HTMLElement}
 */
export function createPassCard(pass, credits = []) {
  const card = createElement('div', { className: 'pass-card' });

  const label = createElement('div', {
    className: 'pass-card-label',
    text: 'Active Membership Pass'
  });

  const name = createElement('div', {
    className: 'pass-card-name',
    text: pass ? pass.packageName : 'No Active Pass'
  });

  card.append(label, name);

  if (credits && credits.length > 0) {
    const creditsContainer = createElement('div', { className: 'pass-card-credits' });

    credits.forEach(item => {
      const row = createElement('div', { className: 'pass-credit-row' });

      const discName = createElement('div', {
        className: 'pass-credit-discipline',
        text: item.discipline ? item.discipline.name : 'Sessions'
      });

      const isZero = item.remaining <= 0;
      const count = createElement('div', {
        className: `pass-credit-count${isZero ? ' pass-credit-empty' : ''}`,
        text: `${item.remaining} ${item.remaining === 1 ? 'Credit' : 'Credits'}`
      });

      row.append(discName, count);
      creditsContainer.appendChild(row);
    });

    card.appendChild(creditsContainer);
  }

  if (pass && pass.expiresAt) {
    const expiry = createElement('div', {
      className: 'pass-card-expiry',
      text: `Valid until ${formatDate(pass.expiresAt)}`
    });
    card.appendChild(expiry);
  }

  return card;
}
