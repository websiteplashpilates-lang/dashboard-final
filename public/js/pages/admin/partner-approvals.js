/**
 * Plash Pilates — Studio Admin: Physicq 57 Partner Approvals
 * Dedicated tracking dashboard for Physicq 57 partner coach reviews on member Barre packages.
 * Displays pending review queue, accepted members, and declined members with explicit reasons.
 * @module pages/admin/partner-approvals
 */

import { createElement, clearChildren } from '../../utils/dom.js';
import { formatDate } from '../../utils/format.js';
import * as store from '../../core/store.js';
import { createBadge } from '../../components/badge.js';
import { createEmptyState } from '../../components/empty-state.js';
import { createStatCard } from '../../components/stat-card.js';
import { showToast } from '../../components/toast.js';
import { openModal } from '../../components/modal.js';

let renderSeq = 0;

export async function render(container) {
  const currentSeq = ++renderSeq;
  const page = createElement('div', { className: 'page-container' });

  // Page header
  const header = createElement('div', {
    className: 'page-header',
    style: 'display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-4);'
  });

  const titleGroup = createElement('div');
  const title = createElement('h1', { className: 'page-title', text: 'Physicq 57 Partner Reviews' });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    text: 'Audited oversight of Physicq 57 certified coach approvals and declinations for Barre package enrollees.'
  });
  titleGroup.append(title, subtitle);

  const syncBtn = createElement('button', {
    className: 'btn btn-outline btn-sm',
    attributes: { type: 'button' },
    text: 'Refresh Partner Reviews'
  });
  syncBtn.prepend(createElement('i', { attributes: { 'data-lucide': 'refresh-cw' }, style: 'width: 14px; height: 14px; margin-right: 6px;' }));
  header.append(titleGroup, syncBtn);
  page.appendChild(header);

  // Sync from server
  try {
    await store.syncPartnerReviews();
  } catch (_) {}

  if (currentSeq !== renderSeq) return;

  // Dynamic content container
  const contentArea = createElement('div');
  page.appendChild(contentArea);
  clearChildren(container);
  container.appendChild(page);

  function renderView() {
    clearChildren(contentArea);
    const reviews = store.getPartnerReviews();

    const pending = reviews.filter(r => r.status === 'pending');
    const accepted = reviews.filter(r => r.status === 'accepted');
    const declined = reviews.filter(r => r.status === 'declined');

    // KPI Summary Cards
    const kpiGrid = createElement('div', {
      className: 'grid grid-4',
      style: 'margin-bottom: var(--space-6); gap: var(--space-4);'
    });

    kpiGrid.appendChild(createStatCard({
      label: 'Total Enrollees',
      value: reviews.length.toString(),
      icon: 'users',
      detail: 'Barre enrollees'
    }));

    kpiGrid.appendChild(createStatCard({
      label: 'Pending Coach Review',
      value: pending.length.toString(),
      icon: 'clock',
      detail: 'Awaiting Physicq 57'
    }));

    kpiGrid.appendChild(createStatCard({
      label: 'Accepted for Barre',
      value: accepted.length.toString(),
      icon: 'check-circle',
      detail: 'Approved for sessions'
    }));

    kpiGrid.appendChild(createStatCard({
      label: 'Declined / Cancelled',
      value: declined.length.toString(),
      icon: 'x-circle',
      detail: 'Declined by partner'
    }));

    contentArea.appendChild(kpiGrid);

    // Filter Navigation & Search
    const controlBar = createElement('div', {
      className: 'card',
      style: 'margin-bottom: var(--space-4); padding: var(--space-3) var(--space-4); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-3);'
    });

    let currentFilter = 'all';
    let searchQuery = '';

    const filterGroup = createElement('div', { style: 'display: flex; gap: var(--space-2); flex-wrap: wrap;' });

    const filterDefs = [
      { key: 'all', label: `All Requests (${reviews.length})` },
      { key: 'pending', label: `Pending (${pending.length})` },
      { key: 'accepted', label: `Accepted (${accepted.length})` },
      { key: 'declined', label: `Declined (${declined.length})` }
    ];

    const filterBtns = [];
    filterDefs.forEach(def => {
      const btn = createElement('button', {
        className: `btn btn-sm ${def.key === currentFilter ? 'btn-primary' : 'btn-outline'}`,
        attributes: { type: 'button' },
        text: def.label
      });
      btn.addEventListener('click', () => {
        currentFilter = def.key;
        filterBtns.forEach(b => b.classList.replace('btn-primary', 'btn-outline'));
        btn.classList.replace('btn-outline', 'btn-primary');
        renderList();
      });
      filterBtns.push(btn);
      filterGroup.appendChild(btn);
    });

    const searchInput = createElement('input', {
      className: 'form-input',
      attributes: {
        type: 'text',
        placeholder: 'Search by member, email, or reason...',
        style: 'max-width: 280px; padding: 6px 12px; font-size: 13px;'
      }
    });
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderList();
    });

    controlBar.append(filterGroup, searchInput);
    contentArea.appendChild(controlBar);

    // List Container
    const listContainer = createElement('div');
    contentArea.appendChild(listContainer);

    function renderList() {
      clearChildren(listContainer);

      let filtered = reviews;
      if (currentFilter !== 'all') {
        filtered = filtered.filter(r => r.status === currentFilter);
      }
      if (searchQuery) {
        filtered = filtered.filter(r => {
          return (r.memberName && r.memberName.toLowerCase().includes(searchQuery)) ||
                 (r.memberEmail && r.memberEmail.toLowerCase().includes(searchQuery)) ||
                 (r.packageName && r.packageName.toLowerCase().includes(searchQuery)) ||
                 (r.decisionReason && r.decisionReason.toLowerCase().includes(searchQuery)) ||
                 (r.healthNotes && r.healthNotes.toLowerCase().includes(searchQuery));
        });
      }

      if (filtered.length === 0) {
        const empty = createEmptyState({
          icon: 'shield-check',
          title: 'No reviews found',
          description: currentFilter === 'all'
            ? 'No Barre package purchases currently pending or recorded.'
            : `No records found in ${currentFilter} status.`
        });
        listContainer.appendChild(empty);
        return;
      }

      const list = createElement('div', { style: 'display: flex; flex-direction: column; gap: var(--space-4);' });

      filtered.forEach(rev => {
        const card = createElement('div', {
          className: 'card',
          style: `border-left: 4px solid ${rev.status === 'accepted' ? '#2E5A44' : rev.status === 'declined' ? 'var(--rust)' : '#C98A2C'}; padding: var(--space-5);`
        });

        const topRow = createElement('div', {
          style: 'display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-3); margin-bottom: var(--space-3);'
        });

        const memberBlock = createElement('div');
        const nameEl = createElement('h3', {
          style: 'font-size: var(--text-base); font-weight: var(--weight-bold); color: var(--ink); margin-bottom: 2px;',
          text: rev.memberName || 'Member'
        });
        const contactEl = createElement('div', {
          style: 'font-size: var(--text-xs); color: var(--ink-50);',
          text: `${rev.memberEmail || 'No email'} · ${rev.memberPhone || 'No phone'} · Enrolled: ${formatDate(rev.createdAt)}`
        });
        const packageBadge = createElement('span', {
          style: 'display: inline-block; font-size: 11px; font-weight: 600; background: var(--stone); color: var(--ink-70); padding: 2px 8px; border-radius: 4px; margin-top: 4px;',
          text: `Package: ${rev.packageName || 'Barre Conditioning'}`
        });
        memberBlock.append(nameEl, contactEl, packageBadge);

        // Status badge
        const badgeWrap = createElement('div', { style: 'display: flex; align-items: center; gap: var(--space-2);' });
        if (rev.status === 'accepted') {
          badgeWrap.appendChild(createBadge({ text: 'Accepted by Physicq 57', status: 'completed', showDot: true }));
        } else if (rev.status === 'declined') {
          badgeWrap.appendChild(createBadge({ text: 'Declined by Physicq 57', status: 'no-show', showDot: true }));
        } else {
          badgeWrap.appendChild(createBadge({ text: 'Pending Partner Review', status: 'pending', showDot: true }));
        }
        topRow.append(memberBlock, badgeWrap);
        card.appendChild(topRow);

        // Health Assessment Details
        const healthSection = createElement('div', {
          style: 'background: var(--stone-10, #FDFCFA); border: 1px solid var(--stone-20, #F0EDE8); border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: var(--space-3);'
        });
        healthSection.innerHTML = `
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink-50); margin-bottom: 2px;">
            Member Physical & Health Assessment:
          </div>
          <div style="font-size: 13px; color: var(--ink-80);">
            ${rev.healthNotes || 'No limiting physical conditions or injuries reported.'}
          </div>
        `;
        card.appendChild(healthSection);

        // If Declined: Prominent alert showing cancellation reason
        if (rev.status === 'declined') {
          const reasonAlert = createElement('div', {
            style: 'background: #FFF5F5; border: 1px solid #FED7D7; border-left: 4px solid var(--rust); border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: var(--space-3);'
          });
          reasonAlert.innerHTML = `
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rust); margin-bottom: 2px;">
              Physicq 57 Partner Declination Reason:
            </div>
            <div style="font-size: 13px; font-weight: 600; color: #9B2C2C;">
              "${rev.decisionReason || 'Partner coach determined attendee profile requires medical clearance or specialized modification.'}"
            </div>
            <div style="font-size: 11px; color: var(--ink-50); margin-top: 4px;">
              Decision recorded on ${formatDate(rev.decidedAt || rev.createdAt)}.
            </div>
          `;
          card.appendChild(reasonAlert);
        } else if (rev.status === 'accepted') {
          const acceptedNotice = createElement('div', {
            style: 'font-size: 12px; color: #2E5A44; font-weight: 500; margin-bottom: var(--space-2);'
          });
          acceptedNotice.textContent = `✓ Safety verified and accepted on ${formatDate(rev.decidedAt || rev.createdAt)}. Member cleared for Barre sessions.`;
          card.appendChild(acceptedNotice);
        }

        // Admin Override Actions (if pending)
        if (rev.status === 'pending') {
          const actionsRow = createElement('div', {
            style: 'display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-2);'
          });

          const approveBtn = createElement('button', {
            className: 'btn btn-primary btn-sm',
            attributes: { type: 'button' },
            text: 'Approve on Behalf of Partner'
          });
          approveBtn.addEventListener('click', async () => {
            try {
              approveBtn.disabled = true;
              await store.acceptPartnerReview(rev.id, 'Admin Override (Plash Studio)');
              showToast(`Accepted ${rev.memberName} for Barre programming.`, 'success');
              renderView();
            } catch (err) {
              showToast(err.message, 'error');
              approveBtn.disabled = false;
            }
          });

          const declineBtn = createElement('button', {
            className: 'btn btn-outline btn-sm',
            attributes: { type: 'button' },
            style: 'color: var(--rust); border-color: var(--rust);',
            text: 'Decline with Reason'
          });
          declineBtn.addEventListener('click', () => {
            openDeclineModal(rev, () => renderView());
          });

          actionsRow.append(declineBtn, approveBtn);
          card.appendChild(actionsRow);
        }

        list.appendChild(card);
      });

      listContainer.appendChild(list);

      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ root: listContainer });
      }
    }

    renderList();

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: contentArea });
    }
  }

  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    try {
      await store.syncPartnerReviews();
      renderView();
      showToast('Partner reviews synced.', 'info');
    } catch (err) {
      showToast('Sync error: ' + err.message, 'error');
    } finally {
      syncBtn.disabled = false;
    }
  });

  renderView();

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}

function openDeclineModal(review, onComplete) {
  const content = createElement('div', { style: 'font-size: 13px; line-height: 1.6;' });
  content.innerHTML = `
    <p style="margin-bottom: 12px;">You are declining <strong>${review.memberName}</strong> for Barre Conditioning programming.</p>
    <div style="margin-bottom: 12px;">
      <label style="display: block; font-weight: 600; margin-bottom: 4px;">Reason for Declination / Cancellation *</label>
      <textarea id="admin-decline-reason" class="form-input" rows="3" placeholder="Enter reason (e.g., spinal injury contraindicated for athletic barre, physician clearance required)..." style="width: 100%; resize: vertical;"></textarea>
    </div>
    <p style="font-size: 11px; color: var(--rust); font-weight: 500;">This reason will be recorded in the audit ledger and displayed on this admin dashboard.</p>
  `;

  const declineConfirmBtn = createElement('button', {
    className: 'btn btn-outline btn-sm',
    attributes: { type: 'button' },
    style: 'color: var(--rust); border-color: var(--rust);',
    text: 'Confirm Declination'
  });

  const modal = openModal({
    title: 'Decline Member for Barre',
    content,
    actions: [declineConfirmBtn]
  });

  declineConfirmBtn.addEventListener('click', async () => {
    const reasonInput = document.getElementById('admin-decline-reason');
    const reason = reasonInput ? reasonInput.value.trim() : '';
    if (!reason) {
      showToast('Please provide a specific reason for declining.', 'error');
      return;
    }

    try {
      declineConfirmBtn.disabled = true;
      declineConfirmBtn.textContent = 'Recording...';
      await store.declinePartnerReview(review.id, reason, 'Admin Override (Plash Studio)');
      modal.close();
      showToast(`Member declined with recorded reason: "${reason}"`, 'info');
      if (onComplete) onComplete();
    } catch (err) {
      showToast(err.message, 'error');
      declineConfirmBtn.disabled = false;
      declineConfirmBtn.textContent = 'Confirm Declination';
    }
  });
}
