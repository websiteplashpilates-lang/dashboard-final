/**
 * Plash Pilates — Waiver Checkbox Component
 * Waiver acceptance gate required before package purchase.
 * Links to full liability waiver modal dialog.
 * @module waiver-checkbox
 */

import { createElement } from '../utils/dom.js';
import { openModal } from './modal.js';
import * as store from '../core/store.js';

/**
 * Create a waiver acceptance checkbox component.
 * @param {Object} [options]
 * @param {Function} [options.onChange] - Callback when checked state changes: (checked) => void
 * @returns {HTMLElement & { isChecked: () => boolean, getWaiverId: () => string }}
 */
export function createWaiverCheckbox({ onChange } = {}) {
  const container = createElement('div', {
    className: 'waiver-section',
    style: 'background: var(--stone); border-radius: var(--radius-sm); padding: var(--space-4); margin-bottom: var(--space-6);'
  });

  const wrapper = createElement('div', {
    className: 'form-checkbox-wrapper',
    style: 'display: flex; align-items: flex-start; gap: var(--space-3);'
  });

  const currentWaiver = store.getCurrentWaiver() || {
    id: 'waiver-1.0',
    version: '1.0',
    title: 'Liability Waiver & Health Declaration',
    content: 'By participating in classes at Plash Pilates, you acknowledge the physical demands and inherent risks of Pilates, Barre, and Sculpt Yoga...'
  };

  const input = createElement('input', {
    attributes: {
      type: 'checkbox',
      id: 'liability-waiver-checkbox',
      name: 'waiverAccepted',
      'aria-required': 'true'
    },
    style: 'width: 20px; height: 20px; min-width: 20px; accent-color: var(--rust, #934b2d); cursor: pointer; margin-top: 2px; flex-shrink: 0;'
  });
  input.checked = false;

  const label = createElement('label', {
    attributes: { for: 'liability-waiver-checkbox' },
    style: 'font-size: var(--text-sm); line-height: 1.5; color: var(--ink); cursor: pointer; user-select: none; flex: 1;'
  });

  label.appendChild(document.createTextNode('I have read, understood, and agree to the '));

  const link = createElement('button', {
    attributes: { type: 'button' },
    style: 'background: none; border: none; padding: 0; color: var(--rust); text-decoration: underline; cursor: pointer; font-size: inherit; font-family: inherit; font-weight: var(--weight-semibold); display: inline;',
    text: `Liability Waiver & Health Declaration (v${currentWaiver.version})`
  });

  link.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openWaiverModal(currentWaiver);
  });

  label.appendChild(link);
  label.appendChild(document.createTextNode(' as well as the studio safety rules.'));

  wrapper.append(input, label);
  container.appendChild(wrapper);

  function updateVisualState() {
    if (input.checked) {
      container.style.borderColor = 'var(--moss, #526b46)';
      container.style.background = 'rgba(82, 107, 70, 0.08)';
    } else {
      container.style.borderColor = 'var(--ink-10, rgba(26, 26, 26, 0.1))';
      container.style.background = 'var(--stone)';
    }
  }

  input.addEventListener('change', () => {
    updateVisualState();
    if (onChange) onChange(input.checked);
  });

  function openWaiverModal(waiver) {
    const content = createElement('div', { style: 'font-size: var(--text-sm); line-height: 1.7; color: var(--ink-80); max-height: 50vh; overflow-y: auto; padding-right: var(--space-2);' });

    const p = createElement('p', {
      style: 'white-space: pre-line;',
      text: waiver.bodyText || waiver.content
    });
    content.appendChild(p);

    const acceptBtn = createElement('button', {
      className: 'btn btn-primary btn-sm',
      attributes: { type: 'button' },
      text: 'I Accept Waiver'
    });

    const modal = openModal({
      title: `${waiver.title} (v${waiver.version})`,
      content,
      actions: [acceptBtn],
      maxWidth: '650px'
    });

    acceptBtn.addEventListener('click', () => {
      input.checked = true;
      updateVisualState();
      if (onChange) onChange(true);
      modal.close();
    });
  }

  container.isChecked = () => input.checked;
  container.setChecked = (val) => {
    input.checked = !!val;
    updateVisualState();
    if (onChange) onChange(input.checked);
  };
  container.getWaiverId = () => currentWaiver.id;

  return container;
}
