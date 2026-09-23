/**
 * Plash Pilates — Studio Admin: Partner Declinations & Refund Queue
 * Dedicated financial & operations queue for members whose Barre programming
 * was declined by Physicq 57 certified coaches.
 * Facilitates tracking pending refunds, processing payment reconciliations,
 * and maintaining an audited record of partner declinations.
 * @module pages/admin/refunds
 */

import { createElement, clearChildren, escapeHtml } from '../../utils/dom.js';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format.js';
import * as store from '../../core/store.js';
import { createStatCard } from '../../components/stat-card.js';
import { createBadge } from '../../components/badge.js';
import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';

/**
 * Render the Partner Declinations & Refund Queue page.
 * @param {HTMLElement} container
 */
export async function render(container) {
  // Sync partner reviews
  try {
    await store.syncPartnerReviews();
  } catch (_) {}

  clearChildren(container);
  const page = createElement('div', { className: 'page-container' });

  // 1. Page Header
  const header = createElement('div', {
    className: 'page-header',
    style: 'display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--space-4); margin-bottom: var(--space-6);'
  });

  const headerLeft = createElement('div');
  const title = createElement('h1', { className: 'page-title', text: 'Partner Declinations & Refund Queue' });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    text: 'Audited queue of member Barre packages declined by Physicq 57 partner coaches awaiting pass credit refund or payment reconciliation.'
  });
  headerLeft.append(title, subtitle);

  const headerActions = createElement('div', {
    style: 'display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;'
  });

  const refreshBtn = createElement('button', {
    className: 'btn btn-secondary',
    style: 'display: inline-flex; align-items: center; gap: 6px; font-size: 13px;',
    html: '<i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i> Refresh Queue'
  });
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    showToast('Refreshing partner declinations...', 'info');
    await Promise.all([
      store.syncPartnerReviews(),
      store.fetchAdminPayments().catch(() => {})
    ]);
    refreshBtn.disabled = false;
    render(container);
  });

  headerActions.appendChild(refreshBtn);
  header.append(headerLeft, headerActions);
  page.appendChild(header);

  // Content area for dynamic filtering
  const contentArea = createElement('div');
  page.appendChild(contentArea);

  clearChildren(container);
  container.appendChild(page);

  function renderView() {
    clearChildren(contentArea);

    const allReviews = store.getPartnerReviews();
    const payments = store.getPayments ? store.getPayments() : [];
    const packages = store.getPackages ? store.getPackages() : [];

    // Filter strictly declined partner reviews
    const declined = allReviews.filter(r => (r.status || '').toLowerCase() === 'declined');

    // Enrich declined reviews with payment and package information
    const enriched = declined.map(rev => {
      const matchPayment = payments.find(p => 
        (rev.memberId && p.memberId === rev.memberId && (p.packageId === rev.packageId || rev.packageName === p.packageName)) ||
        (rev.memberEmail && (p.memberEmail || '').toLowerCase() === rev.memberEmail.toLowerCase())
      );

      const pkg = packages.find(pk => pk.id === rev.packageId) || {};
      const paidAmount = matchPayment ? (matchPayment.totalAmountInr || matchPayment.amountInr) : (pkg.priceInr || rev.refundAmount || 0);

      const isRefunded = rev.refundStatus === 'refunded';

      return {
        ...rev,
        payment: matchPayment || null,
        pkg,
        paidAmount,
        isRefunded
      };
    });

    const pendingRefunds = enriched.filter(e => !e.isRefunded);
    const completedRefunds = enriched.filter(e => e.isRefunded);

    const pendingTotalVolume = pendingRefunds.reduce((sum, e) => sum + (e.paidAmount || 0), 0);
    const completedTotalVolume = completedRefunds.reduce((sum, e) => sum + (e.paidAmount || 0), 0);

    // 2. Summary KPI Cards
    const kpiGrid = createElement('div', {
      className: 'grid grid-4',
      style: 'margin-bottom: var(--space-6); gap: var(--space-4);'
    });

    kpiGrid.appendChild(createStatCard({
      label: 'Total Declinations',
      value: declined.length.toString(),
      icon: 'x-circle',
      detail: 'Barre sessions declined'
    }));

    kpiGrid.appendChild(createStatCard({
      label: 'Pending Refunds',
      value: pendingRefunds.length.toString(),
      icon: 'clock',
      detail: 'Awaiting resolution'
    }));

    kpiGrid.appendChild(createStatCard({
      label: 'Refunds Processed',
      value: completedRefunds.length.toString(),
      icon: 'check-circle-2',
      detail: 'Reconciled & completed'
    }));

    kpiGrid.appendChild(createStatCard({
      label: 'Pending Refund Value',
      value: formatCurrency(pendingTotalVolume),
      icon: 'receipt',
      detail: 'Pending volume'
    }));

    contentArea.appendChild(kpiGrid);

    // 3. Search and Tabs Filter Bar
    const filterCard = createElement('div', {
      className: 'card',
      style: 'margin-bottom: var(--space-4); padding: var(--space-3) var(--space-4); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-3);'
    });

    let currentTab = 'all';
    let searchQuery = '';

    const tabsContainer = createElement('div', { style: 'display: flex; gap: var(--space-2); flex-wrap: wrap;' });
    const tabDefs = [
      { key: 'all', label: `All Declinations (${declined.length})` },
      { key: 'pending', label: `Pending Refund (${pendingRefunds.length})` },
      { key: 'refunded', label: `Refunded (${completedRefunds.length})` }
    ];

    const tabButtons = [];
    tabDefs.forEach(def => {
      const btn = createElement('button', {
        className: `btn btn-sm ${def.key === currentTab ? 'btn-primary' : 'btn-outline'}`,
        attributes: { type: 'button' },
        text: def.label
      });
      btn.addEventListener('click', () => {
        currentTab = def.key;
        tabButtons.forEach(b => b.classList.replace('btn-primary', 'btn-outline'));
        btn.classList.replace('btn-outline', 'btn-primary');
        renderTableList();
      });
      tabButtons.push(btn);
      tabsContainer.appendChild(btn);
    });

    const searchInput = createElement('input', {
      className: 'form-input',
      attributes: {
        type: 'text',
        placeholder: 'Search member, email, phone, or coach reason...',
        style: 'max-width: 300px; padding: 6px 12px; font-size: 13px;'
      }
    });
    searchInput.addEventListener('input', (e) => {
      searchQuery = (e.target.value || '').toLowerCase().trim();
      renderTableList();
    });

    filterCard.append(tabsContainer, searchInput);
    contentArea.appendChild(filterCard);

    // 4. Table Wrapper
    const tableContainer = createElement('div');
    contentArea.appendChild(tableContainer);

    function renderTableList() {
      clearChildren(tableContainer);

      let list = enriched;
      if (currentTab === 'pending') {
        list = list.filter(e => !e.isRefunded);
      } else if (currentTab === 'refunded') {
        list = list.filter(e => e.isRefunded);
      }

      if (searchQuery) {
        list = list.filter(e => {
          return (e.memberName || '').toLowerCase().includes(searchQuery) ||
                 (e.memberEmail || '').toLowerCase().includes(searchQuery) ||
                 (e.memberPhone || '').toLowerCase().includes(searchQuery) ||
                 (e.packageName || '').toLowerCase().includes(searchQuery) ||
                 (e.decisionReason || '').toLowerCase().includes(searchQuery) ||
                 (e.decidedBy || '').toLowerCase().includes(searchQuery) ||
                 (e.refundRef || '').toLowerCase().includes(searchQuery);
        });
      }

      if (list.length === 0) {
        const empty = createElement('div', {
          className: 'card',
          style: 'padding: var(--space-8); text-align: center; color: var(--ink-50);'
        });
        empty.innerHTML = `
          <i data-lucide="check-circle" style="width: 44px; height: 44px; margin: 0 auto var(--space-3); color: var(--olive); opacity: 0.8;"></i>
          <h3 style="font-family: var(--font-serif); font-size: 18px; color: var(--ink); margin-bottom: 6px;">No Declinations in this View</h3>
          <p style="font-size: 13px; max-width: 420px; margin: 0 auto;">There are currently no partner-declined records matching your selected filter.</p>
        `;
        tableContainer.appendChild(empty);
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons({ root: empty });
        }
        return;
      }

      const tableCard = createElement('div', { className: 'card', style: 'padding: 0; overflow: hidden;' });
      const table = createElement('table', {
        className: 'table',
        style: 'width: 100%; border-collapse: collapse; font-size: 13px;'
      });

      table.innerHTML = `
        <thead>
          <tr style="background: var(--stone); border-bottom: 1px solid var(--stone-dark); text-align: left;">
            <th style="padding: 12px 16px; font-weight: 600; color: var(--ink-70);">Member</th>
            <th style="padding: 12px 16px; font-weight: 600; color: var(--ink-70);">Contact</th>
            <th style="padding: 12px 16px; font-weight: 600; color: var(--ink-70);">Package & Amount</th>
            <th style="padding: 12px 16px; font-weight: 600; color: var(--ink-70);">Coach Declination Details</th>
            <th style="padding: 12px 16px; font-weight: 600; color: var(--ink-70);">Refund Status</th>
            <th style="padding: 12px 16px; font-weight: 600; color: var(--ink-70); text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody id="refund-table-body"></tbody>
      `;

      const tbody = table.querySelector('#refund-table-body');

      list.forEach(row => {
        const tr = createElement('tr', {
          style: 'border-bottom: 1px solid var(--stone); transition: background-color 0.15s ease;'
        });

        // Member Column
        const memberInit = (row.memberName || 'M').charAt(0).toUpperCase();
        const tdMember = createElement('td', { style: 'padding: 14px 16px;' });
        tdMember.innerHTML = `
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: #FBEAEB; color: #9A242B; font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 14px;">
              ${escapeHtml(memberInit)}
            </div>
            <div>
              <div style="font-weight: 600; color: var(--ink);">${escapeHtml(row.memberName || 'Member')}</div>
              <div style="font-size: 12px; color: var(--ink-50);">${escapeHtml(row.memberEmail || '')}</div>
            </div>
          </div>
        `;

        // Contact Column
        const tdContact = createElement('td', { style: 'padding: 14px 16px;' });
        tdContact.innerHTML = `
          <div style="color: var(--ink); font-weight: 500;">${escapeHtml(row.memberPhone || '—')}</div>
          <div style="font-size: 11px; color: var(--ink-40); font-family: var(--font-mono);">${escapeHtml((row.memberId || '').slice(0, 14))}...</div>
        `;

        // Package & Amount Column
        const tdPkg = createElement('td', { style: 'padding: 14px 16px;' });
        tdPkg.innerHTML = `
          <div style="font-weight: 600; color: var(--ink);">${escapeHtml(row.packageName || 'Barre Package')}</div>
          <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
            <span style="font-weight: 700; color: var(--ink);">${row.paidAmount ? formatCurrency(row.paidAmount) : '—'}</span>
            <span style="font-size: 11px; color: #C0392B; background: #FDEDEC; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Barre: 0 credits</span>
          </div>
        `;

        // Coach Declination Details
        const tdReason = createElement('td', { style: 'padding: 14px 16px; max-width: 280px;' });
        const coachName = row.decidedBy || 'Physicq 57 Coach';
        const decDate = row.decidedAt ? formatDate(row.decidedAt) : 'Recently';
        const reasonText = row.decisionReason || 'Partner coach safety assessment review';
        tdReason.innerHTML = `
          <div style="font-size: 12px; color: #9A242B; font-weight: 600; display: flex; align-items: center; gap: 4px;">
            <i data-lucide="alert-triangle" style="width: 13px; height: 13px;"></i>
            <span>${escapeHtml(coachName)}</span>
          </div>
          <div style="font-size: 12px; color: var(--ink); margin-top: 3px; font-style: italic; background: var(--stone); padding: 4px 8px; border-radius: 4px; border-left: 2px solid #C0392B;">
            "${escapeHtml(reasonText)}"
          </div>
          <div style="font-size: 11px; color: var(--ink-40); margin-top: 3px;">Declined on ${escapeHtml(decDate)}</div>
        `;

        // Refund Status Column
        const tdStatus = createElement('td', { style: 'padding: 14px 16px;' });
        if (row.isRefunded) {
          tdStatus.innerHTML = `
            <div>
              <span class="badge badge-success" style="display: inline-flex; align-items: center; gap: 4px;">
                <i data-lucide="check" style="width: 12px; height: 12px;"></i> Refund Processed
              </span>
              <div style="font-size: 11px; color: var(--ink-50); margin-top: 4px;">Ref: ${escapeHtml(row.refundRef || 'Completed')}</div>
              <div style="font-size: 10px; color: var(--ink-40);">${row.refundedAt ? formatDate(row.refundedAt) : ''} • ${escapeHtml(row.refundMethod || 'Gateway')}</div>
            </div>
          `;
        } else {
          tdStatus.innerHTML = `
            <div>
              <span class="badge badge-warning" style="display: inline-flex; align-items: center; gap: 4px;">
                <i data-lucide="clock" style="width: 12px; height: 12px;"></i> Pending Refund
              </span>
              <div style="font-size: 11px; color: #B9770E; margin-top: 4px; font-weight: 500;">Awaiting Payout / Reconcile</div>
            </div>
          `;
        }

        // Action Column
        const tdAction = createElement('td', { style: 'padding: 14px 16px; text-align: right;' });
        const actionBtn = createElement('button', {
          className: `btn btn-sm ${row.isRefunded ? 'btn-outline' : 'btn-primary'}`,
          attributes: { type: 'button' },
          style: 'display: inline-flex; align-items: center; gap: 5px; font-size: 12px;',
          html: row.isRefunded
            ? '<i data-lucide="file-text" style="width: 13px; height: 13px;"></i> View Receipt'
            : '<i data-lucide="rotate-ccw" style="width: 13px; height: 13px;"></i> Process Refund'
        });

        actionBtn.addEventListener('click', () => {
          openRefundModal(row, () => {
            renderView();
          });
        });

        tdAction.appendChild(actionBtn);

        tr.append(tdMember, tdContact, tdPkg, tdReason, tdStatus, tdAction);
        tbody.appendChild(tr);
      });

      tableCard.appendChild(table);
      tableContainer.appendChild(tableCard);

      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ root: tableContainer });
      }
    }

    renderTableList();
  }

  renderView();

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}

/**
 * Open modal to process or review refund for a declined member.
 * @param {Object} row
 * @param {Function} onSaved
 */
function openRefundModal(row, onSaved) {
  const content = createElement('div', { style: 'display: flex; flex-direction: column; gap: var(--space-4);' });

  // 1. Overview card
  const summaryBox = createElement('div', {
    style: 'background: var(--stone); padding: 14px 16px; border-radius: 8px; border-left: 3px solid #C0392B;'
  });
  summaryBox.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
      <div>
        <div style="font-weight: 700; color: var(--ink); font-size: 15px;">${escapeHtml(row.memberName || 'Member')}</div>
        <div style="font-size: 12px; color: var(--ink-50);">${escapeHtml(row.memberEmail || '')} • ${escapeHtml(row.memberPhone || '')}</div>
      </div>
      <span class="badge ${row.isRefunded ? 'badge-success' : 'badge-warning'}">
        ${row.isRefunded ? 'Refund Processed' : 'Awaiting Refund'}
      </span>
    </div>
    <div style="font-size: 13px; color: var(--ink); margin-top: 6px;">
      <strong>Package:</strong> ${escapeHtml(row.packageName || 'Barre Package')}
    </div>
    <div style="font-size: 13px; color: #9A242B; margin-top: 4px;">
      <strong>Partner Declination Reason:</strong> "${escapeHtml(row.decisionReason || 'Partner coach safety assessment')}"
    </div>
    <div style="font-size: 11px; color: var(--ink-50); margin-top: 4px;">
      Declined by ${escapeHtml(row.decidedBy || 'Physicq 57 Coach')} on ${row.decidedAt ? formatDateTime(row.decidedAt) : 'Recently'}
    </div>
  `;
  content.appendChild(summaryBox);

  if (row.isRefunded) {
    // Show completed refund audit details
    const receiptBox = createElement('div', {
      style: 'background: #F4F8F5; border: 1px solid #D5E8D9; border-radius: 8px; padding: 16px;'
    });
    receiptBox.innerHTML = `
      <div style="font-weight: 700; color: #2E5A44; font-size: 14px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
        <i data-lucide="check-circle-2" style="width: 16px; height: 16px;"></i>
        Refund Audit Information
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
        <div>
          <span style="color: var(--ink-50); display: block; font-size: 11px;">REFUND REFERENCE</span>
          <span style="font-family: var(--font-mono); font-weight: 600; color: var(--ink);">${escapeHtml(row.refundRef || '—')}</span>
        </div>
        <div>
          <span style="color: var(--ink-50); display: block; font-size: 11px;">SETTLEMENT METHOD</span>
          <span style="font-weight: 600; color: var(--ink);">${escapeHtml(row.refundMethod || 'Razorpay Gateway')}</span>
        </div>
        <div>
          <span style="color: var(--ink-50); display: block; font-size: 11px;">DATE PROCESSED</span>
          <span style="font-weight: 500; color: var(--ink);">${row.refundedAt ? formatDateTime(row.refundedAt) : '—'}</span>
        </div>
        <div>
          <span style="color: var(--ink-50); display: block; font-size: 11px;">PROCESSED BY</span>
          <span style="font-weight: 500; color: var(--ink);">${escapeHtml(row.refundProcessedBy || 'Studio Administrator')}</span>
        </div>
      </div>
      ${row.refundNotes ? `
        <div style="margin-top: 10px; font-size: 12px; color: var(--ink-70); border-top: 1px dashed #D5E8D9; padding-top: 8px;">
          <strong>Admin Notes:</strong> ${escapeHtml(row.refundNotes)}
        </div>
      ` : ''}
    `;
    content.appendChild(receiptBox);

    const closeBtn = createElement('button', {
      className: 'btn btn-secondary',
      text: 'Close Audit'
    });

    const modal = openModal({
      title: `Refund Record — ${row.memberName || 'Member'}`,
      content,
      maxWidth: '560px',
      actions: [closeBtn]
    });

    closeBtn.addEventListener('click', () => modal.close());
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: content });
    }
    return;
  }

  // 2. Refund input form for pending requests
  const formBox = createElement('div', { style: 'display: flex; flex-direction: column; gap: var(--space-3);' });

  const defaultAmount = row.paidAmount || (row.pkg && row.pkg.priceInr) || 0;

  formBox.innerHTML = `
    <div>
      <label style="display: block; font-size: 12px; font-weight: 600; color: var(--ink); margin-bottom: 4px;">
        Refund Amount (INR) *
      </label>
      <input type="number" id="refund-amount" class="form-input" value="${defaultAmount}" min="0" step="100" style="width: 100%; font-weight: 600; font-size: 14px;" />
      <span style="font-size: 11px; color: var(--ink-50);">Standard package gross: ${formatCurrency(defaultAmount)}</span>
    </div>

    <div>
      <label style="display: block; font-size: 12px; font-weight: 600; color: var(--ink); margin-bottom: 4px;">
        Refund Channel / Settlement Method *
      </label>
      <select id="refund-method" class="form-input" style="width: 100%; font-size: 13px;">
        <option value="Razorpay Gateway Refund">Razorpay Payment Gateway Refund</option>
        <option value="Direct Bank Transfer (IMPS/NEFT)">Direct Bank Transfer (IMPS/NEFT)</option>
        <option value="UPI Transfer">UPI Transfer</option>
        <option value="Studio Credit Note">Studio Credit Note / Pass Adjustment</option>
        <option value="Cash / Counter Payout">Cash / Counter Payout</option>
      </select>
    </div>

    <div>
      <label style="display: block; font-size: 12px; font-weight: 600; color: var(--ink); margin-bottom: 4px;">
        Refund Transaction / Reference ID *
      </label>
      <input type="text" id="refund-ref" class="form-input" value="RFND-${Date.now().toString().slice(-8)}" placeholder="e.g. RZP_rfnd_..., UTR number, or Credit Note #" style="width: 100%; font-size: 13px; font-family: var(--font-mono);" />
    </div>

    <div>
      <label style="display: block; font-size: 12px; font-weight: 600; color: var(--ink); margin-bottom: 4px;">
        Reconciliation Notes
      </label>
      <textarea id="refund-notes" class="form-input" rows="2" placeholder="e.g. Partner declined due to back injury. Barre portion refunded via Razorpay." style="width: 100%; font-size: 12px; resize: vertical;"></textarea>
    </div>
  `;
  content.appendChild(formBox);

  const cancelBtn = createElement('button', {
    className: 'btn btn-secondary',
    text: 'Cancel'
  });

  const confirmBtn = createElement('button', {
    className: 'btn btn-primary',
    style: 'display: inline-flex; align-items: center; gap: 6px;',
    html: '<i data-lucide="check" style="width: 14px; height: 14px;"></i> Confirm & Record Refund'
  });

  const modal = openModal({
    title: `Record Refund — ${row.memberName || 'Member'}`,
    content,
    maxWidth: '560px',
    actions: [cancelBtn, confirmBtn]
  });

  cancelBtn.addEventListener('click', () => modal.close());

  confirmBtn.addEventListener('click', async () => {
    const amountVal = parseFloat(content.querySelector('#refund-amount').value) || 0;
    const methodVal = content.querySelector('#refund-method').value;
    const refVal = (content.querySelector('#refund-ref').value || '').trim();
    const notesVal = (content.querySelector('#refund-notes').value || '').trim();

    if (!refVal) {
      showToast('Please enter a refund reference ID or UTR number.', 'warning');
      return;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing...';

    try {
      await store.processPartnerRefund(row.id, {
        amount: amountVal,
        refundMethod: methodVal,
        refundRef: refVal,
        notes: notesVal,
        processedBy: 'Studio Administrator'
      });

      showToast(`Refund record ${refVal} successfully registered.`, 'success');
      modal.close();
      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      showToast(`Failed to process refund: ${err.message}`, 'error');
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i data-lucide="check" style="width: 14px; height: 14px;"></i> Confirm & Record Refund';
    }
  });

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: content });
  }
}
