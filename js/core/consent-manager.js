/**
 * Plash Pilates — Consent Manager
 * Manages cookie/data collection consent (GDPR/DPDPA).
 * @module consent-manager
 */

import { events, EVENT } from './events.js';

const STORAGE_KEY = 'plash_consent';

const defaultConsent = {
  necessary: true,    // Always on
  functional: false,
  analytics: false,
  timestamp: null,
};

/**
 * Get current consent state.
 * @returns {Object}
 */
export function getConsent() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) { /* localStorage unavailable */ }
  return { ...defaultConsent };
}

/**
 * Check whether user has made any consent choice.
 * @returns {boolean}
 */
export function hasConsented() {
  return getConsent().timestamp !== null;
}

/**
 * Save consent preferences.
 * @param {Object} prefs - { functional: boolean, analytics: boolean }
 */
export function setConsent(prefs) {
  const consent = {
    necessary: true,
    functional: !!prefs.functional,
    analytics: !!prefs.analytics,
    timestamp: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch (e) { /* localStorage unavailable */ }
  events.emit(EVENT.CONSENT_UPDATED, consent);
}

/**
 * Accept all consent categories.
 */
export function acceptAll() {
  setConsent({ functional: true, analytics: true });
}

/**
 * Reject all optional consent categories.
 */
export function rejectAll() {
  setConsent({ functional: false, analytics: false });
}

/**
 * Reset consent (for "Manage preferences" re-prompt).
 */
export function resetConsent() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) { /* */ }
}
