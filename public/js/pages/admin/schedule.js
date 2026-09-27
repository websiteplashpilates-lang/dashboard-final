/**
 * Plash Pilates — Studio Admin: Flexible Class Scheduler & Weekly Matrix
 * Supports recurring weekly timetable rules (e.g., Every Monday 9 AM), visual 7-day matrix,
 * 1-click batch generation, session duplication, and strict 1:6 coach ratio enforcement.
 * @module pages/admin/schedule
 */

import { createElement, clearChildren } from '../../utils/dom.js';
import { formatDate, formatTime, toISODate } from '../../utils/format.js';
import * as store from '../../core/store.js';
import { createDataTable } from '../../components/data-table.js';
import { createBadge } from '../../components/badge.js';
import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';

// State for active view tab and week offset
let currentViewTab = 'matrix'; // 'matrix' | 'rules' | 'table'
let currentWeekOffset = 0; // 0 = current week, 1 = next week, -1 = previous week

/**
 * Render the Admin Schedule Page.
 * @param {HTMLElement} container
 */
export async function render(container) {
  clearChildren(container);

  // Authoritative live sync of class sessions from Supabase & server
  try {
    await store.syncClassSessions();
  } catch (_) {}

  const page = createElement('div', { className: 'page-container' });

  // 1. Page Header with Actions
  const header = createElement('div', {
    className: 'content-section-header',
    style: 'display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-4); margin-bottom: var(--space-6);'
  });

  const titleBox = createElement('div');
  const title = createElement('h1', { className: 'page-title', text: 'Class Scheduling & Timetable' });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    text: 'Manage recurring weekly class rules (e.g. Every Monday 9 AM), visual 7-day schedule matrix, and published apparatus sessions.'
  });
  titleBox.append(title, subtitle);

  const headerActions = createElement('div', { style: 'display: flex; gap: var(--space-2); flex-wrap: wrap;' });

  // Quick Action: Add Recurring Rule
  const addRuleBtn = createElement('button', {
    className: 'btn btn-outline btn-sm',
    attributes: { type: 'button' },
    children: [
      createElement('i', { attributes: { 'data-lucide': 'repeat' }, style: 'width: 14px; height: 14px; margin-right: 6px;' }),
      createElement('span', { text: 'Add Recurring Rule' })
    ]
  });
  addRuleBtn.addEventListener('click', () => {
    openRecurringRuleModal(null, () => render(container));
  });

  // Quick Action: Schedule Single Session
  const addSessionBtn = createElement('button', {
    className: 'btn btn-primary btn-sm',
    attributes: { type: 'button' },
    children: [
      createElement('i', { attributes: { 'data-lucide': 'calendar-plus' }, style: 'width: 14px; height: 14px; margin-right: 6px;' }),
      createElement('span', { text: 'Schedule Class' })
    ]
  });
  addSessionBtn.addEventListener('click', () => {
    openScheduleModal(null, null, () => render(container));
  });

  headerActions.append(addRuleBtn, addSessionBtn);
  header.append(titleBox, headerActions);
  page.appendChild(header);

  // 2. View Switcher Tabs
  const navTabs = createElement('div', {
    className: 'schedule-view-switcher',
    style: 'display: flex; gap: var(--space-2); border-bottom: 1px solid var(--stone-30); margin-bottom: var(--space-6);'
  });

  const views = [
    { id: 'matrix', label: 'Weekly Timetable Matrix', icon: 'calendar-days' },
    { id: 'rules', label: 'Recurring Rules & Auto-Scheduler', icon: 'repeat' },
    { id: 'table', label: 'All Sessions Ledger', icon: 'table' },
  ];

  views.forEach(v => {
    const isActive = currentViewTab === v.id;
    const tabBtn = createElement('button', {
      className: `schedule-tab-btn ${isActive ? 'active' : ''}`,
      attributes: { type: 'button' },
      style: `display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; font-size: 13px; font-weight: 600; border: none; background: none; border-bottom: 2px solid ${isActive ? 'var(--rust)' : 'transparent'}; color: ${isActive ? 'var(--rust)' : 'var(--ink-70)'}; cursor: pointer; transition: all var(--t-fast);`
    });
    tabBtn.innerHTML = `<i data-lucide="${v.icon}" style="width: 15px; height: 15px;"></i><span>${v.label}</span>`;
    tabBtn.addEventListener('click', () => {
      currentViewTab = v.id;
      render(container);
    });
    navTabs.appendChild(tabBtn);
  });
  page.appendChild(navTabs);

  // 3. Tab Content Rendering
  if (currentViewTab === 'matrix') {
    renderWeeklyMatrix(page, container);
  } else if (currentViewTab === 'rules') {
    renderRecurringRulesView(page, container);
  } else {
    renderScheduleTableView(page, container);
  }

  container.appendChild(page);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}

/**
 * Render the 7-Day Visual Weekly Matrix (Mon - Sun columns).
 */
function renderWeeklyMatrix(parentEl, container) {
  const wrapper = createElement('div', { className: 'schedule-matrix-wrapper' });

  // Week Navigator Toolbar
  const weekStart = getMondayOfWeek(new Date(), currentWeekOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const toolbar = createElement('div', {
    style: 'display: flex; justify-content: space-between; align-items: center; background: white; border: 1px solid var(--stone-30); border-radius: var(--radius-md); padding: 12px 18px; margin-bottom: var(--space-4); flex-wrap: wrap; gap: var(--space-3);'
  });

  const weekLabel = createElement('div', { style: 'font-weight: 700; font-size: 15px; color: var(--ink); display: flex; align-items: center; gap: 8px;' });
  weekLabel.innerHTML = `
    <i data-lucide="calendar" style="width: 18px; height: 18px; color: var(--rust);"></i>
    <span>${formatDate(weekStart)} – ${formatDate(weekEnd)}</span>
    ${currentWeekOffset === 0 ? '<span class="badge badge-success" style="font-size: 10px; margin-left: 6px;">Current Week</span>' : ''}
  `;

  const navButtons = createElement('div', { style: 'display: flex; gap: var(--space-2); align-items: center;' });
  const prevBtn = createElement('button', {
    className: 'btn btn-outline btn-sm',
    attributes: { type: 'button' },
    text: '‹ Previous Week'
  });
  prevBtn.addEventListener('click', () => {
    currentWeekOffset -= 1;
    render(container);
  });

  const todayBtn = createElement('button', {
    className: 'btn btn-ghost btn-sm',
    attributes: { type: 'button' },
    text: 'Today'
  });
  todayBtn.addEventListener('click', () => {
    currentWeekOffset = 0;
    render(container);
  });

  const nextBtn = createElement('button', {
    className: 'btn btn-outline btn-sm',
    attributes: { type: 'button' },
    text: 'Next Week ›'
  });
  nextBtn.addEventListener('click', () => {
    currentWeekOffset += 1;
    render(container);
  });

  navButtons.append(prevBtn, todayBtn, nextBtn);
  toolbar.append(weekLabel, navButtons);
  wrapper.appendChild(toolbar);

  // 7-Day Grid Columns
  const grid = createElement('div', {
    className: 'schedule-matrix-grid',
    style: 'display: grid; grid-template-columns: repeat(7, minmax(170px, 1fr)); gap: 10px; overflow-x: auto; padding-bottom: var(--space-4);'
  });

  const allSessions = store.getAllClassSessions();
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + i);
    const dateStr = toISODate(dayDate);
    const isToday = dateStr === toISODate(new Date());

    // Filter sessions on this day
    const daySessions = allSessions.filter(s => s.date === dateStr)
      .sort((a, b) => a.time.localeCompare(b.time));

    const dayCol = createElement('div', {
      className: 'schedule-day-column',
      style: `background: #ffffff; border: 1px solid ${isToday ? 'var(--rust)' : 'var(--stone-30)'}; border-radius: var(--radius-md); display: flex; flex-direction: column; min-height: 540px; box-shadow: ${isToday ? '0 0 0 1px var(--rust)' : 'var(--shadow-sm)'};`
    });

    // Column Header
    const colHeader = createElement('div', {
      style: `padding: 10px 12px; border-bottom: 1px solid var(--stone-30); background: ${isToday ? 'var(--rust-10)' : 'var(--stone-10)'}; border-top-left-radius: var(--radius-md); border-top-right-radius: var(--radius-md); text-align: center;`
    });
    colHeader.innerHTML = `
      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: ${isToday ? 'var(--rust)' : 'var(--ink-70)'};">${dayNames[i]}</div>
      <div style="font-size: 14px; font-weight: 800; color: var(--ink); margin-top: 2px;">${dayDate.getDate()} ${dayDate.toLocaleDateString('en-US', { month: 'short' })}</div>
      <div style="font-size: 10px; color: var(--ink-50); margin-top: 2px;">${daySessions.length} class${daySessions.length === 1 ? '' : 'es'}</div>
    `;
    dayCol.appendChild(colHeader);

    // Column Session Cards Body
    const colBody = createElement('div', {
      style: 'flex: 1; padding: 8px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto;'
    });

    if (daySessions.length === 0) {
      const emptyDay = createElement('div', {
        style: 'text-align: center; padding: 24px 8px; color: var(--ink-40); font-size: 11.5px; font-style: italic;'
      });
      emptyDay.innerHTML = `No classes scheduled`;
      colBody.appendChild(emptyDay);
    } else {
      daySessions.forEach(s => {
        const disc = store.getDisciplineById(s.disciplineId);
        const trainer = store.getTrainerById(s.trainerId);
        const filled = s.capacity - s.spotsRemaining;

        let badgeBg = 'var(--stone-20)';
        let badgeColor = 'var(--ink)';
        if (disc) {
          if (disc.id === 'disc-001') { badgeBg = 'var(--rust-10)'; badgeColor = 'var(--rust)'; }
          if (disc.id === 'disc-002') { badgeBg = 'rgba(217, 107, 107, 0.12)'; badgeColor = '#b91c1c'; }
          if (disc.id === 'disc-003') { badgeBg = 'rgba(107, 122, 90, 0.15)'; badgeColor = 'var(--olive)'; }
        }

        const card = createElement('div', {
          className: 'schedule-matrix-card',
          style: 'border: 1px solid var(--stone-30); border-radius: var(--radius-sm); padding: 8px 10px; background: #fafaf9; transition: all var(--t-fast); position: relative;'
        });

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
            <div style="font-weight: 700; font-size: 12px; color: var(--ink); font-family: monospace;">
              ${s.time}
            </div>
            <span style="font-size: 9.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${badgeBg}; color: ${badgeColor};">
              ${disc ? disc.name.split(' ')[0] : 'Class'}
            </span>
          </div>

          <div style="font-size: 12px; font-weight: 600; color: var(--ink); line-height: 1.25; margin-bottom: 6px;">
            ${disc ? disc.name : 'Pilates Session'}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 4px; border-top: 1px dashed var(--stone-30);">
            <div style="font-size: 10px; font-weight: 600; color: ${s.spotsRemaining === 0 ? '#dc2626' : (s.spotsRemaining <= 2 ? '#d97706' : '#15803d')};">
              ${filled}/${s.capacity} spots
            </div>
            <div style="display: flex; gap: 4px;">
              <button type="button" class="btn-card-edit" title="Edit Session" style="background: none; border: none; padding: 2px; cursor: pointer; color: var(--ink-60);">
                <i data-lucide="edit-3" style="width: 12px; height: 12px;"></i>
              </button>
              <button type="button" class="btn-card-clone" title="Duplicate to Another Day" style="background: none; border: none; padding: 2px; cursor: pointer; color: var(--ink-60);">
                <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
              </button>
              <button type="button" class="btn-card-delete" title="Cancel Class" style="background: none; border: none; padding: 2px; cursor: pointer; color: #dc2626;">
                <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
              </button>
            </div>
          </div>
        `;

        card.querySelector('.btn-card-edit').addEventListener('click', (e) => {
          e.stopPropagation();
          openScheduleModal(s, dateStr, () => render(container));
        });

        card.querySelector('.btn-card-clone').addEventListener('click', (e) => {
          e.stopPropagation();
          openCloneModal(s, () => render(container));
        });

        card.querySelector('.btn-card-delete').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`Cancel ${disc ? disc.name : 'class'} on ${s.date} at ${s.time}? All reserved member credits will be refunded.`)) {
            try {
              await store.deleteClassSession(s.id);
              showToast('Class cancelled and spots restored.', 'info');
              render(container);
            } catch (err) {
              showToast(err.message, 'error');
            }
          }
        });

        colBody.appendChild(card);
      });
    }

    dayCol.appendChild(colBody);

    // Quick Add Button at bottom of each day column
    const addColBtn = createElement('button', {
      type: 'button',
      className: 'btn btn-ghost btn-sm',
      style: 'margin: 6px; font-size: 11px; padding: 6px; justify-content: center; color: var(--rust); font-weight: 600; border-top: 1px dashed var(--stone-30); border-radius: var(--radius-sm);',
      text: '+ Add Class'
    });
    addColBtn.addEventListener('click', () => {
      openScheduleModal(null, dateStr, () => render(container));
    });
    dayCol.appendChild(addColBtn);

    grid.appendChild(dayCol);
  }

  wrapper.appendChild(grid);
  parentEl.appendChild(wrapper);
}

/**
 * Render the Recurring Rules Builder View (e.g. Every Monday 9 AM...).
 */
function renderRecurringRulesView(parentEl, container) {
  const wrapper = createElement('div', { className: 'schedule-rules-wrapper' });

  // 1. Batch Generator Announcement Card
  const generatorCard = createElement('div', {
    style: 'background: white; border: 1px solid var(--stone-30); border-radius: var(--radius-md); padding: 18px 24px; margin-bottom: var(--space-6); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-4); box-shadow: var(--shadow-sm);'
  });

  const genText = createElement('div', { style: 'max-width: 600px;' });
  genText.innerHTML = `
    <h3 style="font-size: 16px; font-weight: 700; color: var(--ink); margin: 0 0 4px 0;">
      Recurring Timetable Synchronizer
    </h3>
    <p style="font-size: 13px; color: var(--ink-70); margin: 0; line-height: 1.4;">
      Publish your studio's weekly master routine across the calendar. Automatically fills all individual dates for the upcoming weeks without overriding existing bookings.
    </p>
  `;

  const genActions = createElement('div', { style: 'display: flex; gap: var(--space-2); align-items: center;' });
  const weeksSelect = createElement('select', {
    className: 'form-control',
    style: 'width: 140px; font-size: 12.5px; height: 36px;'
  });
  weeksSelect.innerHTML = `
    <option value="4" selected>Next 4 Weeks</option>
    <option value="8">Next 8 Weeks</option>
    <option value="12">Next 12 Weeks</option>
  `;

  const genBtn = createElement('button', {
    className: 'btn btn-primary btn-sm',
    attributes: { type: 'button' },
    children: [
      createElement('i', { attributes: { 'data-lucide': 'sparkles' }, style: 'width: 14px; height: 14px; margin-right: 6px;' }),
      createElement('span', { text: 'Publish to Calendar' })
    ]
  });

  genBtn.addEventListener('click', async () => {
    const weeks = parseInt(weeksSelect.value, 10);
    genBtn.disabled = true;
    const created = store.generateSessionsFromRules(weeks);
    if (created && created._promise) {
      await created._promise.catch(() => {});
    }
    showToast(`Successfully generated & published ${created.length} sessions for next ${weeks} weeks.`, 'success');
    render(container);
  });

  genActions.append(weeksSelect, genBtn);
  generatorCard.append(genText, genActions);
  wrapper.appendChild(generatorCard);

  // 2. Active Recurring Rules List
  const rulesListSection = createElement('div', { className: 'card' });
  const rulesHeader = createElement('div', {
    style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);'
  });
  rulesHeader.innerHTML = `
    <h3 style="font-size: 15px; font-weight: 700; color: var(--ink); margin: 0;">Master Weekly Class Rules</h3>
    <span style="font-size: 12px; color: var(--ink-60);">Rules define standard repeat schedule</span>
  `;
  rulesListSection.appendChild(rulesHeader);

  const rules = store.getRecurringRules();
  if (rules.length === 0) {
    rulesListSection.appendChild(createElement('div', {
      style: 'text-align: center; padding: 32px; color: var(--ink-50); font-style: italic;',
      text: 'No recurring timetable rules defined. Click "Add Recurring Rule" to create one.'
    }));
  } else {
    const rulesGrid = createElement('div', {
      style: 'display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px;'
    });

    rules.forEach(rule => {
      const disc = store.getDisciplineById(rule.disciplineId);
      const trainer = store.getTrainerById(rule.trainerId);
      const daysFormatted = (rule.daysOfWeek || []).map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');

      const ruleCard = createElement('div', {
        style: 'border: 1px solid var(--stone-30); border-radius: var(--radius-md); padding: 14px 16px; background: #fafaf9; display: flex; flex-direction: column; justify-content: space-between;'
      });

      ruleCard.innerHTML = `
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <span class="badge badge-success" style="font-size: 10px;">Every ${daysFormatted}</span>
            <span style="font-family: monospace; font-weight: 700; font-size: 13px; color: var(--rust);">${rule.time}</span>
          </div>

          <div style="font-size: 14px; font-weight: 700; color: var(--ink); margin-bottom: 6px;">
            ${disc ? disc.name : rule.title}
          </div>

          <div style="font-size: 11px; color: var(--ink-60);">
            Duration: <strong>${rule.durationMinutes || 60}m</strong> • Capacity: <strong>${rule.capacity || 6} beds (1:6)</strong>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px dashed var(--stone-30);">
          <button type="button" class="btn-rule-edit btn btn-outline btn-sm" style="font-size: 11px; padding: 4px 8px;">Edit Rule</button>
          <button type="button" class="btn-rule-delete btn btn-destructive btn-sm" style="font-size: 11px; padding: 4px 8px;">Delete</button>
        </div>
      `;

      ruleCard.querySelector('.btn-rule-edit').addEventListener('click', () => {
        openRecurringRuleModal(rule, () => render(container));
      });

      ruleCard.querySelector('.btn-rule-delete').addEventListener('click', () => {
        if (confirm(`Delete recurring rule "${rule.title}"?`)) {
          store.deleteRecurringRule(rule.id);
          showToast('Recurring rule deleted.', 'info');
          render(container);
        }
      });

      rulesGrid.appendChild(ruleCard);
    });

    rulesListSection.appendChild(rulesGrid);
  }

  wrapper.appendChild(rulesListSection);
  parentEl.appendChild(wrapper);
}

/**
 * Render the Traditional Filterable Data Table.
 */
function renderScheduleTableView(parentEl, container) {
  const sessions = store.getAllClassSessions();
  const tableData = sessions.map(s => {
    const disc = store.getDisciplineById(s.disciplineId);
    const trainer = store.getTrainerById(s.trainerId);
    const filled = s.capacity - s.spotsRemaining;

    return {
      id: s.id,
      date: s.date,
      time: s.time,
      disciplineName: disc ? disc.name : 'Unknown',
      trainerName: '',
      capacity: `${filled}/${s.capacity}`,
      spotsRemaining: s.spotsRemaining,
      raw: s
    };
  });

  const columns = [
    { key: 'date', label: 'Date', sortable: true, render: (val) => formatDate(val) },
    { key: 'time', label: 'Time', sortable: true, render: (val) => val },
    { key: 'disciplineName', label: 'Discipline', sortable: true },
    {
      key: 'capacity',
      label: 'Spots Booked',
      sortable: false,
      render: (val, row) => {
        return createBadge({
          text: `${val} spots`,
          status: row.spotsRemaining === 0 ? 'full' : row.spotsRemaining <= 2 ? 'pending' : 'active'
        });
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => {
        const btnGroup = createElement('div', { style: 'display: flex; gap: var(--space-2);' });

        const editBtn = createElement('button', {
          className: 'btn btn-outline btn-sm',
          attributes: { type: 'button' },
          text: 'Edit'
        });
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openScheduleModal(row.raw, row.date, () => render(container));
        });

        const cloneBtn = createElement('button', {
          className: 'btn btn-secondary btn-sm',
          attributes: { type: 'button' },
          text: 'Duplicate'
        });
        cloneBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openCloneModal(row.raw, () => render(container));
        });

        const cancelBtn = createElement('button', {
          className: 'btn btn-destructive btn-sm',
          attributes: { type: 'button' },
          text: 'Cancel'
        });
        cancelBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`Cancel class on ${row.date} at ${row.time}? Member credits will be refunded.`)) {
            try {
              await store.deleteClassSession(row.id);
              showToast('Class cancelled and spots restored.', 'info');
              render(container);
            } catch (err) {
              showToast(err.message, 'error');
            }
          }
        });

        btnGroup.append(editBtn, cloneBtn, cancelBtn);
        return btnGroup;
      }
    }
  ];

  const table = createDataTable({
    columns,
    data: tableData,
    searchable: true,
    searchPlaceholder: 'Search by discipline or date...',
    filters: [
      {
        key: 'disciplineName',
        label: 'Discipline',
        options: store.getDisciplines().map(d => ({ value: d.name, label: d.name }))
      }
    ]
  });

  parentEl.appendChild(table);
}

/**
 * Modal: Add or Edit Single Class Session.
 */
function openScheduleModal(session, defaultDate, onSuccess) {
  const isEditing = !!session;
  const content = createElement('form', { style: 'display: flex; flex-direction: column; gap: var(--space-4); font-size: var(--text-sm);' });

  // Discipline
  const discGroup = createElement('div', { className: 'form-group' });
  const discLabel = createElement('label', { className: 'form-label', text: 'Discipline' });
  const discSelect = createElement('select', { className: 'form-select', attributes: { required: 'true' } });
  store.getDisciplines().forEach(d => {
    discSelect.appendChild(createElement('option', {
      attributes: {
        value: d.id,
        ...(session && session.disciplineId === d.id ? { selected: 'true' } : {})
      },
      text: d.name
    }));
  });
  discGroup.append(discLabel, discSelect);

  // Date and Time
  const dtRow = createElement('div', { style: 'display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);' });

  const dateGroup = createElement('div', { className: 'form-group' });
  const dateInput = createElement('input', {
    className: 'form-input',
    attributes: {
      type: 'date',
      required: 'true',
      value: session ? session.date : (defaultDate || toISODate(new Date()))
    }
  });
  dateGroup.append(createElement('label', { className: 'form-label', text: 'Date' }), dateInput);

  const timeGroup = createElement('div', { className: 'form-group' });
  const timeInput = createElement('input', {
    className: 'form-input',
    attributes: {
      type: 'time',
      required: 'true',
      value: session ? session.time : '09:00'
    }
  });
  timeGroup.append(createElement('label', { className: 'form-label', text: 'Time' }), timeInput);
  dtRow.append(dateGroup, timeGroup);

  // Capacity (strictly max 6) & Duration
  const cdRow = createElement('div', { style: 'display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);' });

  const capGroup = createElement('div', { className: 'form-group' });
  const capInput = createElement('input', {
    className: 'form-input',
    attributes: {
      type: 'number',
      min: '1',
      max: '6',
      required: 'true',
      value: session ? String(session.capacity) : '6'
    }
  });
  capGroup.append(createElement('label', { className: 'form-label', text: 'Capacity (Strict 1:6 Max 6)' }), capInput);

  const durGroup = createElement('div', { className: 'form-group' });
  const durInput = createElement('input', {
    className: 'form-input',
    attributes: {
      type: 'number',
      min: '30',
      max: '120',
      step: '15',
      required: 'true',
      value: session ? String(session.durationMinutes) : '60'
    }
  });
  durGroup.append(createElement('label', { className: 'form-label', text: 'Duration (Minutes)' }), durInput);
  cdRow.append(capGroup, durGroup);

  content.append(discGroup, dtRow, cdRow);

  const saveBtn = createElement('button', {
    className: 'btn btn-primary btn-sm',
    attributes: { type: 'submit' },
    text: isEditing ? 'Save Changes' : 'Publish Session'
  });

  const modal = openModal({
    title: isEditing ? 'Edit Class Session' : 'Schedule New Class',
    content,
    actions: [saveBtn]
  });

  let isSubmitting = false;

  content.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    isSubmitting = true;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const selectedDisc = store.getDisciplineById(discSelect.value);
    const defaultTrainerId = (session && session.trainerId) || (store.getTrainers()[0]?.id) || 'trainer-001';
    const payload = {
      title: selectedDisc ? selectedDisc.name : 'Studio Session',
      disciplineId: discSelect.value,
      trainerId: defaultTrainerId,
      date: dateInput.value,
      time: timeInput.value,
      capacity: parseInt(capInput.value, 10),
      durationMinutes: parseInt(durInput.value, 10),
    };

    try {
      if (isEditing) {
        const res = store.updateClassSession(session.id, payload);
        if (res && res._promise) await res._promise.catch(() => {});
        showToast('Class session updated successfully.', 'success');
      } else {
        const newSess = store.addClassSession(payload);
        if (newSess && newSess._promise) await newSess._promise.catch(() => {});
        showToast('New class scheduled and open for booking.', 'success');
      }
      modal.close();
      if (typeof onSuccess === 'function') onSuccess();
    } catch (err) {
      showToast(err.message, 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = isEditing ? 'Save Changes' : 'Schedule Class';
      isSubmitting = false;
    }
  });
}

/**
 * Modal: Add or Edit Recurring Timetable Rule (Every Monday 9 AM...).
 */
function openRecurringRuleModal(rule, onSuccess) {
  const isEditing = !!rule;
  const content = createElement('form', { style: 'display: flex; flex-direction: column; gap: var(--space-4); font-size: var(--text-sm);' });

  // Title
  const titleGroup = createElement('div', { className: 'form-group' });
  titleGroup.innerHTML = `
    <label class="form-label">Rule Description / Title</label>
    <input type="text" id="rule-title-input" class="form-control" required value="${rule ? rule.title : 'Monday Morning Reformer Flow'}" style="width: 100%;" />
  `;
  content.appendChild(titleGroup);

  // Days of Week Checkboxes
  const daysGroup = createElement('div', { className: 'form-group' });
  daysGroup.innerHTML = `<label class="form-label">Repeat Every (Days of Week)</label>`;
  const daysRow = createElement('div', { style: 'display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;' });

  const allDays = [
    { id: 'monday', label: 'Mon' },
    { id: 'tuesday', label: 'Tue' },
    { id: 'wednesday', label: 'Wed' },
    { id: 'thursday', label: 'Thu' },
    { id: 'friday', label: 'Fri' },
    { id: 'saturday', label: 'Sat' },
    { id: 'sunday', label: 'Sun' },
  ];

  const currentDays = rule ? (rule.daysOfWeek || []) : ['monday'];

  allDays.forEach(d => {
    const isChecked = currentDays.includes(d.id);
    const label = createElement('label', {
      style: `display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; border: 1px solid var(--stone-30); border-radius: var(--radius-sm); font-size: 12px; cursor: pointer; background: ${isChecked ? 'var(--rust-10)' : 'white'};`
    });
    const chk = createElement('input', {
      attributes: { type: 'checkbox', value: d.id, ...(isChecked ? { checked: 'true' } : {}) },
      style: 'accent-color: var(--rust);'
    });
    chk.addEventListener('change', () => {
      label.style.background = chk.checked ? 'var(--rust-10)' : 'white';
    });
    label.append(chk, document.createTextNode(d.label));
    daysRow.appendChild(label);
  });
  daysGroup.appendChild(daysRow);
  content.appendChild(daysGroup);

  // Discipline & Instructor
  const diRow = createElement('div', { style: 'display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);' });
  const discGroup = createElement('div', { className: 'form-group' });
  discGroup.innerHTML = `<label class="form-label">Discipline</label>`;
  const discSelect = createElement('select', { className: 'form-select', attributes: { required: 'true' }, style: 'width: 100%;' });
  store.getDisciplines().forEach(d => {
    discSelect.appendChild(createElement('option', {
      attributes: { value: d.id, ...(rule && rule.disciplineId === d.id ? { selected: 'true' } : {}) },
      text: d.name
    }));
  });
  discGroup.appendChild(discSelect);
  content.appendChild(discGroup);

  // Start Time & Duration
  const tdRow = createElement('div', { style: 'display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-3);' });
  const timeGroup = createElement('div', { className: 'form-group' });
  timeGroup.innerHTML = `
    <label class="form-label">Start Time</label>
    <input type="time" id="rule-time-input" class="form-control" required value="${rule ? rule.time : '09:00'}" style="width: 100%;" />
  `;

  const durGroup = createElement('div', { className: 'form-group' });
  durGroup.innerHTML = `
    <label class="form-label">Duration (Min)</label>
    <input type="number" id="rule-dur-input" class="form-control" required min="30" max="120" step="15" value="${rule ? rule.durationMinutes : '60'}" style="width: 100%;" />
  `;

  const capGroup = createElement('div', { className: 'form-group' });
  capGroup.innerHTML = `
    <label class="form-label">Capacity (Max 6)</label>
    <input type="number" id="rule-cap-input" class="form-control" required min="1" max="6" value="${rule ? rule.capacity : '6'}" style="width: 100%;" />
  `;
  tdRow.append(timeGroup, durGroup, capGroup);
  content.appendChild(tdRow);

  const saveBtn = createElement('button', {
    className: 'btn btn-primary btn-sm',
    attributes: { type: 'submit' },
    text: isEditing ? 'Update Rule' : 'Save Recurring Rule'
  });

  const modal = openModal({
    title: isEditing ? 'Edit Recurring Class Rule' : 'Create Recurring Timetable Rule',
    content,
    actions: [saveBtn]
  });

  let isSubmitting = false;

  content.addEventListener('submit', (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    isSubmitting = true;
    saveBtn.disabled = true;

    const selectedDays = Array.from(daysRow.querySelectorAll('input:checked')).map(cb => cb.value);
    if (selectedDays.length === 0) {
      showToast('Please select at least one day of the week.', 'error');
      saveBtn.disabled = false;
      isSubmitting = false;
      return;
    }

    const payload = {
      title: content.querySelector('#rule-title-input').value.trim(),
      daysOfWeek: selectedDays,
      disciplineId: discSelect.value,
      trainerId: (rule && rule.trainerId) || (store.getTrainers()[0]?.id) || 'trainer-001',
      time: content.querySelector('#rule-time-input').value,
      durationMinutes: parseInt(content.querySelector('#rule-dur-input').value, 10),
      capacity: parseInt(content.querySelector('#rule-cap-input').value, 10),
    };

    try {
      if (isEditing) {
        store.updateRecurringRule(rule.id, payload);
        showToast('Recurring rule updated and synced across timetable matrix.', 'success');
      } else {
        store.addRecurringRule(payload);
        showToast('Recurring rule created and populated across timetable matrix.', 'success');
      }
      modal.close();
      onSuccess();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

/**
 * Modal: Quick Clone / Duplicate a class session to another date/time.
 */
function openCloneModal(session, onSuccess) {
  const content = createElement('form', { style: 'display: flex; flex-direction: column; gap: var(--space-4); font-size: var(--text-sm);' });

  const disc = store.getDisciplineById(session.disciplineId);
  const trainer = store.getTrainerById(session.trainerId);

  content.innerHTML = `
    <div style="background: var(--stone-20); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--stone-30);">
      <div style="font-weight: 700; color: var(--ink);">${disc ? disc.name : 'Class'}</div>
      <div style="font-size: 12px; color: var(--ink-70);">Original session: ${session.date} at ${session.time}</div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
      <div class="form-group">
        <label class="form-label">Target Date</label>
        <input type="date" id="clone-date-input" class="form-control" required value="${session.date}" style="width: 100%;" />
      </div>

      <div class="form-group">
        <label class="form-label">Target Time</label>
        <input type="time" id="clone-time-input" class="form-control" required value="${session.time}" style="width: 100%;" />
      </div>
    </div>
  `;

  const cloneBtn = createElement('button', {
    className: 'btn btn-primary btn-sm',
    attributes: { type: 'submit' },
    text: 'Duplicate Session'
  });

  cloneBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (typeof content.requestSubmit === 'function') {
      content.requestSubmit();
    } else {
      content.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
  });

  const modal = openModal({
    title: 'Duplicate / Clone Class Session',
    content,
    actions: [cloneBtn]
  });

  content.addEventListener('submit', (e) => {
    e.preventDefault();
    const tDate = content.querySelector('#clone-date-input').value;
    const tTime = content.querySelector('#clone-time-input').value;

    try {
      store.cloneClassSession(session.id, tDate, tTime);
      showToast(`Class duplicated to ${tDate} at ${tTime}.`, 'success');
      modal.close();
      onSuccess();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

/**
 * Helper to get Monday Date object of a given week offset.
 */
function getMondayOfWeek(baseDate, offsetWeeks = 0) {
  const d = new Date(baseDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  d.setDate(diff + (offsetWeeks * 7));
  d.setHours(0, 0, 0, 0);
  return d;
}
