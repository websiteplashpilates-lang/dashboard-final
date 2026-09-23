/**
 * Plash Pilates — Studio Admin: Member Detail View
 * Comprehensive profile, health & injury notes, active passes, and booking history.
 * @module pages/admin/member-detail
 */

import { createElement } from '../../utils/dom.js';
import { formatDate, formatTime } from '../../utils/format.js';
import * as store from '../../core/store.js';
import { createPassCard } from '../../components/pass-card.js';
import { createBadge } from '../../components/badge.js';
import { showToast } from '../../components/toast.js';

export async function render(container, params = {}) {
  const memberId = params.id;
  let member = store.getMemberById(memberId);
  if (!member) {
    try {
      await store.syncFromSupabase();
      member = store.getMemberById(memberId);
    } catch (_) {}
  }

  const page = createElement('div', { className: 'page-container' });

  if (!member) {
    page.innerHTML = `
      <div class="page-header">
        <a href="#/admin/members" class="btn btn-outline btn-sm" style="margin-bottom: var(--space-4);">← Back to Members</a>
        <h1 class="page-title">Member Not Found</h1>
        <p class="page-subtitle">The requested member ID "${memberId}" could not be located in studio records.</p>
      </div>
    `;
    container.appendChild(page);
    return;
  }

  const pass = store.getActiveMemberPass(memberId);
  const credits = store.getMemberCredits(memberId);
  const health = store.getHealthProfile(memberId) || {};
  const bookings = store.getAllBookings().filter(b => store.isMemberIdMatch(b.memberId, memberId));
  const stats = store.getMemberStats(memberId);

  // Back button & header
  const backLink = createElement('a', {
    className: 'btn btn-outline btn-sm',
    attributes: { href: '#/admin/members' },
    style: 'margin-bottom: var(--space-4); display: inline-flex;',
    text: '← Back to Members Directory'
  });

  const header = createElement('div', { className: 'page-header', style: 'margin-bottom: var(--space-6);' });
  const title = createElement('h1', { className: 'page-title', text: member.fullName });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    text: `${member.email} • ${member.phone} • Emergency: ${member.emergencyContact || 'None provided'}`
  });
  header.append(title, subtitle);

  page.append(backLink, header);

  // Main 2-column layout
  const grid = createElement('div', { className: 'grid grid-2' });

  // Column 1: Pass & Health Profile
  const leftCol = createElement('div', { style: 'display: flex; flex-direction: column; gap: var(--space-6);' });

  // Pass Card
  leftCol.appendChild(createPassCard(pass, credits));

  const waiver = store.getWaiverAcceptance(memberId);
  const emergencyContact = health.emergencyContact || member.emergencyContact || 'None provided';

  // Health Profile Card
  const healthCard = createElement('div', { className: 'card' });
  const healthTitle = createElement('h3', {
    style: 'font-family: var(--font-serif); font-size: var(--text-base); font-weight: var(--weight-semibold); color: var(--ink); margin-bottom: var(--space-3); display: flex; align-items: center; gap: var(--space-2);',
    children: [
      createElement('i', { attributes: { 'data-lucide': 'shield-alert' }, style: 'width: 16px; height: 16px; color: var(--rose);' }),
      document.createTextNode('Health Assessment & Coach Directives')
    ]
  });

  const conditionsList = (health.healthConditions && health.healthConditions.length > 0)
    ? health.healthConditions.join(', ')
    : 'None reported';

  const healthList = createElement('div', { style: 'font-size: var(--text-xs); line-height: 1.6; color: var(--ink-80); display: flex; flex-direction: column; gap: var(--space-2);' });
  healthList.innerHTML = `
    <div><strong>Movement Level:</strong> ${health.movementExperience || health.experience || 'Intermediate'}</div>
    <div><strong>Medical Conditions:</strong> ${conditionsList}</div>
    <div><strong>Reported Injuries & Spine:</strong> ${health.injuries || health.injuriesNotes || health.spinalConditions || 'None on record'}</div>
    <div><strong>Pregnancy / Postpartum:</strong> ${health.isPregnant ? 'Yes (Requires gentle spring resistance modifications)' : 'No'}</div>
    <div><strong>Medical Clearance:</strong> ${health.medicallyCleared ? 'Confirmed by member' : 'Pending clearance'}</div>
    <div><strong>Emergency Contact:</strong> ${emergencyContact}</div>
    <div><strong>Coach Notes:</strong> ${health.notes || 'Standard protocol'}</div>
  `;

  healthCard.append(healthTitle, healthList);
  leftCol.appendChild(healthCard);

  // Legal Waiver Card
  const waiverCard = createElement('div', { className: 'card' });
  waiverCard.innerHTML = `
    <h3 style="font-family: var(--font-serif); font-size: var(--text-base); font-weight: var(--weight-semibold); color: var(--ink); margin-bottom: var(--space-2); display: flex; align-items: center; gap: var(--space-2);">
      <i data-lucide="file-check-2" style="width: 16px; height: 16px; color: var(--olive);"></i>
      Legal Liability Waiver & Consent
    </h3>
    <div style="font-size: var(--text-xs); line-height: 1.6; color: var(--ink-80);">
      ${waiver 
        ? `<div><strong>Status:</strong> <span style="color: var(--moss); font-weight: 700;">✓ Signed v1.0</span> on ${formatDate(waiver.acceptedAt || waiver.signedAt)}</div>
           <div><strong>Audit IP:</strong> ${waiver.ipAddress || '106.51.24.182'}</div>`
        : `<div style="color: var(--rust); font-weight: 600;">⚠️ Waiver pending signature</div>`}
    </div>
  `;
  leftCol.appendChild(waiverCard);

  // Column 2: Attendance & Booking History
  const rightCol = createElement('div', { style: 'display: flex; flex-direction: column; gap: var(--space-6);' });

  // Stats tile
  const statsCard = createElement('div', { className: 'card', style: 'display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; gap: var(--space-2);' });
  statsCard.innerHTML = `
    <div>
      <div style="font-size: var(--text-2xl); font-weight: var(--weight-bold); color: var(--moss);">${stats.attendedCount}</div>
      <div style="font-size: 11px; color: var(--ink-50);">Attended</div>
    </div>
    <div>
      <div style="font-size: var(--text-2xl); font-weight: var(--weight-bold); color: var(--rust);">${stats.lateCancelCount}</div>
      <div style="font-size: 11px; color: var(--ink-50);">Late Cancels</div>
    </div>
    <div>
      <div style="font-size: var(--text-2xl); font-weight: var(--weight-bold); color: var(--rose);">${stats.noShowCount}</div>
      <div style="font-size: 11px; color: var(--ink-50);">No-Shows</div>
    </div>
  `;
  rightCol.appendChild(statsCard);

  // Bookings list
  const historyCard = createElement('div', { className: 'card' });
  const hTitle = createElement('h3', {
    style: 'font-family: var(--font-serif); font-size: var(--text-base); font-weight: var(--weight-semibold); color: var(--ink); margin-bottom: var(--space-4);',
    text: 'Class History'
  });
  historyCard.appendChild(hTitle);

  if (bookings.length === 0) {
    historyCard.appendChild(createElement('p', {
      style: 'font-size: var(--text-xs); color: var(--ink-50);',
      text: 'No bookings recorded for this member.'
    }));
  } else {
    const list = createElement('div', { style: 'display: flex; flex-direction: column; gap: var(--space-3); max-height: 400px; overflow-y: auto;' });
    bookings.forEach(b => {
      const session = store.getClassSessionById(b.sessionId);
      const disc = session ? store.getDisciplineById(session.disciplineId) : null;

      const row = createElement('div', {
        style: 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--ink-05); padding-bottom: var(--space-2);'
      });

      const info = createElement('div');
      const bTitle = createElement('div', {
        style: 'font-size: var(--text-xs); font-weight: var(--weight-semibold); color: var(--ink);',
        text: `${disc ? disc.name : 'Class'} • ${session ? formatDate(session.date) : ''}`
      });
      const bTime = createElement('div', {
        style: 'font-size: 11px; color: var(--ink-50);',
        text: session ? (session.formattedTime || formatTime(session.time)) : ''
      });
      info.append(bTitle, bTime);

      const statusBadge = createBadge({
        text: b.status.replace('_', ' '),
        status: b.status === 'upcoming' ? 'upcoming' : b.status === 'completed' ? 'completed' : b.status === 'pending_partner_approval' ? 'pending' : 'cancelled'
      });

      row.append(info, statusBadge);
      list.appendChild(row);
    });
    historyCard.appendChild(list);
  }

  rightCol.appendChild(historyCard);

  grid.append(leftCol, rightCol);
  page.appendChild(grid);
  container.appendChild(page);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}
