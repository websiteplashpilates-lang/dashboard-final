/**
 * Plash Pilates — Partner Portal: Member Detail (Physicq 57)
 * Strictly scoped member drilldown: returns 403 / Access Denied if member is not enrolled in Barre.
 * @module pages/partner/member-detail
 */

import { createElement } from '../../utils/dom.js';
import { formatDate, formatTime } from '../../utils/format.js';
import * as store from '../../core/store.js';
import { createBadge } from '../../components/badge.js';

export async function render(container, params = {}) {
  const memberId = params.id;
  const barreData = store.getBarreMemberDetail(memberId);

  const page = createElement('div', { className: 'page-container' });

  // Back button
  const backLink = createElement('a', {
    className: 'btn btn-outline btn-sm',
    attributes: { href: '#/partner/roster' },
    style: 'margin-bottom: var(--space-4); display: inline-flex;',
    text: '← Back to Barre Roster'
  });
  page.appendChild(backLink);

  // Security / Access Control Check
  if (!barreData) {
    const deniedCard = createElement('div', {
      className: 'card',
      style: 'border-left: 4px solid var(--rose); padding: var(--space-8); text-align: center;'
    });
    deniedCard.innerHTML = `
      <div style="width: 48px; height: 48px; margin: 0 auto var(--space-4); border-radius: 50%; background: var(--rose-10); color: var(--rose); display: flex; align-items: center; justify-content: center;">
        <i data-lucide="shield-x"></i>
      </div>
      <h2 style="font-family: var(--font-serif); font-size: var(--text-xl); color: var(--ink); margin-bottom: var(--space-2);">Access Denied (DPDPA Purpose Limitation)</h2>
      <p style="font-size: var(--text-sm); color: var(--ink-80); max-width: 500px; margin: 0 auto var(--space-4); line-height: 1.6;">
        Member "${memberId}" has no active or pending bookings in Barre Conditioning. In compliance with the India DPDPA 2023 and the Physicq 57 partnership agreement, health data cannot be accessed by external partner coaches without a verified booking relation.
      </p>
      <a href="#/partner/roster" class="btn btn-primary btn-sm">Return to Scoped Roster</a>
    `;
    page.appendChild(deniedCard);
    container.appendChild(page);

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: container });
    }
    return;
  }

  const { member, healthProfile, barreBookings } = barreData;

  // Header
  const header = createElement('div', { className: 'page-header', style: 'margin-bottom: var(--space-6);' });
  const title = createElement('h1', { className: 'page-title', text: member.fullName });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    text: `Verified Barre Participant • Phone: ${member.phone} • Emergency: ${member.emergencyContact || 'None'}`
  });
  header.append(title, subtitle);
  page.appendChild(header);

  const grid = createElement('div', { className: 'grid grid-2' });

  // 1. Health & Movement Directives
  const healthCard = createElement('div', { className: 'card' });
  const hTitle = createElement('h2', {
    style: 'font-family: var(--font-serif); font-size: var(--text-lg); font-weight: var(--weight-semibold); color: var(--ink); margin-bottom: var(--space-4);',
    text: 'Coach Movement Directives'
  });

  const hBody = createElement('div', { style: 'display: flex; flex-direction: column; gap: var(--space-4); font-size: var(--text-sm);' });

  hBody.innerHTML = `
    <div style="background: var(--stone); border-radius: var(--radius-sm); padding: var(--space-4);">
      <div style="font-weight: var(--weight-bold); margin-bottom: 2px;">Experience Level</div>
      <div style="color: var(--ink-80);">${healthProfile ? healthProfile.experience : 'Intermediate'}</div>
    </div>
    <div style="background: var(--stone); border-radius: var(--radius-sm); padding: var(--space-4);">
      <div style="font-weight: var(--weight-bold); margin-bottom: 2px;">Reported Physical / Joint Conditions</div>
      <div style="color: var(--ink-80);">${(healthProfile && healthProfile.injuries) ? healthProfile.injuries : 'No limiting physical conditions reported'}</div>
    </div>
    <div style="background: var(--stone); border-radius: var(--radius-sm); padding: var(--space-4);">
      <div style="font-weight: var(--weight-bold); margin-bottom: 2px;">Prenatal Status</div>
      <div style="color: var(--ink-80);">${healthProfile && healthProfile.isPregnant ? 'Active Prenatal — Avoid deep abdominal flexion and unstable one-leg barre balances' : 'Standard conditioning'}</div>
    </div>
  `;

  healthCard.append(hTitle, hBody);
  grid.appendChild(healthCard);

  // 2. Barre Sessions History
  const sessionsCard = createElement('div', { className: 'card' });
  const sTitle = createElement('h2', {
    style: 'font-family: var(--font-serif); font-size: var(--text-lg); font-weight: var(--weight-semibold); color: var(--ink); margin-bottom: var(--space-4);',
    text: 'Enrolled Barre Sessions'
  });
  sessionsCard.appendChild(sTitle);

  const sList = createElement('div', { style: 'display: flex; flex-direction: column; gap: var(--space-3);' });
  barreBookings.forEach(b => {
    const s = b.session;
    const row = createElement('div', {
      style: 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--ink-05); padding-bottom: var(--space-2);'
    });

    const info = createElement('div');
    const dStr = createElement('div', { style: 'font-size: var(--text-xs); font-weight: var(--weight-semibold); color: var(--ink);', text: formatDate(s.date) });
    const tStr = createElement('div', { style: 'font-size: 11px; color: var(--ink-50);', text: formatTime(`2026-01-01T${s.time}`) });
    info.append(dStr, tStr);

    const badge = createBadge({
      text: b.status.replace('_', ' '),
      status: b.status === 'upcoming' ? 'active' : b.status === 'pending_partner_approval' ? 'pending' : 'completed'
    });

    row.append(info, badge);
    sList.appendChild(row);
  });

  sessionsCard.appendChild(sList);
  grid.appendChild(sessionsCard);

  page.appendChild(grid);
  container.appendChild(page);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}
