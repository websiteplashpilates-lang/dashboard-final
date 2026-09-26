/**
 * Plash Pilates — Sidebar Component
 * Renders role-specific navigation, active route highlighting, user profile, and mobile bottom bar.
 * @module sidebar
 */

import { createElement, clearChildren, escapeHtml } from '../utils/dom.js';
import * as auth from '../core/auth.js';
import * as store from '../core/store.js';
import * as cart from '../core/cart.js';
import { events, EVENT } from '../core/events.js';
import { openForgotPasswordModal } from './forgot-password-modal.js';

const NAV_CONFIG = {
  member: [
    {
      group: 'Studio Experience',
      items: [
        { label: 'Dashboard', hash: '#/portal/dashboard', icon: 'layout-dashboard' },
        { label: 'Book a Class', hash: '#/portal/book', icon: 'calendar-plus' },
        { label: 'My Bookings', hash: '#/portal/bookings', icon: 'calendar-check' },
        { label: 'Packages & Passes', hash: '#/portal/packages', icon: 'credit-card' },
        { label: 'Cart & Checkout', hash: '#/portal/cart', icon: 'shopping-bag' },
      ]
    },
    {
      group: 'Account & Safety',
      items: [
        { label: 'Payment History', hash: '#/portal/payments', icon: 'receipt' },
        { label: 'Profile', hash: '#/portal/profile', icon: 'user' },
      ]
    }
  ],
  admin: [
    {
      group: 'Studio Management',
      items: [
        { label: 'Overview', hash: '#/admin/overview', icon: 'layout-dashboard' },
        { label: 'Members & Health', hash: '#/admin/members', icon: 'users' },
        { label: 'Registered Leads', hash: '#/admin/prospects', icon: 'user-plus' },
        { label: 'Class Schedule', hash: '#/admin/schedule', icon: 'calendar' },
        { label: 'All Bookings', hash: '#/admin/bookings', icon: 'list-checks' },
        { label: 'Physicq 57 Reviews', hash: '#/admin/partner-approvals', icon: 'shield-check' },
      ]
    },
    {
      group: 'Finance & Compliance',
      items: [
        { label: 'Payments & Invoices', hash: '#/admin/payments', icon: 'credit-card' },
        { label: 'Declined Refunds', hash: '#/admin/refunds', icon: 'rotate-ccw' },
        { label: 'Packages & Pricing', hash: '#/admin/packages', icon: 'tag' },
      ]
    },
    {
      group: 'Audit & System',
      items: [
        { label: 'Activity Logs', hash: '#/admin/activity-logs', icon: 'activity' },
      ]
    }
  ],
  trainer: [
    {
      group: 'Trainer Portal',
      items: [
        { label: 'Trainers Dashboard', hash: '#/trainer/dashboard', icon: 'layout-dashboard' },
      ]
    }
  ],
  partner: [
    {
      group: 'Physicq 57 Portal',
      items: [
        { label: 'Booking Requests', hash: '#/partner/requests', icon: 'bell' },
        { label: 'Barre Roster', hash: '#/partner/roster', icon: 'users' },
        { label: 'Barre Schedule', hash: '#/partner/schedule', icon: 'calendar' },
      ]
    }
  ]
};

/**
 * Render the sidebar and mobile bottom navigation based on current auth role.
 * @param {HTMLElement} sidebarEl - Sidebar aside container
 */
export function renderSidebar(sidebarEl) {
  clearChildren(sidebarEl);
  sidebarEl.className = 'sidebar';
  sidebarEl.style.display = '';

  const role = auth.getCurrentRole();
  const navGroups = NAV_CONFIG[role] || NAV_CONFIG.member;
  const currentHash = window.location.hash || auth.getDefaultRoute();

  // 1. Header
  const header = createElement('div', { className: 'sidebar-header' });
  const logo = createElement('div', { className: 'sidebar-logo' });
  logo.innerHTML = '<img src="assets/images/plash-logo-horizontal-light.png" alt="Plash Pilates Logo" style="height: 34px; width: auto; max-width: 210px; object-fit: contain; display: block;" onerror="this.src=\'assets/images/plash-logo-horizontal.png\'" />';

  let subText = 'Boutique Reformer & Barre';
  if (role === 'admin') subText = 'Studio Administration';
  if (role === 'partner') subText = 'Partner Portal • Physicq 57';

  const subtitle = createElement('div', {
    className: 'sidebar-subtitle',
    text: subText
  });

  header.append(logo, subtitle);
  sidebarEl.appendChild(header);

  // 2. Navigation
  const nav = createElement('nav', { className: 'sidebar-nav', attributes: { 'aria-label': 'Sidebar Navigation' } });

  navGroups.forEach(grp => {
    const groupEl = createElement('div', { className: 'sidebar-nav-group' });

    if (grp.group) {
      const labelEl = createElement('div', {
        className: 'sidebar-nav-group-label',
        text: grp.group
      });
      groupEl.appendChild(labelEl);
    }

    grp.items.forEach(item => {
      const isActive = currentHash.startsWith(item.hash);
      const link = createElement('a', {
        className: `sidebar-nav-item ${isActive ? 'active' : ''}`,
        attributes: {
          href: item.hash,
          'aria-current': isActive ? 'page' : 'false'
        }
      });

      const icon = createElement('i', {
        className: 'sidebar-nav-item-icon',
        attributes: { 'data-lucide': item.icon }
      });

      const span = createElement('span', { text: item.label });

      // Badge for partner requests or pause requests
      if (item.hash === '#/partner/requests') {
        const pendingCount = store.getBarreBookingRequests().length;
        if (pendingCount > 0) {
          const badge = createElement('span', {
            className: 'badge badge-pending',
            style: 'margin-left: auto; font-size: 11px;',
            text: String(pendingCount)
          });
          link.append(icon, span, badge);
          groupEl.appendChild(link);
          return;
        }
      }

      link.append(icon, span);
      groupEl.appendChild(link);
    });

    nav.appendChild(groupEl);
  });

  sidebarEl.appendChild(nav);

  // 3. User footer
  const user = auth.getCurrentUser();
  const userFooter = createElement('div', { className: 'sidebar-footer' });
  const userBox = createElement('div', { className: 'sidebar-user' });

  let initials = 'PP';
  let displayName = 'User';
  let roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  if (user) {
    const rawName = user.fullName || user.name || '';
    if (rawName) {
      displayName = rawName;
      const parts = rawName.trim().split(/\s+/);
      initials = (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
    } else if (user.email) {
      displayName = user.email.split('@')[0];
      initials = displayName.slice(0, 2).toUpperCase();
    }
  }

  const avatar = createElement('div', {
    className: 'sidebar-user-avatar',
    text: initials
  });

  const userInfo = createElement('div', { className: 'sidebar-user-info' });
  const nameEl = createElement('div', { 
    className: 'sidebar-user-name', 
    text: displayName,
    attributes: { title: displayName }
  });

  const metaRow = createElement('div', { className: 'sidebar-user-meta' });
  const roleEl = createElement('div', { className: 'sidebar-user-role', text: roleLabel });

  // Quick Account Actions: Reset Password & Log Out
  const actionsGroup = createElement('div', { className: 'sidebar-user-actions' });

  const resetPassBtn = createElement('button', {
    className: 'sidebar-action-btn',
    attributes: {
      type: 'button',
      title: 'Reset / Change Password',
      'aria-label': 'Reset / Change Password'
    }
  });
  resetPassBtn.innerHTML = '<i data-lucide="key-round" style="width: 16px; height: 16px;"></i>';
  resetPassBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openForgotPasswordModal(user ? user.email : '');
  });

  const logoutBtn = createElement('button', {
    className: 'sidebar-action-btn logout',
    attributes: {
      type: 'button',
      title: 'Sign Out of Studio',
      'aria-label': 'Sign Out of Studio'
    }
  });
  logoutBtn.innerHTML = '<i data-lucide="log-out" style="width: 16px; height: 16px;"></i>';
  logoutBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    auth.logout();
  });

  actionsGroup.append(resetPassBtn, logoutBtn);
  metaRow.append(roleEl, actionsGroup);
  userInfo.append(nameEl, metaRow);

  userBox.append(avatar, userInfo);
  userFooter.appendChild(userBox);
  sidebarEl.appendChild(userFooter);

  // 4. Update mobile header & bottom navigation
  renderMobileHeader(currentHash, role, user);
  renderMobileNav(navGroups, currentHash);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: sidebarEl });
  }
}

/**
 * Render sticky top mobile header with studio logo and account actions.
 * @param {string} currentHash
 * @param {string} role
 * @param {Object} user
 */
export function renderMobileHeader(currentHash, role, user) {
  let mobileHeader = document.getElementById('mobile-header');
  if (!mobileHeader) {
    const mainEl = document.getElementById('main-content');
    if (mainEl && mainEl.parentNode) {
      mobileHeader = createElement('header', {
        id: 'mobile-header',
        className: 'mobile-header',
        attributes: { role: 'banner' }
      });
      mainEl.parentNode.insertBefore(mobileHeader, mainEl);
    }
  }
  if (!mobileHeader) return;

  const isAuth = auth.isAuthenticated();
  const curHash = window.location.hash || '';
  const isAuthPage = !curHash || curHash === '#/' || curHash.startsWith('#/login') || curHash.startsWith('#/signup') || curHash.startsWith('#/reset-password') || curHash.startsWith('#/forgot-password');

  if (!isAuth || isAuthPage) {
    mobileHeader.style.display = 'none';
    clearChildren(mobileHeader);
    return;
  }

  mobileHeader.style.display = '';
  clearChildren(mobileHeader);

  // 1. Studio Logo Link (left)
  const defaultRoute = auth.getDefaultRoute();
  const logoLink = createElement('a', {
    className: 'mobile-header-logo',
    attributes: { href: defaultRoute, title: 'Plash Pilates Home' }
  });
  logoLink.innerHTML = `<img src="assets/images/plash-logo-horizontal-light.png" alt="Plash Pilates Logo" style="height: 28px; width: auto; max-width: 170px; object-fit: contain; display: block;" onerror="this.src='assets/images/plash-logo-horizontal.png'" />`;

  // 2. Right Action Group: Cart & User Avatar
  const actionsGroup = createElement('div', { className: 'mobile-header-actions' });

  // Quick Cart Button (for member role)
  if (role === 'member') {
    const pkg = cart.getCartPackage();
    const cartLink = createElement('a', {
      className: `mobile-header-btn ${currentHash.startsWith('#/portal/cart') ? 'active' : ''}`,
      attributes: { href: '#/portal/cart', title: 'View Cart & Checkout', 'aria-label': 'Cart' }
    });
    cartLink.innerHTML = `
      <i data-lucide="shopping-bag" style="width: 17px; height: 17px;"></i>
      ${pkg ? `<span class="mobile-cart-badge">1</span>` : ''}
    `;
    actionsGroup.appendChild(cartLink);
  }

  // User Avatar & Account Menu
  let initials = 'PP';
  let displayName = 'User';
  let roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Member';

  if (user) {
    const rawName = user.fullName || user.name || '';
    if (rawName) {
      displayName = rawName;
      const parts = rawName.trim().split(/\s+/);
      initials = (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
    } else if (user.email) {
      displayName = user.email.split('@')[0];
      initials = displayName.slice(0, 2).toUpperCase();
    }
  }

  const avatarBtn = createElement('button', {
    className: 'mobile-user-avatar-btn',
    attributes: {
      type: 'button',
      id: 'mobile-user-avatar-btn',
      title: `${displayName} (${roleLabel})`,
      'aria-label': 'Account Menu',
      'aria-expanded': 'false'
    },
    text: initials
  });

  // Mobile User Dropdown
  const dropdown = createElement('div', {
    className: 'mobile-user-dropdown',
    id: 'mobile-user-dropdown',
    style: 'display: none;'
  });

  dropdown.innerHTML = `
    <div class="mobile-dropdown-header">
      <div class="mobile-dropdown-name">${escapeHtml(displayName)}</div>
      <div class="mobile-dropdown-meta">${user && user.email ? escapeHtml(user.email) : ''} • <strong style="color: var(--rust-light, #e07a5f); text-transform: capitalize;">${roleLabel}</strong></div>
    </div>
    <div class="mobile-dropdown-links">
      ${role === 'member' ? `
        <a href="#/portal/profile" class="mobile-dropdown-link"><i data-lucide="user" style="width: 15px; height: 15px;"></i> My Profile</a>
        <a href="#/portal/bookings" class="mobile-dropdown-link"><i data-lucide="calendar-check" style="width: 15px; height: 15px;"></i> My Bookings</a>
        <a href="#/portal/payments" class="mobile-dropdown-link"><i data-lucide="receipt" style="width: 15px; height: 15px;"></i> Payment History & Invoices</a>
      ` : ''}
      ${role === 'admin' ? `
        <a href="#/admin/overview" class="mobile-dropdown-link"><i data-lucide="layout-dashboard" style="width: 15px; height: 15px;"></i> Admin Overview</a>
        <a href="#/admin/members" class="mobile-dropdown-link"><i data-lucide="users" style="width: 15px; height: 15px;"></i> Member Directory</a>
        <a href="#/admin/activity-logs" class="mobile-dropdown-link"><i data-lucide="activity" style="width: 15px; height: 15px;"></i> Activity Logs</a>
      ` : ''}
      ${role === 'trainer' ? `
        <a href="#/trainer/dashboard" class="mobile-dropdown-link"><i data-lucide="layout-dashboard" style="width: 15px; height: 15px;"></i> Trainer Dashboard</a>
      ` : ''}
      ${role === 'partner' ? `
        <a href="#/partner/requests" class="mobile-dropdown-link"><i data-lucide="bell" style="width: 15px; height: 15px;"></i> Booking Requests</a>
        <a href="#/partner/schedule" class="mobile-dropdown-link"><i data-lucide="calendar" style="width: 15px; height: 15px;"></i> Barre Schedule</a>
      ` : ''}
      <button type="button" class="mobile-dropdown-btn" id="mobile-btn-reset-pass">
        <i data-lucide="key-round" style="width: 15px; height: 15px;"></i> Reset Password
      </button>
      <button type="button" class="mobile-dropdown-btn logout" id="mobile-btn-logout">
        <i data-lucide="log-out" style="width: 15px; height: 15px;"></i> Sign Out
      </button>
    </div>
  `;

  // Toggle Dropdown
  const closeDropdown = () => {
    dropdown.style.display = 'none';
    avatarBtn.setAttribute('aria-expanded', 'false');
  };

  avatarBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.style.display === 'flex';
    dropdown.style.display = isOpen ? 'none' : 'flex';
    avatarBtn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    if (!isOpen && window.lucide) {
      window.lucide.createIcons({ root: dropdown });
    }
  });

  // Handle dropdown actions
  const resetBtn = dropdown.querySelector('#mobile-btn-reset-pass');
  if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDropdown();
      openForgotPasswordModal(user ? user.email : '');
    });
  }

  const logoutBtn = dropdown.querySelector('#mobile-btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDropdown();
      auth.logout();
    });
  }

  dropdown.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => closeDropdown());
  });

  document.addEventListener('click', (e) => {
    if (!mobileHeader.contains(e.target)) {
      closeDropdown();
    }
  });

  actionsGroup.append(avatarBtn, dropdown);
  mobileHeader.append(logoLink, actionsGroup);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: mobileHeader });
  }
}

function renderMobileNav(navGroups, currentHash) {
  let mobileNav = document.getElementById('mobile-nav');
  if (!mobileNav) {
    mobileNav = createElement('nav', {
      id: 'mobile-nav',
      className: 'mobile-nav',
      attributes: { 'aria-label': 'Mobile Navigation' }
    });
    document.body.appendChild(mobileNav);
  }

  clearChildren(mobileNav);
  const itemsContainer = createElement('div', { className: 'mobile-nav-items' });

  // Take top 4-5 items across groups
  const allItems = [];
  navGroups.forEach(grp => grp.items.forEach(item => allItems.push(item)));
  const mobileItems = allItems.slice(0, 5);

  mobileItems.forEach(item => {
    const isActive = currentHash.startsWith(item.hash);
    const link = createElement('a', {
      className: `mobile-nav-item ${isActive ? 'active' : ''}`,
      attributes: {
        href: item.hash,
        'aria-current': isActive ? 'page' : 'false'
      }
    });

    const icon = createElement('i', {
      className: 'mobile-nav-item-icon',
      attributes: { 'data-lucide': item.icon }
    });

    const label = createElement('span', { text: item.label });
    link.append(icon, label);
    itemsContainer.appendChild(link);
  });

  mobileNav.appendChild(itemsContainer);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: mobileNav });
  }
}

// Live update mobile header cart indicator on cart changes
events.on('cart:updated', () => {
  const role = auth.getCurrentRole();
  const user = auth.getCurrentUser();
  const currentHash = window.location.hash || '';
  renderMobileHeader(currentHash, role, user);
});

