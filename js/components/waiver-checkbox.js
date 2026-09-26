/**
 * Plash Pilates — Dynamic Multi-Studio Waiver Checkbox Component
 * Displays the appropriate legal waiver depending on cart contents:
 * - Barre package -> Physique 57 / AMP Fitness LLP Customer Waiver & Policies
 * - Plash package -> Plash Pilates Studio Member Liability Waiver & Privacy Policy
 * - Combined package -> Dual Studio Waiver (both Plash & Physique 57 tabs)
 * @module waiver-checkbox
 */

import { createElement, clearChildren } from '../utils/dom.js';
import { openModal } from './modal.js';
import * as store from '../core/store.js';

/**
 * Create a dynamic waiver acceptance checkbox component.
 * @param {Object} [options]
 * @param {Object} [options.packageItem] - The package item currently in cart
 * @param {Function} [options.onChange] - Callback when checked state changes: (checked) => void
 * @returns {HTMLElement & { isChecked: () => boolean, setChecked: (val: boolean) => void, getWaiverId: () => string, setPackage: (pkg: Object) => void }}
 */
export function createWaiverCheckbox({ onChange, packageItem } = {}) {
  const container = createElement('div', {
    className: 'waiver-section',
    style: 'background: var(--stone); border-radius: var(--radius-sm); padding: var(--space-4); margin-bottom: var(--space-6); border: 1.5px solid var(--ink-10); transition: all var(--transition-fast);'
  });

  const wrapper = createElement('div', {
    className: 'form-checkbox-wrapper',
    style: 'display: flex; align-items: flex-start; gap: var(--space-3);'
  });

  let currentConfig = store.getWaiverConfigForPackage(packageItem);

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

  function renderLabelContent() {
    clearChildren(label);
    label.appendChild(document.createTextNode('I have read, understood, and agree to the '));

    const link = createElement('button', {
      attributes: { type: 'button' },
      style: 'background: none; border: none; padding: 0; color: var(--rust); text-decoration: underline; cursor: pointer; font-size: inherit; font-family: inherit; font-weight: var(--weight-semibold); display: inline;',
      text: currentConfig.linkText || currentConfig.title
    });

    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openDynamicWaiverModal(currentConfig);
    });

    label.appendChild(link);
    const suffix = currentConfig.type === 'combined'
      ? ' as well as both studio safety rules.'
      : ' as well as the studio safety rules.';
    label.appendChild(document.createTextNode(suffix));
  }

  renderLabelContent();

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

  function openDynamicWaiverModal(config) {
    const modalContent = createElement('div', {
      style: 'display: flex; flex-direction: column; gap: var(--space-4); max-height: 65vh;'
    });

    let activeSubIndex = 0;
    const subWaivers = config.subWaivers || [{
      title: config.waiver?.title || config.title,
      version: config.waiver?.version || '1.0',
      content: config.waiver?.bodyText || config.waiver?.content || ''
    }];

    // If combined, add tab strip
    if (config.type === 'combined' && subWaivers.length > 1) {
      const tabStrip = createElement('div', {
        className: 'tab-strip',
        style: 'display: flex; gap: var(--space-2); border-bottom: 1px solid var(--ink-10); padding-bottom: var(--space-2);'
      });

      const tabButtons = [];

      subWaivers.forEach((sw, idx) => {
        const tabBtn = createElement('button', {
          attributes: { type: 'button' },
          style: `padding: 6px 14px; font-size: var(--text-xs); font-weight: var(--weight-semibold); border-radius: var(--radius-sm); border: 1px solid ${idx === 0 ? 'var(--rust)' : 'var(--ink-10)'}; background: ${idx === 0 ? 'var(--rust)' : 'var(--stone)'}; color: ${idx === 0 ? '#fff' : 'var(--ink-70)'}; cursor: pointer; transition: all var(--transition-fast);`,
          text: sw.tabTitle || sw.title
        });

        tabBtn.addEventListener('click', () => {
          activeSubIndex = idx;
          tabButtons.forEach((btn, bIdx) => {
            if (bIdx === idx) {
              btn.style.background = 'var(--rust)';
              btn.style.borderColor = 'var(--rust)';
              btn.style.color = '#fff';
            } else {
              btn.style.background = 'var(--stone)';
              btn.style.borderColor = 'var(--ink-10)';
              btn.style.color = 'var(--ink-70)';
            }
          });
          renderActiveText();
        });

        tabButtons.push(tabBtn);
        tabStrip.appendChild(tabBtn);
      });

      modalContent.appendChild(tabStrip);
    }

    const scrollBox = createElement('div', {
      style: 'font-size: var(--text-sm); line-height: 1.7; color: var(--ink-80); overflow-y: auto; padding-right: var(--space-3); background: #ffffff; border: 1px solid var(--ink-10); border-radius: var(--radius-sm); padding: var(--space-4); max-height: 48vh;'
    });

    const activeTitle = createElement('div', {
      style: 'font-weight: var(--weight-bold); font-size: var(--text-sm); color: var(--ink); margin-bottom: var(--space-3); padding-bottom: var(--space-2); border-bottom: 1px solid var(--ink-10);'
    });

    const activeText = createElement('p', {
      style: 'white-space: pre-line; margin: 0; font-size: 13px; line-height: 1.65; color: var(--ink-80);'
    });

    scrollBox.append(activeTitle, activeText);
    modalContent.appendChild(scrollBox);

    function renderActiveText() {
      const current = subWaivers[activeSubIndex] || subWaivers[0];
      activeTitle.textContent = `${current.title} (v${current.version || '1.0'})`;
      activeText.textContent = current.content;
      scrollBox.scrollTop = 0;
    }

    renderActiveText();

    let acceptLabel = 'I Accept Waiver';
    if (config.type === 'combined') {
      acceptLabel = 'I Accept Both Waivers';
    } else if (config.type === 'barre') {
      acceptLabel = 'I Accept Physique 57 Waiver';
    } else {
      acceptLabel = 'I Accept Plash Pilates Waiver';
    }

    const acceptBtn = createElement('button', {
      className: 'btn btn-primary',
      attributes: { type: 'button' },
      style: 'justify-content: center;',
      text: acceptLabel
    });

    const modal = openModal({
      title: config.title,
      content: modalContent,
      actions: [acceptBtn],
      maxWidth: '680px'
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
  container.getWaiverId = () => currentConfig.waiverId;
  container.setPackage = (pkg) => {
    currentConfig = store.getWaiverConfigForPackage(pkg);
    renderLabelContent();
  };

  return container;
}
