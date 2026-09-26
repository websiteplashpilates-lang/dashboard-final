/**
 * Plash Pilates — Member Payment & Tax Invoice History
 * Displays verified transaction history with sleek, boutique styling and downloadable GST receipts.
 * @module payments
 */

import { createElement, clearChildren, escapeHtml } from '../../utils/dom.js';
import { formatCurrency, formatDate, formatTime } from '../../utils/format.js';
import * as store from '../../core/store.js';
import * as auth from '../../core/auth.js';
import { createDataTable } from '../../components/data-table.js';
import { createEmptyState } from '../../components/empty-state.js';
import { openReceiptModal, downloadReceipt } from '../../components/receipt-modal.js';
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
    <div style="display: flex; align-items: center; gap: 12px; color: var(--rust); font-family: var(--font-sans); font-size: 14.5px; font-weight: 600;">
      <i data-lucide="loader-2" class="spin" style="width: 20px; height: 20px; animation: spin 1s linear infinite;"></i>
      <span>Loading verified tax invoices & payments...</span>
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
          <span style="font-weight: 600; font-size: 13.5px;">Unable to load records: ${escapeHtml(fetchError.message || 'Database error')}.</span>
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

  // 1. Clean Page Header
  const header = createElement('div', {
    className: 'page-header',
    style: 'display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-4); margin-bottom: var(--space-5);'
  });
  const titleGroup = createElement('div');
  const title = createElement('h1', { className: 'page-title', text: 'Payment & Tax Invoices' });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    style: 'margin-top: 4px; font-size: 13.5px; color: var(--ink-70);',
    text: 'Access and download official GST-compliant tax invoices and payment receipts for your studio passes.'
  });
  titleGroup.append(title, subtitle);

  const headerActions = createElement('div', { className: 'page-actions' });
  const buyBtn = createElement('a', {
    className: 'btn btn-primary btn-sm',
    attributes: { href: '#/portal/packages' },
    style: 'display: inline-flex; align-items: center; gap: 6px;',
    text: 'Purchase New Pass'
  });
  buyBtn.prepend(createElement('i', { attributes: { 'data-lucide': 'plus-circle' }, style: 'width: 14px; height: 14px;' }));
  headerActions.appendChild(buyBtn);
  header.append(titleGroup, headerActions);
  page.appendChild(header);

  // 2. Refined Luxury Summary Bar (Low-profile, eliminates cluttered stat card blocks)
  const summaryBar = createElement('div', {
    className: 'card',
    style: 'padding: 16px 20px; margin-bottom: var(--space-5); background: #FAF8F5; border: 1px solid rgba(28, 25, 23, 0.08); border-radius: 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; align-items: center;'
  });

  summaryBar.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="width: 38px; height: 38px; border-radius: 8px; background: rgba(147, 75, 45, 0.1); color: var(--rust); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <i data-lucide="receipt" style="width: 18px; height: 18px;"></i>
      </div>
      <div>
        <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--ink-50); letter-spacing: 0.5px;">Verified Invoices</div>
        <div style="font-size: 15px; font-weight: 700; color: var(--ink);">${payments.length} ${payments.length === 1 ? 'Receipt' : 'Receipts'}</div>
      </div>
    </div>

    <div style="display: flex; align-items: center; gap: 12px; border-left: 1px solid rgba(28, 25, 23, 0.06); padding-left: 16px;">
      <div style="width: 38px; height: 38px; border-radius: 8px; background: rgba(82, 107, 70, 0.12); color: #526B46; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <i data-lucide="shield-check" style="width: 18px; height: 18px;"></i>
      </div>
      <div>
        <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--ink-50); letter-spacing: 0.5px;">Current Membership</div>
        <div style="font-size: 13.5px; font-weight: 700; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px;">
          ${escapeHtml(activePass ? activePass.packageName : 'No Active Pass')}
        </div>
      </div>
    </div>

    <div style="display: flex; align-items: center; gap: 12px; border-left: 1px solid rgba(28, 25, 23, 0.06); padding-left: 16px;">
      <div style="width: 38px; height: 38px; border-radius: 8px; background: rgba(28, 25, 23, 0.06); color: var(--ink-70); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <i data-lucide="building-2" style="width: 18px; height: 18px;"></i>
      </div>
      <div>
        <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--ink-50); letter-spacing: 0.5px;">Studio Billing</div>
        <div style="font-size: 12.5px; font-weight: 600; color: var(--ink-70);">GSTIN: 29ABIFP5917A1Z7</div>
      </div>
    </div>
  `;
  page.appendChild(summaryBar);

  // 3. Transactions Section
  const section = createElement('div', {
    className: 'card',
    style: 'border: 1px solid rgba(28, 25, 23, 0.08); border-radius: 12px; padding: 20px;'
  });

  const sectionHeader = createElement('div', {
    style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); border-bottom: 1px solid rgba(28, 25, 23, 0.06); padding-bottom: 14px;'
  });
  sectionHeader.innerHTML = `
    <div>
      <h2 style="font-size: 15px; font-weight: 700; color: var(--ink); margin: 0;">Billing Ledger & Invoices</h2>
      <p style="font-size: 12px; color: var(--ink-50); margin: 2px 0 0 0;">Official GST tax receipts issued under CGST / SGST Act 2017</p>
    </div>
    <span class="badge badge-neutral" style="font-size: 11px; font-weight: 600;">${payments.length} Recorded</span>
  `;
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
        dateFormatted: formatDate(pDate),
        timeFormatted: formatTime(pDate),
        invoiceNo: p.invoiceNo,
        packageName: p.packageName,
        method: p.paymentMethod || 'Online (Card/UPI)',
        amount: formatCurrency(p.totalAmountInr || p.amountInr),
        taxDetails: `Base: ${formatCurrency(p.baseAmountInr)} + GST: ${formatCurrency((p.cgstInr || 0) + (p.sgstInr || 0))}`,
        status: p.status,
        raw: p
      };
    });

    const columns = [
      {
        key: 'dateFormatted',
        label: 'Date',
        sortable: true,
        render: (val, row) => {
          const wrap = createElement('div');
          const d = createElement('div', { style: 'font-weight: 600; color: var(--ink); font-size: 13px; white-space: nowrap;', text: val });
          const t = createElement('div', { style: 'font-size: 11px; color: var(--ink-50); white-space: nowrap;', text: row.timeFormatted });
          wrap.append(d, t);
          return wrap;
        }
      },
      {
        key: 'invoiceNo',
        label: 'Invoice #',
        sortable: true,
        render: (val) => {
          return createElement('span', {
            style: 'font-family: monospace; font-weight: 700; color: var(--rust); background: rgba(147, 75, 45, 0.08); border: 1px solid rgba(147, 75, 45, 0.2); padding: 3px 8px; border-radius: 6px; font-size: 11.5px; white-space: nowrap; display: inline-block;',
            text: val
          });
        }
      },
      {
        key: 'packageName',
        label: 'Membership Pass',
        sortable: true,
        render: (val, row) => {
          const wrap = createElement('div');
          const title = createElement('div', { style: 'font-weight: 600; color: var(--ink); font-size: 13px;', text: val });
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
          const amt = createElement('div', { style: 'font-weight: 700; color: var(--ink); font-size: 13.5px;', text: val });
          const tax = createElement('div', { style: 'font-size: 10.5px; color: var(--ink-50);', text: 'Incl. 18% GST' });
          wrap.append(amt, tax);
          return wrap;
        }
      },
      {
        key: 'status',
        label: 'Status',
        sortable: false,
        render: () => {
          return createElement('span', {
            className: 'badge badge-success',
            style: 'font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;',
            text: 'Settled'
          });
        }
      },
      {
        key: 'actions',
        label: 'Actions',
        sortable: false,
        render: (_, row) => {
          const group = createElement('div', {
            style: 'display: flex; gap: 6px; justify-content: flex-end; align-items: center;'
          });

          // Primary Clean Action: View Official Tax Invoice Modal
          const viewBtn = createElement('button', {
            className: 'btn btn-outline btn-sm',
            attributes: { type: 'button', title: 'Open Official Tax Invoice & Receipt' },
            style: 'font-size: 12px; height: 32px; padding: 0 10px; display: inline-flex; align-items: center; gap: 5px;',
            text: 'View Invoice'
          });
          viewBtn.prepend(createElement('i', { attributes: { 'data-lucide': 'file-text' }, style: 'width: 13px; height: 13px;' }));
          viewBtn.addEventListener('click', () => {
            openReceiptModal(row.raw);
          });

          // Quick Action Icon 1: Direct Download PDF
          const downloadBtn = createElement('button', {
            className: 'btn btn-outline btn-sm',
            attributes: { type: 'button', title: 'Download Official PDF Invoice' },
            style: 'width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;'
          });
          downloadBtn.innerHTML = '<i data-lucide="download" style="width: 14px; height: 14px;"></i>';
          downloadBtn.addEventListener('click', async () => {
            downloadBtn.disabled = true;
            const origHTML = downloadBtn.innerHTML;
            downloadBtn.innerHTML = '<i data-lucide="loader-2" style="width: 14px; height: 14px; animation: spin 1s linear infinite;"></i>';
            try {
              await downloadReceipt(row.raw);
            } finally {
              downloadBtn.disabled = false;
              downloadBtn.innerHTML = origHTML;
              if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons({ root: downloadBtn });
              }
            }
          });

          // Quick Action Icon 2: Email Receipt
          const emailBtn = createElement('button', {
            className: 'btn btn-secondary btn-sm',
            attributes: { type: 'button', title: 'Email Tax Invoice to Registered Inbox' },
            style: 'width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;'
          });
          emailBtn.innerHTML = '<i data-lucide="mail" style="width: 14px; height: 14px;"></i>';
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
              emailBtn.innerHTML = '<i data-lucide="check" style="width: 14px; height: 14px; color: #526B46;"></i>';
              setTimeout(() => {
                emailBtn.disabled = false;
                emailBtn.innerHTML = '<i data-lucide="mail" style="width: 14px; height: 14px;"></i>';
                if (window.lucide) window.lucide.createIcons({ root: emailBtn });
              }, 2500);
            } catch (err) {
              showToast(`Error: ${err.message}`, 'error');
              emailBtn.disabled = false;
              emailBtn.innerHTML = '<i data-lucide="mail" style="width: 14px; height: 14px;"></i>';
              if (window.lucide) window.lucide.createIcons({ root: emailBtn });
            }
          });

          group.append(viewBtn, downloadBtn, emailBtn);
          return group;
        }
      }
    ];

    const table = createDataTable({
      columns,
      data: tableData,
      searchable: true,
      searchPlaceholder: 'Search invoice #, pass, or reference...',
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
