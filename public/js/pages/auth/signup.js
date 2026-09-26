/**
 * Plash Pilates — Studio Member Sign-Up Delegation
 * Forwarding to unified split auth card in login.js for seamless in-place registration.
 * @module signup
 */

import { render as renderAuth } from './login.js';

/**
 * Render the Sign-Up Page using unified split authentication card.
 * @param {HTMLElement} container
 */
export async function render(container) {
  return renderAuth(container);
}
