/**
 * Plash Pilates — Split Authentication & Registration Page
 * Pure image visual carousel on left, in-place toggle between Sign In & Create Account on right.
 * @module login
 */

import { createElement, clearChildren } from '../../utils/dom.js';
import * as auth from '../../core/auth.js';
import { openForgotPasswordModal } from '../../components/forgot-password-modal.js';
import { openModal, closeModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { openSignupOtpModal } from '../../components/signup-otp-modal.js';

/**
 * Render the Login & Signup Page.
 * @param {HTMLElement} container
 */
export async function render(container) {
  clearChildren(container);

  const page = createElement('div', {
    className: 'auth-page-wrapper',
    style: 'background: var(--ivory); font-family: "Nunito Sans", sans-serif;'
  });

  const card = createElement('div', {
    className: 'auth-card-split'
  });

  // Left Column: Automatic Carousel with 4 Unique Bespoke Studio Photos (Pure Visual, No Dots)
  const mediaCol = createElement('div', {
    className: 'auth-card-media'
  });

  const carouselImages = [
    'assets/images/pilates-1.jpg',
    'assets/images/pilates-2.jpg',
    'assets/images/pilates-3.jpg',
    'assets/images/pilates-4.jpg'
  ];

  const slidesContainer = createElement('div', {
    style: 'position: absolute; inset: 0; width: 100%; height: 100%; overflow: hidden;'
  });

  carouselImages.forEach((src, idx) => {
    const slide = createElement('div', {
      className: `auth-carousel-slide ${idx === 0 ? 'active' : ''}`,
      style: `background-image: url('${src}');`
    });
    slidesContainer.appendChild(slide);
  });

  mediaCol.appendChild(slidesContainer);
  card.appendChild(mediaCol);

  // Auto-play Carousel Timer
  let currentSlide = 0;
  const allSlides = slidesContainer.querySelectorAll('.auth-carousel-slide');
  const carouselTimer = setInterval(() => {
    currentSlide = (currentSlide + 1) % carouselImages.length;
    allSlides.forEach((slide, i) => {
      if (i === currentSlide) slide.classList.add('active');
      else slide.classList.remove('active');
    });
  }, 4000);

  // Clear interval on route change
  window.addEventListener('hashchange', () => {
    clearInterval(carouselTimer);
  }, { once: true });

  // Right Column: Form Container (In-Place Toggle between Sign In and Create Account)
  const formCol = createElement('div', {
    className: 'auth-card-form'
  });
  card.appendChild(formCol);
  page.appendChild(card);
  container.appendChild(page);

  // Determine initial view based on hash
  const initialMode = window.location.hash === '#/signup' ? 'signup' : 'signin';
  if (initialMode === 'signup') {
    showSignUpView();
  } else {
    showSignInView();
  }

  // --- RENDER SIGN IN VIEW ---
  function showSignInView() {
    clearChildren(formCol);
    formCol.style.animation = 'fadeIn 0.25s ease-out';

    // Header
    const header = createElement('div', { style: 'margin-bottom: var(--space-4);' });
    header.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3);">
        <img src="assets/images/plash-logo-horizontal.png" alt="Plash Pilates Logo" style="height: 38px; width: auto; max-width: 220px; object-fit: contain; display: block;" />
        <div class="auth-portal-badge" style="margin-bottom: 0; font-style: normal;">STUDIO PORTAL</div>
      </div>
      <h1 class="auth-form-title" style="font-style: normal;">
        Sign in to your Studio Portal
      </h1>
      <p class="auth-form-sub" style="font-style: normal; margin-bottom: var(--space-4);">
        Enter your email address and password to access your dashboard.
      </p>
    `;
    formCol.appendChild(header);

    // Active session switcher banner if already authenticated in this browser
    if (auth.isAuthenticated()) {
      const activeUser = auth.getCurrentUser() || {};
      const activeName = activeUser.fullName || activeUser.name || 'User';
      const activeEmail = activeUser.email || '';
      const switchBanner = createElement('div', {
        className: 'auth-active-session-banner',
        style: 'background: rgba(184, 115, 87, 0.08); border: 1px solid rgba(184, 115, 87, 0.25); border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 10px;'
      });
      switchBanner.innerHTML = `
        <div style="min-width: 0;">
          <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--rust); letter-spacing: 0.5px; margin-bottom: 2px;">
            Active Session in Browser
          </div>
          <div style="font-size: 12.5px; color: var(--ink); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            Signed in as <strong>${activeName}</strong>${activeEmail ? ` (${activeEmail})` : ''}
          </div>
        </div>
        <button type="button" class="btn-switch-signout btn btn-outline" style="font-size: 11.5px; height: 30px; padding: 0 10px; white-space: nowrap; border-color: var(--rust); color: var(--rust); font-weight: 600;">
          Switch Account
        </button>
      `;
      switchBanner.querySelector('.btn-switch-signout').addEventListener('click', (e) => {
        e.preventDefault();
        auth.logout();
        showSignInView();
        showToast('Signed out cleanly. Please sign in with your new account.', 'info');
      });
      formCol.appendChild(switchBanner);
    }

    // Form
    const form = createElement('form', { className: 'auth-login-form' });
    form.innerHTML = `
      <div class="form-group" style="margin-bottom: var(--space-4);">
        <label class="form-label" for="login-email" style="font-weight: 600; font-size: 13px; color: var(--ink); margin-bottom: 6px;">
          Email Address
        </label>
        <div style="position: relative;">
          <input 
            type="email" 
            id="login-email" 
            class="form-input" 
            required 
            autocomplete="email"
            placeholder="name@domain.com"
            style="width: 100%; height: 46px; font-size: 14px; padding-left: 40px; font-family: 'Nunito Sans', sans-serif;"
          />
          <i data-lucide="mail" style="position: absolute; left: 13px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--taupe);"></i>
        </div>
        <div id="login-email-alert" style="display: none; margin-top: 8px; font-size: 12.5px; border-radius: 8px; padding: 8px 12px; background: rgba(147, 75, 45, 0.08); border: 1px solid rgba(147, 75, 45, 0.25); color: var(--rust);">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <i data-lucide="alert-circle" style="width: 14px; height: 14px; flex-shrink: 0;"></i>
              <span id="login-email-alert-text">This email is not registered as a member.</span>
            </div>
            <button type="button" id="btn-quick-signup" style="background: none; border: none; padding: 0; color: var(--rust); font-weight: 700; text-decoration: underline; cursor: pointer; font-size: 12px; white-space: nowrap;">Create Account &rarr;</button>
          </div>
        </div>
      </div>

      <div class="form-group" style="margin-bottom: var(--space-4);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <label class="form-label" for="login-password" style="font-weight: 600; font-size: 13px; color: var(--ink); margin-bottom: 0;">
            Password
          </label>
          <button 
            type="button" 
            id="btn-forgot-password-link" 
            class="link-button" 
            style="background: none; border: none; padding: 0; font-size: 12px; color: var(--rust); font-weight: 600; cursor: pointer; font-family: 'Nunito Sans', sans-serif;"
          >
            Forgot Password?
          </button>
        </div>
        <div style="position: relative;">
          <input 
            type="password" 
            id="login-password" 
            class="form-input" 
            required 
            autocomplete="current-password"
            placeholder="Enter password"
            style="width: 100%; height: 46px; font-size: 14px; padding-left: 40px; padding-right: 42px; font-family: 'Nunito Sans', sans-serif;"
          />
          <i data-lucide="lock" style="position: absolute; left: 13px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--taupe);"></i>
          <button 
            type="button" 
            id="btn-toggle-password" 
            aria-label="Toggle password visibility" 
            style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--taupe); padding: 6px;"
          >
            <i data-lucide="eye" style="width: 16px; height: 16px;"></i>
          </button>
        </div>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-5);">
        <label style="display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink); cursor: pointer; font-family: 'Nunito Sans', sans-serif;">
          <input type="checkbox" id="login-remember" checked style="accent-color: var(--rust); width: 16px; height: 16px;" />
          Remember my session
        </label>
      </div>

      <button type="submit" id="btn-submit-login" class="btn btn-primary" style="width: 100%; justify-content: center; height: 48px; font-size: 15px; font-weight: 700; letter-spacing: 0.5px; font-family: 'Nunito Sans', sans-serif;">
        <span>Sign In to Studio</span>
        <i data-lucide="arrow-right" style="width: 16px; height: 16px; margin-left: 8px;"></i>
      </button>
    `;
    formCol.appendChild(form);

    // In-Place Switcher to Create Account & Legal Links Modal Triggers
    const switchBox = createElement('div', {
      className: 'auth-form-footer'
    });
    switchBox.innerHTML = `
      <div>
        Don't have a Plash membership account? 
        <button type="button" id="btn-switch-to-signup" style="background: none; border: none; padding: 0; margin-left: 4px; color: var(--rust); font-weight: 700; cursor: pointer; font-family: inherit; font-size: inherit;">
          Create Account
        </button>
      </div>
      <div style="margin-top: 10px; font-size: 11.5px; color: var(--taupe);">
        <button type="button" id="btn-login-privacy" style="background: none; border: none; padding: 0; color: var(--taupe); cursor: pointer; text-decoration: underline; font-family: inherit; font-size: inherit;">DPDPA Privacy Policy</button>
        <span style="margin: 0 6px;">•</span>
        <button type="button" id="btn-login-terms" style="background: none; border: none; padding: 0; color: var(--taupe); cursor: pointer; text-decoration: underline; font-family: inherit; font-size: inherit;">Terms & Conditions</button>
      </div>
    `;
    formCol.appendChild(switchBox);

    // Wire up in-place switcher to signup
    switchBox.querySelector('#btn-switch-to-signup').addEventListener('click', (e) => {
      e.preventDefault();
      const currentEmail = form.querySelector('#login-email').value.trim();
      showSignUpView(currentEmail);
    });

    switchBox.querySelector('#btn-login-privacy').addEventListener('click', (e) => {
      e.preventDefault();
      openPrivacyPolicyModal();
    });

    switchBox.querySelector('#btn-login-terms').addEventListener('click', (e) => {
      e.preventDefault();
      openTermsModal();
    });

    // Email verification & alert elements
    const emailInput = form.querySelector('#login-email');
    const emailAlert = form.querySelector('#login-email-alert');
    const emailAlertText = form.querySelector('#login-email-alert-text');
    const quickSignupBtn = form.querySelector('#btn-quick-signup');

    if (quickSignupBtn) {
      quickSignupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showSignUpView(emailInput.value.trim());
      });
    }

    const checkEnteredEmail = async () => {
      const val = emailInput.value.trim().toLowerCase();
      if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        if (emailAlert) emailAlert.style.display = 'none';
        return;
      }
      const active = auth.getCurrentUser();
      if (active && (active.email || '').toLowerCase() === val) {
        if (emailAlert) emailAlert.style.display = 'none';
        return;
      }
      const localMatches = (store.getAllMembers ? store.getAllMembers() : []).some(m => (m.email || '').toLowerCase() === val);
      if (localMatches) {
        if (emailAlert) emailAlert.style.display = 'none';
        return;
      }
      try {
        const check = await auth.checkMemberExists(val);
        if (!check.exists && !check.isMember) {
          if (emailAlert) {
            emailAlert.style.display = 'block';
            if (emailAlertText) emailAlertText.textContent = 'This email is not registered as a member.';
            if (window.lucide) window.lucide.createIcons({ root: emailAlert });
          }
        } else {
          if (emailAlert) emailAlert.style.display = 'none';
        }
      } catch (_) {
        if (emailAlert) emailAlert.style.display = 'none';
      }
    };

    emailInput.addEventListener('blur', checkEnteredEmail);
    emailInput.addEventListener('input', () => {
      if (emailAlert && emailAlert.style.display !== 'none') {
        emailAlert.style.display = 'none';
      }
    });

    // Forgot password trigger
    form.querySelector('#btn-forgot-password-link').addEventListener('click', () => {
      const currentEmail = form.querySelector('#login-email').value;
      openForgotPasswordModal(currentEmail);
    });

    // Password visibility toggle
    const toggleBtn = form.querySelector('#btn-toggle-password');
    const passInput = form.querySelector('#login-password');
    let passVisible = false;
    toggleBtn.addEventListener('click', () => {
      passVisible = !passVisible;
      passInput.type = passVisible ? 'text' : 'password';
      toggleBtn.innerHTML = passVisible 
        ? '<i data-lucide="eye-off" style="width: 16px; height: 16px;"></i>'
        : '<i data-lucide="eye" style="width: 16px; height: 16px;"></i>';
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ root: toggleBtn });
      }
    });

    // Submit handler
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.querySelector('#login-email').value.trim();
      const password = form.querySelector('#login-password').value;
      const submitBtn = form.querySelector('#btn-submit-login');

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>Verifying credentials...</span>';
        }
        const user = await auth.login(email, password);
        const role = auth.getCurrentRole();
        const name = user.fullName || user.name || 'User';
        const roleLabel = role === 'admin' ? 'Studio Administrator' : (role === 'partner' ? 'Physicq 57 Coach' : (role === 'trainer' ? 'Studio Trainer' : 'Member'));
        showToast(`Welcome back, ${name} (${roleLabel}).`, 'success');
        window.location.hash = auth.getDefaultRoute();
      } catch (err) {
        showToast(err.message || 'Login failed. Please check credentials.', 'error');
        if (err.message && err.message.toLowerCase().includes('not registered')) {
          if (emailAlert) {
            emailAlert.style.display = 'block';
            if (emailAlertText) emailAlertText.textContent = 'This email is not registered as a member.';
            if (window.lucide) window.lucide.createIcons({ root: emailAlert });
          }
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Sign In to Studio</span><i data-lucide="arrow-right" style="width: 16px; height: 16px; margin-left: 8px;"></i>';
          if (window.lucide) window.lucide.createIcons({ root: submitBtn });
        }
      }
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: formCol });
    }
  }

  // --- RENDER SIGN UP VIEW (IN-PLACE, NO REDIRECTION) ---
  function showSignUpView(initialEmail = '') {
    clearChildren(formCol);
    formCol.style.animation = 'fadeIn 0.25s ease-out';

    // Header
    const header = createElement('div', { style: 'margin-bottom: var(--space-4);' });
    header.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3);">
        <img src="assets/images/plash-logo-horizontal.png" alt="Plash Pilates Logo" style="height: 38px; width: auto; max-width: 220px; object-fit: contain; display: block;" />
        <div class="auth-portal-badge" style="margin-bottom: 0; font-style: normal;">STUDIO MEMBERSHIP</div>
      </div>
      <h1 class="auth-form-title" style="font-style: normal; font-size: 22px;">
        Create Your Studio Account
      </h1>
      <p class="auth-form-sub" style="font-style: normal; margin-bottom: var(--space-4); font-size: 13px;">
        Join Bengaluru's premier boutique reformer, sculpt yoga, and barre sanctuary.
      </p>
    `;
    formCol.appendChild(header);

    // Active session switcher banner if already authenticated in this browser
    if (auth.isAuthenticated()) {
      const activeUser = auth.getCurrentUser() || {};
      const activeName = activeUser.fullName || activeUser.name || 'User';
      const activeEmail = activeUser.email || '';
      const switchBanner = createElement('div', {
        className: 'auth-active-session-banner',
        style: 'background: rgba(184, 115, 87, 0.08); border: 1px solid rgba(184, 115, 87, 0.25); border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 10px;'
      });
      switchBanner.innerHTML = `
        <div style="min-width: 0;">
          <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--rust); letter-spacing: 0.5px; margin-bottom: 2px;">
            Active Session in Browser
          </div>
          <div style="font-size: 12.5px; color: var(--ink); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            Signed in as <strong>${activeName}</strong>${activeEmail ? ` (${activeEmail})` : ''}
          </div>
        </div>
        <button type="button" class="btn-switch-signout btn btn-outline" style="font-size: 11.5px; height: 30px; padding: 0 10px; white-space: nowrap; border-color: var(--rust); color: var(--rust); font-weight: 600;">
          Switch Account
        </button>
      `;
      switchBanner.querySelector('.btn-switch-signout').addEventListener('click', (e) => {
        e.preventDefault();
        auth.logout();
        showSignUpView();
        showToast('Signed out cleanly. Please register your new membership.', 'info');
      });
      formCol.appendChild(switchBanner);
    }

    // Form
    const form = createElement('form', { className: 'auth-signup-form' });
    form.innerHTML = `
      <div class="form-group" style="margin-bottom: var(--space-3);">
        <label class="form-label" for="signup-name" style="font-size: 12.5px; font-weight: 600; color: var(--ink); margin-bottom: 4px;">
          Full Legal Name *
        </label>
        <input 
          type="text" 
          id="signup-name" 
          class="form-input" 
          required 
          autocomplete="name"
          placeholder="e.g. Priya Sharma"
          style="width: 100%; height: 40px; font-size: 13.5px;"
        />
      </div>

      <div style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: var(--space-3); margin-bottom: var(--space-3);">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for="signup-email" style="font-size: 12.5px; font-weight: 600; color: var(--ink); margin-bottom: 4px;">
            Email Address *
          </label>
          <input 
            type="email" 
            id="signup-email" 
            class="form-input" 
            required 
            autocomplete="email"
            placeholder="name@domain.com"
            style="width: 100%; height: 40px; font-size: 13.5px;"
          />
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for="signup-phone" style="font-size: 12.5px; font-weight: 600; color: var(--ink); margin-bottom: 4px;">
            Phone Number *
          </label>
          <input 
            type="tel" 
            id="signup-phone" 
            class="form-input" 
            required 
            autocomplete="tel"
            placeholder="10-digit number"
            style="width: 100%; height: 40px; font-size: 13.5px;"
          />
        </div>
      </div>

      <div class="form-group" style="margin-bottom: var(--space-3);">
        <label class="form-label" for="signup-level" style="font-size: 12.5px; font-weight: 600; color: var(--ink); margin-bottom: 4px;">
          Initial Movement Experience
        </label>
        <select id="signup-level" class="form-input" style="width: 100%; height: 40px; font-size: 13px;">
          <option value="Beginner">Beginner (New to Reformer / Apparatus)</option>
          <option value="Intermediate" selected>Intermediate (Familiar with springs & alignment)</option>
          <option value="Advanced">Advanced (High precision athlete / dancer)</option>
        </select>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-3);">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for="signup-password" style="font-size: 12.5px; font-weight: 600; color: var(--ink); margin-bottom: 4px;">
            Password *
          </label>
          <div style="position: relative;">
            <input 
              type="password" 
              id="signup-password" 
              class="form-input" 
              required 
              placeholder="Min 6 chars"
              style="width: 100%; height: 40px; font-size: 13.5px; padding-right: 36px;"
            />
            <button 
              type="button" 
              id="btn-toggle-signup-password" 
              aria-label="Toggle password visibility" 
              style="position: absolute; right: 6px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--taupe); padding: 5px; display: flex; align-items: center; justify-content: center;"
            >
              <i data-lucide="eye" style="width: 15px; height: 15px;"></i>
            </button>
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for="signup-confirm-password" style="font-size: 12.5px; font-weight: 600; color: var(--ink); margin-bottom: 4px;">
            Confirm Password *
          </label>
          <div style="position: relative;">
            <input 
              type="password" 
              id="signup-confirm-password" 
              class="form-input" 
              required 
              placeholder="Repeat password"
              style="width: 100%; height: 40px; font-size: 13.5px; padding-right: 36px;"
            />
            <button 
              type="button" 
              id="btn-toggle-signup-confirm" 
              aria-label="Toggle confirm password visibility" 
              style="position: absolute; right: 6px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--taupe); padding: 5px; display: flex; align-items: center; justify-content: center;"
            >
              <i data-lucide="eye" style="width: 15px; height: 15px;"></i>
            </button>
          </div>
        </div>

        <!-- Inline Password Error Alert -->
        <div id="signup-password-error" style="display: none; grid-column: span 2; color: #dc2626; font-size: 12px; font-weight: 600; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 6px 10px; margin-top: 2px;"></div>
        <div id="signup-password-hint" style="grid-column: span 2; font-size: 11px; color: var(--taupe); margin-top: 2px; line-height: 1.35;">
          Must contain: min 6 chars, 1 uppercase (A-Z), 1 number (0-9), and 1 special character (!@#$%&*).
        </div>
      </div>

      <!-- Statutory Consent Checkbox with Modal Triggers -->
      <div class="form-group" style="margin-bottom: var(--space-4);">
        <label style="display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: var(--ink); cursor: pointer; line-height: 1.45;">
          <input type="checkbox" id="signup-waiver" required style="accent-color: var(--rust); margin-top: 2px; width: 15px; height: 15px;" />
          <span>
            I accept the Plash Pilates <button type="button" id="btn-open-terms" style="color: var(--rust); font-weight: 700; background: none; border: none; padding: 0; cursor: pointer; font-size: inherit; text-decoration: underline;">Terms & Conditions</button>, studio 1:6 ratio rules, and consent to processing under the <button type="button" id="btn-open-privacy" style="color: var(--rust); font-weight: 700; background: none; border: none; padding: 0; cursor: pointer; font-size: inherit; text-decoration: underline;">DPDPA Privacy Policy</button>.
          </span>
        </label>
      </div>

      <button type="submit" id="btn-submit-signup" class="btn btn-primary" style="width: 100%; justify-content: center; height: 46px; font-size: 14.5px; font-weight: 700;">
        Create Studio Membership
      </button>
    `;
    formCol.appendChild(form);

    if (initialEmail) {
      const emailField = form.querySelector('#signup-email');
      if (emailField) emailField.value = initialEmail;
    }

    // In-Place Switcher to Sign In
    const switchBox = createElement('div', {
      className: 'auth-form-footer'
    });
    switchBox.innerHTML = `
      Already have a studio account? 
      <button type="button" id="btn-switch-to-signin" style="background: none; border: none; padding: 0; margin-left: 4px; color: var(--rust); font-weight: 700; cursor: pointer; font-family: inherit; font-size: inherit;">
        Sign In
      </button>
    `;
    formCol.appendChild(switchBox);

    // Wire up in-place switch to sign in
    switchBox.querySelector('#btn-switch-to-signin').addEventListener('click', (e) => {
      e.preventDefault();
      showSignInView();
    });

    // Wire up Privacy Policy modal popup
    form.querySelector('#btn-open-privacy').addEventListener('click', (e) => {
      e.preventDefault();
      openPrivacyPolicyModal();
    });

    // Wire up Terms modal popup
    form.querySelector('#btn-open-terms').addEventListener('click', (e) => {
      e.preventDefault();
      openTermsModal();
    });

    // Submit handler
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = form.querySelector('#signup-name').value.trim();
      const email = form.querySelector('#signup-email').value.trim();
      const phone = form.querySelector('#signup-phone').value.trim();
      const movementLevel = form.querySelector('#signup-level').value;
      const p1 = form.querySelector('#signup-password').value;
      const p2 = form.querySelector('#signup-confirm-password').value;

      const errBox = form.querySelector('#signup-password-error');
      if (errBox) {
        errBox.style.display = 'none';
        errBox.textContent = '';
      }

      // Check password complexity rules
      const passValidation = auth.validatePassword(p1);
      if (!passValidation.valid) {
        if (errBox) {
          errBox.textContent = passValidation.error;
          errBox.style.display = 'block';
        }
        showToast(passValidation.error, 'error');
        form.querySelector('#signup-password').focus();
        return;
      }

      // Check password match
      if (p1 !== p2) {
        if (errBox) {
          errBox.textContent = 'Passwords do not match.';
          errBox.style.display = 'block';
        }
        showToast('Passwords do not match.', 'error');
        form.querySelector('#signup-confirm-password').focus();
        return;
      }

      const submitBtn = form.querySelector('#btn-submit-signup');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Dispatching Activation Code...</span>';
      }

      const signupData = {
        fullName,
        email,
        phone,
        movementLevel,
        password: p1
      };

      try {
        await auth.requestSignupOtp(signupData);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create Studio Membership';
        }
        showToast(`6-digit activation code dispatched to ${email}.`, 'success');

        openSignupOtpModal({
          email,
          signupData,
          onVerified: (member) => {
            showToast(`Welcome to Plash Pilates, ${member.fullName}! Your membership is active.`, 'success');
            window.location.hash = '#/portal/dashboard';
          }
        });
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create Studio Membership';
        }
        showToast(err.message || 'Registration failed.', 'error');
      }
    });

    const passInput = form.querySelector('#signup-password');
    const confirmInput = form.querySelector('#signup-confirm-password');
    const errBox = form.querySelector('#signup-password-error');

    if (passInput) {
      passInput.addEventListener('input', () => {
        if (errBox && errBox.style.display === 'block') {
          const check = auth.validatePassword(passInput.value);
          if (check.valid) {
            errBox.style.display = 'none';
            errBox.textContent = '';
          } else {
            errBox.textContent = check.error;
          }
        }
      });
    }

    if (confirmInput) {
      confirmInput.addEventListener('input', () => {
        if (errBox && errBox.textContent === 'Passwords do not match.') {
          if (confirmInput.value === passInput.value) {
            errBox.style.display = 'none';
            errBox.textContent = '';
          }
        }
      });
    }

    // Visibility toggles for signup password fields
    const togglePassBtn = form.querySelector('#btn-toggle-signup-password');
    let passVisible = false;
    if (togglePassBtn) {
      togglePassBtn.addEventListener('click', () => {
        passVisible = !passVisible;
        passInput.type = passVisible ? 'text' : 'password';
        togglePassBtn.innerHTML = passVisible 
          ? '<i data-lucide="eye-off" style="width: 15px; height: 15px;"></i>'
          : '<i data-lucide="eye" style="width: 15px; height: 15px;"></i>';
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons({ root: togglePassBtn });
        }
      });
    }

    const toggleConfirmBtn = form.querySelector('#btn-toggle-signup-confirm');
    let confirmVisible = false;
    if (toggleConfirmBtn) {
      toggleConfirmBtn.addEventListener('click', () => {
        confirmVisible = !confirmVisible;
        confirmInput.type = confirmVisible ? 'text' : 'password';
        toggleConfirmBtn.innerHTML = confirmVisible 
          ? '<i data-lucide="eye-off" style="width: 15px; height: 15px;"></i>'
          : '<i data-lucide="eye" style="width: 15px; height: 15px;"></i>';
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons({ root: toggleConfirmBtn });
        }
      });
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: formCol });
    }
  }
}

/**
 * Open Privacy Policy in a small scrollable popup modal without page redirection.
 */
function openPrivacyPolicyModal() {
  const modalContainer = createElement('div', {
    style: 'max-height: 60vh; overflow-y: auto; padding-right: 8px; font-size: 13px; line-height: 1.65; color: var(--ink); font-family: "Nunito Sans", sans-serif;'
  });

  modalContainer.innerHTML = `
    <div style="background: var(--cream); border: 1px solid var(--beige); border-radius: var(--radius-sm); padding: 12px 14px; margin-bottom: 16px; font-size: 12px; color: var(--ink);">
      <strong>Effective Date:</strong> April 2026 | <strong>Compliance:</strong> India Digital Personal Data Protection Act (DPDPA 2023)
    </div>

    <h4 style="font-weight: 700; color: var(--ink); margin: 0 0 6px 0; font-size: 14px;">1. Data Fiduciary & Identity</h4>
    <p style="margin: 0 0 12px 0;">
      This policy governs <strong>Plash Pilates Studio LLP</strong>, Sadashiva Nagar, Bengaluru 560080. We act as the statutory Data Fiduciary under DPDPA 2023.
    </p>

    <h4 style="font-weight: 700; color: var(--ink); margin: 0 0 6px 0; font-size: 14px;">2. Personal & Health Data Collected</h4>
    <p style="margin: 0 0 6px 0;">
      We collect identity data (name, email, phone) and sensitive physical health assessments (movement experience, spinal/joint history, injuries) strictly for:
    </p>
    <ul style="padding-left: 20px; margin: 0 0 12px 0;">
      <li>Calibrating apparatus spring resistance and ensuring injury prevention during 1:6 coaching sessions.</li>
      <li>Verifying account ownership and booking class slots.</li>
    </ul>

    <h4 style="font-weight: 700; color: var(--ink); margin: 0 0 6px 0; font-size: 14px;">3. Confidentiality & Third Parties</h4>
    <p style="margin: 0 0 12px 0;">
      We never sell or trade your data. Health records are isolated. Only when you reserve a Physicq 57 Barre session are relevant instructor approvals coordinated with verified partner coaches.
    </p>

    <h4 style="font-weight: 700; color: var(--ink); margin: 0 0 6px 0; font-size: 14px;">4. Data Principal Rights</h4>
    <p style="margin: 0 0 6px 0;">
      Under DPDPA 2023, you have the right to summary access, instant JSON export, data correction, and account erasure at any time via your Security tab or by emailing <strong>privacy@plashpilates.com</strong>.
    </p>
  `;

  const closeBtn = createElement('button', {
    type: 'button',
    className: 'btn btn-primary',
    style: 'padding: 8px 24px; font-size: 13px; font-weight: 700; cursor: pointer;',
    text: 'I Understand & Close'
  });
  closeBtn.addEventListener('click', () => {
    closeModal();
  });

  openModal({
    title: 'DPDPA Privacy Policy',
    content: modalContainer,
    maxWidth: '560px',
    actions: [closeBtn]
  });
}

/**
 * Open Terms & Conditions in a small scrollable popup modal without page redirection.
 */
function openTermsModal() {
  const modalContainer = createElement('div', {
    style: 'max-height: 60vh; overflow-y: auto; padding-right: 8px; font-size: 13px; line-height: 1.65; color: var(--ink); font-family: "Nunito Sans", sans-serif;'
  });

  modalContainer.innerHTML = `
    <div style="background: var(--cream); border: 1px solid var(--beige); border-radius: var(--radius-sm); padding: 12px 14px; margin-bottom: 16px; font-size: 12px; color: var(--ink);">
      <strong>Studio Terms:</strong> Plash Pilates Studio LLP, Sadashiva Nagar • Bengaluru
    </div>

    <h4 style="font-weight: 700; color: var(--ink); margin: 0 0 6px 0; font-size: 14px;">1. Strict 1:6 Coaching Ratio</h4>
    <p style="margin: 0 0 12px 0;">
      To preserve premium quality and safety, all group classes are strictly capped at maximum 6 members per instructor.
    </p>

    <h4 style="font-weight: 700; color: var(--ink); margin: 0 0 6px 0; font-size: 14px;">2. Cancellation Policy</h4>
    <p style="margin: 0 0 12px 0;">
      Cancellations must be made at least 12 hours before class start for morning sessions (< 12:00 PM) and 6 hours before class start for evening sessions (>= 12:00 PM) to restore session credits. Late cancellations and no-shows forfeit that session credit.
    </p>

    <h4 style="font-weight: 700; color: var(--ink); margin: 0 0 6px 0; font-size: 14px;">3. Grip Socks & Studio Etiquette</h4>
    <p style="margin: 0 0 12px 0;">
      Grip socks are mandatory on all Reformer and apparatus equipment. Please arrive 10 minutes before class.
    </p>
  `;

  const closeBtn = createElement('button', {
    type: 'button',
    className: 'btn btn-primary',
    style: 'padding: 8px 24px; font-size: 13px; font-weight: 700; cursor: pointer;',
    text: 'Close'
  });
  closeBtn.addEventListener('click', () => {
    closeModal();
  });

  openModal({
    title: 'Terms & Conditions',
    content: modalContainer,
    maxWidth: '560px',
    actions: [closeBtn]
  });
}
