/**
 * Plash Pilates — Skeleton Loader Component
 * Accessible loading placeholder with shimmer effect.
 * @module skeleton
 */

import { createElement } from '../utils/dom.js';

/**
 * Create a skeleton placeholder element.
 * @param {'text'|'text-sm'|'text-lg'|'heading'|'card'|'stat'|'avatar'|'table-row'|'bar'} [type='text']
 * @param {string} [width] - CSS width optional
 * @returns {HTMLElement}
 */
export function createSkeleton(type = 'text', width) {
  const el = createElement('div', {
    className: `skeleton skeleton-${type}`,
    attributes: { 'aria-hidden': 'true' }
  });
  if (width) el.style.width = width;
  return el;
}

/**
 * Create a skeleton card block.
 * @returns {HTMLElement}
 */
export function createSkeletonCard() {
  const card = createElement('div', { className: 'card skeleton-card' });
  card.appendChild(createSkeleton('heading', '60%'));
  card.appendChild(createSkeleton('text', '90%'));
  card.appendChild(createSkeleton('text-sm', '40%'));
  return card;
}
