/**
 * Plash Pilates — Cookie Consent Banner
 * GDPR/DPDPA compliant cookie banner with granular preference toggles.
 * @module cookie-banner
 */

import { createElement } from '../utils/dom.js';
import * as consentManager from '../core/consent-manager.js';

let bannerElement = null;

/**
 * Initialize and mount the cookie consent banner if not already consented.
 * Can also be forced to show via `showCookieBanner(true)` from the footer.
 * @param {boolean} [force=false]
 */
export function initCookieBanner(force = false) {
  if (!force && consentManager.hasConsented()) {
    return;
  }

  const root = document.getElementById('cookie-banner-root') || document.body;

  if (bannerElement && bannerElement.parentNode) {
    bannerElement.parentNode.removeChild(bannerElement);
  }

  const currentConsent = consentManager.getConsent();

  const banner = createElement('div', {
    className: 'cookie-banner',
    attributes: {
      role: 'dialog',
      'aria-label': 'Cookie and Privacy Preferences'
    }
  });

  const inner = createElement('div', { className: 'cookie-banner-inner' });

  const text = createElement('div', { className: 'cookie-banner-text' });
  text.innerHTML = 'We use essential cookies to keep our platform secure and functional. With your consent, we also use optional functional and analytics cookies to enhance studio operations and understand class scheduling trends. Learn more in our <a href="#/legal/cookie-policy">Cookie Policy</a> and <a href="#/legal/privacy-policy">Privacy Policy</a>.';

  const actions = createElement('div', { className: 'cookie-banner-actions' });

  const acceptBtn = createElement('button', {
    className: 'btn-accept',
    attributes: { type: 'button' },
    text: 'Accept All'
  });

  const rejectBtn = createElement('button', {
    className: 'btn-reject',
    attributes: { type: 'button' },
    text: 'Reject Optional'
  });

  const manageBtn = createElement('button', {
    className: 'btn-manage',
    attributes: { type: 'button' },
    text: 'Manage Preferences'
  });

  actions.append(acceptBtn, rejectBtn, manageBtn);

  // Preferences panel
  const prefsPanel = createElement('div', { className: 'cookie-preferences' });

  // Necessary item
  const necItem = createPrefItem(
    'Strictly Necessary',
    'Required for core platform functionality, security, and authentication state.',
    true,
    true
  );

  // Functional item
  const funcItem = createPrefItem(
    'Functional Preferences',
    'Remembers UI preferences such as role state and class filter selections.',
    currentConsent.functional,
    false,
    'func-toggle'
  );

  // Analytics item
  const anaItem = createPrefItem(
    'Analytics & Performance',
    'Helps us understand class demand, booking cadence, and studio utilization.',
    currentConsent.analytics,
    false,
    'ana-toggle'
  );

  const saveBtn = createElement('button', {
    className: 'btn btn-primary btn-sm cookie-pref-save',
    attributes: { type: 'button' },
    text: 'Save Preferences'
  });

  prefsPanel.append(necItem.row, funcItem.row, anaItem.row, saveBtn);

  inner.append(text, actions, prefsPanel);
  banner.appendChild(inner);
  root.appendChild(banner);
  bannerElement = banner;

  requestAnimationFrame(() => {
    banner.classList.add('visible');
  });

  function closeBanner() {
    banner.classList.remove('visible');
    setTimeout(() => {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
      bannerElement = null;
    }, 300);
  }

  acceptBtn.addEventListener('click', () => {
    consentManager.acceptAll();
    closeBanner();
  });

  rejectBtn.addEventListener('click', () => {
    consentManager.rejectAll();
    closeBanner();
  });

  manageBtn.addEventListener('click', () => {
    prefsPanel.classList.toggle('open');
    manageBtn.textContent = prefsPanel.classList.contains('open') ? 'Hide Preferences' : 'Manage Preferences';
  });

  saveBtn.addEventListener('click', () => {
    consentManager.setConsent({
      functional: funcItem.input.checked,
      analytics: anaItem.input.checked,
    });
    closeBanner();
  });
}

function createPrefItem(name, desc, isChecked, isDisabled, inputId) {
  const row = createElement('div', { className: 'cookie-pref-item' });

  const info = createElement('div', { className: 'cookie-pref-info' });
  const title = createElement('div', { className: 'cookie-pref-name', text: name });
  const subtitle = createElement('div', { className: 'cookie-pref-desc', text: desc });
  info.append(title, subtitle);

  const toggle = createElement('label', { className: 'toggle-switch' });
  const input = createElement('input', {
    attributes: {
      type: 'checkbox',
      ...(isChecked ? { checked: 'true' } : {}),
      ...(isDisabled ? { disabled: 'true' } : {}),
      ...(inputId ? { id: inputId } : {})
    }
  });
  if (isChecked) input.checked = true;
  if (isDisabled) input.disabled = true;

  const slider = createElement('span', { className: 'toggle-slider' });
  toggle.append(input, slider);

  row.append(info, toggle);
  return { row, input };
}
