/**
 * Plash Pilates — Application Entry Point
 * Orchestrates SPA routing, role-based navigation, accessibility, and compliance managers.
 * @module app
 */

import * as router from './core/router.js';
import * as auth from './core/auth.js';
import * as store from './core/store.js';
import { loadEnvConfig } from './core/env-loader.js';
import { events, EVENT } from './core/events.js';
import { setupSkipNav } from './utils/accessibility.js';
import { renderSidebar } from './components/sidebar.js';
import { initCookieBanner } from './components/cookie-banner.js';
import { setupRealtimeSubscriptions, getSupabase } from './core/supabase.js';
import './components/toast.js'; // Registers toast event listeners

// Page imports — Authentication & Onboarding
import * as authLogin from './pages/auth/login.js?v=102';
import * as authSignup from './pages/auth/signup.js?v=102';
import * as authResetPassword from './pages/auth/reset-password.js?v=102';

// Page imports — Member Portal
import * as memberDashboard from './pages/portal/dashboard.js?v=75';
import * as memberBook from './pages/portal/book.js?v=117';
import * as memberBookings from './pages/portal/bookings.js?v=117';
import * as memberPackages from './pages/portal/packages.js';
import * as memberCart from './pages/portal/cart.js?v=75';
import * as memberPayments from './pages/portal/payments.js?v=205';
import * as memberProfile from './pages/portal/profile.js?v=104';

// Page imports — Studio Admin
import * as adminOverview from './pages/admin/overview.js';
import * as adminMembers from './pages/admin/members.js?v=107';
import * as adminProspects from './pages/admin/prospects.js?v=106';
import * as adminActivityLogs from './pages/admin/activity-logs.js';
import * as adminMemberDetail from './pages/admin/member-detail.js';
import * as adminSchedule from './pages/admin/schedule.js';
import * as adminPackages from './pages/admin/packages.js';
import * as adminBookings from './pages/admin/bookings.js?v=123';
import * as adminPayments from './pages/admin/payments.js';
import * as adminPartnerApprovals from './pages/admin/partner-approvals.js?v=108';
import * as adminRefunds from './pages/admin/refunds.js?v=215';

// Page imports — Trainer Portal
import * as trainerDashboard from './pages/trainer/dashboard.js?v=122';

// Page imports — Partner Portal (Physicq 57)
import * as partnerRequests from './pages/partner/booking-requests.js?v=215';
import * as partnerRoster from './pages/partner/roster.js';
import * as partnerMemberDetail from './pages/partner/member-detail.js';
import * as partnerSchedule from './pages/partner/schedule.js?v=215';

// Page imports — Legal & Compliance
import * as legalPrivacy from './pages/legal/privacy-policy.js';
import * as legalTerms from './pages/legal/terms.js';
import * as legalCookies from './pages/legal/cookie-policy.js';

// Page imports — Error & Status Pages
import * as errorNotFound from './pages/error/not-found.js';
import * as errorForbidden from './pages/error/forbidden.js';
import * as errorServerError from './pages/error/server-error.js';

/**
 * Register all application routes.
 */
function registerRoutes() {
  // Authentication & Password Recovery
  router.addRoute('#/login', authLogin.render);
  router.addRoute('#/signup', authLogin.render);
  router.addRoute('#/forgot-password', authLogin.render);
  router.addRoute('#/reset-password', authResetPassword.render);

  // Member Portal
  router.addRoute('#/portal/dashboard', memberDashboard.render);
  router.addRoute('#/portal/book', memberBook.render);
  router.addRoute('#/portal/bookings', memberBookings.render);
  router.addRoute('#/portal/packages', memberPackages.render);
  router.addRoute('#/portal/cart', memberCart.render);
  router.addRoute('#/portal/payments', memberPayments.render);
  router.addRoute('#/portal/profile', memberProfile.render);
  router.addRoute('#/portal/security', memberProfile.render);

  // Studio Admin
  router.addRoute('#/admin/overview', adminOverview.render);
  router.addRoute('#/admin/members', adminMembers.render);
  router.addRoute('#/admin/members/:id', adminMemberDetail.render);
  router.addRoute('#/admin/prospects', adminProspects.render);
  router.addRoute('#/admin/activity-logs', adminActivityLogs.render);
  router.addRoute('#/admin/schedule', adminSchedule.render);
  router.addRoute('#/admin/packages', adminPackages.render);
  router.addRoute('#/admin/bookings', adminBookings.render);
  router.addRoute('#/admin/payments', adminPayments.render);
  router.addRoute('#/admin/partner-approvals', adminPartnerApprovals.render);
  router.addRoute('#/admin/refunds', adminRefunds.render);

  // Trainer Portal
  router.addRoute('#/trainer/dashboard', trainerDashboard.render);

  // Partner Portal (Physicq 57)
  router.addRoute('#/partner/requests', partnerRequests.render);
  router.addRoute('#/partner/roster', partnerRoster.render);
  router.addRoute('#/partner/members/:id', partnerMemberDetail.render);
  router.addRoute('#/partner/schedule', partnerSchedule.render);

  // Legal Pages
  router.addRoute('#/legal/privacy', legalPrivacy.render);
  router.addRoute('#/legal/privacy-policy', legalPrivacy.render);
  router.addRoute('#/legal/terms', legalTerms.render);
  router.addRoute('#/legal/terms-and-conditions', legalTerms.render);
  router.addRoute('#/legal/cookies', legalCookies.render);
  router.addRoute('#/legal/cookie-policy', legalCookies.render);

  // Error & Status Pages (404 Not Found, 403 Forbidden, 500 System Recovery)
  router.addRoute('#/404', errorNotFound.render);
  router.addRoute('#/403', errorForbidden.render);
  router.addRoute('#/500', errorServerError.render);
}

/**
 * Render footer with privacy, terms, and cookie controls.
 */
function renderFooter() {
  const footerEl = document.getElementById('app-footer');
  if (!footerEl) return;

  footerEl.className = 'app-footer';
  footerEl.innerHTML = `
    <div class="footer-links">
      <span style="font-weight: 600; color: var(--ink-80);">Plash Pilates Bengaluru</span>
      <span class="footer-separator">•</span>
      <a href="#/legal/privacy" class="footer-link">Privacy Policy (DPDPA)</a>
      <span class="footer-separator">•</span>
      <a href="#/legal/terms" class="footer-link">Terms & Conditions</a>
      <span class="footer-separator">•</span>
      <a href="#/legal/cookies" class="footer-link">Cookie Policy</a>
      <span class="footer-separator">•</span>
      <button id="footer-cookie-trigger" class="footer-link" style="background: none; border: none; padding: 0; cursor: pointer; font-size: inherit; font-family: inherit;">Cookie Settings</button>
    </div>
    <div style="margin-top: var(--space-2); font-size: 11px; color: var(--ink-50);">
      Sadashiva Nagar / Vyalikaval, Bengaluru 560003 • 1:6 Coach-to-Member Ratio • Physicq 57 Barre Partner
    </div>
  `;

  const cookieBtn = footerEl.querySelector('#footer-cookie-trigger');
  if (cookieBtn) {
    cookieBtn.addEventListener('click', () => {
      initCookieBanner(true);
    });
  }
}

/**
 * Initialize the full application.
 */
async function initApp() {
  // Load dynamic .env config if available
  await loadEnvConfig();

  const sidebarEl = document.getElementById('sidebar');
  const mainEl = document.getElementById('main-content');

  setupSkipNav();
  registerRoutes();
  renderFooter();

  // Route guard & layout check BEFORE painting any UI (eliminates dashboard/sidebar flicker)
  const isAuth = auth.isAuthenticated();
  const curHash = window.location.hash || '';
  const isAuthPage = !curHash || curHash === '#/' || curHash.startsWith('#/login') || curHash.startsWith('#/signup') || curHash.startsWith('#/reset-password') || curHash.startsWith('#/forgot-password');

  if (!isAuth || isAuthPage) {
    document.body.classList.add('auth-layout');
    document.documentElement.classList.add('auth-layout');
    if (sidebarEl) sidebarEl.style.display = 'none';
    const mobileHeader = document.getElementById('mobile-header');
    if (mobileHeader) mobileHeader.style.display = 'none';
  } else if (sidebarEl) {
    document.body.classList.remove('auth-layout');
    document.documentElement.classList.remove('auth-layout');
    const mobileHeader = document.getElementById('mobile-header');
    if (mobileHeader) mobileHeader.style.display = '';
    renderSidebar(sidebarEl);
  }

  initCookieBanner(false);

  // Router init (starts listening to hash changes and renders initial view immediately)
  router.init(mainEl);

  // Re-render current view when live Supabase data arrives
  events.on(EVENT.DATA_MUTATED, (payload = {}) => {
    if (payload && payload.source === 'supabase_sync') {
      const curHash = window.location.hash;
      if (curHash) {
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
    }
  });

  // Background hydration & sync (never blocks initial auth paint)
  (async () => {
    const client = getSupabase();
    if (client && client.auth && typeof client.auth.getSession === 'function') {
      try {
        await client.auth.getSession();
      } catch (e) {
        console.warn('[Supabase auth session hydration]', e);
      }
    }

    await store.syncFromSupabase().catch(() => {});
    const currentUser = auth.getCurrentUser();
    if (currentUser && currentUser.email && auth.getCurrentRole() === 'member') {
      const allMems = typeof store.getAllMembers === 'function' ? store.getAllMembers() : (typeof store.getMembers === 'function' ? store.getMembers() : []);
      const liveMember = allMems.find(m => (m.email || '').toLowerCase() === currentUser.email.toLowerCase());
      if (liveMember && liveMember.id && liveMember.id !== auth.getCurrentMemberId()) {
        auth.syncMemberId(liveMember.id);
      }
    }
    const currentMemberId = auth.getCurrentMemberId();
    if (currentMemberId) {
      await store.fetchMemberPayments(currentMemberId).catch(() => {});
    }
  })();

  // Subscribe to live Postgres changes across all Supabase tables
  setupRealtimeSubscriptions(async () => {
    await store.syncFromSupabase();
    const mid = auth.getCurrentMemberId();
    if (mid) await store.fetchMemberPayments(mid).catch(() => {});
  });

  // Listen to role changes
  events.on(EVENT.AUTH_ROLE_CHANGED, () => {
    if (sidebarEl) renderSidebar(sidebarEl);
  });

  // Listen to member persona changes
  events.on(EVENT.AUTH_MEMBER_CHANGED, () => {
    if (sidebarEl) renderSidebar(sidebarEl);
    // Re-render current page (only if already on an internal page)
    const curHash = window.location.hash;
    if (curHash && !curHash.startsWith('#/login') && !curHash.startsWith('#/signup') && !curHash.startsWith('#/reset-password')) {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  });

  // Listen to route changes to update sidebar active highlight and layout
  events.on(EVENT.ROUTE_CHANGED, () => {
    const isNowAuth = auth.isAuthenticated();
    const curHash = window.location.hash || '';
    const isAuthRoute = !curHash || curHash === '#/' || curHash.startsWith('#/login') || curHash.startsWith('#/signup') || curHash.startsWith('#/reset-password') || curHash.startsWith('#/forgot-password');
    const mobileHeader = document.getElementById('mobile-header');

    if (!isNowAuth || isAuthRoute) {
      if (sidebarEl) sidebarEl.style.display = 'none';
      if (mobileHeader) mobileHeader.style.display = 'none';
    } else {
      if (sidebarEl) {
        sidebarEl.style.display = '';
        renderSidebar(sidebarEl);
      }
      if (mobileHeader) mobileHeader.style.display = '';
    }
  });

  // Re-render sidebar when database sync resolves profiles
  events.on(EVENT.DATA_MUTATED, () => {
    if (sidebarEl) renderSidebar(sidebarEl);
  });

  // Track user activity to manage 30-minute idle session timeout
  const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
  activityEvents.forEach(evt => {
    window.addEventListener(evt, () => {
      auth.recordUserActivity();
    }, { passive: true });
  });

  // Periodic check for 30-minute inactivity timeout (every 30 seconds)
  setInterval(() => {
    auth.checkSessionInactivity();
  }, 30000);

  // When user switches tabs or returns to window, immediately check session freshness
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      auth.checkSessionInactivity();
    }
  });
  window.addEventListener('focus', () => {
    auth.checkSessionInactivity();
  });
}

// Enterprise Global Error Boundary & Crash Telemetry (ISO 27001 Resilience)
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    console.error('[Plash Enterprise Error Boundary]', event.error || event.message);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Plash Enterprise Unhandled Rejection]', event.reason);
  });
}

// Boot on DOMContentLoaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}
