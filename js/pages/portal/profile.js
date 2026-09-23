/**
 * Plash Pilates — Member Portal: Unified Profile, Health & Security
 * Combines personal contact info, health assessment declaration,
 * and password management / recovery in one unified screen.
 * @module pages/portal/profile
 */

import { createElement } from '../../utils/dom.js';
import * as auth from '../../core/auth.js';
import * as store from '../../core/store.js';
import { showToast } from '../../components/toast.js';
import { openEmailChangeModal } from '../../components/email-change-modal.js';
import { openModal } from '../../components/modal.js';
import { initCookieBanner } from '../../components/cookie-banner.js';

export async function render(container) {
  const memberId = auth.getCurrentMemberId();
  const member = store.getMemberById(memberId);
  const health = store.getHealthProfile(memberId) || {};

  const page = createElement('div', { className: 'page-container' });

  // Page header
  const header = createElement('div', { className: 'page-header' });
  const title = createElement('h1', { className: 'page-title', text: 'My Profile & Account' });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    text: 'Manage your contact details, movement and health assessment for coaches, and password security.'
  });
  header.append(title, subtitle);
  page.appendChild(header);

  // Main 2-column grid
  const grid = createElement('div', { className: 'grid grid-2', style: 'margin-bottom: var(--space-8);' });

  // =========================================================================
  // CARD 1: Personal Contact & Account Info
  // =========================================================================
  const personalCard = createElement('div', { className: 'card' });
  const personalHeading = createElement('h2', {
    style: 'font-family: var(--font-serif); font-size: var(--text-lg); font-weight: var(--weight-semibold); margin-bottom: var(--space-4); color: var(--ink); display: flex; align-items: center; gap: var(--space-2);',
    text: 'Personal Information'
  });
  personalHeading.prepend(createElement('i', { attributes: { 'data-lucide': 'user' }, style: 'width: 18px; height: 18px; color: var(--gold);' }));
  personalCard.appendChild(personalHeading);

  const pForm = createElement('form', { style: 'display: flex; flex-direction: column; gap: var(--space-4);' });

  // Name
  const nameGroup = createElement('div', { className: 'form-group' });
  const nameLabel = createElement('label', { className: 'form-label', text: 'Full Name', attributes: { for: 'p-name' } });
  const nameInput = createElement('input', {
    className: 'form-input',
    attributes: { type: 'text', id: 'p-name', value: member ? member.fullName : '', required: 'true' }
  });
  nameGroup.append(nameLabel, nameInput);

  // Email with Change with Verification Option
  const emailGroup = createElement('div', { className: 'form-group' });
  const emailLabelRow = createElement('div', {
    style: 'display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-1);'
  }, [
    createElement('label', { className: 'form-label', text: 'Email Address', attributes: { for: 'p-email' }, style: 'margin-bottom: 0;' }),
    createElement('button', {
      type: 'button',
      id: 'change-email-btn',
      className: 'btn btn-ghost btn-sm',
      style: 'font-size: var(--text-xs); padding: 2px 8px; color: var(--rust); display: flex; align-items: center; gap: 4px; font-weight: var(--weight-semibold);',
      children: [
        createElement('i', { attributes: { 'data-lucide': 'mail-check' }, style: 'width: 14px; height: 14px;' }),
        createElement('span', { text: 'Change Email' })
      ]
    })
  ]);

  const currentMemberEmail = member ? member.email : (auth.getCurrentUser()?.email || '');
  const emailInput = createElement('input', {
    className: 'form-input',
    attributes: { type: 'email', id: 'p-email', value: currentMemberEmail, disabled: 'true' },
    style: 'background: var(--stone); opacity: 0.9; cursor: not-allowed;'
  });

  const emailHelp = createElement('span', {
    style: 'font-size: var(--text-xs); color: var(--ink-50); margin-top: 2px;',
    text: 'Studio identifier. Requires OTP security verification to update.'
  });
  emailGroup.append(emailLabelRow, emailInput, emailHelp);

  emailLabelRow.querySelector('#change-email-btn')?.addEventListener('click', () => {
    openEmailChangeModal({
      currentEmail: emailInput.value,
      onSuccess: (newEmail) => {
        emailInput.value = newEmail;
      }
    });
  });

  // Phone
  const phoneGroup = createElement('div', { className: 'form-group' });
  const phoneLabel = createElement('label', { className: 'form-label', text: 'Phone Number', attributes: { for: 'p-phone' } });
  const phoneInput = createElement('input', {
    className: 'form-input',
    attributes: { type: 'tel', id: 'p-phone', value: member ? (member.phone || '') : '', placeholder: '+91 98450 12345' }
  });
  phoneGroup.append(phoneLabel, phoneInput);

  // Emergency Contact
  const emerGroup = createElement('div', { className: 'form-group' });
  const emerLabel = createElement('label', { className: 'form-label', text: 'Emergency Contact (Name & Phone)', attributes: { for: 'p-emer' } });
  const emerInput = createElement('input', {
    className: 'form-input',
    attributes: {
      type: 'text',
      id: 'p-emer',
      value: health.emergencyContactName || health.emergencyContact || (member ? member.emergencyContact : '') || '',
      placeholder: 'e.g. S. Rao - +91 98450 12345'
    }
  });
  emerGroup.append(emerLabel, emerInput);

  const pSaveBtn = createElement('button', {
    className: 'btn btn-primary btn-sm',
    attributes: { type: 'submit' },
    style: 'align-self: flex-start; margin-top: var(--space-2);',
    text: 'Save Personal Details'
  });

  pForm.append(nameGroup, emailGroup, phoneGroup, emerGroup, pSaveBtn);
  personalCard.appendChild(pForm);

  pForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    pSaveBtn.disabled = true;
    pSaveBtn.textContent = 'Saving...';
    try {
      await store.updateMemberProfile(memberId, {
        fullName: nameInput.value.trim(),
        phone: phoneInput.value.trim(),
        emergencyContact: emerInput.value.trim()
      });
      showToast('Profile details updated successfully.', 'success');
    } catch (err) {
      console.error('[Profile Update Failed]', err);
      showToast(err.message || 'Failed to update profile.', 'error');
    } finally {
      pSaveBtn.disabled = false;
      pSaveBtn.textContent = 'Save Personal Details';
    }
  });

  // =========================================================================
  // CARD 2: Health & Safety Assessment
  // =========================================================================
  const healthCard = createElement('div', { className: 'card' });
  const healthHeading = createElement('h2', {
    style: 'font-family: var(--font-serif); font-size: var(--text-lg); font-weight: var(--weight-semibold); margin-bottom: var(--space-4); color: var(--ink); display: flex; align-items: center; gap: var(--space-2);',
    text: 'Health & Physical Assessment'
  });
  healthHeading.prepend(createElement('i', { attributes: { 'data-lucide': 'activity' }, style: 'width: 18px; height: 18px; color: var(--rust);' }));
  healthCard.appendChild(healthHeading);

  const hForm = createElement('form', { style: 'display: flex; flex-direction: column; gap: var(--space-4);' });

  // Prior Pilates Experience
  const expGroup = createElement('div', { className: 'form-group' });
  const expLabel = createElement('label', { className: 'form-label', text: 'Movement Experience', attributes: { for: 'h-exp' } });
  const currentExp = (health.movementExperience || (health.notes && health.notes.toLowerCase().includes('beginner') ? 'beginner' : (health.notes && health.notes.toLowerCase().includes('advanced') ? 'advanced' : 'intermediate'))).toLowerCase();
  const expSelect = createElement('select', { className: 'form-select', attributes: { id: 'h-exp' } }, [
    createElement('option', { attributes: { value: 'beginner', ...(currentExp === 'beginner' ? { selected: 'true' } : {}) }, text: 'Beginner (New to Reformer & Barre)' }),
    createElement('option', { attributes: { value: 'intermediate', ...(currentExp === 'intermediate' ? { selected: 'true' } : {}) }, text: 'Intermediate (Regular practice)' }),
    createElement('option', { attributes: { value: 'advanced', ...(currentExp === 'advanced' ? { selected: 'true' } : {}) }, text: 'Advanced (Experienced practitioner)' }),
  ]);
  expGroup.append(expLabel, expSelect);

  // Injuries / Spine
  const injGroup = createElement('div', { className: 'form-group' });
  const injLabel = createElement('label', { className: 'form-label', text: 'Injuries, Spinal or Joint Conditions', attributes: { for: 'h-inj' } });
  const injInput = createElement('textarea', {
    className: 'form-textarea',
    attributes: { id: 'h-inj', rows: '3', placeholder: 'e.g. Lumbar disc strain (L4-L5), right knee meniscus surgery, etc.' },
    text: health.injuriesNotes || health.injuries || health.spinalConditions || ''
  });
  injGroup.append(injLabel, injInput);

  // Pregnancy / Postnatal
  const pregGroup = createElement('div', { className: 'form-checkbox-wrapper' });
  const pregCheck = createElement('input', {
    attributes: {
      type: 'checkbox',
      id: 'h-preg',
      ...(health.isPregnant ? { checked: 'true' } : {})
    }
  });
  const pregLabel = createElement('label', {
    attributes: { for: 'h-preg' },
    style: 'font-size: var(--text-sm); color: var(--ink); cursor: pointer;',
    text: 'Currently pregnant or within 6 months postpartum'
  });
  pregGroup.append(pregCheck, pregLabel);

  // Physician clearance
  const clearGroup = createElement('div', { className: 'form-checkbox-wrapper' });
  const clearCheck = createElement('input', {
    attributes: {
      type: 'checkbox',
      id: 'h-clear',
      checked: 'true'
    }
  });
  const clearLabel = createElement('label', {
    attributes: { for: 'h-clear' },
    style: 'font-size: var(--text-sm); color: var(--ink); cursor: pointer;',
    text: 'I confirm medical fitness for vigorous physical exercise'
  });
  clearGroup.append(clearCheck, clearLabel);

  const hSaveBtn = createElement('button', {
    className: 'btn btn-primary btn-sm',
    attributes: { type: 'submit' },
    style: 'align-self: flex-start; margin-top: var(--space-2);',
    text: 'Save Health Declaration'
  });

  hForm.append(expGroup, injGroup, pregGroup, clearGroup, hSaveBtn);
  healthCard.appendChild(hForm);

  hForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hSaveBtn.disabled = true;
    hSaveBtn.textContent = 'Saving...';
    try {
      await store.updateHealthProfile(memberId, {
        experience: expSelect.value,
        injuries: injInput.value.trim(),
        isPregnant: pregCheck.checked,
        medicallyCleared: clearCheck.checked,
        emergencyContact: emerInput.value.trim(),
        updatedAt: new Date().toISOString()
      });
      showToast('Health assessment updated and shared with your instructors.', 'success');
    } catch (err) {
      console.error('[Health Profile Update Failed]', err);
      showToast(err.message || 'Failed to save health declaration.', 'error');
    } finally {
      hSaveBtn.disabled = false;
      hSaveBtn.textContent = 'Save Health Declaration';
    }
  });

  grid.append(personalCard, healthCard);
  page.appendChild(grid);



  // =========================================================================
  // CARD 4: Data & Privacy Controls (Subtle, Collapsible / Bottom section)
  // =========================================================================
  const privacyAccordion = createElement('details', {
    className: 'card',
    style: 'margin-top: var(--space-4); cursor: pointer;'
  });

  const privacySummary = createElement('summary', {
    style: 'font-weight: var(--weight-medium); font-size: var(--text-sm); color: var(--ink-70); display: flex; align-items: center; gap: var(--space-2); outline: none;',
    text: 'Privacy & Data Protection Options (DPDPA 2023)'
  });
  privacySummary.prepend(createElement('i', { attributes: { 'data-lucide': 'shield' }, style: 'width: 14px; height: 14px; color: var(--ink-50);' }));

  const privacyBody = createElement('div', { style: 'margin-top: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--ink-10);' });

  const privacyText = createElement('p', {
    style: 'font-size: var(--text-xs); line-height: 1.6; color: var(--ink-70); margin-bottom: var(--space-4);',
    text: 'Under the Digital Personal Data Protection Act (India), you have the right to obtain a digital archive of your health and booking records or request account erasure.'
  });

  const privacyActions = createElement('div', { style: 'display: flex; gap: var(--space-3); flex-wrap: wrap;' });

  // Download Data JSON
  const downloadBtn = createElement('button', {
    className: 'btn btn-outline btn-sm',
    attributes: { type: 'button' },
    text: 'Download My Data (JSON)'
  });
  downloadBtn.prepend(createElement('i', { attributes: { 'data-lucide': 'download' }, style: 'width: 14px; height: 14px; margin-right: 6px;' }));
  downloadBtn.addEventListener('click', () => {
    const exportData = {
      member,
      healthProfile: store.getHealthProfile(memberId),
      passes: store.getMemberPasses(memberId),
      credits: store.getMemberCredits(memberId),
      bookings: store.getAllBookings().filter(b => b.memberId === memberId),
      exportedAt: new Date().toISOString(),
      studio: 'Plash Pilates Bengaluru'
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plash-profile-${memberId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Personal data archive downloaded.', 'success');
  });

  // Cookie Preferences
  const cookieBtn = createElement('button', {
    className: 'btn btn-outline btn-sm',
    attributes: { type: 'button' },
    text: 'Cookie & Tracker Preferences'
  });
  cookieBtn.prepend(createElement('i', { attributes: { 'data-lucide': 'sliders' }, style: 'width: 14px; height: 14px; margin-right: 6px;' }));
  cookieBtn.addEventListener('click', () => {
    initCookieBanner(true);
  });

  // Delete Account
  const eraseBtn = createElement('button', {
    className: 'btn btn-sm',
    attributes: { type: 'button' },
    style: 'color: var(--rust); border: 1px solid var(--rust); background: transparent;',
    text: 'Request Account & Data Erasure'
  });
  eraseBtn.prepend(createElement('i', { attributes: { 'data-lucide': 'trash-2' }, style: 'width: 14px; height: 14px; margin-right: 6px;' }));
  eraseBtn.addEventListener('click', () => {
    openModal({
      title: 'Request Account Erasure',
      content: `
        <div style="font-size: var(--text-sm); line-height: 1.6; color: var(--ink-80);">
          <p style="margin-bottom: var(--space-3);">
            This request initiates permanent deletion of your profile, medical assessment, and active pass entitlements from Plash Pilates.
          </p>
          <p style="margin-bottom: var(--space-3); color: var(--rust);">
            <strong>Warning:</strong> Outstanding unused pass credits will be forfeited immediately.
          </p>
        </div>
      `,
      confirmText: 'Submit Erasure Request',
      confirmClass: 'btn-danger',
      onConfirm: () => {
        store.logActivity(memberId, 'member', 'Requested DPDPA account erasure', 'compliance');
        showToast('Erasure request submitted to studio data protection officer.', 'info');
      }
    });
  });

  privacyActions.append(downloadBtn, cookieBtn, eraseBtn);
  privacyBody.append(privacyText, privacyActions);
  privacyAccordion.append(privacySummary, privacyBody);
  page.appendChild(privacyAccordion);

  container.appendChild(page);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}
