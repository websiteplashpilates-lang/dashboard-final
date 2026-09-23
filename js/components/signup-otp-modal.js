/**
 * Plash Pilates — Signup Activation OTP Modal Component
 * Enforces strict 6-digit OTP verification before member account activation.
 * @module signup-otp-modal
 */

import { createElement, clearChildren } from '../utils/dom.js';
import * as auth from '../core/auth.js';
import { openModal } from './modal.js';
import { showToast } from './toast.js';

/**
 * Open the Signup Activation OTP verification modal.
 * @param {Object} options
 * @param {string} options.email - New member's registered email
 * @param {Object} [options.signupData] - Full signup payload
 * @param {Function} options.onVerified - Callback invoked with verified member data
 */
export function openSignupOtpModal({ email, signupData = {}, onVerified }) {
  const cleanEmail = (email || '').trim().toLowerCase();
  let isSubmitting = false;
  let resendCooldown = 60;
  let resendTimer = null;

  const container = createElement('div', {
    className: 'signup-otp-flow',
    style: 'padding: var(--space-2); min-height: 260px;'
  });

  let modalInstance = null;

  function startCooldown() {
    resendCooldown = 60;
    if (resendTimer) clearInterval(resendTimer);
    resendTimer = setInterval(() => {
      resendCooldown--;
      const resendBtn = container.querySelector('#btn-resend-signup-otp');
      if (resendBtn) {
        if (resendCooldown > 0) {
          resendBtn.disabled = true;
          resendBtn.textContent = `Resend Code (${resendCooldown}s)`;
        } else {
          resendBtn.disabled = false;
          resendBtn.textContent = 'Resend Code';
          clearInterval(resendTimer);
          resendTimer = null;
        }
      }
    }, 1000);
  }

  function render() {
    clearChildren(container);

    const form = createElement('form', { className: 'auth-modal-step' });
    form.innerHTML = `
      <div style="margin-bottom: var(--space-4);">
        <!-- Information Banner -->
        <div style="display: flex; align-items: flex-start; gap: 12px; background: rgba(147, 75, 45, 0.06); border: 1px solid rgba(147, 75, 45, 0.18); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-4); margin-bottom: var(--space-4);">
          <i data-lucide="mail-check" style="width: 22px; height: 22px; color: var(--terracotta); flex-shrink: 0; margin-top: 2px;"></i>
          <div style="font-size: 13.5px; color: var(--ink); line-height: 1.5;">
            A 6-digit activation code has been dispatched to <strong style="color: var(--terracotta); font-weight: 700;">${cleanEmail}</strong>.<br>
            Please check your inbox, enter the code below to verify ownership, and activate your studio membership.
          </div>
        </div>

        <!-- Verification Code Input -->
        <div class="form-group" style="text-align: center; margin: var(--space-5) 0 var(--space-3) 0;">
          <label class="form-label" for="signup-otp-input" style="font-weight: 700; margin-bottom: 8px; display: block; font-size: 14px; color: var(--ink);">Enter Activation Code</label>
          <input 
            type="text" 
            id="signup-otp-input" 
            class="form-input" 
            placeholder="••••••••" 
            maxlength="10"
            pattern="[0-9]{6,10}"
            required
            autocomplete="one-time-code"
            inputmode="numeric"
            style="width: 280px; margin: 0 auto; text-align: center; font-size: 24px; font-weight: 800; letter-spacing: 6px; font-family: 'SFMono-Regular', Consolas, Monaco, monospace; height: 52px; border-radius: var(--radius-sm); border: 1.5px solid var(--ink-20);"
          />
        </div>

        <div style="text-align: center; font-size: 12.5px; color: var(--ink-60); margin-bottom: var(--space-3);">
          Code is valid for 10 minutes &bull; Didn't receive it? Check spam folder or resend.
        </div>
      </div>

      <!-- Action Buttons -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-top: var(--space-5); padding-top: var(--space-3); border-top: 1px solid var(--ink-10);">
        <button type="button" class="btn btn-ghost btn-sm" id="btn-resend-signup-otp" style="font-size: 13px; font-weight: 600; color: var(--terracotta);" ${resendCooldown > 0 ? 'disabled' : ''}>
          ${resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
        </button>
        <div style="display: flex; gap: var(--space-2);">
          <button type="button" class="btn btn-outline btn-sm" id="btn-cancel-signup-otp">Cancel</button>
          <button type="submit" class="btn btn-primary btn-sm" id="btn-verify-signup-otp" style="font-weight: 700;" ${isSubmitting ? 'disabled' : ''}>
            ${isSubmitting ? 'Activating Account...' : 'Activate Membership'}
          </button>
        </div>
      </div>
    `;

    // Resend handler
    form.querySelector('#btn-resend-signup-otp')?.addEventListener('click', async () => {
      try {
        const btn = form.querySelector('#btn-resend-signup-otp');
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Dispatching...';
        }
        await auth.requestSignupOtp(signupData);
        showToast(`New activation code dispatched to ${cleanEmail}.`, 'success');
        startCooldown();
      } catch (err) {
        showToast(err.message || 'Failed to resend activation code.', 'error');
        const btn = form.querySelector('#btn-resend-signup-otp');
        if (btn) btn.disabled = false;
      }
    });

    // Cancel handler
    form.querySelector('#btn-cancel-signup-otp')?.addEventListener('click', () => {
      if (resendTimer) clearInterval(resendTimer);
      if (modalInstance) modalInstance.close();
    });

    // Submit handler
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const otpInput = form.querySelector('#signup-otp-input');
      const codeVal = otpInput ? otpInput.value.trim() : '';

      if (!codeVal || codeVal.length < 6 || codeVal.length > 10) {
        showToast('Please enter the complete activation code.', 'error');
        otpInput?.focus();
        return;
      }

      isSubmitting = true;
      render();

      try {
        const verifiedUser = await auth.verifySignupOtp(cleanEmail, codeVal, signupData);
        if (resendTimer) clearInterval(resendTimer);
        if (modalInstance) modalInstance.close();
        if (typeof onVerified === 'function') {
          onVerified(verifiedUser);
        }
      } catch (err) {
        isSubmitting = false;
        showToast(err.message || 'Invalid activation code. Please check and try again.', 'error');
        render();
        setTimeout(() => form.querySelector('#signup-otp-input')?.focus(), 50);
      }
    });

    container.appendChild(form);
    if (window.lucide) window.lucide.createIcons({ root: container });
    setTimeout(() => container.querySelector('#signup-otp-input')?.focus(), 50);
  }

  modalInstance = openModal({
    title: 'Activate Studio Membership',
    content: container,
    maxWidth: '520px',
    onClose: () => {
      if (resendTimer) clearInterval(resendTimer);
    }
  });

  startCooldown();
  render();
}
