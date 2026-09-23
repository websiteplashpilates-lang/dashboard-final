/**
 * Plash Pilates — Cart State Manager
 * Manages active package selection for member checkout.
 * @module cart
 */

import { events } from './events.js';

let activeCartPackage = null;

// Initialize from default popular package or localStorage
try {
  const saved = localStorage.getItem('plash_cart');
  if (saved) activeCartPackage = JSON.parse(saved);
} catch (e) { /* ignore */ }

/**
 * Get current package in cart.
 * @returns {Object|null}
 */
export function getCartPackage() {
  return activeCartPackage;
}

/**
 * Set selected package in cart.
 * @param {Object} pkg
 */
export function setCartPackage(pkg) {
  activeCartPackage = pkg;
  try {
    if (pkg) {
      localStorage.setItem('plash_cart', JSON.stringify(pkg));
    } else {
      localStorage.removeItem('plash_cart');
    }
  } catch (e) { /* ignore */ }
  events.emit('cart:updated', pkg);
}

/**
 * Clear the cart.
 */
export function clearCart() {
  setCartPackage(null);
}
