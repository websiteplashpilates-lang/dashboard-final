/**
 * Plash Pilates — Package Card Component
 * Displays membership pricing, session breakdown, duration, and First Circle discounts.
 * @module package-card
 */

import { createElement } from '../utils/dom.js';
import { formatCurrency } from '../utils/format.js';
import * as store from '../core/store.js';

/**
 * Render a package pricing card.
 * @param {Object} pkg - Package catalog object
 * @param {Object} options
 * @param {Function} [options.onSelect] - Callback when plan is selected
 * @returns {HTMLElement}
 */
export function createPackageCard(pkg, { onSelect } = {}) {
  const effectivePrice = pkg.priceInr;

  const card = createElement('div', {
    className: `package-card ${pkg.isPopular ? 'popular' : ''}`
  });

  if (pkg.isPopular) {
    const popularBadge = createElement('div', {
      className: 'package-card-popular-badge',
      text: 'Most Popular'
    });
    card.appendChild(popularBadge);
  }

  // Discipline or All-Access
  let discName = 'All-Access Signature';
  if (pkg.disciplineId) {
    const disc = store.getDisciplineById(pkg.disciplineId);
    if (disc) discName = disc.name;
  }

  const discEl = createElement('div', {
    className: 'package-card-discipline',
    text: discName
  });

  const nameEl = createElement('h3', {
    className: 'package-card-name',
    text: `${pkg.name} (${pkg.durationMonths} ${pkg.durationMonths === 1 ? 'Month' : 'Months'})`
  });

  // Session allocations
  const sessionsEl = createElement('div', { className: 'package-card-sessions' });
  if (pkg.sessionAllocations && pkg.sessionAllocations.length > 0) {
    pkg.sessionAllocations.forEach(alloc => {
      const disc = store.getDisciplineById(alloc.disciplineId);
      const row = createElement('div', { className: 'package-card-session-item' }, [
        createElement('i', {
          attributes: { 'data-lucide': 'check' },
          style: 'width: 14px; height: 14px; color: var(--moss); flex-shrink: 0;'
        }),
        createElement('span', {
          text: `${alloc.sessionCount} ${disc ? disc.name : 'Sessions'}`
        })
      ]);
      sessionsEl.appendChild(row);
    });
  }

  // Duration
  const durationEl = createElement('div', {
    className: 'package-card-duration',
    text: `Validity: ${pkg.durationMonths * 30} days`
  });

  // Pricing
  const pricingEl = createElement('div', { className: 'package-card-pricing' });
  const priceVal = createElement('span', {
    className: 'package-card-price',
    text: formatCurrency(effectivePrice)
  });
  const gstNote = createElement('span', {
    style: 'display: block; font-size: var(--text-xs); color: var(--ink-50); font-weight: var(--weight-medium); margin-top: 2px;',
    text: '+ 18% GST at checkout'
  });
  pricingEl.append(priceVal, gstNote);

  // Actions
  const actionsEl = createElement('div', { className: 'package-card-actions' });
  const selectBtn = createElement('button', {
    className: `btn ${pkg.isPopular ? 'btn-primary' : 'btn-outline'} btn-block`,
    attributes: { type: 'button' },
    text: 'Choose Plan'
  });

  selectBtn.addEventListener('click', () => {
    if (onSelect) onSelect(pkg);
  });

  actionsEl.appendChild(selectBtn);

  card.append(discEl, nameEl, sessionsEl, durationEl, pricingEl, actionsEl);
  return card;
}
