/**
 * Plash Pilates — Email Change with Security Verification Modal Component
 * Allows verified members to change their account email address with 6-digit OTP verification.
 * @module email-change-modal
 */

import { createElement, clearChildren } from '../utils/dom.js';
import * as auth from '../core/auth.js';
import { openModal } from './modal.js';
import { showToast } from './toast.js';

/**
 * Open the interactive 2-step Email Change & Verification Modal.
 * @param {Object} options
 * @param {string} [options.currentEmail] - Current email of the member
 * @param {Function} [options.onSuccess] - Callback when email is successfully verified & updated
 */
export function openEmailChangeModal({ currentEmail = '', onSuccess } = {}) {
  let step = 1; // 1: Enter new email, 2: Enter 6-digit OTP
  let targetNewEmail = '';
  let isSubmitting = false;

  const activeUser = auth.getCurrentUser();
  const current = currentEmail || (activeUser ? activeUser.email : '') || '';

  const container = createElement('div', {
    className: 'email-change-flow',
    style: 'padding: var(--space-2); min-height: 240px;'
  });

  let modalInstance = null;

  function renderStep() {
    clearChildren(container);

    if (step === 1) {
      // Step 1: Input New Email
      const form = createElement('form', { className: 'auth-modal-step' });
      form.innerHTML = `
        <div style="margin-bottom: var(--space-4);">
          <div style="background: var(--stone); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-4); margin-bottom: var(--space-4); border: 1px solid var(--ink-10);">
            <span style="font-size: var(--text-xs); color: var(--ink-60); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; display: block; margin-bottom: 2px;">Current Active Email</span>
            <strong style="color: var(--ink); font-size: var(--text-sm);">${current || 'Not set'}</strong>
          </div>

          <div style="font-size: 13px; color: var(--ink-70); margin-bottom: var(--space-3); line-height: 1.5;">
            To protect your studio membership and pass security, we verify ownership before updating your account email. Enter your new email below to receive a 6-digit verification code.
          </div>

          <div class="form-group">
            <label class="form-label" for="new-email-input" style="font-weight: 600;">New Email Address</label>
            <input 
              type="email" 
              id="new-email-input" 
              class="form-input" 
              placeholder="e.g. yourname.new@domain.com" 
              value="${targetNewEmail || ''}" 
              required
              autocomplete="email"
              style="width: 100%;"
            />
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-5);">
          <button type="button" class="btn btn-outline btn-sm" id="btn-cancel-email-change">Cancel</button>
          <button type="submit" class="btn btn-primary btn-sm" id="btn-send-email-code" ${isSubmitting ? 'disabled' : ''}>
            ${isSubmitting ? 'Dispatching Code...' : 'Send Verification Code'}
          </button>
        </div>
      `;

      form.querySelector('#btn-cancel-email-change')?.addEventListener('click', () => {
        if (modalInstance) modalInstance.close();
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = form.querySelector('#new-email-input');
        const newEmailVal = input ? input.value.trim().toLowerCase() : '';

        if (!newEmailVal || !newEmailVal.includes('@') || !newEmailVal.includes('.')) {
          showToast('Please enter a valid email address.', 'error');
          return;
        }

        if (newEmailVal === current.toLowerCase()) {
          showToast('New email must be different from your current email.', 'error');
          return;
        }

        isSubmitting = true;
        renderStep();

        try {
          const res = await auth.requestEmailChange(newEmailVal);
          targetNewEmail = newEmailVal;
          step = 2;
          isSubmitting = false;
          showToast(`Verification code sent to ${newEmailVal}.`, 'success');
          renderStep();
        } catch (err) {
          isSubmitting = false;
          showToast(err.message || 'Failed to dispatch verification code.', 'error');
          renderStep();
        }
      });

      container.appendChild(form);
      setTimeout(() => form.querySelector('#new-email-input')?.focus(), 50);

    } else if (step === 2) {
      // Step 2: Enter 6-digit OTP received in email
      const form = createElement('form', { className: 'auth-modal-step' });
      form.innerHTML = `
        <div style="margin-bottom: var(--space-4);">
          <div style="display: flex; align-items: center; gap: 10px; background: rgba(82, 107, 70, 0.08); border: 1px solid rgba(82, 107, 70, 0.2); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-4); margin-bottom: var(--space-4);">
            <i data-lucide="mail-check" style="width: 22px; height: 22px; color: var(--moss); flex-shrink: 0;"></i>
            <div style="font-size: 13px; color: var(--ink); line-height: 1.4;">
              A 6-digit verification code has been dispatched to <strong style="color: var(--moss);">${targetNewEmail}</strong>.<br>
              Please open your email inbox, find the code, and enter it below to verify.
            </div>
          </div>

          <div class="form-group" style="text-align: center; margin: var(--space-5) 0;">
            <label class="form-label" for="email-otp-input" style="font-weight: 600; margin-bottom: 8px; display: block; font-size: var(--text-sm);">Enter Verification Code From Your Email</label>
            <input 
              type="text" 
              id="email-otp-input" 
              class="form-input" 
              placeholder="••••••••" 
              maxlength="10"
              required
              autocomplete="one-time-code"
              style="width: 280px; margin: 0 auto; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 6px; font-family: monospace;"
            />
          </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: var(--space-5);">
          <button type="button" class="btn btn-ghost btn-sm" id="btn-change-target-email" style="font-size: var(--text-xs); color: var(--ink-60);">
            ← Change Email
          </button>
          <div style="display: flex; gap: var(--space-2);">
            <button type="button" class="btn btn-outline btn-sm" id="btn-cancel-otp">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm" id="btn-verify-otp" ${isSubmitting ? 'disabled' : ''}>
              ${isSubmitting ? 'Verifying Code...' : 'Verify & Update Email'}
            </button>
          </div>
        </div>
      `;

      form.querySelector('#btn-cancel-otp')?.addEventListener('click', () => {
        if (modalInstance) modalInstance.close();
      });

      form.querySelector('#btn-change-target-email')?.addEventListener('click', () => {
        step = 1;
        renderStep();
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const otpInput = form.querySelector('#email-otp-input');
        const codeVal = otpInput ? otpInput.value.trim() : '';

        if (!codeVal || codeVal.length < 6 || codeVal.length > 10) {
          showToast('Please enter the complete verification code.', 'error');
          return;
        }

        isSubmitting = true;
        renderStep();

        try {
          const res = await auth.verifyEmailChange(targetNewEmail, codeVal);
          showToast(res.message || `Email address successfully updated to ${targetNewEmail}!`, 'success');
          if (typeof onSuccess === 'function') {
            onSuccess(targetNewEmail);
          }
          if (modalInstance) modalInstance.close();
        } catch (err) {
          isSubmitting = false;
          showToast(err.message || 'Verification failed. Please check the code.', 'error');
          renderStep();
        }
      });

      container.appendChild(form);
      if (window.lucide) window.lucide.createIcons({ root: container });
      setTimeout(() => form.querySelector('#email-otp-input')?.focus(), 50);
    }
  }

  modalInstance = openModal({
    title: 'Update Account Email',
    content: container,
    maxWidth: '500px'
  });

  renderStep();
}
