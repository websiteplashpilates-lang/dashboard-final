/**
 * Plash Pilates — Studio Admin: Packages & Pricing
 * Manage membership plans, session allocations, and rates.
 * Supports full Create, Read, Update, and Delete (CRUD) operations.
 * @module pages/admin/packages
 */

import { createElement, clearChildren } from '../../utils/dom.js';
import { formatCurrency } from '../../utils/format.js';
import { CONFIG } from '../../core/config.js';
import * as store from '../../core/store.js';
import { createDataTable } from '../../components/data-table.js';
import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';

export async function render(container) {
  clearChildren(container);
  await store.fetchPackages();
  const page = createElement('div', { className: 'page-container' });

  // Header with Add New Package CTA
  const header = createElement('div', { 
    className: 'page-header',
    style: 'display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--space-4); margin-bottom: var(--space-6);'
  });

  const headerLeft = createElement('div');
  const title = createElement('h1', { className: 'page-title', text: 'Packages & Pricing Management' });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    text: 'Configure studio membership plans, session allocations, and rates.'
  });
  headerLeft.append(title, subtitle);

  const addPkgBtn = createElement('button', {
    className: 'btn btn-primary',
    attributes: { type: 'button' },
    style: 'display: inline-flex; align-items: center; gap: 8px; font-weight: 700;'
  });
  addPkgBtn.innerHTML = '<i data-lucide="plus-circle" style="width: 17px; height: 17px;"></i><span>Add New Package</span>';
  addPkgBtn.addEventListener('click', () => {
    openAddPackageModal(() => render(container));
  });

  header.append(headerLeft, addPkgBtn);
  page.appendChild(header);

  // Table of Packages
  const packages = store.getPackageCatalog();
  const tableData = packages.map(pkg => {
    let discName = 'All-Access Signature';
    if (pkg.disciplineId) {
      const d = store.getDisciplineById(pkg.disciplineId);
      if (d) discName = d.name;
    }

    const sessionsCount = (pkg.sessionAllocations || []).reduce((sum, a) => sum + (a.sessionCount || 0), 0);

    return {
      id: pkg.id,
      name: pkg.name,
      disciplineName: discName,
      duration: `${pkg.durationMonths} ${pkg.durationMonths === 1 ? 'Month' : 'Months'}`,
      sessions: `${sessionsCount} Sessions`,
      price: pkg.priceInr,
      isPopular: pkg.isPopular,
      raw: pkg
    };
  });

  const columns = [
    { 
      key: 'name', 
      label: 'Plan Name', 
      sortable: true,
      render: (val, row) => {
        const wrap = createElement('div', { style: 'display: flex; align-items: center; gap: 8px;' });
        const nameSpan = createElement('span', { text: val, style: 'font-weight: 600;' });
        wrap.appendChild(nameSpan);
        if (row.isPopular) {
          const badge = createElement('span', {
            style: 'background: var(--rust); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;',
            text: 'Popular'
          });
          wrap.appendChild(badge);
        }
        return wrap;
      }
    },
    { key: 'disciplineName', label: 'Discipline', sortable: true },
    { key: 'duration', label: 'Duration', sortable: false },
    { key: 'sessions', label: 'Sessions', sortable: false },
    { key: 'price', label: 'Price (INR)', sortable: true, render: (val) => formatCurrency(val) },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => {
        const wrap = createElement('div', { style: 'display: flex; gap: 6px; align-items: center;' });

        const editBtn = createElement('button', {
          className: 'btn btn-outline btn-sm',
          attributes: { type: 'button', title: 'Edit Plan Details & Price' },
          text: 'Edit'
        });
        editBtn.addEventListener('click', () => openEditPackageModal(row.raw, () => render(container)));

        const deleteBtn = createElement('button', {
          className: 'btn btn-sm',
          attributes: { type: 'button', title: 'Delete Plan' },
          style: 'background: rgba(220, 38, 38, 0.08); color: #dc2626; border: 1px solid rgba(220, 38, 38, 0.25); cursor: pointer; padding: 4px 10px; border-radius: var(--radius-sm); font-size: var(--text-xs); font-weight: 600; display: inline-flex; align-items: center; gap: 4px;'
        });
        deleteBtn.innerHTML = '<i data-lucide="trash-2" style="width: 13px; height: 13px;"></i><span>Delete</span>';
        deleteBtn.addEventListener('click', () => openDeletePackageModal(row.raw, () => render(container)));

        wrap.append(editBtn, deleteBtn);
        return wrap;
      }
    }
  ];

  const table = createDataTable({
    columns,
    data: tableData,
    searchable: true,
    searchPlaceholder: 'Search packages...'
  });

  page.appendChild(table);
  container.appendChild(page);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}

/**
 * Modal to Add a New Membership Package.
 */
function openAddPackageModal(onSuccess) {
  const form = createElement('form', { 
    id: 'add-pkg-form',
    style: 'display: flex; flex-direction: column; gap: var(--space-4); font-size: var(--text-sm); font-family: "Nunito Sans", sans-serif;' 
  });

  // Name
  const nameGroup = createElement('div', { className: 'form-group', style: 'margin-bottom: 0;' });
  nameGroup.append(
    createElement('label', { className: 'form-label', text: 'Plan Name *', style: 'font-weight: 600; margin-bottom: 4px;' }),
    createElement('input', { 
      className: 'form-input', 
      attributes: { id: 'add-pkg-name', placeholder: 'e.g. Reformer Foundations or All-Access Gold', required: 'true' } 
    })
  );

  // Discipline & Duration Row
  const discDurRow = createElement('div', { style: 'display: grid; grid-template-columns: 1.2fr 0.8fr; gap: var(--space-3);' });

  const discGroup = createElement('div', { className: 'form-group', style: 'margin-bottom: 0;' });
  const discSelect = createElement('select', { className: 'form-input', attributes: { id: 'add-pkg-discipline' } });
  discSelect.innerHTML = `
    <option value="all">All-Access Signature (Pilates + Barre + Yoga)</option>
    <option value="${CONFIG.DISCIPLINES.PILATES}">Reformer Pilates</option>
    <option value="${CONFIG.DISCIPLINES.BARRE}">Barre Conditioning (Physicq 57)</option>
    <option value="${CONFIG.DISCIPLINES.SCULPT_YOGA}">Sculpt Yoga</option>
  `;
  discGroup.append(createElement('label', { className: 'form-label', text: 'Discipline Category *', style: 'font-weight: 600; margin-bottom: 4px;' }), discSelect);

  const durGroup = createElement('div', { className: 'form-group', style: 'margin-bottom: 0;' });
  const durSelect = createElement('select', { className: 'form-input', attributes: { id: 'add-pkg-duration' } });
  durSelect.innerHTML = `
    <option value="1">1 Month</option>
    <option value="3" selected>3 Months</option>
    <option value="6">6 Months</option>
    <option value="12">12 Months</option>
  `;
  durGroup.append(createElement('label', { className: 'form-label', text: 'Duration *', style: 'font-weight: 600; margin-bottom: 4px;' }), durSelect);

  discDurRow.append(discGroup, durGroup);

  // Sessions Allocations
  const sessionsWrapper = createElement('div', { id: 'add-pkg-sessions-wrapper' });

  function renderSessionsInputs() {
    const isAll = discSelect.value === 'all';
    if (isAll) {
      sessionsWrapper.innerHTML = `
        <label class="form-label" style="font-weight: 600; margin-bottom: 4px;">Session Allocations (All-Access)</label>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2);">
          <div>
            <span style="font-size: 11px; color: var(--taupe);">Pilates</span>
            <input type="number" id="add-sessions-pilates" class="form-input" min="0" value="12" required style="height: 38px;" />
          </div>
          <div>
            <span style="font-size: 11px; color: var(--taupe);">Barre</span>
            <input type="number" id="add-sessions-barre" class="form-input" min="0" value="8" required style="height: 38px;" />
          </div>
          <div>
            <span style="font-size: 11px; color: var(--taupe);">Sculpt Yoga</span>
            <input type="number" id="add-sessions-yoga" class="form-input" min="0" value="8" required style="height: 38px;" />
          </div>
        </div>
      `;
    } else {
      sessionsWrapper.innerHTML = `
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for="add-total-sessions" style="font-weight: 600; margin-bottom: 4px;">Total Class Sessions *</label>
          <input type="number" id="add-total-sessions" class="form-input" min="1" value="12" required style="height: 38px;" />
        </div>
      `;
    }
  }

  discSelect.addEventListener('change', renderSessionsInputs);
  renderSessionsInputs();

  // Price & Trainer Tier Row
  const priceTierRow = createElement('div', { style: 'display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);' });

  const stdGroup = createElement('div', { className: 'form-group', style: 'margin-bottom: 0;' });
  const stdInput = createElement('input', {
    className: 'form-input',
    attributes: { type: 'number', id: 'add-std-price', placeholder: '25000', required: 'true', min: '0', step: 'any' }
  });
  stdGroup.append(createElement('label', { className: 'form-label', text: 'Price (INR) *', style: 'font-weight: 600; margin-bottom: 4px;' }), stdInput);

  const tierGroup = createElement('div', { className: 'form-group', style: 'margin-bottom: 0;' });
  const tierSelect = createElement('select', { className: 'form-input', attributes: { id: 'add-pkg-tier' } });
  tierSelect.innerHTML = `
    <option value="">Any / Standard Instructor</option>
    <option value="lead">Lead Instructor</option>
    <option value="master">Master Instructor</option>
  `;
  tierGroup.append(createElement('label', { className: 'form-label', text: 'Instructor Tier (Optional)', style: 'font-weight: 600; margin-bottom: 4px;' }), tierSelect);

  priceTierRow.append(stdGroup, tierGroup);

  // Popular Badge
  const popGroup = createElement('div', { style: 'margin-top: 2px;' });
  popGroup.innerHTML = `
    <label style="display: flex; align-items: center; gap: 8px; font-weight: 600; cursor: pointer; color: var(--ink);">
      <input type="checkbox" id="add-pkg-popular" style="accent-color: var(--rust); width: 16px; height: 16px;" />
      <span>Featured / Popular Badge</span>
    </label>
  `;

  form.append(nameGroup, discDurRow, sessionsWrapper, priceTierRow, popGroup);

  const submitBtn = createElement('button', {
    className: 'btn btn-primary btn-sm',
    attributes: { type: 'button' },
    style: 'padding: 8px 20px; font-weight: 700; cursor: pointer;',
    text: 'Create Package'
  });

  submitBtn.addEventListener('click', () => {
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    } else {
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
  });

  const modal = openModal({
    title: 'Add New Membership Package',
    content: form,
    maxWidth: '560px',
    actions: [submitBtn]
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.querySelector('#add-pkg-name').value.trim();
    const disciplineChoice = discSelect.value;
    const disciplineId = disciplineChoice === 'all' ? null : disciplineChoice;
    const durationMonths = parseInt(durSelect.value, 10);
    const priceInr = parseInt(stdInput.value, 10);
    const isPopular = form.querySelector('#add-pkg-popular').checked;
    const trainerTier = tierSelect.value || undefined;

    let sessionAllocations = [];
    if (disciplineChoice === 'all') {
      const pCount = parseInt(form.querySelector('#add-sessions-pilates')?.value || 12, 10);
      const bCount = parseInt(form.querySelector('#add-sessions-barre')?.value || 8, 10);
      const yCount = parseInt(form.querySelector('#add-sessions-yoga')?.value || 8, 10);
      sessionAllocations = [
        { disciplineId: CONFIG.DISCIPLINES.PILATES, sessionCount: pCount },
        { disciplineId: CONFIG.DISCIPLINES.BARRE, sessionCount: bCount },
        { disciplineId: CONFIG.DISCIPLINES.SCULPT_YOGA, sessionCount: yCount },
      ];
    } else {
      const sCount = parseInt(form.querySelector('#add-total-sessions')?.value || 12, 10);
      sessionAllocations = [
        { disciplineId, sessionCount: sCount }
      ];
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Saving Package...';
      }
      await store.addPackage({
        name,
        disciplineId,
        durationMonths,
        priceInr,
        sessionAllocations,
        isPopular,
        trainerTier
      });

      modal.close();
      showToast(`Package "${name}" added to catalog successfully.`, 'success');
      onSuccess();
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Save & Publish Package';
      }
      showToast(err.message || 'Failed to add package.', 'error');
    }
  });
}

/**
 * Modal to Edit an Existing Package.
 */
function openEditPackageModal(pkg, onSuccess) {
  const content = createElement('form', { 
    id: 'edit-pkg-form',
    style: 'display: flex; flex-direction: column; gap: var(--space-4); font-size: var(--text-sm); font-family: "Nunito Sans", sans-serif;' 
  });

  const nameGroup = createElement('div', { className: 'form-group', style: 'margin-bottom: 0;' });
  nameGroup.append(
    createElement('label', { className: 'form-label', text: 'Plan Name *', style: 'font-weight: 600; margin-bottom: 4px;' }),
    createElement('input', { className: 'form-input', attributes: { id: 'edit-pkg-name', value: pkg.name, required: 'true' } })
  );

  const durPriceRow = createElement('div', { style: 'display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);' });

  const durGroup = createElement('div', { className: 'form-group', style: 'margin-bottom: 0;' });
  const durSelect = createElement('select', { className: 'form-input', attributes: { id: 'edit-pkg-duration' } });
  durSelect.innerHTML = `
    <option value="1" ${pkg.durationMonths === 1 ? 'selected' : ''}>1 Month</option>
    <option value="3" ${pkg.durationMonths === 3 ? 'selected' : ''}>3 Months</option>
    <option value="6" ${pkg.durationMonths === 6 ? 'selected' : ''}>6 Months</option>
    <option value="12" ${pkg.durationMonths === 12 ? 'selected' : ''}>12 Months</option>
  `;
  durGroup.append(createElement('label', { className: 'form-label', text: 'Duration *', style: 'font-weight: 600; margin-bottom: 4px;' }), durSelect);

  const stdGroup = createElement('div', { className: 'form-group', style: 'margin-bottom: 0;' });
  const stdInput = createElement('input', {
    className: 'form-input',
    attributes: { type: 'number', id: 'edit-std-price', value: String(pkg.priceInr), required: 'true', min: '0', step: 'any' }
  });
  stdGroup.append(createElement('label', { className: 'form-label', text: 'Price (INR) *', style: 'font-weight: 600; margin-bottom: 4px;' }), stdInput);

  durPriceRow.append(durGroup, stdGroup);

  const popGroup = createElement('div');
  popGroup.innerHTML = `
    <label style="display: flex; align-items: center; gap: 8px; font-weight: 600; cursor: pointer; color: var(--ink);">
      <input type="checkbox" id="edit-pkg-popular" ${pkg.isPopular ? 'checked' : ''} style="accent-color: var(--rust); width: 16px; height: 16px;" />
      <span>Featured / Popular Badge</span>
    </label>
  `;

  content.append(nameGroup, durPriceRow, popGroup);

  const saveBtn = createElement('button', {
    className: 'btn btn-primary btn-sm',
    attributes: { type: 'button' },
    style: 'padding: 8px 20px; font-weight: 700; cursor: pointer;',
    text: 'Save Pricing Updates'
  });

  saveBtn.addEventListener('click', () => {
    if (typeof content.requestSubmit === 'function') {
      content.requestSubmit();
    } else {
      content.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
  });

  const modal = openModal({
    title: `Edit ${pkg.name} (${pkg.durationMonths}M)`,
    content,
    maxWidth: '520px',
    actions: [saveBtn]
  });

  content.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerText = 'Saving...';
      }
      await store.updatePackage(pkg.id, {
        name: content.querySelector('#edit-pkg-name').value.trim(),
        durationMonths: parseInt(durSelect.value, 10),
        priceInr: parseInt(stdInput.value, 10),
        isPopular: content.querySelector('#edit-pkg-popular').checked
      });
      modal.close();
      showToast('Package rates updated successfully.', 'success');
      onSuccess();
    } catch (err) {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerText = 'Save Changes';
      }
      showToast(err.message || 'Failed to update package.', 'error');
    }
  });
}

/**
 * Modal to Delete a Package with Confirmation.
 */
function openDeletePackageModal(pkg, onSuccess) {
  const content = createElement('div', { 
    style: 'font-size: var(--text-sm); line-height: 1.5; color: var(--ink); font-family: "Nunito Sans", sans-serif;' 
  });
  content.innerHTML = `
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--radius-sm); padding: 12px 14px; margin-bottom: 16px; color: #991b1b; font-size: 13px;">
      <strong>Warning:</strong> You are about to permanently remove <strong>${pkg.name}</strong> (${pkg.durationMonths} Month${pkg.durationMonths === 1 ? '' : 's'}) from the catalog.
    </div>
    <p style="margin: 0 0 10px 0;">
      This plan will no longer be available for new member purchases or renewals. Any passes already held by current members will remain active until expired.
    </p>
  `;

  let modal = null;
  const cancelBtn = createElement('button', {
    type: 'button',
    className: 'btn btn-outline btn-sm',
    text: 'Cancel'
  });
  cancelBtn.addEventListener('click', () => {
    if (modal) modal.close();
  });

  const confirmBtn = createElement('button', {
    type: 'button',
    className: 'btn btn-sm',
    style: 'background: #dc2626; color: #ffffff; border: none; font-weight: 700; padding: 6px 16px; border-radius: var(--radius-sm); cursor: pointer;',
    text: 'Confirm & Delete'
  });
  confirmBtn.addEventListener('click', async () => {
    try {
      confirmBtn.disabled = true;
      confirmBtn.innerText = 'Deleting...';
      await store.deletePackage(pkg.id);
      modal.close();
      showToast(`Package "${pkg.name}" deleted successfully.`, 'success');
      onSuccess();
    } catch (err) {
      confirmBtn.disabled = false;
      confirmBtn.innerText = 'Confirm & Delete';
      showToast(err.message || 'Failed to delete package.', 'error');
    }
  });

  modal = openModal({
    title: 'Delete Membership Package',
    content,
    maxWidth: '480px',
    actions: [cancelBtn, confirmBtn]
  });
}
