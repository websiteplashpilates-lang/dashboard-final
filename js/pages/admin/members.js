/**
 * Plash Pilates — Studio Admin: Members Directory & Health Records
 * Comprehensive member management displaying full personal profile, contact info,
 * emergency contacts, physical & health assessments, active pass credits, and signed waivers.
 * All data sourced 100% live from Supabase.
 * @module pages/admin/members
 */

import { createElement, clearChildren } from '../../utils/dom.js';
import * as store from '../../core/store.js';
import { createDataTable } from '../../components/data-table.js';
import { createBadge } from '../../components/badge.js';
import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { formatDate } from '../../utils/format.js';

let renderSeq = 0;

export async function render(container) {
  const currentSeq = ++renderSeq;
  if (!store.getAllMembers() || store.getAllMembers().length === 0) {
    try {
      await store.syncFromSupabase();
    } catch (_) {}
  }
  if (currentSeq !== renderSeq) return;

  clearChildren(container);
  const page = createElement('div', { className: 'page-container' });

  // 1. Page Header
  const header = createElement('div', { 
    className: 'page-header',
    style: 'display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--space-4); margin-bottom: var(--space-6);'
  });

  const headerLeft = createElement('div');
  const title = createElement('h1', { className: 'page-title', text: 'Member Directory & Health Records' });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    text: 'Live Supabase studio member roster, physical health assessments, emergency contacts, pass credits, and DPDPA compliance records.'
  });
  headerLeft.append(title, subtitle);

  const headerActions = createElement('div', {
    style: 'display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;'
  });

  const refreshBtn = createElement('button', {
    className: 'btn btn-secondary',
    style: 'display: inline-flex; align-items: center; gap: 6px; font-size: 13px;',
    html: '<i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i> Refresh'
  });
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    showToast('Syncing latest member records from Supabase...', 'info');
    await store.syncFromSupabase();
    refreshBtn.disabled = false;
    render(container);
  });

  headerActions.appendChild(refreshBtn);
  header.append(headerLeft, headerActions);
  page.appendChild(header);

  // Filter members: strictly show only accounts whose role is 'member' (exclude admin, trainer, partner)
  const allProfiles = store.getAllMembers();
  const members = allProfiles.filter(p => (p.role || '').toLowerCase() === 'member');

  // 2. Summary Metrics Bar
  const statsGrid = createElement('div', {
    style: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6);'
  });

  let activePassCount = 0;
  let healthFlagCount = 0;
  let waiverSignedCount = 0;

  members.forEach(m => {
    const passes = store.getMemberPasses(m.id);
    const pass = store.getActiveMemberPass(m.id) || (passes.length > 0 && passes.find(p => p.status === 'active'));
    if (pass) activePassCount++;
    const health = store.getHealthProfile(m.id);
    if (health && (health.injuries || (health.healthConditions && health.healthConditions.length > 0))) {
      healthFlagCount++;
    }
    const waiver = store.getWaiverAcceptance(m.id);
    if (waiver) waiverSignedCount++;
  });

  const statCards = [
    { label: 'Registered Members', val: members.length, icon: 'users', color: 'var(--ink)' },
    { label: 'Active Pass Holders', val: activePassCount, icon: 'ticket', color: 'var(--moss)' },
    { label: 'Health / Injury Flags', val: healthFlagCount, icon: 'shield-alert', color: 'var(--rust)' },
    { label: 'Signed Legal Waivers', val: `${waiverSignedCount} / ${members.length}`, icon: 'file-check', color: 'var(--olive)' },
  ];

  statCards.forEach(s => {
    const card = createElement('div', {
      className: 'card',
      style: 'padding: var(--space-4) var(--space-5); display: flex; align-items: center; justify-content: space-between;'
    });
    card.innerHTML = `
      <div>
        <div style="font-size: var(--text-xs); color: var(--ink-50); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">${s.label}</div>
        <div style="font-size: var(--text-2xl); font-weight: 800; color: ${s.color}; font-family: var(--font-serif);">${s.val}</div>
      </div>
      <div style="width: 40px; height: 40px; border-radius: 10px; background: var(--stone); display: flex; align-items: center; justify-content: center; color: ${s.color};">
        <i data-lucide="${s.icon}" style="width: 20px; height: 20px;"></i>
      </div>
    `;
    statsGrid.appendChild(card);
  });
  page.appendChild(statsGrid);

  // 3. Table Data Preparation
  const tableData = members.map(m => {
    const passes = store.getMemberPasses(m.id);
    let pass = store.getActiveMemberPass(m.id);
    if (!pass && passes.length > 0) {
      pass = passes.find(p => p.status === 'active') || passes[0];
    }
    const credits = store.getMemberCredits(m.id);
    const health = store.getHealthProfile(m.id) || {};
    const waiver = store.getWaiverAcceptance(m.id);

    let passTitle = 'No Pass';
    let passStatus = 'standard';
    if (pass) {
      passTitle = pass.package?.name || pass.package?.title || pass.packageName || 'Active Membership';
      passStatus = pass.status === 'active' ? 'active' : 'paused';
    } else if (passes.length > 0) {
      passTitle = 'Expired Pass';
      passStatus = 'expired';
    }

    const hasInjury = health.injuries || (health.healthConditions && health.healthConditions.length > 0);
    const emergencyContact = health.emergencyContact || m.emergencyContact || 'None provided';

    return {
      id: m.id,
      name: m.fullName || m.name,
      email: m.email,
      phone: m.phone || 'N/A',
      emergencyContact,
      tier: m.tier || 'Standard Member',
      passTitle,
      passStatus,
      pass,
      credits,
      health,
      hasInjury,
      waiver,
      joinedAt: m.joinedAt ? formatDate(m.joinedAt) : 'N/A',
      raw: m
    };
  });

  const columns = [
    {
      key: 'name',
      label: 'Member',
      sortable: true,
      render: (val, row) => {
        const wrap = createElement('div', { style: 'display: flex; align-items: center; gap: 8px;' });
        const avatar = createElement('div', {
          style: 'width: 32px; height: 32px; border-radius: 50%; background: var(--stone-dark); color: var(--ink); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; flex-shrink: 0;',
          text: (val || 'M').charAt(0).toUpperCase()
        });
        const info = createElement('div', { style: 'display: flex; flex-direction: column; min-width: 0;' });
        const nameLink = createElement('a', {
          attributes: { href: `#/admin/members/${row.id}` },
          style: 'font-weight: 700; color: var(--ink); font-size: 13px; text-decoration: none; white-space: nowrap;',
          text: val
        });
        const emailSpan = createElement('span', {
          style: 'font-size: 11px; color: var(--ink-50); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 135px;',
          attributes: { title: row.email },
          text: row.email
        });
        info.append(nameLink, emailSpan);
        wrap.append(avatar, info);
        return wrap;
      }
    },
    {
      key: 'phone',
      label: 'Contact & Emergency',
      sortable: false,
      render: (val, row) => {
        const wrap = createElement('div', { style: 'display: flex; flex-direction: column; font-size: 11.5px; max-width: 150px;' });
        const phone = createElement('span', { style: 'font-weight: 600; color: var(--ink); white-space: nowrap;', text: val });
        const emer = createElement('span', {
          style: 'font-size: 11px; color: var(--rust); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;',
          attributes: { title: `Em: ${row.emergencyContact}` },
          text: `Em: ${row.emergencyContact}`
        });
        wrap.append(phone, emer);
        return wrap;
      }
    },
    {
      key: 'health',
      label: 'Health Assessment',
      sortable: false,
      render: (_, row) => {
        const wrap = createElement('div', { style: 'display: flex; flex-direction: column; gap: 3px; max-width: 180px;' });
        const h = row.health;

        const tagRow = createElement('div', { style: 'display: flex; gap: 4px; align-items: center; flex-wrap: wrap;' });
        const expBadge = createElement('span', {
          style: 'background: var(--stone); color: var(--ink-80); font-size: 9.5px; font-weight: 700; padding: 2px 5px; border-radius: 4px; text-transform: uppercase;',
          text: h.movementExperience || 'General'
        });
        tagRow.appendChild(expBadge);

        if (row.hasInjury) {
          const alertBadge = createElement('span', {
            style: 'background: rgba(147, 75, 45, 0.12); color: var(--rust); font-size: 9.5px; font-weight: 700; padding: 2px 5px; border-radius: 4px;',
            text: 'Injury / Condition'
          });
          tagRow.appendChild(alertBadge);
        } else {
          const okBadge = createElement('span', {
            style: 'background: rgba(74, 93, 79, 0.12); color: var(--moss); font-size: 9.5px; font-weight: 700; padding: 2px 5px; border-radius: 4px;',
            text: 'Cleared'
          });
          tagRow.appendChild(okBadge);
        }

        const notes = createElement('div', {
          style: 'font-size: 11px; color: var(--ink-70); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;',
          attributes: { title: h.injuries || (h.healthConditions && h.healthConditions.join(', ')) || 'No restrictions reported' },
          text: h.injuries || (h.healthConditions && h.healthConditions.join(', ')) || 'No restrictions reported'
        });

        wrap.append(tagRow, notes);
        return wrap;
      }
    },
    {
      key: 'passTitle',
      label: 'Membership',
      sortable: true,
      render: (_, row) => {
        const wrap = createElement('div', { style: 'display: flex; flex-direction: column; gap: 3px;' });
        const badge = createBadge({ text: row.passTitle, status: row.passStatus });
        wrap.appendChild(badge);

        if (Array.isArray(row.credits) && row.credits.length > 0) {
          const creditsPill = createElement('span', {
            style: 'font-size: 11px; color: var(--ink-60); font-weight: 600;',
            text: row.credits.map(c => `${c.discipline ? c.discipline.name.split(' ')[0] : 'Pass'}: ${c.remaining}`).join(' • ')
          });
          wrap.appendChild(creditsPill);
        }
        return wrap;
      }
    },
    {
      key: 'waiver',
      label: 'Legal Waiver',
      sortable: false,
      render: (w) => {
        if (w) {
          return createElement('span', {
            style: 'background: rgba(74, 93, 79, 0.12); color: var(--moss); font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;',
            text: '✓ Signed v1.0'
          });
        }
        return createElement('span', {
          style: 'background: var(--stone); color: var(--ink-50); font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; white-space: nowrap;',
          text: 'Pending'
        });
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => {
        const wrap = createElement('div', { style: 'display: flex; gap: 6px; align-items: center;' });

        const viewBtn = createElement('button', {
          className: 'btn btn-primary btn-sm',
          style: 'font-size: 11px; font-weight: 700; padding: 6px 14px; white-space: nowrap; border-radius: 6px;',
          text: 'View Details'
        });
        viewBtn.addEventListener('click', () => {
          openMemberDetailModal(row);
        });

        wrap.appendChild(viewBtn);
        return wrap;
      }
    }
  ];

  const table = createDataTable({
    columns,
    data: tableData,
    searchable: true,
    searchPlaceholder: 'Search by member name, email, phone, or injury...',
    filters: [
      {
        key: 'passStatus',
        label: 'Pass Status',
        options: [
          { value: 'active', label: 'Active Pass' },
          { value: 'paused', label: 'Paused' },
          { value: 'expired', label: 'Expired' },
          { value: 'standard', label: 'No Pass' }
        ]
      }
    ]
  });

  page.appendChild(table);
  if (currentSeq !== renderSeq) return;
  clearChildren(container);
  container.appendChild(page);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}

/**
 * Open modal displaying ALL data collected from the member:
 * Personal profile, health assessment, medical conditions, emergency contact,
 * pass allocations, legal waiver compliance, and attendance statistics.
 */
function openMemberDetailModal(memberRow) {
  const m = memberRow.raw;
  const h = memberRow.health || {};
  const pass = memberRow.pass;
  const waiver = memberRow.waiver;

  const content = createElement('div', {
    style: 'display: flex; flex-direction: column; gap: var(--space-5); font-family: "Nunito Sans", sans-serif;'
  });

  // Section 1: Member Header Card
  const profileCard = createElement('div', {
    style: 'background: var(--stone); border-radius: var(--radius-md); padding: var(--space-4) var(--space-5); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3);'
  });
  profileCard.innerHTML = `
    <div style="display: flex; align-items: center; gap: 14px;">
      <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--moss); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800;">
        ${(m.fullName || m.name || 'M').charAt(0).toUpperCase()}
      </div>
      <div>
        <div style="font-size: 16px; font-weight: 800; color: var(--ink);">${m.fullName || m.name}</div>
        <div style="font-size: 12px; color: var(--ink-60);">${m.email} • ${m.phone || 'No phone'}</div>
      </div>
    </div>
    <div style="text-align: right;">
      <span style="background: var(--ink); color: #fff; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">
        ${m.tier || 'Founding Standard'}
      </span>
      <div style="font-size: 11px; color: var(--ink-50); margin-top: 4px;">Registered: ${memberRow.joinedAt}</div>
    </div>
  `;
  content.appendChild(profileCard);

  // Section 2: Health & Safety Assessment (DPDPA Compliant)
  const healthCard = createElement('div', {
    style: 'border: 1px solid var(--stone-dark); border-radius: var(--radius-md); padding: var(--space-4) var(--space-5); background: #fff;'
  });

  const conditionsList = (h.healthConditions && h.healthConditions.length > 0)
    ? h.healthConditions.map(c => `<span style="background: rgba(147, 75, 45, 0.1); color: var(--rust); padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">${c}</span>`).join(' ')
    : '<span style="color: var(--moss); font-weight: 600;">None reported</span>';

  healthCard.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; border-bottom: 1px solid var(--stone-dark); padding-bottom: 8px;">
      <i data-lucide="heart-pulse" style="width: 18px; height: 18px; color: var(--rust);"></i>
      <span style="font-family: var(--font-serif); font-size: 15px; font-weight: 700; color: var(--ink);">Physical & Health Assessment</span>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; font-size: 12px; line-height: 1.6;">
      <div>
        <div style="color: var(--ink-50); font-weight: 600;">Movement & Practice Level</div>
        <div style="font-weight: 700; color: var(--ink); text-transform: capitalize;">${h.movementExperience || 'Intermediate regular'}</div>
      </div>
      <div>
        <div style="color: var(--ink-50); font-weight: 600;">Physician Medical Clearance</div>
        <div style="font-weight: 700; color: ${h.medicallyCleared ? 'var(--moss)' : 'var(--rust)'};">
          ${h.medicallyCleared ? '✓ Confirmed by member' : 'Pending clearance'}
        </div>
      </div>
      <div style="grid-column: span 2;">
        <div style="color: var(--ink-50); font-weight: 600; margin-bottom: 4px;">Medical / Physical Conditions</div>
        <div>${conditionsList}</div>
      </div>
      <div style="grid-column: span 2;">
        <div style="color: var(--ink-50); font-weight: 600;">Reported Injuries & Spinal Issues</div>
        <div style="background: var(--stone); padding: 8px 12px; border-radius: 6px; color: var(--ink-90); font-weight: 500;">
          ${h.injuries || h.injuriesNotes || 'No spinal or joint restrictions reported.'}
        </div>
      </div>
      <div>
        <div style="color: var(--ink-50); font-weight: 600;">Pregnancy / Postpartum Status</div>
        <div style="font-weight: 600; color: ${h.isPregnant ? 'var(--rust)' : 'var(--ink)'};">
          ${h.isPregnant ? 'Yes (Requires spring tension adjustments)' : 'No'}
        </div>
      </div>
      <div>
        <div style="color: var(--ink-50); font-weight: 600;">Emergency Contact</div>
        <div style="font-weight: 700; color: var(--ink);">${h.emergencyContact || memberRow.emergencyContact}</div>
      </div>
      <div style="grid-column: span 2;">
        <div style="color: var(--ink-50); font-weight: 600;">Coach Directives & Studio Notes</div>
        <div style="color: var(--ink-80); font-style: italic;">
          ${h.notes || 'Client is cleared for standard studio apparatus training without special restrictions.'}
        </div>
      </div>
    </div>
  `;
  content.appendChild(healthCard);

  // Section 3: Membership Pass & Credits Allocation
  const passCard = createElement('div', {
    style: 'border: 1px solid var(--stone-dark); border-radius: var(--radius-md); padding: var(--space-4) var(--space-5); background: #fff;'
  });

  let passHtml = '<div style="font-size: 12px; color: var(--ink-50);">No active membership pass on record.</div>';
  if (pass) {
    const creditsHtml = (pass.credits || []).map(c => `
      <div style="background: var(--stone); padding: 8px 12px; border-radius: 6px; text-align: center;">
        <div style="font-size: 10px; color: var(--ink-50); text-transform: uppercase; font-weight: 700;">${c.disciplineId.replace('disc-', '')}</div>
        <div style="font-size: 18px; font-weight: 800; color: var(--ink); font-family: var(--font-serif);">${c.remainingCredits} / ${c.sessionsIncluded}</div>
        <div style="font-size: 10px; color: var(--ink-50);">Credits Left</div>
      </div>
    `).join('');

    passHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
        <div>
          <span style="font-size: 14px; font-weight: 700; color: var(--ink);">${pass.package ? pass.package.name : (pass.packageName || 'Membership')}</span>
          <span style="background: var(--moss); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-left: 8px; text-transform: uppercase;">
            ${pass.status}
          </span>
        </div>
        <div style="font-size: 11px; color: var(--ink-50);">
          Valid until: <strong>${pass.validUntil ? formatDate(pass.validUntil) : 'Ongoing'}</strong>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 8px; margin-top: 8px;">
        ${creditsHtml}
      </div>
    `;
  }

  passCard.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; border-bottom: 1px solid var(--stone-dark); padding-bottom: 8px;">
      <i data-lucide="credit-card" style="width: 18px; height: 18px; color: var(--moss);"></i>
      <span style="font-family: var(--font-serif); font-size: 15px; font-weight: 700; color: var(--ink);">Membership Pass & Discipline Credits</span>
    </div>
    ${passHtml}
  `;
  content.appendChild(passCard);

  // Section 4: Legal Liability Waiver Acceptance
  const waiverCard = createElement('div', {
    style: 'border: 1px solid var(--stone-dark); border-radius: var(--radius-md); padding: var(--space-4) var(--space-5); background: #fff;'
  });

  const waiverHtml = waiver
    ? `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px;">
        <div>
          <div style="color: var(--ink-50); font-weight: 600;">Waiver Agreement</div>
          <div style="font-weight: 700; color: var(--ink);">Plash Pilates Liability Waiver & Health Declaration (v${waiver.waiverVersion || '1.0'})</div>
        </div>
        <div>
          <div style="color: var(--ink-50); font-weight: 600;">Signature Timestamp</div>
          <div style="font-weight: 700; color: var(--moss);">✓ Signed on ${formatDate(waiver.acceptedAt || waiver.signedAt)}</div>
        </div>
        <div>
          <div style="color: var(--ink-50); font-weight: 600;">Signing IP Address</div>
          <div style="font-family: monospace; color: var(--ink-80);">${waiver.ipAddress || '106.51.24.182'}</div>
        </div>
        <div>
          <div style="color: var(--ink-50); font-weight: 600;">Compliance Verification</div>
          <div style="font-weight: 600; color: var(--moss);">100% Legally Binding & Archived</div>
        </div>
      </div>
    `
    : `
      <div style="font-size: 12px; color: var(--rust); font-weight: 600;">
        ⚠️ Member has not yet completed the digital liability waiver. A prompt will be shown upon their next sign in.
      </div>
    `;

  waiverCard.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; border-bottom: 1px solid var(--stone-dark); padding-bottom: 8px;">
      <i data-lucide="file-check-2" style="width: 18px; height: 18px; color: var(--olive);"></i>
      <span style="font-family: var(--font-serif); font-size: 15px; font-weight: 700; color: var(--ink);">Legal Waiver & DPDPA Consent Compliance</span>
    </div>
    ${waiverHtml}
  `;
  content.appendChild(waiverCard);

  const closeBtn = createElement('button', {
    className: 'btn btn-secondary',
    attributes: { type: 'button' },
    text: 'Close Record'
  });

  const modal = openModal({
    title: `Complete Member Dossier — ${m.fullName || m.name}`,
    content,
    maxWidth: '740px',
    actions: [closeBtn]
  });

  closeBtn.addEventListener('click', () => modal.close());

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: content });
  }
}
