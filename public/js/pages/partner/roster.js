/**
 * Plash Pilates — Partner Portal: Barre Roster (Physicq 57)
 * Scoped view displaying ONLY members enrolled in Barre Conditioning sessions.
 * Enforces strict data access isolation.
 * @module pages/partner/roster
 */

import { createElement } from '../../utils/dom.js';
import * as store from '../../core/store.js';
import { createDataTable } from '../../components/data-table.js';
import { createBadge } from '../../components/badge.js';

export async function render(container) {
  const page = createElement('div', { className: 'page-container' });

  // Header
  const header = createElement('div', { className: 'page-header' });
  const title = createElement('h1', { className: 'page-title', text: 'Barre Member Roster' });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    text: 'Physicq 57 coach view: Access active participants and health directives for Barre enrollees.'
  });
  header.append(title, subtitle);
  page.appendChild(header);

  // Scope isolation notice
  const scopeNotice = createElement('div', {
    style: 'background: var(--stone); border-left: 4px solid var(--olive); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-5); margin-bottom: var(--space-6); font-size: var(--text-xs); color: var(--ink-80); display: flex; align-items: center; gap: var(--space-3);'
  });
  scopeNotice.innerHTML = `
    <i data-lucide="shield-check" style="width: 16px; height: 16px; color: var(--olive); flex-shrink: 0;"></i>
    <span><strong>Data Protection Scope:</strong> In accordance with DPDPA 2023 principles of purpose limitation, this roster is strictly limited to studio members who have booked Barre Conditioning sessions.</span>
  `;
  page.appendChild(scopeNotice);

  const barreMembers = store.getBarreRoster();

  const tableData = barreMembers.map(m => {
    const health = store.getHealthProfile(m.id) || {};
    return {
      id: m.id,
      name: m.fullName,
      phone: m.phone,
      experience: health.experience || 'Intermediate',
      injuries: health.injuries || 'None reported',
      isPregnant: health.isPregnant ? 'Yes' : 'No',
      raw: m
    };
  });

  const columns = [
    {
      key: 'name',
      label: 'Participant Name',
      sortable: true,
      render: (val, row) => {
        const wrap = createElement('div');
        const n = createElement('div', { style: 'font-weight: var(--weight-semibold); color: var(--ink);', text: val });
        const p = createElement('div', { style: 'font-size: 11px; color: var(--ink-50);', text: row.phone });
        wrap.append(n, p);
        return wrap;
      }
    },
    {
      key: 'experience',
      label: 'Level',
      sortable: true,
      render: (val) => createBadge({ text: val.toUpperCase(), status: 'standard' })
    },
    {
      key: 'injuries',
      label: 'Health & Injury Notes',
      sortable: false,
      render: (val) => {
        const span = createElement('span', {
          style: 'font-size: var(--text-xs); color: var(--ink-80); max-width: 260px; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
          text: val
        });
        return span;
      }
    },
    {
      key: 'isPregnant',
      label: 'Prenatal Mod',
      sortable: true,
      render: (val) => {
        return createBadge({
          text: val === 'Yes' ? 'Prenatal' : 'None',
          status: val === 'Yes' ? 'pending' : 'standard'
        });
      }
    },
    {
      key: 'actions',
      label: 'Coach View',
      render: (_, row) => {
        const link = createElement('a', {
          className: 'btn btn-outline btn-sm',
          attributes: { href: `#/partner/members/${row.id}` },
          text: 'Health Directives'
        });
        return link;
      }
    }
  ];

  const table = createDataTable({
    columns,
    data: tableData,
    searchable: true,
    searchPlaceholder: 'Search Barre roster...'
  });

  page.appendChild(table);
  container.appendChild(page);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}
