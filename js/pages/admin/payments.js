/**
 * Plash Pilates — Studio Admin: Payments & Tax Invoices
 * Complete authoritative financial ledger with 10-per-page pagination,
 * real-time member identity resolution, and official GST tax invoice inspections.
 * @module pages/admin/payments
 */

import { createElement, clearChildren, escapeHtml } from '../../utils/dom.js';
import { formatCurrency, formatDate, formatTime, formatDateTime } from '../../utils/format.js';
import * as store from '../../core/store.js';
import { createStatCard } from '../../components/stat-card.js';
import { createBadge } from '../../components/badge.js';
import { openReceiptModal } from '../../components/receipt-modal.js';
import { showToast } from '../../components/toast.js';

const PAGE_SIZE = 10;

/**
 * Render the Admin Payments & Invoices Ledger.
 * @param {HTMLElement} container
 */
export async function render(container) {
  clearChildren(container);

  // 1. Loading State
  const loadingWrap = createElement('div', {
    className: 'page-container',
    style: 'display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 280px; gap: var(--space-4);'
  });
  loadingWrap.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; color: var(--moss); font-family: var(--font-sans); font-size: 15px; font-weight: 600;">
      <i data-lucide="loader-2" class="spin" style="width: 22px; height: 22px; animation: spin 1s linear infinite;"></i>
      <span>Loading studio financial ledger and tax invoices...</span>
    </div>
    <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
  `;
  container.appendChild(loadingWrap);
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: loadingWrap });
  }

  // 2. Fetch all payments authoritatively
  try {
    await store.fetchAdminPayments();
  } catch (err) {
    console.error('[Admin Payments fetch warning]', err);
  }

  clearChildren(container);

  const page = createElement('div', { className: 'page-container' });

  // 3. Page Header
  const header = createElement('div', {
    className: 'page-header',
    style: 'display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--space-4); margin-bottom: var(--space-6);'
  });

  const headerLeft = createElement('div');
  const title = createElement('h1', { className: 'page-title', text: 'Payments & Tax Invoices' });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    text: 'Authoritative financial ledger, transaction tracking, itemized GST tax invoices, and member payment records.'
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
    showToast('Fetching latest payments from Supabase...', 'info');
    await store.fetchAdminPayments();
    refreshBtn.disabled = false;
    render(container);
  });

  const exportBtn = createElement('button', {
    className: 'btn btn-secondary',
    style: 'display: inline-flex; align-items: center; gap: 6px; font-size: 13px;',
    html: '<i data-lucide="download" style="width: 14px; height: 14px;"></i> Export CSV'
  });
  exportBtn.addEventListener('click', () => {
    exportPaymentsCSV(store.getAllPayments());
  });

  headerActions.append(refreshBtn, exportBtn);
  header.append(headerLeft, headerActions);
  page.appendChild(header);

  // 4. Financial KPI Stat Cards
  const allPayments = store.getAllPayments();
  const totalRevenue = allPayments.reduce((acc, p) => acc + (Number(p.totalAmountInr || p.amountInr) || 0), 0);
  const totalGst = allPayments.reduce((acc, p) => acc + ((Number(p.cgstInr) || 0) + (Number(p.sgstInr) || 0)), 0);
  const totalCount = allPayments.length;
  const avgTicket = totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0;

  const statsGrid = createElement('div', {
    style: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6);'
  });

  const kpis = [
    { label: 'Total Studio Revenue', val: formatCurrency(totalRevenue), icon: 'credit-card', color: 'var(--moss)', sub: 'Gross collections (inc. GST)' },
    { label: 'Settled Transactions', val: totalCount, icon: 'receipt', color: 'var(--ink)', sub: 'Official tax invoices issued' },
    { label: 'Average Ticket Value', val: formatCurrency(avgTicket), icon: 'trending-up', color: 'var(--olive)', sub: 'Mean transaction size' },
    { label: 'GST Collected (18%)', val: formatCurrency(totalGst), icon: 'file-check', color: 'var(--rust)', sub: 'CGST 9% + SGST 9%' }
  ];

  kpis.forEach(k => {
    const card = createElement('div', {
      className: 'card',
      style: 'padding: var(--space-4) var(--space-5); display: flex; align-items: center; justify-content: space-between;'
    });
    card.innerHTML = `
      <div>
        <div style="font-size: var(--text-xs); color: var(--ink-50); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">${k.label}</div>
        <div style="font-size: var(--text-2xl); font-weight: 800; color: ${k.color}; font-family: var(--font-serif);">${k.val}</div>
        <div style="font-size: 11px; color: var(--ink-50); margin-top: 2px;">${k.sub}</div>
      </div>
      <div style="width: 42px; height: 42px; border-radius: 10px; background: var(--stone); display: flex; align-items: center; justify-content: center; color: ${k.color}; flex-shrink: 0;">
        <i data-lucide="${k.icon}" style="width: 22px; height: 22px;"></i>
      </div>
    `;
    statsGrid.appendChild(card);
  });
  page.appendChild(statsGrid);

  // 5. State for Filtering & Pagination
  let searchQuery = '';
  let statusFilter = 'all';
  let currentPage = 1;

  // Toolbar (Search & Filter)
  const toolbarCard = createElement('div', {
    className: 'card',
    style: 'padding: var(--space-4); margin-bottom: var(--space-5); background: var(--sand); border: 1px solid var(--stone-dark);'
  });

  const toolbarFlex = createElement('div', {
    style: 'display: flex; gap: var(--space-3); align-items: center; flex-wrap: wrap; justify-content: space-between;'
  });

  // Search input
  const searchWrap = createElement('div', {
    style: 'position: relative; flex: 1; min-width: 260px;'
  });
  searchWrap.innerHTML = `
    <i data-lucide="search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--ink-50);"></i>
    <input type="search" placeholder="Search by member, email, invoice #, or ref..." class="form-input" style="padding-left: 36px; width: 100%; font-size: 13.5px;" />
  `;
  const searchInput = searchWrap.querySelector('input');
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    currentPage = 1;
    renderTable();
  });

  // Status Filter Select
  const statusSelect = createElement('select', {
    className: 'form-input',
    style: 'width: auto; min-width: 150px; font-size: 13.5px;'
  });
  statusSelect.innerHTML = `
    <option value="all">All Statuses</option>
    <option value="paid">Paid / Captured</option>
    <option value="pending">Pending</option>
  `;
  statusSelect.addEventListener('change', (e) => {
    statusFilter = e.target.value;
    currentPage = 1;
    renderTable();
  });

  toolbarFlex.append(searchWrap, statusSelect);
  toolbarCard.appendChild(toolbarFlex);
  page.appendChild(toolbarCard);

  // Table Container Box
  const tableContainer = createElement('div', { className: 'card', style: 'padding: 0; overflow: hidden; border: 1px solid var(--stone-dark);' });
  page.appendChild(tableContainer);

  // Pagination Footer Wrapper
  const paginationFooter = createElement('div', {
    style: 'display: flex; align-items: center; justify-content: space-between; padding: var(--space-4); background: var(--stone); border-top: 1px solid var(--stone-dark); flex-wrap: wrap; gap: var(--space-3);'
  });
  tableContainer.appendChild(paginationFooter);

  // Main dynamic table renderer
  function renderTable() {
    // 1. Filter rows
    const filtered = allPayments.filter(p => {
      // Status filter
      if (statusFilter !== 'all') {
        const s = (p.status || 'paid').toLowerCase();
        if (s !== statusFilter) return false;
      }

      // Search query
      if (searchQuery) {
        const member = store.resolveMember(p.member || p.memberId) || p.member || {};
        const memberName = (member.fullName || member.full_name || member.name || '').toLowerCase();
        const memberEmail = (member.email || '').toLowerCase();
        const memberPhone = (member.phone || '').toLowerCase();
        const invoiceNo = (p.invoiceNo || p.invoice_no || '').toLowerCase();
        const ref = (p.reference || p.id || '').toLowerCase();
        const pkgName = (p.packageName || (p.package && p.package.name) || '').toLowerCase();

        const match = memberName.includes(searchQuery) ||
          memberEmail.includes(searchQuery) ||
          memberPhone.includes(searchQuery) ||
          invoiceNo.includes(searchQuery) ||
          ref.includes(searchQuery) ||
          pkgName.includes(searchQuery);

        if (!match) return false;
      }

      return true;
    });

    const totalRecords = filtered.length;
    const totalPages = Math.ceil(totalRecords / PAGE_SIZE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, totalRecords);
    const pagedPayments = filtered.slice(startIdx, endIdx);

    // Render table DOM
    let existingTable = tableContainer.querySelector('.admin-payments-table-wrap');
    if (existingTable) existingTable.remove();

    const tableWrap = createElement('div', {
      className: 'admin-payments-table-wrap',
      style: 'overflow-x: auto;'
    });

    if (pagedPayments.length === 0) {
      tableWrap.innerHTML = `
        <div style="padding: var(--space-8); text-align: center; color: var(--ink-50);">
          <i data-lucide="inbox" style="width: 38px; height: 38px; margin-bottom: 8px; stroke-width: 1.5; color: var(--ink-30);"></i>
          <p style="font-weight: 600; font-size: 15px; color: var(--ink); margin-bottom: 4px;">No payment records found</p>
          <p style="font-size: 13px;">${searchQuery ? 'Try adjusting your search query or status filter.' : 'No transactions recorded yet.'}</p>
        </div>
      `;
    } else {
      const table = createElement('table', {
        className: 'data-table',
        style: 'width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;'
      });

      table.innerHTML = `
        <thead>
          <tr style="background: var(--stone); border-bottom: 1px solid var(--stone-dark);">
            <th style="padding: var(--space-3) var(--space-4); font-weight: 700; color: var(--ink-70); font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.5px;">Date & Time (IST)</th>
            <th style="padding: var(--space-3) var(--space-4); font-weight: 700; color: var(--ink-70); font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.5px;">Member Identity</th>
            <th style="padding: var(--space-3) var(--space-4); font-weight: 700; color: var(--ink-70); font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.5px;">Package Purchased</th>
            <th style="padding: var(--space-3) var(--space-4); font-weight: 700; color: var(--ink-70); font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.5px;">Invoice & Ref</th>
            <th style="padding: var(--space-3) var(--space-4); font-weight: 700; color: var(--ink-70); font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.5px; text-align: right;">Amount & GST</th>
            <th style="padding: var(--space-3) var(--space-4); font-weight: 700; color: var(--ink-70); font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.5px; text-align: center;">Status</th>
            <th style="padding: var(--space-3) var(--space-4); font-weight: 700; color: var(--ink-70); font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.5px; text-align: center;">Tax Receipt</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;

      const tbody = table.querySelector('tbody');

      pagedPayments.forEach((p, idx) => {
        const member = store.resolveMember(p.member || p.memberId) || p.member || {};
        const memberName = member.fullName || member.full_name || member.name || 'Studio Member';
        const memberEmail = member.email || '';
        const memberPhone = member.phone || '';
        const memberTier = member.tier || 'First Circle';
        const initial = memberName.charAt(0).toUpperCase();

        const tr = createElement('tr', {
          style: `border-bottom: 1px solid var(--stone-dark); ${idx % 2 === 1 ? 'background: rgba(0,0,0,0.01);' : ''}`
        });

        // 1. Date (Asia/Kolkata)
        const dateTd = createElement('td', { style: 'padding: var(--space-3) var(--space-4); vertical-align: middle; white-space: nowrap;' });
        const pDate = new Date(p.createdAt || Date.now());
        dateTd.innerHTML = `
          <div style="font-weight: 700; color: var(--ink);">${formatDate(pDate)}</div>
          <div style="font-size: 11px; color: var(--ink-50);">${formatTime(pDate)} IST</div>
        `;

        // 2. Member Identity
        const memberTd = createElement('td', { style: 'padding: var(--space-3) var(--space-4); vertical-align: middle;' });
        const memberWrap = createElement('div', { style: 'display: flex; align-items: center; gap: 10px;' });
        const avatar = createElement('div', {
          style: 'width: 34px; height: 34px; border-radius: 50%; background: var(--stone-dark); color: var(--ink); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0;',
          text: initial
        });
        const mInfo = createElement('div', { style: 'display: flex; flex-direction: column; min-width: 0;' });
        mInfo.innerHTML = `
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-weight: 700; color: var(--ink); font-size: 13.5px;">${escapeHtml(memberName)}</span>
            <span style="font-size: 10px; font-weight: 700; background: var(--stone); color: var(--moss); padding: 1px 5px; border-radius: 3px; text-transform: uppercase;">${escapeHtml(memberTier)}</span>
          </div>
          <div style="font-size: 11.5px; color: var(--ink-50); line-height: 1.3;">${escapeHtml(memberEmail)}</div>
          ${memberPhone ? `<div style="font-size: 11px; color: var(--ink-50);">${escapeHtml(memberPhone)}</div>` : ''}
        `;
        memberWrap.append(avatar, mInfo);
        memberTd.appendChild(memberWrap);

        // 3. Package
        const pkgTd = createElement('td', { style: 'padding: var(--space-3) var(--space-4); vertical-align: middle;' });
        const pkgName = p.packageName || (p.package && p.package.name) || 'Studio Pass';
        const credits = (p.package && p.package.credits) ? `${p.package.credits} Credits` : '';
        pkgTd.innerHTML = `
          <div style="font-weight: 600; color: var(--ink);">${escapeHtml(pkgName)}</div>
          ${credits ? `<div style="font-size: 11px; color: var(--moss); font-weight: 600;">${credits}</div>` : ''}
        `;

        // 4. Invoice & Ref
        const invTd = createElement('td', { style: 'padding: var(--space-3) var(--space-4); vertical-align: middle; white-space: nowrap;' });
        const invNo = p.invoiceNo || p.invoice_no || `PLASH-INV-${p.id.slice(0, 8)}`;
        const refStr = p.reference || p.id;
        invTd.innerHTML = `
          <div style="font-weight: 700; color: var(--ink); font-family: monospace; font-size: 12px;">${escapeHtml(invNo)}</div>
          <div style="font-size: 11px; color: var(--ink-50); font-family: monospace;" title="Gateway Reference">${escapeHtml(refStr)}</div>
        `;

        // 5. Amount & GST Breakdown
        const amountTd = createElement('td', { style: 'padding: var(--space-3) var(--space-4); vertical-align: middle; text-align: right; white-space: nowrap;' });
        const total = Number(p.totalAmountInr || p.amountInr) || 0;
        const base = Number(p.baseAmountInr) || Math.round(total / 1.18);
        const gst = (Number(p.cgstInr) || 0) + (Number(p.sgstInr) || 0) || (total - base);
        amountTd.innerHTML = `
          <div style="font-weight: 800; font-size: 14.5px; color: var(--ink); font-family: var(--font-serif);">${formatCurrency(total)}</div>
          <div style="font-size: 11px; color: var(--ink-50);">Base: ${formatCurrency(base)} + GST: ${formatCurrency(gst)}</div>
        `;

        // 6. Status
        const statusTd = createElement('td', { style: 'padding: var(--space-3) var(--space-4); vertical-align: middle; text-align: center; white-space: nowrap;' });
        const status = (p.status || 'paid').toLowerCase();
        let badgeVariant = 'success';
        if (status === 'pending') badgeVariant = 'pending';
        if (status === 'failed') badgeVariant = 'danger';
        const badge = createBadge({ label: status.toUpperCase(), variant: badgeVariant });
        statusTd.appendChild(badge);

        // 7. Actions (Tax Receipt Modal & Email)
        const actionTd = createElement('td', { style: 'padding: var(--space-3) var(--space-4); vertical-align: middle; text-align: center; white-space: nowrap;' });
        const receiptBtn = createElement('button', {
          className: 'btn btn-secondary btn-sm',
          style: 'padding: 4px 10px; font-size: 12px; display: inline-flex; align-items: center; gap: 5px;',
          html: '<i data-lucide="file-text" style="width: 13px; height: 13px;"></i> View Invoice'
        });
        receiptBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openReceiptModal(p);
        });
        actionTd.appendChild(receiptBtn);

        tr.append(dateTd, memberTd, pkgTd, invTd, amountTd, statusTd, actionTd);
        tbody.appendChild(tr);
      });

      tableWrap.appendChild(table);
    }

    tableContainer.insertBefore(tableWrap, paginationFooter);

    // Update Pagination Footer Controls
    clearChildren(paginationFooter);

    // Showing X–Y of Z
    const infoText = createElement('div', {
      style: 'font-size: 13px; color: var(--ink-70); font-weight: 500;',
      text: totalRecords > 0 ? `Showing ${startIdx + 1}–${endIdx} of ${totalRecords} payments (Page ${currentPage} of ${totalPages})` : 'Showing 0 records'
    });
    paginationFooter.appendChild(infoText);

    // Pagination Buttons
    const btnGroup = createElement('div', {
      style: 'display: flex; align-items: center; gap: 6px;'
    });

    const prevBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      style: 'padding: 4px 10px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;',
      html: '<i data-lucide="chevron-left" style="width: 14px; height: 14px;"></i> Prev',
      attributes: { type: 'button' }
    });
    if (currentPage <= 1) {
      prevBtn.disabled = true;
      prevBtn.style.opacity = '0.5';
    }
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
        tableContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    btnGroup.appendChild(prevBtn);

    // Render individual page numbers
    for (let pNum = 1; pNum <= totalPages; pNum++) {
      // If totalPages is large, window the buttons
      if (totalPages > 7) {
        if (pNum !== 1 && pNum !== totalPages && Math.abs(pNum - currentPage) > 2) {
          if (pNum === 2 || pNum === totalPages - 1) {
            btnGroup.appendChild(createElement('span', { style: 'padding: 0 4px; color: var(--ink-50);', text: '...' }));
          }
          continue;
        }
      }

      const pBtn = createElement('button', {
        className: pNum === currentPage ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm',
        style: `min-width: 30px; padding: 4px 8px; font-size: 12px; font-weight: 700; ${pNum === currentPage ? 'background: var(--moss); color: white;' : ''}`,
        text: String(pNum)
      });
      pBtn.addEventListener('click', () => {
        currentPage = pNum;
        renderTable();
        tableContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      btnGroup.appendChild(pBtn);
    }

    const nextBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      style: 'padding: 4px 10px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;',
      html: 'Next <i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i>',
      attributes: { type: 'button' }
    });
    if (currentPage >= totalPages) {
      nextBtn.disabled = true;
      nextBtn.style.opacity = '0.5';
    }
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
        tableContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    btnGroup.appendChild(nextBtn);
    paginationFooter.appendChild(btnGroup);

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: tableContainer });
    }
  }

  // Initial render of table
  renderTable();

  container.appendChild(page);
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: page });
  }
}

/**
 * Export payments ledger to CSV.
 * @param {Array} payments
 */
function exportPaymentsCSV(payments) {
  if (!payments || payments.length === 0) {
    showToast('No payment records to export', 'warning');
    return;
  }

  const headers = [
    'Invoice Number',
    'Payment Date (IST)',
    'Member Name',
    'Member Email',
    'Member Phone',
    'Package Name',
    'Base Amount (INR)',
    'CGST 9% (INR)',
    'SGST 9% (INR)',
    'Total Amount (INR)',
    'Payment Method',
    'Gateway Reference',
    'Payment Status'
  ];

  const rows = payments.map(p => {
    const member = store.resolveMember(p.member || p.memberId) || p.member || {};
    const memberName = member.fullName || member.full_name || member.name || 'Studio Member';
    const memberEmail = member.email || '';
    const memberPhone = member.phone || '';
    const pkgName = p.packageName || (p.package && p.package.name) || 'Studio Pass';
    const total = Number(p.totalAmountInr || p.amountInr) || 0;
    const base = Number(p.baseAmountInr) || Math.round(total / 1.18);
    const cgst = Number(p.cgstInr) || Math.round((total - base) / 2);
    const sgst = Number(p.sgstInr) || (total - base - cgst);
    const invNo = p.invoiceNo || p.invoice_no || `PLASH-INV-${p.id}`;
    const pDate = formatDateTime(p.createdAt || Date.now());

    return [
      `"${invNo}"`,
      `"${pDate}"`,
      `"${memberName.replace(/"/g, '""')}"`,
      `"${memberEmail.replace(/"/g, '""')}"`,
      `"${memberPhone.replace(/"/g, '""')}"`,
      `"${pkgName.replace(/"/g, '""')}"`,
      base,
      cgst,
      sgst,
      total,
      `"${p.paymentMethod || 'Razorpay UPI/Card'}"`,
      `"${p.reference || p.id}"`,
      `"${p.status || 'paid'}"`
    ].join(',');
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `plash_payments_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Payments ledger CSV exported successfully!', 'success');
}
