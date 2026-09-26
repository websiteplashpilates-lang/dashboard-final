/**
 * Plash Pilates — Partner Portal: Package Reviews (Physicq 57)
 * Certified Physicq 57 coach review queue for members acquiring packages with Barre programming.
 * Allows inspecting member health assessments, approving readiness, or declining with reason.
 * @module pages/partner/booking-requests
 */

import { createElement, clearChildren } from '../../utils/dom.js';
import { formatDate } from '../../utils/format.js';
import * as store from '../../core/store.js';
import { createBadge } from '../../components/badge.js';
import { createEmptyState } from '../../components/empty-state.js';
import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { openForgotPasswordModal } from '../../components/forgot-password-modal.js';
import * as auth from '../../core/auth.js';

export async function render(container) {
  clearChildren(container);
  const page = createElement('div', { className: 'page-container' });

  // Header
  const header = createElement('div', {
    className: 'page-header',
    style: 'display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-4);'
  });
  const titleGroup = createElement('div');
  const title = createElement('h1', { className: 'page-title', text: 'Barre Package Enrollee Reviews' });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    text: 'Certified Physicq 57 coaches: Review member health declarations for Barre packages, confirm readiness, or decline with stated safety reason.'
  });
  titleGroup.append(title, subtitle);

  const btnRow = createElement('div', { style: 'display: flex; gap: var(--space-2);' });

  const resetPassBtn = createElement('button', {
    className: 'btn btn-outline btn-sm',
    attributes: { type: 'button', title: 'Forgot or Reset Partner Password' },
    text: 'Reset Password'
  });
  resetPassBtn.prepend(createElement('i', { attributes: { 'data-lucide': 'key-round' }, style: 'width: 14px; height: 14px; margin-right: 6px;' }));
  resetPassBtn.addEventListener('click', () => {
    const user = auth.getCurrentUser();
    openForgotPasswordModal(user ? user.email : '');
  });

  btnRow.appendChild(resetPassBtn);
  header.append(titleGroup, btnRow);
  page.appendChild(header);

  // Sync latest from server
  try {
    await store.syncPartnerReviews();
  } catch (_) {}

  const reviews = store.getPartnerReviews();

  if (reviews.length === 0) {
    const empty = createEmptyState({
      icon: 'check-circle-2',
      title: 'Queue is clear',
      description: 'There are no Barre package purchase reviews currently awaiting coach approval.'
    });
    page.appendChild(empty);
  } else {
    const list = createElement('div', { style: 'display: flex; flex-direction: column; gap: var(--space-4);' });

    reviews.forEach(rev => {
      const card = createElement('div', {
        className: 'card',
        style: `border-left: 4px solid ${rev.status === 'accepted' ? '#2E5A44' : rev.status === 'declined' ? 'var(--rust)' : '#C98A2C'}; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-4);`
      });

      const info = createElement('div', { style: 'flex: 1; min-width: 260px;' });
      const mName = createElement('div', {
        style: 'font-size: var(--text-base); font-weight: var(--weight-bold); color: var(--ink); margin-bottom: 2px;',
        text: rev.memberName || 'Member'
      });
      const meta = createElement('div', {
        style: 'font-size: var(--text-xs); color: var(--ink-50); margin-bottom: var(--space-2);',
        text: `Package: ${rev.packageName} · Enrolled: ${formatDate(rev.createdAt)}`
      });

      const healthSnippet = createElement('div', {
        style: 'font-size: 12px; color: var(--ink-80); background: var(--stone); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--stone-20); margin-bottom: var(--space-2);',
        text: `⚕ Health Assessment: ${rev.healthNotes || 'No limiting physical conditions or injuries reported.'}`
      });

      info.append(mName, meta, healthSnippet);

      if (rev.status === 'declined') {
        const reasonBox = createElement('div', {
          style: 'font-size: 12px; color: #9B2C2C; background: #FFF5F5; border-left: 3px solid var(--rust); padding: 6px 10px; border-radius: 4px;'
        });
        reasonBox.innerHTML = `<strong>Declined Reason:</strong> ${rev.decisionReason || 'Safety consideration'}`;
        info.appendChild(reasonBox);
      }

      const actions = createElement('div', { style: 'display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-2);' });

      if (rev.status === 'accepted') {
        actions.appendChild(createBadge({ text: 'Approved by Physicq 57', status: 'completed', showDot: true }));
      } else if (rev.status === 'declined') {
        actions.appendChild(createBadge({ text: 'Declined by Physicq 57', status: 'no-show', showDot: true }));
      } else {
        actions.appendChild(createBadge({ text: 'Pending Coach Decision', status: 'pending', showDot: true }));

        const btnWrap = createElement('div', { style: 'display: flex; gap: var(--space-2); margin-top: var(--space-2);' });

        // Approve
        const approveBtn = createElement('button', {
          className: 'btn btn-primary btn-sm',
          attributes: { type: 'button' },
          text: 'Approve Member'
        });
        approveBtn.addEventListener('click', async () => {
          try {
            approveBtn.disabled = true;
            await store.acceptPartnerReview(rev.id, 'Physicq 57 Coach');
            showToast(`Approved ${rev.memberName} for Barre programming. Admin notified.`, 'success');
            render(container);
          } catch (err) {
            showToast(err.message, 'error');
            approveBtn.disabled = false;
          }
        });

        // Decline
        const declineBtn = createElement('button', {
          className: 'btn btn-outline btn-sm',
          attributes: { type: 'button' },
          style: 'color: var(--rust); border-color: var(--rust);',
          text: 'Decline'
        });
        declineBtn.addEventListener('click', () => {
          openPartnerDeclineModal(rev, () => render(container));
        });

        btnWrap.append(declineBtn, approveBtn);
        actions.appendChild(btnWrap);
      }

      card.append(info, actions);
      list.appendChild(card);
    });

    page.appendChild(list);
  }

  container.appendChild(page);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}

function openPartnerDeclineModal(review, onComplete) {
  const content = createElement('div', { style: 'font-size: 13px; line-height: 1.6;' });
  content.innerHTML = `
    <p style="margin-bottom: 12px;">You are declining Barre eligibility for <strong>${review.memberName}</strong>.</p>
    <div style="margin-bottom: 12px;">
      <label style="display: block; font-weight: 600; margin-bottom: 4px;">Reason for Declining (Disclosed to Studio Admin) *</label>
      <textarea id="coach-decline-reason" class="form-input" rows="3" placeholder="State reason (e.g. disc herniation requires clearance, high pulse rate, injury contraindication)..." style="width: 100%; resize: vertical;"></textarea>
    </div>
    <p style="font-size: 11px; color: var(--rust); font-weight: 500;">Per studio agreement, this reason will be instantly recorded and visible to Studio Administrators.</p>
  `;

  const declineConfirmBtn = createElement('button', {
    className: 'btn btn-outline btn-sm',
    attributes: { type: 'button' },
    style: 'color: var(--rust); border-color: var(--rust);',
    text: 'Submit Declination'
  });

  const modal = openModal({
    title: 'Decline Barre Enrollee',
    content,
    actions: [declineConfirmBtn]
  });

  declineConfirmBtn.addEventListener('click', async () => {
    const reasonInput = document.getElementById('coach-decline-reason');
    const reason = reasonInput ? reasonInput.value.trim() : '';
    if (!reason) {
      showToast('Please state a reason for declining.', 'error');
      return;
    }

    try {
      declineConfirmBtn.disabled = true;
      declineConfirmBtn.textContent = 'Submitting...';
      await store.declinePartnerReview(review.id, reason, 'Physicq 57 Coach');
      modal.close();
      showToast(`Member declined with recorded reason. Studio Admin notified.`, 'info');
      if (onComplete) onComplete();
    } catch (err) {
      showToast(err.message, 'error');
      declineConfirmBtn.disabled = false;
      declineConfirmBtn.textContent = 'Submit Declination';
    }
  });
}
