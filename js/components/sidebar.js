/**
 * Plash Pilates — Sidebar Component
 * Renders role-specific navigation, active route highlighting, user profile, and mobile bottom bar.
 * @module sidebar
 */

import { createElement, clearChildren } from '../utils/dom.js';
import * as auth from '../core/auth.js';
import * as store from '../core/store.js';
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
  logo.innerHTML = '<img src="assets/images/plash-logo-horizontal.png" alt="Plash Pilates Logo" style="height: 34px; width: auto; max-width: 210px; object-fit: contain; display: block;" />';

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

  // 4. Update mobile bottom navigation
  renderMobileNav(navGroups, currentHash);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: sidebarEl });
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
