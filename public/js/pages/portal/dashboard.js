/**
 * Plash Pilates — Member Portal: Dashboard
 * Member overview, next upcoming session, remaining credits, and quick actions.
 * @module pages/portal/dashboard
 */

import { createElement } from '../../utils/dom.js';
import { formatDate, formatTime } from '../../utils/format.js';
import * as auth from '../../core/auth.js';
import * as store from '../../core/store.js';
import { createStatCard } from '../../components/stat-card.js';
import { createPassCard } from '../../components/pass-card.js?v=230';
import { createEmptyState } from '../../components/empty-state.js';
import { showToast } from '../../components/toast.js';
import { openForgotPasswordModal } from '../../components/forgot-password-modal.js';

export async function render(container) {
  const memberId = auth.getCurrentMemberId();

  if (memberId) {
    try {
      await Promise.all([
        store.fetchMemberPasses(memberId).catch(() => {}),
        store.syncBookings().catch(() => {}),
        store.syncClassSessions().catch(() => {})
      ]);
    } catch (_) {}
  }

  const member = store.resolveMember(memberId) || store.getMemberById(memberId);
  const pass = store.getActiveMemberPass(memberId);
  const credits = store.getMemberCredits(memberId);
  const upcomingBookings = store.getUpcomingBookingsForMember(memberId);
  const stats = store.getMemberStats(memberId);

  const page = createElement('div', { className: 'page-container' });

  // 1. Welcome header with Quick Password Reset Action
  const welcome = createElement('div', {
    className: 'dashboard-welcome',
    style: 'display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-4);'
  });
  const textGroup = createElement('div');
  const nameEl = createElement('h1', {
    className: 'dashboard-welcome-name',
    text: `Welcome back, ${member ? member.fullName.split(' ')[0] : 'Member'}`
  });
  const subEl = createElement('p', {
    className: 'dashboard-welcome-sub',
    text: pass ? `${pass.packageName} • ${pass.status === 'active' ? 'Active Membership' : 'Membership ' + pass.status}` : 'No active membership pass'
  });
  textGroup.append(nameEl, subEl);

  const headerActions = createElement('div', { style: 'display: flex; gap: var(--space-2); align-items: center;' });
  const resetPassBtn = createElement('button', {
    className: 'btn btn-outline btn-sm',
    attributes: { type: 'button', title: 'Forgot or Reset Account Password' },
    text: 'Reset Password'
  });
  resetPassBtn.prepend(createElement('i', { attributes: { 'data-lucide': 'key-round' }, style: 'width: 14px; height: 14px; margin-right: 6px;' }));
  resetPassBtn.addEventListener('click', () => {
    openForgotPasswordModal(member ? member.email : '');
  });
  headerActions.appendChild(resetPassBtn);

  welcome.append(textGroup, headerActions);
  page.appendChild(welcome);

  // 2. Stat KPIs
  const statsGrid = createElement('div', { className: 'grid grid-3 dashboard-stats' });

  const totalCreditsRemaining = credits.reduce((acc, c) => acc + c.remaining, 0);

  const creditsStat = createStatCard({
    label: 'Remaining Sessions',
    value: totalCreditsRemaining,
    detail: totalCreditsRemaining > 0 ? 'Available across active passes' : 'Purchase a pass to book'
  });

  const streakStat = createStatCard({
    label: 'Studio Consistency',
    value: `${stats.attendedCount} Classes`,
    detail: `${stats.streakWeeks} week active streak`
  });

  const attendanceStat = createStatCard({
    label: 'Booking Reliability',
    value: `${stats.attendanceRate}%`,
    detail: `${stats.lateCancelCount} late cancel, ${stats.noShowCount} no-show`
  });

  statsGrid.append(creditsStat, streakStat, attendanceStat);
  page.appendChild(statsGrid);

  // 3. Next Upcoming Session
  const nextSection = createElement('div', { className: 'dashboard-next-session content-section' });
  const nextHeader = createElement('div', { className: 'content-section-header' }, [
    createElement('h2', { className: 'content-section-title', text: 'Next Upcoming Session' })
  ]);
  nextSection.appendChild(nextHeader);

  if (upcomingBookings && upcomingBookings.length > 0) {
    const nextBooking = upcomingBookings[0];
    const session = nextBooking.session;
    const disc = store.getDisciplineById(session.disciplineId);
    const trainer = store.getTrainerById(session.trainerId);

    const card = createElement('div', { className: 'next-session-card' });

    const dateBox = createElement('div', { className: 'next-session-date' });
    const sessionDate = new Date(`${session.date}T${session.time}`);
    const dayNum = createElement('div', { className: 'next-session-date-day', text: String(sessionDate.getDate()) });
    const monthName = createElement('div', { className: 'next-session-date-month', text: sessionDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() });
    dateBox.append(dayNum, monthName);

    const info = createElement('div', { className: 'next-session-info' });
    const title = createElement('div', { className: 'next-session-title', text: `${disc ? disc.name : 'Pilates Session'} with ${trainer ? trainer.name : 'Coach'}` });
    const meta = createElement('div', { className: 'next-session-meta', text: `${formatTime(sessionDate)} • 60 Minutes • Bengaluru Studio` });
    info.append(title, meta);

    const actions = createElement('div', { style: 'display: flex; gap: var(--space-3);' });
    const cancelBtn = createElement('button', {
      className: 'btn btn-outline btn-sm',
      attributes: { type: 'button' },
      text: 'Cancel'
    });

    cancelBtn.addEventListener('click', async () => {
      try {
        await store.cancelBooking(nextBooking.id);
        showToast('Booking cancelled. Credit refunded to pass.', 'info');
        render(container);
      } catch (err) {
        showToast(err.message || 'Cannot cancel this booking', 'error');
      }
    });

    actions.appendChild(cancelBtn);
    card.append(dateBox, info, actions);
    nextSection.appendChild(card);
  } else {
    const empty = createEmptyState({
      icon: 'calendar',
      title: 'No upcoming classes scheduled',
      description: 'Book your spot in an upcoming Reformer, Sculpt Yoga, or Barre class to maintain your routine.',
      action: createElement('a', {
        className: 'btn btn-primary btn-sm',
        attributes: { href: '#/portal/book' },
        text: 'Explore Schedule & Book'
      })
    });
    nextSection.appendChild(empty);
  }
  page.appendChild(nextSection);

  // 4. Pass Overview & Quick Access
  const bottomGrid = createElement('div', { className: 'grid grid-2' });

  // Pass Card Column
  const passCol = createElement('div');
  const passHeader = createElement('div', { className: 'content-section-header' }, [
    createElement('h2', { className: 'content-section-title', text: 'Membership & Credits' })
  ]);
  passCol.append(passHeader, createPassCard(pass, credits));
  bottomGrid.appendChild(passCol);

  // Quick Actions & Studio Advisory
  const advisoryCol = createElement('div');
  const advHeader = createElement('div', { className: 'content-section-header' }, [
    createElement('h2', { className: 'content-section-title', text: 'Studio Etiquette & Booking' })
  ]);
  const advCard = createElement('div', {
    className: 'card',
    style: 'display: flex; flex-direction: column; gap: var(--space-4); justify-content: space-between;'
  });

  const advText = createElement('div', { style: 'font-size: var(--text-sm); line-height: 1.6; color: var(--ink-80);' });
  advText.innerHTML = `
    <p style="margin-bottom: var(--space-3);"><strong>1:6 Intimate Coaching Ratio:</strong> Every class is strictly capped at 6 spots for personalized attention and precise alignment coaching.</p>
    <p style="margin-bottom: var(--space-3);"><strong>Cancellation Policy:</strong> Cancel at least 12 hours before morning classes (< 12:00 PM) or 6 hours before evening classes (>= 12:00 PM) to retain your session credit. Late cancellations or no-shows forfeit the credit.</p>
    <p><strong>Physicq 57 Barre:</strong> All Barre reservations are reviewed by certified partner coaches to ensure readiness and safety.</p>
  `;

  const resetPassAction = createElement('button', {
    className: 'btn btn-outline btn-sm',
    attributes: { type: 'button' },
    text: 'Forgot / Reset Password'
  });
  resetPassAction.prepend(createElement('i', { attributes: { 'data-lucide': 'key-round' }, style: 'width: 14px; height: 14px; margin-right: 6px;' }));
  resetPassAction.addEventListener('click', () => {
    openForgotPasswordModal(member ? member.email : '');
  });

  const quickLinks = createElement('div', { style: 'display: flex; gap: var(--space-3); flex-wrap: wrap; margin-top: var(--space-2);' }, [
    createElement('a', { className: 'btn btn-primary btn-sm', attributes: { href: '#/portal/book' }, text: 'Book Next Session' }),
    createElement('a', { className: 'btn btn-outline btn-sm', attributes: { href: '#/portal/packages' }, text: 'Browse Packages' }),
    createElement('a', { className: 'btn btn-outline btn-sm', attributes: { href: '#/portal/cart' }, text: 'View Cart' }),
    resetPassAction,
  ]);

  advCard.append(advText, quickLinks);
  advisoryCol.append(advHeader, advCard);
  bottomGrid.appendChild(advisoryCol);

  page.appendChild(bottomGrid);
  container.appendChild(page);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}
