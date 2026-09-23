/**
 * Plash Pilates — Forgot & Reset Password Modal Component
 * Universal password recovery flow accessible across Login, Member Dashboard, Admin, and Partner portals.
 * @module forgot-password-modal
 */

import { createElement, clearChildren } from '../utils/dom.js';
import * as auth from '../core/auth.js';
import { openModal } from './modal.js';
import { showToast } from './toast.js';

/**
 * Open the interactive 3-step Password Recovery Modal.
 * @param {string} [initialEmail] - Optional pre-filled email (e.g. from current session)
 */
export function openForgotPasswordModal(initialEmail = '') {
  let step = 1; // 1: Email Request, 2: Email Dispatched
  let targetEmail = (initialEmail || '').trim();
  let isSubmitting = false;

  const container = createElement('div', {
    className: 'forgot-password-flow',
    style: 'padding: var(--space-2); min-height: 240px;'
  });

  let modalInstance = null;

  function renderStep() {
    clearChildren(container);

    if (step === 1) {
      // Step 1: Request Email
      const form = createElement('form', { className: 'auth-modal-step' });
      form.innerHTML = `
        <div style="margin-bottom: var(--space-4);">
          <div style="font-size: 14px; color: var(--ink-70); margin-bottom: var(--space-4); line-height: 1.5;">
            Enter your registered studio email address. We will send you a secure password recovery link to reset your password.
          </div>
          <div class="form-group" style="margin-bottom: var(--space-3);">
            <label class="form-label" for="reset-email-input" style="font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 6px; display: block;">
              Registered Studio Email Address
            </label>
            <div style="position: relative;">
              <input 
                type="email" 
                id="reset-email-input" 
                class="form-input" 
                placeholder="Enter your registered email (e.g. name@domain.com)" 
                value="${targetEmail ? targetEmail.replace(/"/g, '&quot;') : ''}" 
                required
                autocomplete="email"
                style="width: 100%; height: 46px; padding-left: 40px; padding-right: 14px; font-size: 14px; border: 1.5px solid var(--stone-40, #d5cec5); border-radius: 6px; background: #ffffff; color: var(--ink); font-family: 'Nunito Sans', sans-serif; box-sizing: border-box;"
              />
              <i data-lucide="mail" style="position: absolute; left: 13px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--taupe, #8c827a); pointer-events: none;"></i>
            </div>
            <div style="font-size: 11.5px; color: var(--taupe, #8c827a); margin-top: 6px;">
              Please enter the email address linked with your Plash membership.
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-5);">
          <button type="button" class="btn btn-outline btn-sm" id="btn-cancel-reset" style="height: 38px; padding: 0 16px;">Cancel</button>
          <button type="submit" class="btn btn-primary btn-sm" id="btn-send-recovery" style="height: 38px; padding: 0 20px; font-weight: 600;" ${isSubmitting ? 'disabled' : ''}>
            ${isSubmitting ? 'Sending Recovery Link...' : 'Send Recovery Link'}
          </button>
        </div>
      `;

      form.querySelector('#btn-cancel-reset').addEventListener('click', () => {
        if (modalInstance && modalInstance.close) modalInstance.close();
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = form.querySelector('#reset-email-input');
        const emailVal = emailInput.value.trim();
        if (!emailVal || !emailVal.includes('@')) {
          showToast('Please enter a valid email address.', 'error');
          return;
        }

        targetEmail = emailVal;
        isSubmitting = true;
        renderStep();

        try {
          await auth.requestPasswordReset(targetEmail);
          showToast(`Password recovery link dispatched to ${targetEmail}`, 'success');
          step = 2;
        } catch (err) {
          showToast(err.message || 'Error requesting password reset link', 'error');
        } finally {
          isSubmitting = false;
          renderStep();
        }
      });

      container.appendChild(form);
    } else if (step === 2) {
      // Step 2: Email Dispatched
      const dispatchedBox = createElement('div', {
        style: 'text-align: center; padding: var(--space-4) var(--space-2);'
      });
      dispatchedBox.innerHTML = `
        <div style="width: 52px; height: 52px; border-radius: 50%; background: var(--moss-10); color: var(--moss); display: flex; align-items: center; justify-content: center; margin: 0 auto var(--space-3);">
          <i data-lucide="mail-check" style="width: 28px; height: 28px;"></i>
        </div>
        <h3 style="font-size: 18px; font-weight: 700; color: var(--ink); margin-bottom: 8px;">
          Recovery Link Dispatched
        </h3>
        <p style="font-size: 13.5px; color: var(--ink-80); max-width: 420px; margin: 0 auto var(--space-3); line-height: 1.6;">
          A secure password recovery email has been sent to <strong>${targetEmail}</strong>.
        </p>
        <p style="font-size: 12.5px; color: var(--ink-60); max-width: 400px; margin: 0 auto var(--space-5); line-height: 1.5;">
          Click the secure link in your email to choose your new password. If you do not see the email within a couple of minutes, please check your spam folder.
        </p>
        <div style="display: flex; justify-content: center; gap: var(--space-3);">
          <button type="button" class="btn btn-outline btn-sm" id="btn-resend-recovery">
            Resend Email
          </button>
          <button type="button" class="btn btn-primary btn-sm" id="btn-close-recovery">
            Done
          </button>
        </div>
      `;

      dispatchedBox.querySelector('#btn-resend-recovery').addEventListener('click', async () => {
        try {
          await auth.requestPasswordReset(targetEmail);
          showToast(`New recovery link dispatched to ${targetEmail}`, 'info');
        } catch (err) {
          showToast(err.message || 'Error resending recovery link', 'error');
        }
      });

      dispatchedBox.querySelector('#btn-close-recovery').addEventListener('click', () => {
        if (modalInstance && modalInstance.close) modalInstance.close();
      });

      container.appendChild(dispatchedBox);
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: container });
    }
  }

  renderStep();

  modalInstance = openModal({
    title: 'Studio Account • Password Recovery',
    content: container,
    maxWidth: '520px'
  });

  return modalInstance;
}
