/**
 * Plash Pilates — Studio Admin: Activity & Audit Logs
 * Comprehensive chronological ledger of all system, member, trainer, partner, and admin events.
 * Displays actor identities resolved against Supabase profiles, categorized badges,
 * full forensic details, and timestamps strictly formatted in Asia/Kolkata.
 * @module pages/admin/activity-logs
 */

import { createElement, clearChildren, escapeHtml } from '../../utils/dom.js';
import * as store from '../../core/store.js';
import { createDataTable } from '../../components/data-table.js';
import { createBadge } from '../../components/badge.js';
import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { formatDateTime, formatDateShort } from '../../utils/format.js';

export async function render(container) {
  clearChildren(container);

  // Authoritative live sync of audit activity logs from Supabase & server
  try {
    await store.syncActivityLogs();
  } catch (_) {}

  const page = createElement('div', { className: 'page-container' });

  // 1. Page Header
  const header = createElement('div', {
    className: 'page-header',
    style: 'display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--space-4); margin-bottom: var(--space-6);'
  });

  const headerLeft = createElement('div');
  const title = createElement('h1', { className: 'page-title', text: 'Studio Activity & Audit Ledger' });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    text: 'Immutable audit log tracking all studio activities: account logins, membership sales, class reservations, cancellations, waiver signings, and administrative actions.'
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
    showToast('Fetching latest audit records from Supabase...', 'info');
    await store.syncFromSupabase();
    refreshBtn.disabled = false;
    render(container);
  });

  const exportBtn = createElement('button', {
    className: 'btn btn-secondary',
    style: 'display: inline-flex; align-items: center; gap: 6px; font-size: 13px;',
    html: '<i data-lucide="download" style="width: 14px; height: 14px;"></i> Export Audit CSV'
  });
  exportBtn.addEventListener('click', () => exportLogsCSV());

  headerActions.append(refreshBtn, exportBtn);
  header.append(headerLeft, headerActions);
  page.appendChild(header);

  // 2. Fetch Logs
  const allLogs = store.getAllActivityLogs();

  // 3. Metric KPI Cards
  const totalEvents = allLogs.length;
  const bookingEvents = allLogs.filter(l => l.category === 'booking').length;
  const paymentEvents = allLogs.filter(l => l.category === 'payment' || l.category === 'pass').length;
  const authEvents = allLogs.filter(l => l.category === 'auth' || l.category === 'account').length;

  const statsGrid = createElement('div', {
    style: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6);'
  });

  const statCards = [
    { label: 'Total Recorded Events', val: totalEvents, icon: 'list-checks', color: 'var(--ink)' },
    { label: 'Bookings & Attendance', val: bookingEvents, icon: 'calendar-check', color: 'var(--moss)' },
    { label: 'Payments & Passes', val: paymentEvents, icon: 'receipt', color: 'var(--olive)' },
    { label: 'Auth & Access Events', val: authEvents, icon: 'shield-check', color: 'var(--rust)' },
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
      key: 'createdAt',
      label: 'Timestamp (Asia/Kolkata)',
      sortable: true,
      render: (val) => {
        const wrap = createElement('div', { style: 'display: flex; flex-direction: column; font-size: 12px;' });
        const timeStr = val ? formatDateTime(val) : 'N/A';
        const mainTime = createElement('span', {
          style: 'font-weight: 700; color: var(--ink); white-space: nowrap;',
          text: timeStr
        });
        const istLabel = createElement('span', {
          style: 'font-size: 10px; color: var(--ink-50); text-transform: uppercase; letter-spacing: 0.5px;',
          text: 'IST (UTC+05:30)'
        });
        wrap.append(mainTime, istLabel);
        return wrap;
      }
    },
    {
      key: 'displayName',
      label: 'Actor Identity',
      sortable: true,
      render: (val, row) => {
        const wrap = createElement('div', { style: 'display: flex; align-items: center; gap: 8px;' });
        const initial = (val || 'U').charAt(0).toUpperCase();
        const avatar = createElement('div', {
          style: 'width: 32px; height: 32px; border-radius: 50%; background: var(--stone-dark); color: var(--ink); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; flex-shrink: 0;',
          text: initial
        });
        const info = createElement('div', { style: 'display: flex; flex-direction: column; min-width: 0;' });
        const nameRow = createElement('div', { style: 'display: flex; align-items: center; gap: 6px;' });
        const nameEl = createElement('span', {
          style: 'font-weight: 700; color: var(--ink); font-size: 13px; white-space: nowrap;',
          text: val
        });
        nameRow.appendChild(nameEl);

        const emailEl = createElement('span', {
          style: 'font-size: 11px; color: var(--ink-50); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;',
          text: row.user?.email || (row.details && row.details.email) || 'Studio Actor'
        });

        info.append(nameRow, emailEl);
        wrap.append(avatar, info);
        return wrap;
      }
    },
    {
      key: 'actor',
      label: 'Role',
      sortable: true,
      render: (val, row) => {
        const rawRole = val || (row.user && row.user.role) || (row.details && row.details.role) || (row.details && row.details.actor) || 'member';
        const role = String(rawRole).toLowerCase();
        let status = 'standard';
        if (role === 'admin') status = 'master';
        else if (role === 'trainer') status = 'active';
        else if (role === 'partner') status = 'upcoming';
        else if (role === 'system') status = 'paused';
        return createBadge({ text: role.toUpperCase(), status });
      }
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (val) => {
        const cat = String(val || 'general').toLowerCase();
        const catLabels = {
          booking: { label: 'Booking', color: 'var(--ink)' },
          payment: { label: 'Payment', color: 'var(--moss)' },
          pass: { label: 'Pass', color: 'var(--olive)' },
          auth: { label: 'Auth', color: '#1a56db' },
          account: { label: 'Account', color: '#1a56db' },
          profile: { label: 'Profile', color: '#7e22ce' },
          legal: { label: 'Legal', color: 'var(--rust)' },
          system: { label: 'System', color: 'var(--ink-50)' }
        };
        const cfg = catLabels[cat] || { label: cat.toUpperCase(), color: 'var(--ink)' };
        const badge = createElement('span', {
          style: `background: var(--stone); color: ${cfg.color}; font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.3px;`,
          text: cfg.label
        });
        return badge;
      }
    },
    {
      key: 'action',
      label: 'Action Summary',
      sortable: true,
      render: (val, row) => {
        const wrap = createElement('div', { style: 'display: flex; flex-direction: column; gap: 2px; max-width: 320px;' });
        const actionText = createElement('span', {
          style: 'font-size: 12.5px; font-weight: 600; color: var(--ink); line-height: 1.4;',
          text: val
        });
        wrap.appendChild(actionText);

        if (row.details && Object.keys(row.details).length > 0) {
          const detailKeys = Object.keys(row.details).filter(k => k !== 'category' && k !== 'actor');
          if (detailKeys.length > 0) {
            const previewSnippet = detailKeys
              .slice(0, 2)
              .map(k => `${k}: ${typeof row.details[k] === 'object' ? '...' : row.details[k]}`)
              .join(' • ');
            const detailSpan = createElement('span', {
              style: 'font-size: 10.5px; color: var(--ink-50); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px;',
              text: previewSnippet
            });
            wrap.appendChild(detailSpan);
          }
        }
        return wrap;
      }
    },
    {
      key: 'details',
      label: 'Audit Metadata',
      sortable: false,
      render: (_, row) => {
        const btn = createElement('button', {
          className: 'btn btn-sm btn-secondary',
          style: 'padding: 4px 8px; font-size: 11px; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;',
          html: '<i data-lucide="file-text" style="width: 12px; height: 12px;"></i> Inspect'
        });
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          openAuditDetailModal(row);
        });
        return btn;
      }
    }
  ];

  // 5. Render Data Table
  const tableEl = createDataTable({
    columns,
    data: allLogs,
    searchable: true,
    searchPlaceholder: 'Search logs by actor name, action, or keyword...',
    filters: [
      {
        key: 'category',
        label: 'Category',
        options: [
          { value: 'all', label: 'All Categories' },
          { value: 'booking', label: 'Bookings' },
          { value: 'payment', label: 'Payments' },
          { value: 'pass', label: 'Passes' },
          { value: 'auth', label: 'Authentication' },
          { value: 'profile', label: 'Profile' },
          { value: 'legal', label: 'Legal & Waivers' },
          { value: 'system', label: 'System' }
        ]
      },
      {
        key: 'actor',
        label: 'Actor Role',
        options: [
          { value: 'all', label: 'All Roles' },
          { value: 'member', label: 'Member' },
          { value: 'admin', label: 'Admin' },
          { value: 'trainer', label: 'Trainer' },
          { value: 'partner', label: 'Partner' },
          { value: 'system', label: 'System' }
        ]
      }
    ],
    emptyText: 'No studio activity logs found.'
  });

  page.appendChild(tableEl);
  container.appendChild(page);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}

/**
 * Open detailed modal inspecting an audit log entry.
 * @param {Object} log
 */
function openAuditDetailModal(log) {
  const content = createElement('div', { style: 'display: flex; flex-direction: column; gap: var(--space-4);' });

  content.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: var(--stone); padding: 14px; border-radius: 8px; font-size: 12px;">
      <div>
        <div style="font-size: 11px; color: var(--ink-50); font-weight: 600;">ACTOR NAME</div>
        <div style="font-weight: 700; color: var(--ink); font-size: 13.5px;">${escapeHtml(log.displayName)}</div>
      </div>
      <div>
        <div style="font-size: 11px; color: var(--ink-50); font-weight: 600;">ACTOR ROLE</div>
        <div style="font-weight: 700; color: var(--ink); text-transform: uppercase;">${escapeHtml(log.actor)}</div>
      </div>
      <div>
        <div style="font-size: 11px; color: var(--ink-50); font-weight: 600;">EVENT CATEGORY</div>
        <div style="font-weight: 700; color: var(--ink); text-transform: uppercase;">${escapeHtml(log.category)}</div>
      </div>
      <div>
        <div style="font-size: 11px; color: var(--ink-50); font-weight: 600;">TIMESTAMP (IST)</div>
        <div style="font-weight: 700; color: var(--ink);">${log.createdAt ? formatDateTime(log.createdAt) : 'N/A'}</div>
      </div>
      <div style="grid-column: 1 / -1;">
        <div style="font-size: 11px; color: var(--ink-50); font-weight: 600;">ACTION DESCRIPTION</div>
        <div style="font-weight: 600; color: var(--ink); font-size: 13px; margin-top: 2px;">${escapeHtml(log.action)}</div>
      </div>
    </div>

    <div>
      <div style="font-size: 12px; font-weight: 700; color: var(--ink); margin-bottom: 6px;">Audit Payload & Metadata (JSON)</div>
      <pre style="background: var(--ink); color: #a3e635; padding: 12px; border-radius: 8px; font-size: 11.5px; font-family: monospace; overflow-x: auto; max-height: 240px; margin: 0;">${escapeHtml(JSON.stringify(log.details || {}, null, 2))}</pre>
    </div>

    <div style="font-size: 11px; color: var(--ink-50); background: var(--paper); border: 1px solid var(--stone-dark); padding: 10px; border-radius: 6px;">
      Log ID: <span style="font-family: monospace; color: var(--ink);">${escapeHtml(log.id)}</span> • Actor UUID: <span style="font-family: monospace; color: var(--ink);">${escapeHtml(log.memberId || 'system')}</span>
    </div>
  `;

  const closeBtn = createElement('button', {
    className: 'btn btn-secondary',
    text: 'Close'
  });

  const modal = openModal({
    title: 'Audit Log Inspection',
    content,
    maxWidth: '560px',
    actions: [closeBtn]
  });

  closeBtn.addEventListener('click', () => modal.close());
}

/**
 * Export all studio activity logs to CSV format.
 */
function exportLogsCSV() {
  const logs = store.getAllActivityLogs();
  if (logs.length === 0) {
    showToast('No activity logs to export.', 'warning');
    return;
  }

  const headers = ['Log ID', 'Timestamp (IST)', 'Actor Name', 'Actor Email', 'Role', 'Category', 'Action Summary', 'Details JSON'];
  const rows = logs.map(l => [
    `"${(l.id || '').replace(/"/g, '""')}"`,
    `"${(l.createdAt ? formatDateTime(l.createdAt) : '').replace(/"/g, '""')}"`,
    `"${(l.displayName || '').replace(/"/g, '""')}"`,
    `"${((l.user && l.user.email) || (l.details && l.details.email) || '').replace(/"/g, '""')}"`,
    `"${(l.actor || '').replace(/"/g, '""')}"`,
    `"${(l.category || '').replace(/"/g, '""')}"`,
    `"${(l.action || '').replace(/"/g, '""')}"`,
    `"${JSON.stringify(l.details || {}).replace(/"/g, '""')}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `plash_activity_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Exported ${logs.length} audit logs to CSV`, 'success');
}
