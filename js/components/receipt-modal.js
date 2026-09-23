/**
 * Plash Pilates — Sophisticated Official Tax Invoice & PDF Generator
 * Generates an ultra-premium, GST & IT Act compliant Tax Invoice with direct PDF download.
 * @module receipt-modal
 */

import { createElement, escapeHtml } from '../utils/dom.js';
import { formatCurrency, formatDate, formatTime, amountInWordsINR } from '../utils/format.js';
import * as store from '../core/store.js';
import { openModal } from './modal.js';
import { showToast } from './toast.js';

/**
 * Generate full HTML markup for the Tax Invoice document.
 * @param {Object} payment - Enriched payment object
 * @returns {string} HTML string
 */
export function buildInvoiceHTML(payment) {
  const pkg = payment.package || {};
  const member = store.resolveMember(payment.member || payment.memberId) || payment.member || {};
  const memberName = member.fullName || member.full_name || member.name || 'Studio Member';
  const memberPhone = member.phone || '';
  const memberEmail = member.email || '';
  const memberTier = member.tier || 'First Circle';
  const memberRefId = member.id || payment.memberId || '';
  const paymentDate = new Date(payment.createdAt);
  const words = amountInWordsINR(payment.totalAmountInr);

  return `
    <div class="luxury-invoice-paper" id="invoice-doc-${payment.id}">
      <!-- Top Decorative Luxury Accent Bar -->
      <div class="invoice-accent-bar"></div>

      <!-- Studio Header -->
      <div class="invoice-top-row">
        <div class="invoice-studio-brand">
          <img src="assets/images/plash-logo-horizontal.png" alt="Plash Pilates Logo" class="invoice-logo-img" style="height: 38px; width: auto; max-width: 210px; object-fit: contain; margin-bottom: 4px; display: block;" />
          <div class="invoice-brand-subtitle">BOUTIQUE REFORMER • SCULPT YOGA • BARRE</div>
          <div class="invoice-legal-entity">Plash Pilates Studio LLP • LLPIN: AAG-8942</div>
          <div class="invoice-address-line">42, 8th Main Road, RMV Extension, Sadashiva Nagar</div>
          <div class="invoice-address-line">Bengaluru, Karnataka 560080, India</div>
          <div class="invoice-address-line">GSTIN: <strong>29ABIFP5917A1Z7</strong> | State: <strong>Karnataka (29)</strong></div>
          <div class="invoice-address-line">Email: billing@plashpilates.com | Web: plashpilates.com</div>
        </div>

        <div class="invoice-official-tag">
          <div class="invoice-tag-head">ORIGINAL FOR RECIPIENT</div>
          <div class="invoice-tag-reg">TAX INVOICE</div>
          <div class="invoice-tag-sub">GSTIN: 29ABIFP5917A1Z7</div>
          <div class="invoice-tag-sub">State Code: 29 (Karnataka)</div>
        </div>
      </div>

      <!-- Document Title & Primary Metadata Banner -->
      <div class="invoice-title-strip">
        <div class="invoice-doc-type">
          <span>TAX INVOICE / BILL OF SUPPLY</span>
          <small>Issued under Section 31 of the CGST Act, 2017</small>
        </div>
        <div class="invoice-num-box">
          <div class="invoice-num-label">INVOICE NUMBER</div>
          <div class="invoice-num-val">${escapeHtml(payment.invoiceNo)}</div>
        </div>
      </div>

      <!-- Two Column Meta Section: Billed To & Invoice Specifics -->
      <div class="invoice-parties-grid">
        <div class="invoice-party-box">
          <div class="invoice-box-heading">BILLED TO (DATA PRINCIPAL / MEMBER)</div>
          <div class="invoice-party-name">${escapeHtml(memberName)}</div>
          ${memberPhone ? `<div class="invoice-meta-row"><span>Contact Phone:</span> <strong>${escapeHtml(memberPhone)}</strong></div>` : ''}
          ${memberEmail ? `<div class="invoice-meta-row"><span>Email Address:</span> <strong>${escapeHtml(memberEmail)}</strong></div>` : ''}
          <div class="invoice-meta-row"><span>Membership Tier:</span> <strong>${escapeHtml(memberTier)}</strong></div>
          <div class="invoice-meta-row"><span>Place of Supply:</span> <strong>Bengaluru, Karnataka (Code 29)</strong></div>
          ${memberRefId ? `<div class="invoice-meta-row" style="opacity: 0.7; font-size: 11px;"><span>Relational Ref:</span> <code>${escapeHtml(memberRefId)}</code></div>` : ''}
        </div>

        <div class="invoice-party-box">
          <div class="invoice-box-heading">PAYMENT & SETTLEMENT PARTICULARS</div>
          <div class="invoice-meta-row"><span>Invoice Date:</span> <strong>${formatDate(paymentDate)}</strong></div>
          <div class="invoice-meta-row"><span>Invoice Time:</span> <strong>${formatTime(paymentDate)} IST</strong></div>
          <div class="invoice-meta-row"><span>Payment Status:</span> <strong class="invoice-status-paid">PAID IN FULL</strong></div>
          <div class="invoice-meta-row"><span>Transaction Mode:</span> <strong>${escapeHtml(payment.paymentMethod || 'UPI / Instant Gateway')}</strong></div>
          <div class="invoice-meta-row"><span>Gateway Reference:</span> <strong>${escapeHtml(payment.reference || payment.id)}</strong></div>
          <div class="invoice-meta-row"><span>Waiver Version:</span> <strong>Liability Waiver & Health Declaration (v1.0)</strong></div>
        </div>
      </div>

      <!-- Itemized Service Description Table -->
      <table class="invoice-items-table">
        <thead>
          <tr>
            <th style="width: 6%; text-align: center;">S.No</th>
            <th style="width: 44%;">Service Description & Package Particulars</th>
            <th style="width: 12%; text-align: center;">HSN/SAC</th>
            <th style="width: 8%; text-align: center;">Qty</th>
            <th style="width: 15%; text-align: right;">Unit Rate</th>
            <th style="width: 15%; text-align: right;">Taxable Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align: center; color: var(--ink-50);">01</td>
            <td>
              <div class="invoice-item-title">${escapeHtml(payment.packageName)}</div>
              <div class="invoice-item-desc">
                ${escapeHtml(pkg.description || 'Exclusive boutique studio sessions with 1:6 coach-to-member ratio in Sadashiva Nagar')}
              </div>
              <div class="invoice-item-credits">
                Credits Included: <strong>${pkg.durationMonths ? pkg.durationMonths * 12 : 12} Reformer / Sculpt / Barre</strong> sessions • 
                Validity: <strong>${pkg.durationMonths || 1} Month(s)</strong> • Ratio: <strong>1:6 Maximum</strong>
              </div>
            </td>
            <td style="text-align: center; font-weight: 600;">999723</td>
            <td style="text-align: center; font-weight: 600;">1</td>
            <td style="text-align: right;">${formatCurrency(payment.baseAmountInr)}</td>
            <td style="text-align: right; font-weight: 600;">${formatCurrency(payment.baseAmountInr)}</td>
          </tr>
        </tbody>
      </table>

      <!-- GST Tax Breakup Table (Formal Tax Invoice Requirement) -->
      <div class="invoice-tax-breakup-wrapper">
        <div class="invoice-breakup-title">GST TAX ASSESSMENT MATRIX (INR)</div>
        <table class="invoice-tax-table">
          <thead>
            <tr>
              <th>SAC Code</th>
              <th style="text-align: right;">Taxable Amount</th>
              <th style="text-align: center;">CGST Rate</th>
              <th style="text-align: right;">CGST Amount</th>
              <th style="text-align: center;">SGST Rate</th>
              <th style="text-align: right;">SGST Amount</th>
              <th style="text-align: right;">Total Tax</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight: 600;">999723</td>
              <td style="text-align: right;">${formatCurrency(payment.baseAmountInr)}</td>
              <td style="text-align: center;">9.0%</td>
              <td style="text-align: right;">${formatCurrency(payment.cgstInr)}</td>
              <td style="text-align: center;">9.0%</td>
              <td style="text-align: right;">${formatCurrency(payment.sgstInr)}</td>
              <td style="text-align: right; font-weight: 600;">${formatCurrency((payment.cgstInr || 0) + (payment.sgstInr || 0))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Amount in Words & Totals Block -->
      <div class="invoice-summary-grid">
        <div class="invoice-words-box">
          <div class="invoice-words-label">AMOUNT CHARGEABLE IN WORDS:</div>
          <div class="invoice-words-val">${words}</div>

          <div class="invoice-statutory-notes">
            <strong>Terms & Studio Compliance:</strong>
            <ol>
              <li>Session bookings require minimum 4-hour cancellation notice for credit restoration.</li>
              <li>Strict 1:6 coach ratio maintained for all apparatus classes.</li>
              <li>Electronic tax invoice digitally signed pursuant to the Information Technology Act, 2000.</li>
              <li>Subject to Bengaluru, Karnataka jurisdiction.</li>
            </ol>
          </div>
        </div>

        <div class="invoice-totals-box">
          <div class="invoice-sum-row">
            <span>Taxable Subtotal:</span>
            <span>${formatCurrency(payment.baseAmountInr)}</span>
          </div>
          <div class="invoice-sum-row">
            <span>Central GST (CGST 9%):</span>
            <span>${formatCurrency(payment.cgstInr)}</span>
          </div>
          <div class="invoice-sum-row">
            <span>State GST (SGST 9%):</span>
            <span>${formatCurrency(payment.sgstInr)}</span>
          </div>
          <div class="invoice-sum-row invoice-grand-total">
            <span>Total Amount Paid:</span>
            <span>${formatCurrency(payment.totalAmountInr)}</span>
          </div>
          <div class="invoice-paid-badge">
            <i data-lucide="check-check" style="width: 14px; height: 14px;"></i>
            <span>TRANSACTION COMPLETED & SETTLED</span>
          </div>
        </div>
      </div>

      <!-- Official Digital Authentication & Authorized Signatory Footer -->
      <div class="invoice-sign-footer">
        <div class="invoice-seal-area">
          <div class="crest-meta">
            <div style="font-weight: 700; color: #1c1917; font-size: 10.5px; margin-bottom: 2px;">Digitally Authenticated Tax Invoice</div>
            <div>Reference: PLASH/AUTH/${paymentDate.getFullYear()}/${payment.invoiceNo}</div>
            <div>Date & Time: ${formatDate(paymentDate)} ${formatTime(paymentDate)}</div>
            <div>GSTIN: <strong>29ABIFP5917A1Z7</strong> • Bengaluru Jurisdiction</div>
          </div>
        </div>

        <div class="invoice-signatory-area">
          <div class="invoice-sign-image">
            <span class="digital-sign-script">Plash Pilates</span>
          </div>
          <div class="invoice-sign-line"></div>
          <div class="invoice-sign-name">Authorized Signatory</div>
          <div class="invoice-sign-role">Designated Partner & Studio Operations</div>
          <div class="invoice-sign-entity">For Plash Pilates Studio LLP</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Open the official tax invoice modal with direct email receipt dispatch.
 * @param {Object} payment - Enriched payment object
 */
export function openReceiptModal(payment) {
  if (!payment) return;

  const container = createElement('div', { className: 'receipt-modal-container' });

  // Top Action Toolbar
  const toolbar = createElement('div', { className: 'receipt-toolbar' });
  const toolbarLeft = createElement('div', { className: 'receipt-toolbar-status' });
  toolbarLeft.innerHTML = `
    <span class="badge badge-success" style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 6px 14px; font-weight: 600;">
      <i data-lucide="check-circle-2" style="width: 14px; height: 14px;"></i> Paid & Verified Official Invoice
    </span>
    <span style="font-size: 12px; color: var(--ink-70); margin-left: 12px; font-weight: 700; font-family: var(--font-sans);">
      ${payment.invoiceNo}
    </span>
  `;

  const toolbarActions = createElement('div', { className: 'receipt-toolbar-actions', style: 'display: flex; gap: var(--space-2);' });

  // Email Receipt Button (triggers official Tax Invoice dispatch directly to member inbox)
  const emailReceiptBtn = createElement('button', {
    className: 'btn btn-primary btn-sm',
    attributes: { type: 'button', id: 'btn-email-receipt' },
    style: 'display: inline-flex; align-items: center; gap: 6px;',
    text: 'Email Receipt'
  });
  emailReceiptBtn.prepend(createElement('i', { attributes: { 'data-lucide': 'mail' }, style: 'width: 14px; height: 14px;' }));
  emailReceiptBtn.addEventListener('click', async () => {
    try {
      emailReceiptBtn.disabled = true;
      emailReceiptBtn.innerHTML = '<i data-lucide="loader-2" style="width: 14px; height: 14px; animation: spin 1s linear infinite;"></i> Sending...';

      const member = store.resolveMember(payment.member || payment.memberId) || payment.member || {};
      const targetEmail = member.email || '';

      const res = await fetch('/api/send-receipt-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: payment.id,
          invoiceNo: payment.invoiceNo || payment.invoice_no,
          email: targetEmail
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to dispatch receipt email');
      }

      showToast(`Official Tax Invoice sent to ${data.email || targetEmail || 'inbox'}!`, 'success');
      emailReceiptBtn.innerHTML = '<i data-lucide="check" style="width: 14px; height: 14px;"></i> Sent!';
      setTimeout(() => {
        emailReceiptBtn.disabled = false;
        emailReceiptBtn.innerHTML = '<i data-lucide="mail" style="width: 14px; height: 14px;"></i> Email Receipt';
        if (window.lucide) window.lucide.createIcons({ root: emailReceiptBtn });
      }, 3000);
    } catch (err) {
      console.error('[Email Receipt Error]', err);
      showToast(`Email error: ${err.message}`, 'error');
      emailReceiptBtn.disabled = false;
      emailReceiptBtn.innerHTML = '<i data-lucide="mail" style="width: 14px; height: 14px;"></i> Email Receipt';
      if (window.lucide) window.lucide.createIcons({ root: emailReceiptBtn });
    }
  });

  toolbarActions.append(emailReceiptBtn);
  toolbar.append(toolbarLeft, toolbarActions);
  container.appendChild(toolbar);

  // Invoice Wrapper
  const paperWrapper = createElement('div', {
    className: 'receipt-scroll-wrap',
    style: 'max-height: 75vh; overflow-y: auto; padding: 4px; border-radius: var(--radius-sm);'
  });
  paperWrapper.innerHTML = buildInvoiceHTML(payment);
  container.appendChild(paperWrapper);

  const modal = openModal({
    title: `Official Tax Invoice • ${payment.invoiceNo}`,
    content: container,
    maxWidth: '900px'
  });

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }

  return modal;
}
