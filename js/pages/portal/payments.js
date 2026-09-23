/**
 * Plash Pilates — Member Payment History Page
 * Displays chronological transaction history with sophisticated, downloadable tax receipts.
 * @module payments
 */

import { createElement, clearChildren } from '../../utils/dom.js';
import { formatCurrency, formatDate, formatTime } from '../../utils/format.js';
import * as store from '../../core/store.js';
import * as auth from '../../core/auth.js';
import { createStatCard } from '../../components/stat-card.js';
import { createDataTable } from '../../components/data-table.js';
import { createEmptyState } from '../../components/empty-state.js';
import { openReceiptModal } from '../../components/receipt-modal.js';
import { showToast } from '../../components/toast.js';

/**
 * Render the Payment History page.
 * @param {HTMLElement} container
 */
export async function render(container) {
  clearChildren(container);

  const memberId = auth.getCurrentMemberId();
  if (!memberId) {
    window.location.hash = '#/login';
    return;
  }

  // 0. Loading State
  const loadingState = createElement('div', {
    className: 'page-container',
    style: 'display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 280px; gap: var(--space-4);'
  });
  loadingState.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; color: var(--rust); font-family: var(--font-sans); font-size: 15px; font-weight: 600;">
      <i data-lucide="loader-2" class="spin" style="width: 22px; height: 22px; animation: spin 1s linear infinite;"></i>
      <span>Retrieving verified tax invoices & payments from Supabase...</span>
    </div>
    <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
  `;
  container.appendChild(loadingState);
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: loadingState });
  }

  // 1. Authoritative Live Fetch from Supabase
  let fetchError = null;
  try {
    await Promise.all([
      store.fetchMemberPayments(memberId).catch(err => { fetchError = err; }),
      store.fetchMemberPasses(memberId).catch(() => {})
    ]);
  } catch (err) {
    console.error('[Payment History fetch error]', err);
    fetchError = err;
  }

  clearChildren(container);

  const payments = store.getPaymentHistory(memberId);
  const activePass = store.getActiveMemberPass(memberId);

  const page = createElement('div', { className: 'page-container' });

  // Error Banner if Supabase returned a hard error
  if (fetchError && payments.length === 0) {
    const errorBanner = createElement('div', {
      className: 'card',
      style: 'margin-bottom: var(--space-4); border: 1px solid var(--rust-40); background: #fff5f2; padding: var(--space-4);'
    });
    errorBanner.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3);">
        <div style="display: flex; align-items: center; gap: 8px; color: var(--rust);">
          <i data-lucide="alert-circle" style="width: 18px; height: 18px; flex-shrink: 0;"></i>
          <span style="font-weight: 600; font-size: 13.5px;">Unable to load records from Supabase: ${fetchError.message || 'Database error'}.</span>
        </div>
        <button id="btn-retry-payments" class="btn btn-secondary btn-sm">
          <i data-lucide="refresh-cw" style="width: 14px; height: 14px; margin-right: 6px;"></i>Retry
        </button>
      </div>
    `;
    const retryBtn = errorBanner.querySelector('#btn-retry-payments');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => render(container));
    }
    page.appendChild(errorBanner);
  }

  // 1. Page Header
  const header = createElement('div', { className: 'page-header' });
  const titleGroup = createElement('div');
  const title = createElement('h1', { className: 'page-title', text: 'Payment & Invoice History' });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    text: 'Access and download official GST-compliant tax invoices and payment receipts for your boutique studio memberships.'
  });
  titleGroup.append(title, subtitle);

  const headerActions = createElement('div', { className: 'page-actions' });
  const buyBtn = createElement('a', {
    className: 'btn btn-primary btn-sm',
    attributes: { href: '#/portal/packages' },
    text: 'Purchase New Pass'
  });
  headerActions.appendChild(buyBtn);
  header.append(titleGroup, headerActions);
  page.appendChild(header);

  // 2. Overview Stats Cards
  const statsGrid = createElement('div', { className: 'grid grid-2 dashboard-stats', style: 'margin-bottom: var(--space-6);' });

  const totalInvoices = payments.length;

  const invoicesCountCard = createStatCard({
    label: 'Verified Tax Invoices',
    value: String(totalInvoices),
    detail: 'All receipts available for download'
  });

  const activePassCard = createStatCard({
    label: 'Current Membership',
    value: activePass ? activePass.packageName : 'No Active Pass',
    detail: activePass ? `Status: ${activePass.status.toUpperCase()}` : 'Visit packages to enroll'
  });

  statsGrid.append(invoicesCountCard, activePassCard);
  page.appendChild(statsGrid);

  // 3. Transactions Section
  const section = createElement('div', { className: 'card' });
  const sectionHeader = createElement('div', {
    style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);'
  });
  const sectionTitle = createElement('h2', {
    style: 'font-size: var(--text-base); font-weight: var(--weight-bold); color: var(--ink);',
    text: 'Tax Invoices & Transaction Records'
  });
  sectionHeader.appendChild(sectionTitle);
  section.appendChild(sectionHeader);

  if (payments.length === 0) {
    const empty = createEmptyState({
      icon: 'receipt',
      title: 'No payment records found',
      description: 'You have not made any membership package transactions yet. Browse our packages to join a class.',
      action: createElement('a', {
        className: 'btn btn-primary btn-sm',
        attributes: { href: '#/portal/packages' },
        text: 'View Studio Packages'
      })
    });
    section.appendChild(empty);
  } else {
    const tableData = payments.map(p => {
      const pDate = new Date(p.createdAt);
      return {
        id: p.id,
        dateTime: `${formatDate(pDate)} at ${formatTime(pDate)}`,
        invoiceNo: p.invoiceNo,
        packageName: p.packageName,
        method: p.paymentMethod,
        amount: formatCurrency(p.totalAmountInr || p.amountInr),
        taxDetails: `Base: ${formatCurrency(p.baseAmountInr)} + GST: ${formatCurrency((p.cgstInr || 0) + (p.sgstInr || 0))}`,
        status: p.status,
        raw: p
      };
    });

    const columns = [
      {
        key: 'dateTime',
        label: 'Date & Time',
        sortable: true,
        render: (val, row) => {
          const wrap = createElement('div');
          const d = createElement('div', { style: 'font-weight: var(--weight-medium); color: var(--ink); white-space: nowrap;', text: val });
          const ref = createElement('div', { style: 'font-size: 11px; color: var(--ink-50); font-family: var(--font-sans); font-weight: 500; white-space: nowrap;', text: `Ref: ${row.raw.reference || row.id}` });
          wrap.append(d, ref);
          return wrap;
        }
      },
      {
        key: 'invoiceNo',
        label: 'Invoice #',
        sortable: true,
        render: (val) => {
          return createElement('span', {
            style: 'font-family: var(--font-sans); font-weight: 700; color: var(--rust); background: var(--rust-10); padding: 4px 10px; border-radius: var(--radius-sm); font-size: 11px; white-space: nowrap; display: inline-block; letter-spacing: 0.3px;',
            text: val
          });
        }
      },
      {
        key: 'packageName',
        label: 'Package / Service',
        sortable: true,
        render: (val, row) => {
          const wrap = createElement('div');
          const title = createElement('div', { style: 'font-weight: var(--weight-semibold); color: var(--ink);', text: val });
          const method = createElement('div', { style: 'font-size: 11px; color: var(--ink-50);', text: `Paid via ${row.method}` });
          wrap.append(title, method);
          return wrap;
        }
      },
      {
        key: 'amount',
        label: 'Amount Paid',
        sortable: true,
        render: (val, row) => {
          const wrap = createElement('div', { style: 'text-align: right;' });
          const amt = createElement('div', { style: 'font-weight: var(--weight-bold); color: var(--ink); font-size: var(--text-sm);', text: val });
          const tax = createElement('div', { style: 'font-size: 10px; color: var(--ink-50);', text: row.taxDetails });
          wrap.append(amt, tax);
          return wrap;
        }
      },
      {
        key: 'status',
        label: 'Status',
        sortable: false,
        render: () => {
          const badge = createElement('span', {
            className: 'badge badge-success',
            style: 'font-size: 11px;',
            text: 'Paid & Settled'
          });
          return badge;
        }
      },
      {
        key: 'actions',
        label: 'Receipt Actions',
        sortable: false,
        render: (_, row) => {
          const group = createElement('div', { style: 'display: flex; gap: var(--space-2); justify-content: flex-end;' });

          const viewBtn = createElement('button', {
            className: 'btn btn-outline btn-sm',
            attributes: { type: 'button', title: 'View Official Tax Invoice' },
            text: 'View Receipt'
          });
          viewBtn.prepend(createElement('i', { attributes: { 'data-lucide': 'file-text' }, style: 'width: 14px; height: 14px; margin-right: 4px;' }));
          viewBtn.addEventListener('click', () => {
            openReceiptModal(row.raw);
          });

          const emailBtn = createElement('button', {
            className: 'btn btn-secondary btn-sm',
            attributes: { type: 'button', title: 'Email Official Tax Invoice Receipt' },
            text: 'Email Receipt'
          });
          emailBtn.prepend(createElement('i', { attributes: { 'data-lucide': 'mail' }, style: 'width: 14px; height: 14px; margin-right: 4px;' }));
          emailBtn.addEventListener('click', async () => {
            try {
              emailBtn.disabled = true;
              emailBtn.innerHTML = '<i data-lucide="loader-2" style="width: 14px; height: 14px; animation: spin 1s linear infinite;"></i>';
              const member = store.resolveMember(row.raw.member || row.raw.memberId || memberId) || {};
              const res = await fetch('/api/send-receipt-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  paymentId: row.raw.id,
                  invoiceNo: row.raw.invoiceNo || row.raw.invoice_no,
                  email: member.email || ''
                })
              });
              const data = await res.json();
              if (!res.ok || !data.success) throw new Error(data.error || 'Failed to dispatch email');
              showToast(`Invoice ${row.raw.invoiceNo || row.raw.invoice_no} emailed to ${data.email || member.email || 'inbox'}!`, 'success');
              emailBtn.innerHTML = '<i data-lucide="check" style="width: 14px; height: 14px;"></i>';
              setTimeout(() => {
                emailBtn.disabled = false;
                emailBtn.innerHTML = '<i data-lucide="mail" style="width: 14px; height: 14px; margin-right: 4px;"></i>Email Receipt';
                if (window.lucide) window.lucide.createIcons({ root: emailBtn });
              }, 2500);
            } catch (err) {
              showToast(`Error: ${err.message}`, 'error');
              emailBtn.disabled = false;
              emailBtn.innerHTML = '<i data-lucide="mail" style="width: 14px; height: 14px; margin-right: 4px;"></i>Email Receipt';
              if (window.lucide) window.lucide.createIcons({ root: emailBtn });
            }
          });

          group.append(viewBtn, emailBtn);
          return group;
        }
      }
    ];

    const table = createDataTable({
      columns,
      data: tableData,
      searchable: true,
      searchPlaceholder: 'Search by invoice #, package, or reference...',
      pagination: true,
      pageSize: 10
    });

    section.appendChild(table);
  }

  page.appendChild(section);

  if (!window.location.hash.startsWith('#/portal/payments')) {
    return;
  }
  clearChildren(container);
  container.appendChild(page);

  // Trigger Lucide icons creation
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}
