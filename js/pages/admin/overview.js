/**
 * Plash Pilates — Studio Admin: Overview Dashboard
 * KPIs, live studio apparatus utilization, revenue, pending partner requests, and schedule preview.
 * @module pages/admin/overview
 */

import { createElement } from '../../utils/dom.js';
import { formatCurrency, formatDate, formatTime } from '../../utils/format.js';
import * as store from '../../core/store.js';
import { createStatCard } from '../../components/stat-card.js';
import { createChartBar } from '../../components/chart-bar.js';
import { createBadge } from '../../components/badge.js';
import { openForgotPasswordModal } from '../../components/forgot-password-modal.js';
import * as auth from '../../core/auth.js';

export async function render(container) {
  const stats = store.getOverviewStats();
  const partnerRequests = store.getBarreBookingRequests();

  const page = createElement('div', { className: 'page-container' });

  // Page header
  const header = createElement('div', {
    className: 'page-header',
    style: 'display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-4);'
  });

  const titleGroup = createElement('div');
  const title = createElement('h1', { className: 'page-title', text: 'Studio Overview' });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    text: 'Sadashiva Nagar studio performance, apparatus utilization, and partner operations.'
  });
  titleGroup.append(title, subtitle);

  const resetPassBtn = createElement('button', {
    className: 'btn btn-outline btn-sm',
    attributes: { type: 'button', title: 'Forgot or Reset Admin Password' },
    text: 'Reset Password'
  });
  resetPassBtn.prepend(createElement('i', { attributes: { 'data-lucide': 'key-round' }, style: 'width: 14px; height: 14px; margin-right: 6px;' }));
  resetPassBtn.addEventListener('click', () => {
    const user = auth.getCurrentUser();
    openForgotPasswordModal(user ? user.email : '');
  });

  header.append(titleGroup, resetPassBtn);
  page.appendChild(header);

  // 1. KPI Cards
  const statsGrid = createElement('div', { className: 'grid grid-4', style: 'margin-bottom: var(--space-8);' });

  const activeStat = createStatCard({
    label: 'Active Memberships',
    value: stats.activeMembers,
    detail: 'Enrolled & paying passes'
  });

  const sessionStat = createStatCard({
    label: 'Weekly Sessions',
    value: stats.sessionsThisWeek || store.getAllClassSessions().length,
    detail: '1:6 ratio capped'
  });

  const utilStat = createStatCard({
    label: 'Studio Utilization',
    value: `${stats.utilization}%`,
    detail: 'Reformer & Barre beds'
  });

  const revStat = createStatCard({
    label: 'Monthly Revenue',
    value: formatCurrency(stats.monthlyRevenue || 185000),
    detail: 'Net package activations'
  });

  statsGrid.append(activeStat, sessionStat, utilStat, revStat);
  page.appendChild(statsGrid);

  // 2. Urgent Attention Alerts (Partner Requests)
  if (partnerRequests.length > 0) {
    const alertBox = createElement('div', {
      style: 'background: white; border: 1px solid var(--rust); border-left: 4px solid var(--rust); border-radius: var(--radius-sm); padding: var(--space-4) var(--space-6); margin-bottom: var(--space-8); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-4);'
    });

    const alertInfo = createElement('div');
    const aTitle = createElement('div', {
      style: 'font-weight: var(--weight-bold); font-size: var(--text-sm); color: var(--ink); margin-bottom: 2px;',
      text: 'Action Required'
    });
    const aText = createElement('div', {
      style: 'font-size: var(--text-xs); color: var(--ink-80);',
      text: `${partnerRequests.length} Barre booking reservation(s) awaiting Physicq 57 certified partner coach review.`
    });
    alertInfo.append(aTitle, aText);

    const alertLinks = createElement('div', { style: 'display: flex; gap: var(--space-2);' }, [
      createElement('a', { className: 'btn btn-primary btn-sm', attributes: { href: '#/partner/requests' }, text: 'Review Partner Requests' })
    ]);

    alertBox.append(alertInfo, alertLinks);
    page.appendChild(alertBox);
  }

  // 3. Grid: Utilization Breakdown + Upcoming Schedule
  const grid = createElement('div', { className: 'grid grid-2' });

  // Utilization widget
  const disciplines = store.getDisciplines();
  const chartItems = disciplines.map(d => {
    const sessions = store.getAllClassSessions().filter(s => s.disciplineId === d.id);
    const total = sessions.reduce((acc, s) => acc + s.capacity, 0);
    const filled = sessions.reduce((acc, s) => acc + (s.capacity - s.spotsRemaining), 0);
    const pct = total > 0 ? Math.round((filled / total) * 100) : 65;
    return {
      label: d.name,
      value: pct,
      displayValue: `${pct}% booked`,
      color: d.name.includes('Pilates') ? 'var(--rust)' : d.name.includes('Barre') ? 'var(--olive)' : 'var(--moss)'
    };
  });

  const chart = createChartBar({
    title: 'Discipline Utilization (Current Week)',
    items: chartItems,
    maxValue: 100
  });
  grid.appendChild(chart);

  // Today's Upcoming Sessions List
  const schedCard = createElement('div', { className: 'card' });
  const schedHeader = createElement('div', { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);' });
  const schedTitle = createElement('h3', {
    style: 'font-family: var(--font-serif); font-size: var(--text-base); font-weight: var(--weight-semibold); color: var(--ink); margin: 0;',
    text: "Upcoming Classes"
  });
  const viewAllLink = createElement('a', {
    className: 'btn btn-outline btn-sm',
    attributes: { href: '#/admin/schedule' },
    text: 'Manage Schedule'
  });
  schedHeader.append(schedTitle, viewAllLink);
  schedCard.appendChild(schedHeader);

  const upcomingList = createElement('div', { style: 'display: flex; flex-direction: column; gap: var(--space-3);' });
  const sessions = store.getAllClassSessions().slice(0, 4);

  sessions.forEach(s => {
    const disc = store.getDisciplineById(s.disciplineId);
    const trainer = store.getTrainerById(s.trainerId);
    const filled = s.capacity - s.spotsRemaining;

    const row = createElement('div', {
      style: 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--ink-05); padding-bottom: var(--space-3);'
    });

    const info = createElement('div');
    const tEl = createElement('div', {
      style: 'font-size: var(--text-xs); font-weight: var(--weight-semibold); color: var(--ink);',
      text: `${disc ? disc.name : 'Class'} • ${formatTime(`2026-01-01T${s.time}`)}`
    });
    const subEl = createElement('div', {
      style: 'font-size: 11px; color: var(--ink-50);',
      text: `Trainer: ${trainer ? trainer.name : 'Coach'} • ${s.date}`
    });
    info.append(tEl, subEl);

    const capBadge = createBadge({
      text: `${filled}/${s.capacity} spots`,
      status: s.spotsRemaining === 0 ? 'full' : s.spotsRemaining <= 2 ? 'pending' : 'active'
    });

    row.append(info, capBadge);
    upcomingList.appendChild(row);
  });

  schedCard.appendChild(upcomingList);
  grid.appendChild(schedCard);

  page.appendChild(grid);
  container.appendChild(page);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}
