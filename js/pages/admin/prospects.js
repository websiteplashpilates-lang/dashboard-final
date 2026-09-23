/**
 * Plash Pilates — Studio Admin: Registered Leads & Prospects
 * Roster of authenticated accounts who have registered or logged in but do not hold an active pass.
 * Enables studio managers to track signup pipelines, review movement levels, send direct WhatsApp/Email outreach,
 * and grant complimentary trial passes.
 * @module pages/admin/prospects
 */

import { createElement, clearChildren, escapeHtml } from '../../utils/dom.js';
import * as store from '../../core/store.js';
import * as auth from '../../core/auth.js';
import { createDataTable } from '../../components/data-table.js';
import { createBadge } from '../../components/badge.js';
import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { formatDateShort, formatDate, formatDateTime } from '../../utils/format.js';

export async function render(container) {
  clearChildren(container);
  const page = createElement('div', { className: 'page-container' });

  // 1. Page Header
  const header = createElement('div', {
    className: 'page-header',
    style: 'display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--space-4); margin-bottom: var(--space-6);'
  });

  const headerLeft = createElement('div');
  const title = createElement('h1', { className: 'page-title', text: 'Registered Leads & Prospects' });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    text: 'Client accounts who have signed up or logged into Plash Pilates without an active membership pass. Track lead conversion, review movement experience, and grant trial passes.'
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
    showToast('Syncing latest prospect records from Supabase...', 'info');
    await store.syncFromSupabase();
    refreshBtn.disabled = false;
    render(container);
  });

  const exportBtn = createElement('button', {
    className: 'btn btn-secondary',
    style: 'display: inline-flex; align-items: center; gap: 6px; font-size: 13px;',
    html: '<i data-lucide="download" style="width: 14px; height: 14px;"></i> Export Leads CSV'
  });
  exportBtn.addEventListener('click', () => exportProspectsCSV());

  headerActions.append(refreshBtn, exportBtn);
  header.append(headerLeft, headerActions);
  page.appendChild(header);

  // 2. Fetch Prospects
  const prospects = store.getNonMemberProspects();

  // 3. Metric KPI Cards
  const totalLeads = prospects.length;
  const newProspectsCount = prospects.filter(p => p.status === 'registered_prospect').length;
  const lapsedCount = prospects.filter(p => p.status === 'expired_member').length;
  const healthDeclaredCount = prospects.filter(p => p.health && (p.movementLevel !== 'Not specified' || (p.fitnessGoals && p.fitnessGoals.length > 0))).length;

  const statsGrid = createElement('div', {
    style: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6);'
  });

  const statCards = [
    { label: 'Total Inactive / Leads', val: totalLeads, icon: 'user-x', color: 'var(--ink)' },
    { label: 'New Prospects (Never Bought)', val: newProspectsCount, icon: 'user-plus', color: 'var(--moss)' },
    { label: 'Lapsed Former Members', val: lapsedCount, icon: 'clock-rotate-left', color: 'var(--rust)' },
    { label: 'Declared Movement Profile', val: `${healthDeclaredCount} / ${totalLeads}`, icon: 'activity', color: 'var(--olive)' },
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

  // 4. Columns Definition
  const columns = [
    {
      key: 'name',
      label: 'Lead Name & Email',
      sortable: true,
      render: (val, row) => {
        const wrap = createElement('div', { style: 'display: flex; align-items: center; gap: 10px;' });
        const initial = (val || 'L').charAt(0).toUpperCase();
        const avatar = createElement('div', {
          style: 'width: 36px; height: 36px; border-radius: 50%; background: var(--stone-dark); color: var(--ink); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0;',
          text: initial
        });
        const info = createElement('div', { style: 'display: flex; flex-direction: column; min-width: 0;' });
        const nameEl = createElement('span', {
          style: 'font-weight: 700; color: var(--ink); font-size: 13.5px; white-space: nowrap;',
          text: val
        });
        const emailEl = createElement('span', {
          style: 'font-size: 11.5px; color: var(--ink-50); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px;',
          attributes: { title: row.email },
          text: row.email || 'No email'
        });
        info.append(nameEl, emailEl);
        wrap.append(avatar, info);
        return wrap;
      }
    },
    {
      key: 'phone',
      label: 'Direct Contact',
      sortable: false,
      render: (val, row) => {
        const wrap = createElement('div', { style: 'display: flex; flex-direction: column; gap: 4px;' });
        const phoneRow = createElement('div', { style: 'display: flex; align-items: center; gap: 6px;' });
        const phoneText = createElement('span', {
          style: 'font-size: 12px; font-weight: 600; color: var(--ink);',
          text: val || 'No phone'
        });
        phoneRow.appendChild(phoneText);

        const actionsRow = createElement('div', { style: 'display: flex; align-items: center; gap: 8px;' });

        if (val && val !== 'N/A') {
          const rawDigits = String(val).replace(/[^0-9]/g, '');
          const intlDigits = rawDigits.startsWith('91') ? rawDigits : (rawDigits.length === 10 ? `91${rawDigits}` : rawDigits);
          const waLink = createElement('a', {
            attributes: {
              href: `https://wa.me/${intlDigits}?text=${encodeURIComponent(`Hi ${row.name}, welcome to Plash Pilates! We noticed you signed up recently. Would you like to schedule a studio trial session?`)}`,
              target: '_blank',
              rel: 'noopener noreferrer',
              title: 'Open WhatsApp Chat'
            },
            style: 'display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; font-weight: 700; color: #128C7E; text-decoration: none; padding: 2px 6px; background: rgba(18, 140, 126, 0.08); border-radius: 4px;'
          });
          waLink.innerHTML = '<i data-lucide="message-circle" style="width: 11px; height: 11px;"></i> WhatsApp';
          actionsRow.appendChild(waLink);
        }

        if (row.email) {
          const mailLink = createElement('a', {
            attributes: {
              href: `mailto:${row.email}?subject=${encodeURIComponent('Exclusive Trial Session at Plash Pilates')}&body=${encodeURIComponent(`Dear ${row.name},\n\nThank you for signing up with Plash Pilates Studio. We would love to welcome you for a personalized Reformer or Barre experience.\n\nWarm regards,\nPlash Pilates Team`)}`,
              title: 'Send Email'
            },
            style: 'display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; font-weight: 700; color: var(--olive); text-decoration: none; padding: 2px 6px; background: rgba(122, 107, 46, 0.08); border-radius: 4px;'
          });
          mailLink.innerHTML = '<i data-lucide="mail" style="width: 11px; height: 11px;"></i> Email';
          actionsRow.appendChild(mailLink);
        }

        wrap.append(phoneRow, actionsRow);
        return wrap;
      }
    },
    {
      key: 'status',
      label: 'Prospect Status',
      sortable: true,
      render: (val, row) => {
        const wrap = createElement('div', { style: 'display: flex; flex-direction: column; gap: 3px;' });
        if (row.status === 'registered_prospect') {
          wrap.appendChild(createBadge({ label: 'New Lead', variant: 'success' }));
        } else {
          wrap.appendChild(createBadge({ label: 'Lapsed Member', variant: 'warning' }));
        }
        const hint = createElement('span', {
          style: 'font-size: 10.5px; color: var(--ink-50);',
          text: row.hasPastPass ? `${row.bookingsCount} past bookings` : 'Zero purchases'
        });
        wrap.appendChild(hint);
        return wrap;
      }
    },
    {
      key: 'movementLevel',
      label: 'Movement & Health',
      sortable: true,
      render: (val, row) => {
        const wrap = createElement('div', { style: 'display: flex; flex-direction: column; gap: 3px;' });
        const levelBadge = createElement('span', {
          style: 'background: var(--stone); color: var(--ink); font-size: 10.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: inline-block; width: fit-content;',
          text: val
        });
        wrap.appendChild(levelBadge);

        if (row.healthInjuries) {
          const injuryAlert = createElement('span', {
            style: 'color: var(--rust); font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; gap: 2px;',
            html: '<i data-lucide="alert-triangle" style="width: 10px; height: 10px;"></i> Injury Flagged'
          });
          wrap.appendChild(injuryAlert);
        } else if (row.hasWaiver) {
          const waiverOk = createElement('span', {
            style: 'color: var(--moss); font-size: 10px; font-weight: 600;',
            text: '✓ Waiver on file'
          });
          wrap.appendChild(waiverOk);
        }
        return wrap;
      }
    },
    {
      key: 'createdAt',
      label: 'Registered Date (IST)',
      sortable: true,
      render: (val) => {
        const wrap = createElement('div', { style: 'font-size: 12px; color: var(--ink); font-weight: 600;' });
        wrap.textContent = val ? formatDateShort(val) : 'N/A';
        return wrap;
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => {
        const wrap = createElement('div', { style: 'display: flex; align-items: center; gap: 6px;' });

        // Grant Complimentary Pass button
        const grantBtn = createElement('button', {
          className: 'btn btn-sm btn-primary',
          style: 'padding: 4px 8px; font-size: 11px; white-space: nowrap;',
          text: 'Grant Pass'
        });
        grantBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openGrantPassModal(row, container);
        });

        // Dossier / Profile button
        const viewBtn = createElement('button', {
          className: 'btn btn-sm btn-secondary',
          style: 'padding: 4px 8px; font-size: 11px; white-space: nowrap;',
          text: 'Dossier'
        });
        viewBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openProspectDossier(row);
        });

        wrap.append(grantBtn, viewBtn);
        return wrap;
      }
    }
  ];

  // 5. Render Data Table
  const tableEl = createDataTable({
    columns,
    data: prospects,
    searchable: true,
    searchPlaceholder: 'Search leads by name, email, or phone...',
    filters: [
      {
        key: 'status',
        label: 'Status',
        options: [
          { value: 'all', label: 'All Non-Members' },
          { value: 'registered_prospect', label: 'New Prospects Only' },
          { value: 'expired_member', label: 'Lapsed Members Only' }
        ]
      },
      {
        key: 'movementLevel',
        label: 'Movement Level',
        options: [
          { value: 'all', label: 'All Levels' },
          { value: 'Beginner', label: 'Beginner' },
          { value: 'Intermediate', label: 'Intermediate' },
          { value: 'Advanced', label: 'Advanced' }
        ]
      }
    ],
    emptyText: 'No non-member prospects match the current filter.'
  });

  page.appendChild(tableEl);
  container.appendChild(page);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}

/**
 * Open modal to grant a complimentary trial/welcome pass to a prospect.
 * @param {Object} prospect
 * @param {HTMLElement} container
 */
function openGrantPassModal(prospect, container) {
  const packages = store.getPackages().filter(p => p.isActive !== false);
  const currentUser = auth.getCurrentUser();

  const content = createElement('div', { style: 'display: flex; flex-direction: column; gap: var(--space-4);' });

  content.innerHTML = `
    <div style="background: var(--stone); padding: 12px 14px; border-radius: 8px; font-size: 13px;">
      <div style="font-weight: 700; color: var(--ink);">${escapeHtml(prospect.name)}</div>
      <div style="color: var(--ink-50); font-size: 12px;">${escapeHtml(prospect.email)} • ${escapeHtml(prospect.phone)}</div>
    </div>
    <div class="form-group">
      <label class="form-label" style="font-size: 12.5px; font-weight: 600; color: var(--ink);">Select Package to Grant as Complimentary Pass</label>
      <select id="grant-package-select" class="form-control" style="width: 100%;">
        ${packages.map(p => `
          <option value="${p.id}">${escapeHtml(p.name)} (${p.totalSessions} sessions • ${p.durationMonths} mo) — ₹${(p.price || 0).toLocaleString('en-IN')}</option>
        `).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label" style="font-size: 12.5px; font-weight: 600; color: var(--ink);">Administrative Reason / Note</label>
      <input type="text" id="grant-note-input" class="form-control" placeholder="e.g., Studio opening trial promotion, VIP invite..." value="Studio VIP Welcome Pass" />
    </div>
    <div style="font-size: 11.5px; color: var(--ink-50); background: rgba(122, 107, 46, 0.08); padding: 10px; border-radius: 6px; border-left: 3px solid var(--olive);">
      ℹ️ This pass will be activated immediately with full session credits. The event will be logged in the Studio Activity Ledger.
    </div>
  `;

  const cancelBtn = createElement('button', {
    className: 'btn btn-secondary',
    text: 'Cancel'
  });

  const confirmBtn = createElement('button', {
    className: 'btn btn-primary',
    text: 'Confirm & Grant Pass'
  });

  const modal = openModal({
    title: 'Grant Complimentary Membership Pass',
    content,
    maxWidth: '520px',
    actions: [cancelBtn, confirmBtn]
  });

  cancelBtn.addEventListener('click', () => modal.close());

  confirmBtn.addEventListener('click', () => {
    const pkgSelect = content.querySelector('#grant-package-select');
    const noteInput = content.querySelector('#grant-note-input');
    const packageId = pkgSelect ? pkgSelect.value : packages[0]?.id;
    const note = noteInput ? noteInput.value.trim() : 'Complimentary trial';

    if (!packageId) {
      showToast('Please select a valid package.', 'error');
      return;
    }

    try {
      store.grantComplimentaryPass({
        memberId: prospect.id,
        packageId,
        adminId: currentUser?.id,
        note
      });
      modal.close();
      showToast(`Complimentary pass granted to ${prospect.name}!`, 'success');
      render(container);
    } catch (err) {
      console.error('[openGrantPassModal error]', err);
      showToast(`Failed to grant pass: ${err.message}`, 'error');
    }
  });
}

/**
 * Open detailed profile dossier modal for a prospect.
 * @param {Object} p
 */
function openProspectDossier(p) {
  const content = createElement('div', { style: 'display: flex; flex-direction: column; gap: var(--space-4);' });

  const health = p.health || {};
  const waiver = p.waiver;

  content.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: var(--stone); padding: 14px; border-radius: 8px;">
      <div>
        <div style="font-size: 11px; color: var(--ink-50); font-weight: 600;">FULL NAME</div>
        <div style="font-weight: 700; color: var(--ink); font-size: 14px;">${escapeHtml(p.name)}</div>
      </div>
      <div>
        <div style="font-size: 11px; color: var(--ink-50); font-weight: 600;">ACCOUNT STATUS</div>
        <div style="font-weight: 700; color: ${p.status === 'registered_prospect' ? 'var(--moss)' : 'var(--rust)'}; font-size: 14px;">${p.statusLabel}</div>
      </div>
      <div>
        <div style="font-size: 11px; color: var(--ink-50); font-weight: 600;">EMAIL ADDRESS</div>
        <div style="font-weight: 600; color: var(--ink); font-size: 13px;">${escapeHtml(p.email)}</div>
      </div>
      <div>
        <div style="font-size: 11px; color: var(--ink-50); font-weight: 600;">PHONE NUMBER</div>
        <div style="font-weight: 600; color: var(--ink); font-size: 13px;">${escapeHtml(p.phone)}</div>
      </div>
      <div>
        <div style="font-size: 11px; color: var(--ink-50); font-weight: 600;">EMERGENCY CONTACT</div>
        <div style="font-weight: 600; color: var(--ink); font-size: 13px;">${escapeHtml(p.emergencyContact)}</div>
      </div>
      <div>
        <div style="font-size: 11px; color: var(--ink-50); font-weight: 600;">REGISTRATION DATE (IST)</div>
        <div style="font-weight: 600; color: var(--ink); font-size: 13px;">${p.createdAt ? formatDate(p.createdAt) : 'N/A'}</div>
      </div>
    </div>

    <div style="background: var(--paper); border: 1px solid var(--stone-dark); padding: 14px; border-radius: 8px;">
      <div style="font-size: 13px; font-weight: 700; color: var(--ink); margin-bottom: 8px;">Physical Readiness & Movement History</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px;">
        <div>
          <span style="color: var(--ink-50); font-weight: 600;">Movement Level:</span>
          <span style="font-weight: 700; color: var(--ink); margin-left: 6px;">${escapeHtml(p.movementLevel)}</span>
        </div>
        <div>
          <span style="color: var(--ink-50); font-weight: 600;">Injury Flags:</span>
          <span style="font-weight: 700; color: ${p.healthInjuries ? 'var(--rust)' : 'var(--moss)'}; margin-left: 6px;">${p.healthInjuries ? 'Yes (flagged)' : 'None declared'}</span>
        </div>
        <div style="grid-column: 1 / -1;">
          <span style="color: var(--ink-50); font-weight: 600;">Fitness Goals:</span>
          <span style="font-weight: 600; color: var(--ink); margin-left: 6px;">${(health.fitnessGoals || []).join(', ') || 'General fitness'}</span>
        </div>
      </div>
    </div>

    <div style="background: var(--paper); border: 1px solid var(--stone-dark); padding: 14px; border-radius: 8px;">
      <div style="font-size: 13px; font-weight: 700; color: var(--ink); margin-bottom: 8px;">Legal Waiver Status</div>
      <div style="font-size: 12px; color: ${waiver ? 'var(--moss)' : 'var(--rust)'}; font-weight: 600;">
        ${waiver ? `✓ Liability waiver signed on ${formatDate(waiver.acceptedAt || waiver.signedAt)}` : '⚠️ Waiver pending completion upon first studio session'}
      </div>
    </div>
  `;

  const closeBtn = createElement('button', {
    className: 'btn btn-secondary',
    text: 'Close'
  });

  const modal = openModal({
    title: `Prospect Dossier — ${p.name}`,
    content,
    maxWidth: '640px',
    actions: [closeBtn]
  });

  closeBtn.addEventListener('click', () => modal.close());
}

/**
 * Export all prospects as formatted CSV.
 */
function exportProspectsCSV() {
  const prospects = store.getNonMemberProspects();
  if (prospects.length === 0) {
    showToast('No prospect records available to export.', 'warning');
    return;
  }

  const headers = ['Full Name', 'Email', 'Phone', 'Emergency Contact', 'Status', 'Movement Level', 'Injury Flagged', 'Registered Date (IST)'];
  const rows = prospects.map(p => [
    `"${(p.name || '').replace(/"/g, '""')}"`,
    `"${(p.email || '').replace(/"/g, '""')}"`,
    `"${(p.phone || '').replace(/"/g, '""')}"`,
    `"${(p.emergencyContact || '').replace(/"/g, '""')}"`,
    `"${p.statusLabel}"`,
    `"${p.movementLevel}"`,
    `"${p.healthInjuries ? 'Yes' : 'No'}"`,
    `"${p.createdAt ? formatDateShort(p.createdAt) : 'N/A'}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `plash_leads_prospects_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Exported ${prospects.length} leads to CSV`, 'success');
}
