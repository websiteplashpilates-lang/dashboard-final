/**
 * Plash Pilates — Legal: Cookie Policy
 * Explains browser storage, categories of cookies, and preference controls.
 * @module pages/legal/cookie-policy
 */

import { createElement } from '../../utils/dom.js';
import { initCookieBanner } from '../../components/cookie-banner.js';

export async function render(container) {
  const page = createElement('div', { className: 'page-container' });

  const header = createElement('div', { className: 'page-header' });
  const title = createElement('h1', { className: 'page-title', text: 'Cookie & Storage Policy' });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    text: 'How Plash Pilates uses local storage and cookies to maintain security, session state, and analytics.'
  });
  header.append(title, subtitle);
  page.appendChild(header);

  const article = createElement('article', { className: 'legal-content' });

  article.innerHTML = `
    <div style="background: var(--stone); border-radius: var(--radius-sm); padding: var(--space-4); margin-bottom: var(--space-8); font-size: var(--text-xs); color: var(--ink-80);">
      <strong>Effective Date:</strong> April 11, 2026 | <strong>Version:</strong> 1.0 (GDPR & DPDPA Compliant)
    </div>

    <h2>1. What Are Cookies and Local Storage?</h2>
    <p>
      Cookies and web storage (such as HTML5 <code>localStorage</code>) are small text files and data tokens stored on your browser or device when you visit web portals. They help preserve your login session, store your consent choices, and ensure website security.
    </p>

    <h2>2. Categories of Storage We Use</h2>
    <div style="display: flex; flex-direction: column; gap: var(--space-4); margin: var(--space-6) 0;">
      <div style="background: white; border: 1px solid var(--ink-10); border-radius: var(--radius-sm); padding: var(--space-4);">
        <h3 style="margin-top: 0; color: var(--ink); font-size: var(--text-base);">Strictly Necessary Storage (Always Active)</h3>
        <p style="margin-bottom: 0; font-size: var(--text-xs); color: var(--ink-80); line-height: 1.6;">
          Essential for authentication, CSRF security, pass credit validation, and remembering your privacy choices. These cannot be switched off in our system as core booking features depend on them.
        </p>
      </div>

      <div style="background: white; border: 1px solid var(--ink-10); border-radius: var(--radius-sm); padding: var(--space-4);">
        <h3 style="margin-top: 0; color: var(--ink); font-size: var(--text-base);">Functional Storage (Optional)</h3>
        <p style="margin-bottom: 0; font-size: var(--text-xs); color: var(--ink-80); line-height: 1.6;">
          Stores user interface preferences, such as your selected calendar week, timetable filters, and demo persona selection.
        </p>
      </div>

      <div style="background: white; border: 1px solid var(--ink-10); border-radius: var(--radius-sm); padding: var(--space-4);">
        <h3 style="margin-top: 0; color: var(--ink); font-size: var(--text-base);">Analytics & Performance Storage (Optional)</h3>
        <p style="margin-bottom: 0; font-size: var(--text-xs); color: var(--ink-80); line-height: 1.6;">
          Aggregates anonymous session metrics to help us understand studio demand, apparatus booking flow, and page loading speed.
        </p>
      </div>
    </div>

    <h2>3. Managing Your Cookie Preferences</h2>
    <p>
      You have the right to withdraw or customize your consent at any time without affecting your statutory rights. Click below to adjust your settings:
    </p>
  `;

  const manageBtn = createElement('button', {
    className: 'btn btn-primary btn-sm',
    attributes: { type: 'button' },
    style: 'margin-top: var(--space-4);',
    text: 'Open Cookie Preference Manager'
  });

  manageBtn.addEventListener('click', () => {
    initCookieBanner(true);
  });

  article.appendChild(manageBtn);
  page.appendChild(article);
  container.appendChild(page);
}
