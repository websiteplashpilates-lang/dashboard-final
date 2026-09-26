/**
 * Plash Pilates — Router
 * Hash-based SPA router with transitions and route guards.
 * @module router
 */

import { events, EVENT } from './events.js';
import * as auth from './auth.js';

/** @type {Map<string, Function>} */
const routes = new Map();
let currentRoute = '';
let mainContainer = null;
let currentNavToken = 0;

/**
 * Register a route.
 * @param {string} path - Hash path e.g. '#/portal/dashboard'
 * @param {Function} renderFn - async (container, params) => void
 */
export function addRoute(path, renderFn) {
  routes.set(path, renderFn);
}

/**
 * Initialize the router.
 * @param {HTMLElement} container - Main content container
 */
export function init(container) {
  mainContainer = container;
  window.addEventListener('hashchange', handleRouteChange);
  handleRouteChange();
}

/**
 * Navigate to a route.
 * @param {string} hash
 */
export function navigate(hash) {
  window.location.hash = hash;
}

/**
 * Get current route path.
 * @returns {string}
 */
export function getCurrentRoute() {
  return currentRoute;
}

/**
 * Extract params from a dynamic route.
 * @param {string} pattern - e.g. '#/admin/members/:id'
 * @param {string} hash - e.g. '#/admin/members/member-001'
 * @returns {Object|null}
 */
function matchRoute(pattern, hash) {
  const patternParts = pattern.replace('#/', '').split('/');
  const hashParts = hash.replace('#/', '').split('/');
  if (patternParts.length !== hashParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = hashParts[i];
    } else if (patternParts[i] !== hashParts[i]) {
      return null;
    }
  }
  return params;
}

/**
 * Find matching route and extract params.
 * @param {string} hash
 * @returns {{ renderFn: Function, params: Object }|null}
 */
function findRoute(hash) {
  // Strip query string, secondary fragments, and trailing slashes for route matching
  const cleanPath = (hash || '').split('?')[0].split('&')[0].replace(/\/+$/, '') || hash;

  // Exact match first
  if (routes.has(cleanPath)) {
    return { renderFn: routes.get(cleanPath), params: {} };
  }
  if (routes.has(hash)) {
    return { renderFn: routes.get(hash), params: {} };
  }
  if (cleanPath === '#reset-password' && routes.has('#/reset-password')) {
    return { renderFn: routes.get('#/reset-password'), params: {} };
  }
  // Fallback: any recovery token or auth error URL maps to reset-password view
  if (
    cleanPath.includes('access_token=') || 
    cleanPath.includes('type=recovery') || 
    cleanPath.includes('error_description=') || 
    cleanPath.includes('error_code=')
  ) {
    if (routes.has('#/reset-password')) {
      return { renderFn: routes.get('#/reset-password'), params: {} };
    }
  }
  // Dynamic route match
  for (const [pattern, renderFn] of routes) {
    const params = matchRoute(pattern, cleanPath) || matchRoute(pattern, hash);
    if (params) return { renderFn, params };
  }
  return null;
}

/**
 * Handle hash change event.
 */
async function handleRouteChange() {
  const navToken = ++currentNavToken;
  const currentHash = window.location.hash || '';
  const search = window.location.search || '';
  const combinedFragment = currentHash + '&' + search;
  let hash = currentHash;

  // 1. Intercept incoming Supabase Auth recovery tokens or auth codes
  // Supabase redirects with #access_token=...&type=recovery or ?code=... or ?token=...
  if (
    combinedFragment.includes('type=recovery') || 
    search.includes('code=') ||
    (currentHash.includes('access_token=') && !currentHash.startsWith('#/portal') && !currentHash.startsWith('#/admin'))
  ) {
    if (!currentHash.startsWith('#/reset-password')) {
      if (typeof auth.isAuthenticated === 'function' && auth.isAuthenticated()) {
        try { auth.logout(); } catch (_) {}
      }
      const fragment = currentHash.replace(/^#\/?/, '');
      const searchParams = search.startsWith('?') ? search.slice(1) : search;
      const combined = [fragment, searchParams].filter(Boolean).join('&');
      hash = `#/reset-password?${combined}`;
      window.location.hash = hash;
    }
  }

  // 2. Intercept incoming Supabase Auth error callbacks (e.g. expired recovery link)
  if (combinedFragment.includes('error_description=') || combinedFragment.includes('error_code=')) {
    if (!currentHash.startsWith('#/reset-password') && !currentHash.startsWith('#/login')) {
      const fragment = currentHash.replace(/^#\/?/, '');
      const searchParams = search.startsWith('?') ? search.slice(1) : search;
      const combined = [fragment, searchParams].filter(Boolean).join('&');
      hash = `#/reset-password?${combined}`;
      window.location.hash = hash;
    }
  }

  if (!hash) {
    hash = auth.getDefaultRoute();
  }

  // Check 30-minute idle session timeout
  if (typeof auth.checkSessionInactivity === 'function') {
    auth.checkSessionInactivity();
  }

  // Route guard
  if (!auth.isRouteAllowed(hash)) {
    if (!auth.isAuthenticated()) {
      window.location.hash = '#/login';
      return;
    }
    // Authenticated user lacks authorization for this role-restricted route
    window.location.hash = '#/403';
    return;
  }

  const match = findRoute(hash);
  if (!match) {
    if (hash !== '#/404') {
      window.location.hash = '#/404';
      return;
    }
    window.location.hash = auth.getDefaultRoute();
    return;
  }

  currentRoute = hash;

  // Transition out
  if (mainContainer.children.length > 0) {
    mainContainer.classList.add('page-transition-exit');
    await sleep(150);
    if (navToken !== currentNavToken) return;
  }

  // Clear and render
  mainContainer.innerHTML = '';
  mainContainer.classList.remove('page-transition-exit');
  mainContainer.classList.add('page-transition-enter');

  try {
    await match.renderFn(mainContainer, match.params);
    if (navToken !== currentNavToken) return;
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: mainContainer });
    }
  } catch (err) {
    if (navToken !== currentNavToken) return;
    console.error('Route render error:', err);
    const serverErr = findRoute('#/500');
    if (serverErr) {
      await serverErr.renderFn(mainContainer, { message: err.message });
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ root: mainContainer });
      }
    } else {
      mainContainer.innerHTML = `<div class="page-container"><h2>Something went wrong</h2><p class="text-muted">Unable to load this page. Please try again.</p></div>`;
    }
  }

  // Transition in
  requestAnimationFrame(() => {
    mainContainer.classList.remove('page-transition-enter');
    mainContainer.classList.add('page-transition-active');
    setTimeout(() => {
      mainContainer.classList.remove('page-transition-active');
    }, 200);
  });

  // Toggle sidebar/footer & centering layout for standalone pages (auth and error pages are completely standalone)
  const cleanPath = (hash || '').split('?')[0].split('&')[0];
  const isStandalonePage = 
    cleanPath.startsWith('#/login') || 
    cleanPath.startsWith('#/signup') || 
    cleanPath.startsWith('#/forgot-password') || 
    cleanPath.startsWith('#/reset-password') ||
    cleanPath.startsWith('#/404') ||
    cleanPath.startsWith('#/403') ||
    cleanPath.startsWith('#/500');

  const isTrainerDashboard = cleanPath.startsWith('#/trainer/dashboard');
  document.body.classList.toggle('auth-layout', isStandalonePage);
  document.documentElement.classList.toggle('auth-layout', isStandalonePage);
  document.body.classList.toggle('no-scroll', isTrainerDashboard);
  document.documentElement.classList.toggle('no-scroll', isTrainerDashboard);

  const sidebarEl = document.getElementById('sidebar');
  const footerEl = document.getElementById('app-footer');
  const mobileNav = document.getElementById('mobile-nav');

  if (sidebarEl) sidebarEl.style.display = isStandalonePage ? 'none' : '';
  if (footerEl) footerEl.style.display = (isStandalonePage || isTrainerDashboard) ? 'none' : '';
  if (mobileNav) mobileNav.style.display = isStandalonePage ? 'none' : '';
  if (mainContainer) {
    mainContainer.style.marginLeft = isStandalonePage ? '0' : '';
    mainContainer.classList.toggle('no-scroll', isTrainerDashboard);
  }

  // Update title
  const pageTitle = getPageTitle(hash);
  document.title = pageTitle ? `${pageTitle} | Plash Pilates` : 'Plash Pilates';

  // Scroll to top
  mainContainer.scrollTop = 0;
  window.scrollTo(0, 0);

  events.emit(EVENT.ROUTE_CHANGED, { route: hash, params: match.params });
}

/** @param {number} ms */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get page title from route hash.
 * @param {string} hash
 * @returns {string}
 */
function getPageTitle(hash) {
  const titles = {
    '#/login':            'Sign In',
    '#/signup':           'Create Account',
    '#/forgot-password':  'Reset Password',
    '#/reset-password':   'Set New Password',
    '#/portal/dashboard': 'Dashboard',
    '#/portal/book':      'Book a Class',
    '#/portal/bookings':  'My Bookings',
    '#/portal/packages':  'Packages & Payments',
    '#/portal/cart':      'Cart & Checkout',
    '#/portal/payments':  'Payment History',
    '#/portal/profile':   'Profile',
    '#/portal/security':  'Security',
    '#/admin/overview':      'Studio Overview',
    '#/admin/members':       'Members',
    '#/admin/prospects':     'Registered Leads',
    '#/admin/activity-logs': 'Activity Logs',
    '#/admin/schedule':      'Class Schedule',
    '#/admin/packages':      'Packages & Pricing',
    '#/admin/bookings':      'Bookings',
    '#/admin/payments':      'Payments & Invoices',
    '#/admin/partner-approvals': 'Physicq 57 Reviews',
    '#/admin/refunds':       'Partner Declines & Refunds',
    '#/trainer/dashboard': 'Trainers Dashboard',
    '#/partner/requests': 'Booking Requests',
    '#/partner/roster':   'Barre Roster',
    '#/partner/schedule': 'Barre Schedule',
    '#/legal/privacy':    'Privacy Policy',
    '#/legal/terms':      'Terms & Conditions',
    '#/legal/cookies':    'Cookie Policy',
  };
  // Check exact match
  if (titles[hash]) return titles[hash];
  // Check prefix matches for dynamic routes
  if (hash.startsWith('#/admin/members/')) return 'Member Detail';
  if (hash.startsWith('#/partner/members/')) return 'Member Detail';
  return '';
}
