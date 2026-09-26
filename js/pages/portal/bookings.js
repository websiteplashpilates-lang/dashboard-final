/**
 * Plash Pilates — Member Portal: My Bookings
 * Tabbed view of Upcoming and Past/Completed sessions.
 * @module pages/portal/bookings
 */

import { createElement, clearChildren } from '../../utils/dom.js';
import { formatDate, formatTime } from '../../utils/format.js';
import * as auth from '../../core/auth.js';
import * as store from '../../core/store.js';
import { createTabs } from '../../components/tabs.js';
import { createBadge } from '../../components/badge.js';
import { createEmptyState } from '../../components/empty-state.js';
import { showToast } from '../../components/toast.js';
import { openModal } from '../../components/modal.js';

export async function render(container) {
  const memberId = auth.getCurrentMemberId();
  const page = createElement('div', { className: 'page-container' });

  // Page header
  const header = createElement('div', {
    className: 'page-header',
    style: 'display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-4);'
  });
  const titleGroup = createElement('div');
  const title = createElement('h1', { className: 'page-title', text: 'My Bookings' });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    text: 'Review your upcoming reservations, attendance history, and cancellation policy.'
  });
  titleGroup.append(title, subtitle);

  const refreshBtn = createElement('button', {
    className: 'btn btn-outline btn-sm',
    attributes: { type: 'button' },
    text: 'Sync Bookings'
  });
  refreshBtn.prepend(createElement('i', { attributes: { 'data-lucide': 'refresh-cw' }, style: 'width: 14px; height: 14px; margin-right: 6px;' }));
  header.append(titleGroup, refreshBtn);
  page.appendChild(header);

  // Synchronize live bookings from Supabase
  try {
    await store.syncBookings(memberId);
  } catch (_) {}

  // Tabs container
  const upcomingContent = createElement('div');
  const pastContent = createElement('div');

  function refreshTabs() {
    renderUpcoming(upcomingContent, memberId, refreshTabs);
    renderPast(pastContent, memberId);
  }

  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    try {
      await store.syncBookings(memberId);
      refreshTabs();
      showToast('Bookings synced with studio database.', 'info');
    } catch (err) {
      showToast('Sync error: ' + err.message, 'error');
    } finally {
      refreshBtn.disabled = false;
    }
  });

  const tabs = createTabs([
    {
      id: 'upcoming',
      label: 'Upcoming Classes',
      content: upcomingContent,
      active: true
    },
    {
      id: 'past',
      label: 'Past & Attendance',
      content: pastContent
    }
  ]);

  refreshTabs();
  page.appendChild(tabs);
  container.appendChild(page);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}

function renderUpcoming(container, memberId, onUpdate) {
  clearChildren(container);
  const bookings = store.getUpcomingBookingsForMember(memberId);

  if (bookings.length === 0) {
    const empty = createEmptyState({
      icon: 'calendar',
      title: 'No upcoming bookings',
      description: 'You have no confirmed upcoming classes. Explore available spots to reserve your spot.',
      action: createElement('a', {
        className: 'btn btn-primary btn-sm',
        attributes: { href: '#/portal/book' },
        text: 'Book a Class'
      })
    });
    container.appendChild(empty);
    return;
  }

  const list = createElement('div', { style: 'display: flex; flex-direction: column; gap: var(--space-4);' });

  bookings.forEach(b => {
    const session = b.session || {};
    const disc = store.getDisciplineById(session.disciplineId || session.discipline_id);

    const card = createElement('div', {
      className: 'card',
      style: 'display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap;'
    });

    const info = createElement('div', { style: 'display: flex; gap: var(--space-4); align-items: center;' });

    const sDate = session.startsAt ? new Date(session.startsAt) : (session.date && session.time ? new Date(`${session.date}T${session.time}`) : new Date());
    const dateBadge = createElement('div', {
      style: 'background: var(--rust-10); color: var(--rust); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-4); text-align: center; min-width: 65px;'
    });
    dateBadge.innerHTML = `<div style="font-size: var(--text-lg); font-weight: var(--weight-bold); line-height: 1;">${sDate.getDate()}</div><div style="font-size: 10px; font-weight: var(--weight-semibold);">${sDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</div>`;

    const details = createElement('div');
    const titleEl = createElement('h3', {
      style: 'font-size: var(--text-base); font-weight: var(--weight-semibold); color: var(--ink); margin-bottom: 2px;',
      text: `${disc ? disc.name : (session.title || 'Studio Class')}`
    });

    const timeStr = session.time || formatTime(sDate);
    const metaEl = createElement('div', {
      style: 'font-size: var(--text-xs); color: var(--ink-50); margin-bottom: var(--space-1);',
      text: `${formatDate(session.date || sDate.toISOString().slice(0, 10))} • ${timeStr} • Sadashiva Nagar Studio`
    });

    // Cancellation window badge
    const cutoffHours = store.getCancellationWindowHours(session);
    const sessionType = cutoffHours === 12 ? 'Morning (12h cutoff)' : 'Evening (6h cutoff)';
    const policyEl = createElement('div', {
      style: 'font-size: 11px; color: var(--rust-dark); font-weight: var(--weight-medium);',
      text: `Cancellation Policy: Free cancellation up to ${cutoffHours}h before start (${sessionType})`
    });

    details.append(titleEl, metaEl, policyEl);
    info.append(dateBadge, details);

    const actions = createElement('div', { style: 'display: flex; align-items: center; gap: var(--space-3);' });
    actions.appendChild(createBadge({ text: 'Confirmed Spot', status: 'active', showDot: true }));

    const cancelBtn = createElement('button', {
      className: 'btn btn-outline btn-sm',
      attributes: { type: 'button' },
      style: 'color: var(--rust); border-color: var(--rust);',
      text: 'Cancel Booking'
    });

    cancelBtn.addEventListener('click', async () => {
      // Validate cancellation policy window before prompting
      const now = new Date();
      const hoursUntil = (sDate.getTime() - now.getTime()) / 3600000;

      if (hoursUntil <= 0) {
        showToast('This class has already started or concluded and cannot be cancelled.', 'error');
        return;
      }

      if (hoursUntil < cutoffHours) {
        const dialogContent = createElement('div', { style: 'font-size: var(--text-sm); line-height: 1.6; color: var(--ink-80);' });
        dialogContent.innerHTML = `
          <p style="margin-bottom: var(--space-3); color: var(--rust); font-weight: var(--weight-bold);">Cancellation Window Closed</p>
          <p style="margin-bottom: var(--space-3);">Per studio policy, <strong>${sessionType}</strong> require at least <strong>${cutoffHours} hours notice</strong> to cancel and restore session credits.</p>
          <p>This class begins in <strong>${Math.max(0, hoursUntil).toFixed(1)} hours</strong>. As the cutoff has passed, this booking cannot be cancelled online.</p>
        `;
        const closeBtn = createElement('button', {
          className: 'btn btn-primary btn-sm',
          text: 'Understood'
        });
        const modal = openModal({
          title: 'Cancellation Notice',
          content: dialogContent,
          actions: [closeBtn]
        });
        closeBtn.addEventListener('click', () => modal.close());
        return;
      }

      // Confirmation dialog
      const confirmContent = createElement('div', { style: 'font-size: var(--text-sm); line-height: 1.6; color: var(--ink-80);' });
      confirmContent.innerHTML = `
        <p style="margin-bottom: var(--space-3);">Are you sure you want to cancel your booking for <strong>${disc ? disc.name : 'Class'}</strong> on <strong>${formatDate(session.date || sDate.toISOString().slice(0, 10))}</strong> at <strong>${timeStr}</strong>?</p>
        <p style="color: #2E5A44; font-weight: var(--weight-semibold);">✓ Your 1 session credit will be refunded back to your membership pass immediately.</p>
      `;

      const confirmBtn = createElement('button', {
        className: 'btn btn-outline btn-sm',
        style: 'color: var(--rust); border-color: var(--rust);',
        text: 'Confirm Cancellation'
      });

      const modal = openModal({
        title: 'Cancel Booking',
        content: confirmContent,
        actions: [confirmBtn]
      });

      confirmBtn.addEventListener('click', async () => {
        try {
          confirmBtn.disabled = true;
          confirmBtn.textContent = 'Cancelling...';
          await store.cancelBooking(b.id);
          await store.fetchMemberPasses(memberId).catch(() => {});
          modal.close();
          showToast('Booking cancelled. Session credit refunded.', 'info');
          onUpdate();
        } catch (err) {
          showToast(err.message, 'error');
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Confirm Cancellation';
        }
      });
    });

    actions.appendChild(cancelBtn);
    card.append(info, actions);
    list.appendChild(card);
  });

  container.appendChild(list);
}

function renderPast(container, memberId) {
  clearChildren(container);
  const past = store.getPastBookingsForMember(memberId);

  if (past.length === 0) {
    const empty = createEmptyState({
      icon: 'history',
      title: 'No past sessions recorded',
      description: 'Your completed, attended, and cancelled class history from Supabase will appear here.'
    });
    container.appendChild(empty);
    return;
  }

  const list = createElement('div', { style: 'display: flex; flex-direction: column; gap: var(--space-3);' });

  past.forEach(b => {
    const session = b.session || {};
    const disc = store.getDisciplineById(session.disciplineId || session.discipline_id);

    const card = createElement('div', {
      className: 'card',
      style: 'display: flex; align-items: center; justify-content: space-between; padding: var(--space-4); opacity: 0.9;'
    });

    const info = createElement('div');
    const sDate = session.startsAt ? new Date(session.startsAt) : (session.date && session.time ? new Date(`${session.date}T${session.time}`) : new Date(b.bookedAt));
    const timeStr = session.time || formatTime(sDate);

    const titleEl = createElement('div', {
      style: 'font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--ink);',
      text: `${disc ? disc.name : (session.title || 'Studio Class')} • ${formatDate(session.date || sDate.toISOString().slice(0, 10))} at ${timeStr}`
    });

    let subText = 'Sadashiva Nagar Studio';
    if (b.status === 'cancelled') {
      subText += ` · Cancelled on ${formatDate(b.cancelledAt || b.bookedAt)} (Credit refunded)`;
    } else if (b.status === 'no_show') {
      subText += b.creditWaived ? ' · No-show: Credit waived by trainer' : ' · No-show: Credit forfeited per studio policy';
    } else if (b.status === 'completed' || b.status === 'attended') {
      subText += ' · Completed and verified by trainer';
    }

    const trainerEl = createElement('div', {
      style: 'font-size: var(--text-xs); color: var(--ink-50); margin-top: 2px;',
      text: subText
    });
    info.append(titleEl, trainerEl);

    let badgeText = 'Attended';
    let badgeStatus = 'completed';

    if (b.status === 'completed' || b.status === 'attended') {
      badgeText = 'Attended';
      badgeStatus = 'completed';
    } else if (b.status === 'no_show') {
      badgeText = b.creditWaived ? 'No-Show (Waived)' : 'No-Show (Forfeited)';
      badgeStatus = b.creditWaived ? 'pending' : 'no-show';
    } else if (b.status === 'cancelled') {
      badgeText = 'Cancelled (Refunded)';
      badgeStatus = 'neutral';
    }

    const statusBadge = createBadge({
      text: badgeText,
      status: badgeStatus
    });

    card.append(info, statusBadge);
    list.appendChild(card);
  });

  container.appendChild(list);
}
