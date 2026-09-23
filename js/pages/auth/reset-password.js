/**
 * Plash Pilates — Reset Password Page
 * Handles incoming recovery tokens from Supabase Auth and updates user credentials.
 * @module pages/auth/reset-password
 */

import { createElement, clearChildren } from '../../utils/dom.js';
import * as auth from '../../core/auth.js';
import { getSupabase } from '../../core/supabase.js';
import { showToast } from '../../components/toast.js';

export async function render(container) {
  clearChildren(container);

  // Extract access token or error from URL hash or query
  let recoveryToken = null;
  const fullHash = window.location.hash || '';
  const searchOrHash = fullHash + '&' + window.location.search;

  const match = searchOrHash.match(/access_token=([^&]+)/);
  if (match) {
    recoveryToken = decodeURIComponent(match[1]);
  }

  // Also check if PKCE authorization code was returned by Supabase Auth
  const client = getSupabase();
  const codeMatch = searchOrHash.match(/[?&]code=([^&]+)/);
  if (!recoveryToken && codeMatch && client && client.auth && typeof client.auth.exchangeCodeForSession === 'function') {
    try {
      const { data } = await client.auth.exchangeCodeForSession(decodeURIComponent(codeMatch[1]));
      if (data?.session?.access_token) {
        recoveryToken = data.session.access_token;
      }
    } catch (e) {
      console.warn('[PKCE exchangeCodeForSession notice]', e?.message || e);
    }
  }

  // Also verify with active Supabase session if token was consumed by SDK
  if (!recoveryToken && client && client.auth) {
    try {
      const { data } = await client.auth.getSession();
      if (data?.session?.access_token) {
        recoveryToken = data.session.access_token;
      }
    } catch (_) {}
  }

  const errMatch = searchOrHash.match(/error_description=([^&]+)/);
  const errorDescription = errMatch ? decodeURIComponent(errMatch[1]).replace(/\+/g, ' ') : null;

  const wrapper = createElement('div', {
    className: 'auth-page-wrapper',
    style: 'min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--color-bg, #fbf8f5); padding: var(--space-4);'
  });

  const card = createElement('div', {
    className: 'auth-card card card-elevated',
    style: 'max-width: 440px; width: 100%; padding: var(--space-8); border-radius: var(--radius-lg); background: #ffffff; border: 1px solid var(--stone-30, #e7e2dc); box-shadow: 0 12px 32px rgba(30, 30, 36, 0.08);'
  });

  // If recovery link has expired or has error description, display clean recovery card
  if (errorDescription) {
    card.innerHTML = `
      <div style="text-align: center;">
        <div style="font-family: var(--font-editorial, 'Playfair Display', serif); font-size: 24px; font-weight: 700; color: var(--rust, #934b2d); margin-bottom: 8px;">
          PLASH PILATES
        </div>
        <div style="width: 56px; height: 56px; border-radius: 50%; background: #FDE8E4; color: #BE603C; display: flex; align-items: center; justify-content: center; margin: 16px auto;">
          <i data-lucide="alert-triangle" style="width: 28px; height: 28px;"></i>
        </div>
        <h1 style="font-size: 20px; font-weight: 700; color: var(--ink, #1e1e24); margin-bottom: 8px;">
          Recovery Link Expired
        </h1>
        <p style="font-size: 13.5px; color: var(--ink-70, #666); line-height: 1.5; margin-bottom: 24px;">
          ${errorDescription || 'This password reset link has expired or has already been used. Please request a new link.'}
        </p>
        <a href="#/login" class="btn btn-primary btn-block" style="padding: 12px 24px; text-decoration: none; display: inline-block;">
          Request New Reset Link
        </a>
      </div>
    `;
    wrapper.appendChild(card);
    container.appendChild(wrapper);
    if (window.lucide) window.lucide.createIcons({ root: container });
    return;
  }

  const header = createElement('div', {
    style: 'text-align: center; margin-bottom: var(--space-6);'
  });
  header.innerHTML = `
    <div style="font-family: var(--font-editorial, 'Playfair Display', serif); font-size: 24px; font-weight: 700; color: var(--rust, #934b2d); margin-bottom: 6px;">
      PLASH PILATES
    </div>
    <h1 style="font-size: 20px; font-weight: 700; color: var(--ink, #1e1e24); margin-bottom: 6px;">
      Set New Password
    </h1>
    <p style="font-size: 13.5px; color: var(--ink-70, #666); line-height: 1.5;">
      Choose a strong, secure password for your studio account.
    </p>
  `;
  card.appendChild(header);

  let isSubmitting = false;

  const form = createElement('form', { id: 'reset-password-form' });
  form.innerHTML = `
    <div class="form-group" style="margin-bottom: var(--space-4);">
      <label class="form-label" for="reset-new-pass" style="font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 6px; display: block;">New Password</label>
      <input 
        type="password" 
        id="reset-new-pass" 
        class="form-input" 
        placeholder="Enter new password" 
        required 
        minlength="6"
        autocomplete="new-password"
        style="width: 100%; height: 44px; padding: 0 14px; font-size: 14px; border: 1.5px solid var(--stone-40, #d5cec5); border-radius: 6px; background: #ffffff; color: var(--ink); box-sizing: border-box;"
      />
      <div style="font-size: 11px; color: var(--ink-60, #888); margin-top: 4px;">
        Must be at least 6 characters, contain 1 uppercase letter, 1 number, and 1 symbol.
      </div>
    </div>

    <div class="form-group" style="margin-bottom: var(--space-5);">
      <label class="form-label" for="reset-confirm-pass" style="font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 6px; display: block;">Confirm Password</label>
      <input 
        type="password" 
        id="reset-confirm-pass" 
        class="form-input" 
        placeholder="Re-enter new password" 
        required 
        minlength="6"
        autocomplete="new-password"
        style="width: 100%; height: 44px; padding: 0 14px; font-size: 14px; border: 1.5px solid var(--stone-40, #d5cec5); border-radius: 6px; background: #ffffff; color: var(--ink); box-sizing: border-box;"
      />
    </div>

    <button 
      type="submit" 
      id="btn-submit-reset" 
      class="btn btn-primary btn-block" 
      style="padding: var(--space-3) var(--space-4); font-size: 15px; font-weight: 600;"
    >
      Update Password
    </button>

    <div style="text-align: center; margin-top: var(--space-5);">
      <a href="#/login" style="font-size: 13px; color: var(--rust, #934b2d); text-decoration: none; font-weight: 600;">
        ← Back to Studio Sign In
      </a>
    </div>
  `;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const p1 = form.querySelector('#reset-new-pass').value;
    const p2 = form.querySelector('#confirm-pass-input') || form.querySelector('#reset-confirm-pass');
    const p2Val = p2 ? p2.value : '';

    if (p1 !== p2Val) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    const check = auth.validatePassword(p1);
    if (!check.valid) {
      showToast(check.error, 'error');
      return;
    }

    const btn = form.querySelector('#btn-submit-reset');
    isSubmitting = true;
    btn.disabled = true;
    btn.innerText = 'Updating Password...';

    try {
      await auth.completePasswordReset(p1, recoveryToken);
      showToast('Password updated successfully! Please sign in.', 'success');
      
      clearChildren(card);
      const successBox = createElement('div', { style: 'text-align: center; padding: var(--space-4) 0;' });
      successBox.innerHTML = `
        <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--moss-10, #e8f5e9); color: var(--moss, #2e7d32); display: flex; align-items: center; justify-content: center; margin: 0 auto var(--space-4);">
          <i data-lucide="check-circle" style="width: 32px; height: 32px;"></i>
        </div>
        <h2 style="font-size: 20px; font-weight: 700; color: var(--ink, #1e1e24); margin-bottom: 8px;">
          Password Reset Complete
        </h2>
        <p style="font-size: 14px; color: var(--ink-70, #666); margin-bottom: var(--space-5); line-height: 1.5;">
          Your account credentials have been securely updated. You may now sign in with your new password.
        </p>
        <a href="#/login" class="btn btn-primary" style="display: inline-block; padding: 10px 24px;">
          Sign In Now
        </a>
      `;
      card.appendChild(successBox);
      if (window.lucide) window.lucide.createIcons({ root: card });
    } catch (err) {
      console.error('[Reset Password Error]', err);
      showToast(err.message || 'Failed to update password. Link may be expired.', 'error');
      btn.disabled = false;
      btn.innerText = 'Update Password';
      isSubmitting = false;
    }
  });

  card.appendChild(form);
  wrapper.appendChild(card);
  container.appendChild(wrapper);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}
