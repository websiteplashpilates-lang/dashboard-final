/**
 * Plash Pilates — Member Portal: Cart & Checkout
 * Selected package review, pricing summary, and mandatory liability waiver agreement gate.
 * @module pages/portal/cart
 */

import { createElement, clearChildren } from '../../utils/dom.js';
import { formatCurrency } from '../../utils/format.js';
import { CONFIG } from '../../core/config.js';
import * as auth from '../../core/auth.js';
import * as store from '../../core/store.js';
import * as cart from '../../core/cart.js';
import { createWaiverCheckbox } from '../../components/waiver-checkbox.js';
import { createEmptyState } from '../../components/empty-state.js';
import { openModal } from '../../components/modal.js';
import { openReceiptModal } from '../../components/receipt-modal.js';
import { showToast } from '../../components/toast.js';
import { createPackageCard } from '../../components/package-card.js';

export async function render(container) {
  clearChildren(container);
  const memberId = auth.getCurrentMemberId();
  const page = createElement('div', { className: 'page-container' });

  // Page header
  const header = createElement('div', { className: 'page-header' });
  const title = createElement('h1', { className: 'page-title', text: 'Membership Cart & Checkout' });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    text: 'Review your selected studio membership plan, accept the mandatory safety waiver, and activate your session credits.'
  });
  header.append(title, subtitle);
  page.appendChild(header);

  // Auto-reconcile any recently captured unfulfilled payment
  if (memberId) {
    try {
      const reconRes = await fetch('/api/reconcile-recent-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, packageId: cart.getCartPackage()?.id })
      });
      if (reconRes.ok) {
        const reconData = await reconRes.json();
        if (reconData.success && reconData.reconciled) {
          if (reconData.payment) store.addPayment(reconData.payment);
          if (reconData.pass) store.addMemberPass(reconData.pass);
          await store.fetchMemberPayments(memberId).catch(() => {});
          await store.syncFromSupabase().catch(() => {});
          cart.clearCart();
          showToast('Payment verified and pass provisioned! Tax invoice generated.', 'success');
          if (reconData.payment) {
            openReceiptModal(reconData.payment);
          }
          window.location.hash = '#/portal/payments';
          return;
        }
      }
    } catch (e) {
      console.warn('[Auto-reconcile check]', e.message);
    }
  }

  const pkg = cart.getCartPackage();

  if (!pkg) {
    const empty = createEmptyState({
      icon: 'shopping-bag',
      title: 'Your cart is empty',
      description: 'You have not selected a membership package yet. Browse our Reformer, Barre, and Sculpt Yoga plans below to begin.',
      action: createElement('a', {
        className: 'btn btn-secondary btn-sm',
        attributes: { href: '#/portal/packages' },
        text: 'View Full Catalog'
      })
    });
    page.appendChild(empty);

    // Direct plan browsing section inside cart
    const plansSection = createElement('div', {
      style: 'margin-top: var(--space-8);'
    });

    const plansHeader = createElement('div', {
      style: 'margin-bottom: var(--space-5); text-align: left;'
    }, [
      createElement('h2', {
        style: 'font-family: var(--font-serif); font-size: var(--text-xl); font-weight: var(--weight-bold); color: var(--ink); margin-bottom: var(--space-1);',
        text: 'Browse Studio Packages'
      }),
      createElement('p', {
        style: 'font-size: var(--text-sm); color: var(--ink-60); margin: 0;',
        text: 'Select a plan below to add it directly to your cart and proceed with checkout.'
      })
    ]);
    plansSection.appendChild(plansHeader);

    const packages = store.getPackageCatalog();
    const grid = createElement('div', { className: 'package-grid' });

    packages.forEach(p => {
      const card = createPackageCard(p, {
        onSelect: (selectedPkg) => {
          cart.setCartPackage(selectedPkg);
          showToast(`${selectedPkg.name} added to cart.`, 'success');
          clearChildren(container);
          render(container);
        }
      });
      grid.appendChild(card);
    });
    plansSection.appendChild(grid);
    page.appendChild(plansSection);

    if (!window.location.hash.startsWith('#/portal/cart')) {
      return;
    }
    clearChildren(container);
    container.appendChild(page);

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: container });
    }
    return;
  }

  const basePrice = Number(pkg.priceInr);
  const cgst = Math.round(basePrice * 0.09);
  const sgst = Math.round(basePrice * 0.09);
  const totalGst = cgst + sgst;
  const finalPrice = basePrice + totalGst;

  const grid = createElement('div', { className: 'cart-grid' });

  // 1. Package Review Card (Left)
  const itemCard = createElement('div', { className: 'cart-item-card' });

  const itemHeader = createElement('div', { className: 'cart-item-header' });
  const itemTitleBox = createElement('div');
  const itemName = createElement('h2', {
    style: 'font-family: var(--font-serif); font-size: var(--text-xl); font-weight: var(--weight-bold); color: var(--ink); margin-bottom: 4px;',
    text: `${pkg.name} (${pkg.durationMonths} ${pkg.durationMonths === 1 ? 'Month' : 'Months'})`
  });
  const itemSub = createElement('div', {
    style: 'font-size: var(--text-xs); color: var(--olive); font-weight: var(--weight-semibold);',
    text: 'Sadashiva Nagar Studio • 1:6 Coach Ratio'
  });
  itemTitleBox.append(itemName, itemSub);

  const removeBtn = createElement('button', {
    className: 'btn btn-ghost btn-sm',
    attributes: { type: 'button' },
    style: 'color: var(--rose);',
    text: 'Remove Plan'
  });
  removeBtn.addEventListener('click', () => {
    cart.clearCart();
    showToast('Removed package from cart.', 'info');
    render(container);
  });

  itemHeader.append(itemTitleBox, removeBtn);
  itemCard.appendChild(itemHeader);

  // Allocations breakdown
  const allocSection = createElement('div', { style: 'margin-bottom: var(--space-6);' });
  const allocTitle = createElement('div', {
    style: 'font-size: var(--text-xs); font-weight: var(--weight-semibold); color: var(--ink); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: var(--space-3);',
    text: 'Included Session Allocations'
  });
  allocSection.appendChild(allocTitle);

  if (pkg.sessionAllocations && pkg.sessionAllocations.length > 0) {
    const list = createElement('div', { style: 'display: flex; flex-direction: column; gap: var(--space-2);' });
    pkg.sessionAllocations.forEach(alloc => {
      const disc = store.getDisciplineById(alloc.disciplineId);
      const row = createElement('div', {
        style: 'display: flex; align-items: center; justify-content: space-between; background: var(--stone); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-4); font-size: var(--text-sm); color: var(--ink);'
      }, [
        createElement('div', { style: 'display: flex; align-items: center; gap: var(--space-2);' }, [
          createElement('i', { attributes: { 'data-lucide': 'check' }, style: 'width: 16px; height: 16px; color: var(--moss);' }),
          createElement('span', { text: disc ? disc.name : 'Sessions' })
        ]),
        createElement('span', { style: 'font-weight: var(--weight-semibold);', text: `${alloc.sessionCount} Classes` })
      ]);
      list.appendChild(row);
    });
    allocSection.appendChild(list);
  }
  itemCard.appendChild(allocSection);

  // Payment Method Selector
  const payMethodSection = createElement('div', { style: 'margin-top: var(--space-6); padding-top: var(--space-4); border-top: 1px solid var(--ink-10);' });
  const payMethodTitle = createElement('div', {
    style: 'font-size: var(--text-xs); font-weight: var(--weight-semibold); color: var(--ink); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: var(--space-3); display: flex; align-items: center; justify-content: space-between;',
    children: [
      createElement('span', { text: 'Payment Gateway' }),
      createElement('span', { style: 'font-size: 10px; color: var(--moss); font-weight: var(--weight-bold); background: rgba(82, 107, 70, 0.1); padding: 2px 6px; border-radius: 4px;', text: 'Razorpay Secured' })
    ]
  });
  const methodsRow = createElement('div', { style: 'display: flex; gap: var(--space-2); flex-wrap: wrap;' });

  const methods = [
    { name: 'UPI (GPay / PhonePe / Paytm)', icon: 'zap' },
    { name: 'Credit / Debit Card', icon: 'credit-card' },
    { name: 'NetBanking / Wallets', icon: 'building-2' }
  ];
  methods.forEach((m, idx) => {
    const b = createElement('div', {
      className: `badge ${idx === 0 ? 'badge-moss' : 'badge-neutral'}`,
      style: 'padding: var(--space-2) var(--space-3); font-size: var(--text-xs); font-weight: 500;',
      text: m.name
    });
    methodsRow.appendChild(b);
  });

  payMethodSection.append(payMethodTitle, methodsRow);
  itemCard.appendChild(payMethodSection);

  grid.appendChild(itemCard);

  // 2. Summary & Mandatory Waiver Acceptance Gate (Right)
  const summaryCard = createElement('div', { className: 'cart-summary-card' });
  const sTitle = createElement('h3', {
    style: 'font-family: var(--font-serif); font-size: var(--text-lg); font-weight: var(--weight-semibold); color: var(--ink); margin-bottom: var(--space-4);',
    text: 'Order Summary'
  });
  summaryCard.appendChild(sTitle);

  // Price rows: Base package fee + 18% GST (9% CGST + 9% SGST) added at checkout
  const r1 = createElement('div', { className: 'cart-summary-row' });
  r1.innerHTML = `<span>Membership Plan (Base)</span><span>${formatCurrency(basePrice)}</span>`;
  summaryCard.appendChild(r1);

  const rCgst = createElement('div', { className: 'cart-summary-row' });
  rCgst.innerHTML = `<span>CGST (9%)</span><span>${formatCurrency(cgst)}</span>`;
  summaryCard.appendChild(rCgst);

  const rSgst = createElement('div', { className: 'cart-summary-row' });
  rSgst.innerHTML = `<span>SGST (9%)</span><span>${formatCurrency(sgst)}</span>`;
  summaryCard.appendChild(rSgst);

  const rTotal = createElement('div', { className: 'cart-summary-total' });
  rTotal.innerHTML = `<span>Total Due (incl. 18% GST)</span><span style="color: var(--rust);">${formatCurrency(finalPrice)}</span>`;
  summaryCard.appendChild(rTotal);

  // Waiver acceptance in cart (always starts unchecked, must be checked by user)
  const waiverContainer = createElement('div', { style: 'margin-top: var(--space-4);' });
  const waiverGate = createWaiverCheckbox({
    onChange: (checked) => {
      if (checked) {
        if (waiverWarning) waiverWarning.style.display = 'none';
        checkoutBtn.style.borderColor = 'var(--moss)';
      }
    }
  });
  waiverContainer.appendChild(waiverGate);
  summaryCard.appendChild(waiverContainer);

  // Prominent warning banner if user clicks checkout without checking waiver
  const waiverWarning = createElement('div', {
    id: 'cart-waiver-warning',
    style: 'display: none; background: #fff1f2; border: 1.5px solid #fecdd3; border-radius: var(--radius-sm); padding: var(--space-3) var(--space-4); margin-top: var(--space-3); color: #9f1239; font-size: var(--text-xs); font-weight: var(--weight-semibold); line-height: 1.4; align-items: center; gap: 8px;'
  }, [
    createElement('i', { attributes: { 'data-lucide': 'alert-circle' }, style: 'width: 16px; height: 16px; flex-shrink: 0;' }),
    createElement('span', { text: 'Action Required: Please tick the Liability Waiver agreement box above before proceeding to Razorpay payment.' })
  ]);
  summaryCard.appendChild(waiverWarning);

  // Checkout trigger with Razorpay
  const checkoutBtn = createElement('button', {
    id: 'pay-razorpay-btn',
    className: 'btn btn-primary btn-block',
    attributes: { type: 'button' },
    style: 'padding: var(--space-4); font-size: var(--text-base); margin-top: var(--space-4); display: flex; align-items: center; justify-content: center; gap: 8px;',
    children: [
      createElement('i', { attributes: { 'data-lucide': 'lock' }, style: 'width: 16px; height: 16px;' }),
      createElement('span', { text: `Pay ${formatCurrency(finalPrice)} with Razorpay` })
    ]
  });

  function resetBtn() {
    checkoutBtn.disabled = false;
    checkoutBtn.innerHTML = `<i data-lucide="lock" style="width: 16px; height: 16px;"></i><span>Pay ${formatCurrency(finalPrice)} with Razorpay</span>`;
    if (window.lucide) window.lucide.createIcons({ root: checkoutBtn });
  }

  async function launchRazorpayCheckout() {
    try {
      waiverWarning.style.display = 'none';
      checkoutBtn.disabled = true;
      checkoutBtn.innerHTML = '<span>Creating Secure Razorpay Order...</span>';

      const member = (typeof auth.getCurrentUser === 'function' ? auth.getCurrentUser() : null) ||
                     (typeof auth.getCurrentMember === 'function' ? auth.getCurrentMember() : null) ||
                     store.getMemberById(memberId) || {};
      const rawPhone = member.phone || '';
      const rawDigits = rawPhone.replace(/[^\d]/g, '');
      let cleanPhone = '9900111001';
      if (/^[6-9]\d{9}$/.test(rawDigits)) {
        cleanPhone = rawDigits;
      } else if (rawDigits.length >= 10 && /^[6-9]\d{9}$/.test(rawDigits.slice(-10))) {
        cleanPhone = rawDigits.slice(-10);
      }

      // Request backend order creation (Resilient multi-origin fallback)
      const orderPayload = {
        amount: Math.round(finalPrice * 100),
        currency: 'INR',
        packageId: pkg.id,
        memberId,
        receipt: `rcpt_${pkg.id}_${Date.now()}`
      };

      let orderData = null;
      let lastError = null;

      try {
        const orderRes = await fetch('/api/create-razorpay-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload)
        });
        const parsed = await orderRes.json();
        const resolvedOrderId = (parsed && (parsed.orderId || parsed.id)) || null;

        if (orderRes.ok && parsed && resolvedOrderId && parsed.success !== false) {
          orderData = {
            ...parsed,
            success: true,
            orderId: resolvedOrderId,
            id: resolvedOrderId,
            amount: parsed.amount || Math.round(finalPrice * 100),
            currency: parsed.currency || 'INR',
            keyId: parsed.keyId || CONFIG.RAZORPAY.KEY_ID || 'rzp_test_SKQzTiiysg1aGG'
          };
        } else {
          const errMsg = parsed?.error?.description || parsed?.error?.message || (typeof parsed?.error === 'string' ? parsed.error : null) || parsed?.message || `HTTP ${orderRes.status}`;
          lastError = new Error(errMsg);
        }
      } catch (e) {
        lastError = e;
      }

      if (!orderData || !orderData.orderId) {
        const errDetail = (orderData && orderData.error) || (lastError && lastError.message) || 'Backend unreachable';
        console.error('[Razorpay Order Error]', errDetail);
        showToast(`Razorpay Order creation error: ${errDetail}`, 'error');
        resetBtn();
        return;
      }

      checkoutBtn.innerHTML = '<span>Opening Razorpay Gateway...</span>';

      if (typeof window.Razorpay !== 'function') {
        try {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://checkout.razorpay.com/v1/checkout.js';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
          });
        } catch (scriptErr) {
          console.warn('[Razorpay script load error]', scriptErr);
          showToast('Failed to load Razorpay payment SDK. Please check your connection or ad-blocker.', 'error');
          resetBtn();
          return;
        }
      }

      if (typeof window.Razorpay === 'function') {
        let paymentSettled = false;
        let paymentSettling = false;
        let pollInterval = null;

        const fulfillPayment = async (fulfillPayload, paymentRef, source) => {
          if (paymentSettled) return true;
          if (paymentSettling && source === 'poll') return false;
          paymentSettling = true;

          try {
            checkoutBtn.disabled = true;
            checkoutBtn.innerHTML = '<span>Verifying Payment & Provisioning Pass...</span>';

            const fulfillRes = await fetch('/api/verify-and-fulfill-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(fulfillPayload)
            });
            const fulfillResult = await fulfillRes.json();
            if (!fulfillRes.ok || !fulfillResult.success) {
              throw new Error(fulfillResult.error || 'Server payment fulfillment failed.');
            }

            paymentSettled = true;
            paymentSettling = false;
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }

            if (fulfillResult.payment) store.addPayment(fulfillResult.payment);
            if (fulfillResult.pass) store.addMemberPass(fulfillResult.pass);
            await store.fetchMemberPayments(memberId).catch(() => {});
            await store.syncFromSupabase().catch(() => {});

            cart.clearCart();
            showToast(`Payment successful (${paymentRef})! Official tax invoice emailed.`, 'success');

            const paymentHistory = store.getPaymentHistory(memberId);
            const paymentRecord = (fulfillResult && fulfillResult.payment) || (paymentHistory && paymentHistory[0]);
            if (paymentRecord) {
              openReceiptModal(paymentRecord);
            }
            window.location.hash = '#/portal/payments';
            return true;
          } catch (err) {
            paymentSettling = false;
            console.error('[Payment Fulfillment Error]', err);
            if (source !== 'poll') {
              showToast(`Payment Verification: ${err.message}`, 'error');
              resetBtn();
            }
            return false;
          }
        };

        const options = {
          key: orderData.keyId || CONFIG.RAZORPAY.KEY_ID,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'Plash Pilates Studio',
          description: `${pkg.name} (${pkg.durationMonths} ${pkg.durationMonths === 1 ? 'Month' : 'Months'}) • ${formatCurrency(basePrice)} + 18% GST`,
          order_id: orderData.orderId,
          prefill: {
            name: member.fullName || member.name || member.email || 'Studio Member',
            email: member.email || 'member@plashpilates.com',
            contact: cleanPhone
          },
          theme: {
            color: '#934b2d'
          },
          modal: {
            ondismiss: function () {
              if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
              }
              resetBtn();
              if (!paymentSettled) {
                showToast('Checkout window closed. Package remains saved in your cart.', 'info');
              }
            }
          },
          handler: async function (response) {
            const fulfillPayload = {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              packageId: pkg.id,
              memberId: memberId,
              waiverId: waiverGate.getWaiverId()
            };
            await fulfillPayment(fulfillPayload, response.razorpay_payment_id, 'modal');
          }
        };

        try {
          const rzp = new window.Razorpay(options);
          rzp.on('payment.failed', function (res) {
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
            showToast(`Payment failed: ${res.error?.description || res.error?.reason || 'Transaction declined'}`, 'error');
            resetBtn();
          });
          rzp.open();

          // Background polling to catch Razorpay server status (UPI QR, Intent, Domain verification)
          let pollAttempts = 0;
          pollInterval = setInterval(async () => {
            if (paymentSettled) {
              if (pollInterval) clearInterval(pollInterval);
              return;
            }
            pollAttempts++;
            if (pollAttempts > 50) {
              clearInterval(pollInterval);
              pollInterval = null;
              return;
            }
            try {
              const checkRes = await fetch(`/api/check-razorpay-order?orderId=${encodeURIComponent(orderData.orderId)}`);
              if (checkRes.ok) {
                const statusData = await checkRes.json();
                if (statusData.isPaid) {
                  if (paymentSettled) {
                    clearInterval(pollInterval);
                    return;
                  }
                  const payId = statusData.payment?.id || `RZP-${Date.now()}`;
                  const fulfillPayload = {
                    razorpay_order_id: orderData.orderId,
                    razorpay_payment_id: payId,
                    packageId: pkg.id,
                    memberId: memberId,
                    waiverId: waiverGate.getWaiverId()
                  };
                  await fulfillPayment(fulfillPayload, payId, 'poll');
                  return;
                }
                if (statusData.errorDescription) {
                  clearInterval(pollInterval);
                  pollInterval = null;
                  resetBtn();
                  const modalContent = createElement('div', { style: 'font-size: var(--text-sm); line-height: 1.6;' });
                  modalContent.innerHTML = `
                    <div style="background: #fff1f2; border: 1px solid #fecdd3; padding: 12px 14px; border-radius: 6px; color: #9f1239; font-weight: 600; margin-bottom: 14px;">
                      ⚠️ Razorpay Error: ${statusData.errorDescription}
                    </div>
                    <p style="color: var(--ink-80); margin-bottom: 10px;">
                      <strong>Why this happened:</strong> Your live Razorpay account security policy requires the website origin to match the domain registered on your Razorpay Dashboard. Because testing on <code>${window.location.origin}</code>, Razorpay's risk engine blocked the live charge.
                    </p>
                    <p style="color: var(--ink-80); margin-bottom: 10px;">
                      <strong>Did you get charged?</strong> Razorpay marked this transaction as <code>failed</code>. Any temporary UPI debit will automatically reverse back to your bank account.
                    </p>
                    <div style="background: var(--stone); border-radius: 6px; padding: 10px 12px; font-size: 12px; color: var(--ink-70);">
                      <strong>How to resolve:</strong><br>
                      1. <em>For Local Testing:</em> Use Razorpay <strong>Test Key & Secret</strong> (<code>rzp_test_...</code>) which allows free local testing without domain restrictions.<br>
                      2. <em>For Production:</em> Add your development or production URL to <strong>Razorpay Dashboard &gt; Account &amp; Settings &gt; Business Website Details</strong>.
                    </div>
                  `;

                  const closeAlertBtn = createElement('button', {
                    className: 'btn btn-primary btn-sm',
                    attributes: { type: 'button' },
                    text: 'Understood'
                  });

                  const errModal = openModal({
                    title: 'Razorpay Live Payment Security Restriction',
                    content: modalContent,
                    actions: [closeAlertBtn],
                    maxWidth: '560px'
                  });

                  closeAlertBtn.addEventListener('click', () => errModal.close());
                }
              }
            } catch (_) {}
          }, 2500);

          setTimeout(resetBtn, 2000);
        } catch (err) {
          console.error('[Razorpay open error]', err);
          showToast(`Razorpay Gateway Error: ${err.message}`, 'error');
          resetBtn();
        }
      } else {
        showToast('Razorpay Gateway is unavailable. Please reload.', 'error');
        resetBtn();
      }
    } catch (checkoutErr) {
      console.error('[launchRazorpayCheckout error]', checkoutErr);
      showToast('Checkout error: ' + checkoutErr.message, 'error');
      resetBtn();
    }
  }

  checkoutBtn.addEventListener('click', () => {
    if (!waiverGate.isChecked()) {
      waiverWarning.style.display = 'flex';
      if (window.lucide) window.lucide.createIcons({ root: waiverWarning });
      waiverGate.scrollIntoView({ behavior: 'smooth', block: 'center' });
      waiverGate.style.outline = '2px solid var(--rose)';
      setTimeout(() => {
        waiverGate.style.outline = 'none';
      }, 3000);

      // Instant acceptance modal so user is NEVER blocked from opening Razorpay
      const modalBody = createElement('div', { style: 'font-size: var(--text-sm); line-height: 1.6; color: var(--ink-80);' }, [
        createElement('p', { style: 'margin-bottom: 12px;', text: 'To proceed with Razorpay checkout, please confirm your agreement to the studio safety declaration:' }),
        createElement('div', {
          style: 'background: var(--stone); border-radius: var(--radius-sm); padding: 12px; font-size: 12px; line-height: 1.5; margin-bottom: 16px; border: 1px solid var(--ink-10);'
        }, [
          createElement('strong', { text: 'Plash Pilates Liability Waiver & Health Declaration (v1.0)' }),
          createElement('br'),
          createElement('span', { text: 'I acknowledge the physical nature and inherent risks of Pilates, Barre, and Sculpt Yoga, and affirm I am physically fit to participate.' })
        ])
      ]);

      const agreeBtn = createElement('button', {
        className: 'btn btn-primary',
        attributes: { type: 'button' },
        style: 'width: 100%; justify-content: center;',
        text: 'I Agree — Open Razorpay Gateway'
      });

      const waiverModal = openModal({
        title: 'Safety Waiver Agreement',
        content: modalBody,
        actions: [agreeBtn],
        maxWidth: '520px'
      });

      agreeBtn.addEventListener('click', () => {
        waiverModal.close();
        waiverGate.setChecked(true);
        launchRazorpayCheckout();
      });
      return;
    }

    launchRazorpayCheckout();
  });

  summaryCard.appendChild(checkoutBtn);

  const securityNote = createElement('div', {
    style: 'margin-top: var(--space-3); font-size: 11px; color: var(--ink-50); text-align: center; display: flex; align-items: center; justify-content: center; gap: 4px;'
  }, [
    createElement('i', { attributes: { 'data-lucide': 'shield-check' }, style: 'width: 14px; height: 14px; color: var(--moss);' }),
    createElement('span', { text: '256-bit TLS Encrypted • ISO 27001 Security Aligned' })
  ]);
  summaryCard.appendChild(securityNote);

  grid.appendChild(summaryCard);
  page.appendChild(grid);

  if (!window.location.hash.startsWith('#/portal/cart')) {
    return;
  }
  clearChildren(container);
  container.appendChild(page);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}
