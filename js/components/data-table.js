/**
 * Plash Pilates — Data Table Component
 * Searchable, sortable, and filterable accessible data table.
 * @module data-table
 */

import { createElement, clearChildren } from '../utils/dom.js';

/**
 * @typedef {Object} ColumnDef
 * @property {string} key - Property key in row data
 * @property {string} label - Header label
 * @property {boolean} [sortable=false] - Whether column is sortable
 * @property {Function} [render] - Custom cell renderer: (value, row) => HTMLElement|string
 */

/**
 * Create a rich interactive data table.
 * @param {Object} options
 * @param {Array<ColumnDef>} options.columns - Column specifications
 * @param {Array<Object>} options.data - Array of row objects
 * @param {boolean} [options.searchable=true] - Enable client-side search
 * @param {string} [options.searchPlaceholder='Search records...']
 * @param {Array<{label: string, key: string, options: Array<{value: string, label: string}>}>} [options.filters]
 * @param {Function} [options.onRowClick] - Callback when row clicked
 * @param {string} [options.emptyText='No records found']
 * @returns {HTMLElement}
 */
export function createDataTable({
  columns,
  data = [],
  searchable = true,
  searchPlaceholder = 'Search records...',
  filters = [],
  onRowClick,
  emptyText = 'No records found'
}) {
  let rows = [...data];
  let searchQuery = '';
  let activeFilters = {};
  let sortKey = null;
  let sortAsc = true;

  const wrapper = createElement('div', { className: 'data-table-wrapper' });

  // Toolbar
  let toolbar = null;
  if (searchable || (filters && filters.length > 0)) {
    toolbar = createElement('div', { className: 'data-table-toolbar' });

    if (searchable) {
      const searchBox = createElement('div', { className: 'data-table-search' });
      const icon = createElement('i', {
        className: 'data-table-search-icon',
        attributes: { 'data-lucide': 'search' }
      });
      const input = createElement('input', {
        attributes: {
          type: 'search',
          placeholder: searchPlaceholder,
          'aria-label': searchPlaceholder
        }
      });

      input.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderBody();
      });

      searchBox.append(icon, input);
      toolbar.appendChild(searchBox);
    }

    if (filters && filters.length > 0) {
      const filtersEl = createElement('div', { className: 'data-table-filters' });
      filters.forEach(filterDef => {
        const select = createElement('select', {
          className: 'data-table-filter-select',
          attributes: { 'aria-label': `Filter by ${filterDef.label}` }
        });

        const defaultOpt = createElement('option', {
          attributes: { value: '' },
          text: `All ${filterDef.label}`
        });
        select.appendChild(defaultOpt);

        filterDef.options.forEach(opt => {
          select.appendChild(createElement('option', {
            attributes: { value: opt.value },
            text: opt.label
          }));
        });

        select.addEventListener('change', (e) => {
          activeFilters[filterDef.key] = e.target.value;
          renderBody();
        });

        filtersEl.appendChild(select);
      });
      toolbar.appendChild(filtersEl);
    }

    wrapper.appendChild(toolbar);
  }

  // Table
  const table = createElement('table', { className: 'data-table' });
  const thead = createElement('thead');
  const headerRow = createElement('tr');

  columns.forEach(col => {
    const th = createElement('th', {
      className: col.sortable ? 'sortable' : '',
      attributes: { scope: 'col' },
      text: col.label
    });

    if (col.sortable) {
      th.addEventListener('click', () => {
        if (sortKey === col.key) {
          sortAsc = !sortAsc;
        } else {
          sortKey = col.key;
          sortAsc = true;
        }
        updateSortHeaders();
        renderBody();
      });
    }

    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = createElement('tbody');
  table.appendChild(tbody);

  const scrollBox = createElement('div', { className: 'data-table-scroll' });
  scrollBox.appendChild(table);
  wrapper.appendChild(scrollBox);

  // Footer status
  const footer = createElement('div', { className: 'data-table-pagination' });
  const countSpan = createElement('span');
  footer.appendChild(countSpan);
  wrapper.appendChild(footer);

  function updateSortHeaders() {
    Array.from(headerRow.children).forEach((th, idx) => {
      const col = columns[idx];
      if (!col.sortable) return;
      th.classList.remove('sorted');
      if (sortKey === col.key) {
        th.classList.add('sorted');
        th.textContent = `${col.label} ${sortAsc ? '↑' : '↓'}`;
      } else {
        th.textContent = col.label;
      }
    });
  }

  function getFilteredRows() {
    return rows.filter(row => {
      // Search
      if (searchQuery) {
        const matchesSearch = columns.some(col => {
          const val = row[col.key];
          return val !== undefined && val !== null && String(val).toLowerCase().includes(searchQuery);
        });
        if (!matchesSearch) return false;
      }

      // Dropdown filters
      for (const [key, val] of Object.entries(activeFilters)) {
        if (val && String(row[key]) !== String(val)) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (!sortKey) return 0;
      const valA = a[sortKey] ?? '';
      const valB = b[sortKey] ?? '';
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }

  function renderBody() {
    clearChildren(tbody);
    const filtered = getFilteredRows();

    countSpan.textContent = `Showing ${filtered.length} of ${rows.length} records`;

    if (filtered.length === 0) {
      const tr = createElement('tr');
      const td = createElement('td', {
        className: 'data-table-empty',
        attributes: { colspan: String(columns.length) },
        text: emptyText
      });
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    filtered.forEach(row => {
      const tr = createElement('tr', {
        className: onRowClick ? 'clickable' : ''
      });

      if (onRowClick) {
        tr.addEventListener('click', () => onRowClick(row));
      }

      columns.forEach(col => {
        const td = createElement('td');
        const rawVal = row[col.key];

        if (typeof col.render === 'function') {
          const rendered = col.render(rawVal, row);
          if (rendered instanceof HTMLElement) {
            td.appendChild(rendered);
          } else {
            td.textContent = String(rendered ?? '');
          }
        } else {
          td.textContent = String(rawVal ?? '');
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: wrapper });
    }
  }

  renderBody();
  return wrapper;
}
