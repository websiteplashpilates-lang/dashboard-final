/**
 * Plash Pilates — Trainers Dashboard
 * Shared trainer view: today's and tomorrow's class batches with live enrollments.
 * Includes interactive calendar date selector to audit previous days' member attendance and rosters.
 * Batches outside the chosen date/window remain hidden until selected from the calendar.
 * Click any batch card to view enrolled member names and mark/audit attendance.
 * @module pages/trainer/dashboard
 */

import { createElement, clearChildren } from '../../utils/dom.js';
import { formatDate, formatTime, toISODate, formatDayName } from '../../utils/format.js';
import { events, EVENT } from '../../core/events.js';
import * as store from '../../core/store.js';
import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { createEmptyState } from '../../components/empty-state.js';

/**
 * Render the Trainers Dashboard.
 * @param {HTMLElement} container
 */
export async function render(container) {
  clearChildren(container);

  // Sync latest sessions & bookings
  try {
    await Promise.all([
      store.syncClassSessions().catch(() => {}),
      store.syncBookings().catch(() => {})
    ]);
  } catch (_) {}

  const page = createElement('div', {
    className: 'page-container trainer-dashboard-container'
  });

  // Calculate reference IST dates
  const now = new Date();
  const todayIST = toISODate(now);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowIST = toISODate(tomorrow);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayIST = toISODate(yesterday);

  // State: 'today_tomorrow' or 'date'
  let viewMode = 'today_tomorrow';
  let selectedDate = todayIST;

  // 1. Top Header & Calendar Date Navigation Toolbar
  const headerWrapper = createElement('div', {
    style: 'display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; flex-shrink: 0;'
  });

  const titleRow = createElement('div', {
    style: 'display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;'
  });

  const titleLeft = createElement('div');
  titleLeft.innerHTML = `
    <h1 style="font-family: var(--font-serif); font-size: 22px; font-weight: 700; color: var(--ink); margin: 0 0 2px;">
      Trainers Dashboard
    </h1>
    <p style="font-size: 13px; color: var(--ink-60); margin: 0;">
      Class batches, live enrollment rosters, and member attendance records.
    </p>
  `;

  // Toolbar controls: Today & Tomorrow toggle, Yesterday shortcut, and Calendar Date Picker
  const toolbar = createElement('div', {
    style: 'display: flex; align-items: center; flex-wrap: wrap; gap: 8px;'
  });

  // Mode button: Today & Tomorrow (default)
  const todayTomorrowBtn = createElement('button', {
    className: 'btn btn-sm',
    attributes: { type: 'button' },
    style: 'display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600;'
  });

  // Shortcut button: Yesterday (quick past day attendance)
  const yesterdayBtn = createElement('button', {
    className: 'btn btn-sm',
    attributes: { type: 'button' },
    style: 'display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600;'
  });

  // Calendar picker box
  const calendarBox = createElement('div', {
    style: 'display: inline-flex; align-items: center; gap: 6px; background: white; border: 1px solid var(--stone-30); border-radius: 6px; padding: 3px 8px;'
  });

  const calIcon = createElement('i', {
    attributes: { 'data-lucide': 'calendar' },
    style: 'width: 15px; height: 15px; color: var(--rust); flex-shrink: 0;'
  });

  const dateInput = createElement('input', {
    attributes: {
      type: 'date',
      title: 'Select date to audit attendance',
      value: selectedDate
    },
    style: 'border: none; background: transparent; font-size: 12.5px; font-weight: 600; color: var(--ink); outline: none; cursor: pointer; padding: 2px 0;'
  });

  // Day steppers (< and >)
  const prevDayBtn = createElement('button', {
    className: 'btn btn-outline btn-sm',
    attributes: { type: 'button', title: 'Previous Day' },
    style: 'width: 28px; height: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center;',
    html: '<i data-lucide="chevron-left" style="width: 14px; height: 14px;"></i>'
  });

  const nextDayBtn = createElement('button', {
    className: 'btn btn-outline btn-sm',
    attributes: { type: 'button', title: 'Next Day' },
    style: 'width: 28px; height: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center;',
    html: '<i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i>'
  });

  calendarBox.append(calIcon, dateInput);
  toolbar.append(todayTomorrowBtn, yesterdayBtn, calendarBox, prevDayBtn, nextDayBtn);
  titleRow.append(titleLeft, toolbar);
  headerWrapper.appendChild(titleRow);
  page.appendChild(headerWrapper);

  // Content wrapper for batches (scrollable flex container)
  const contentArea = createElement('div', {
    style: 'flex: 1; min-height: 0; display: flex; flex-direction: column;'
  });
  page.appendChild(contentArea);
  container.appendChild(page);

  // Helper to step date by offset in days
  function stepDate(currentDateStr, dayOffset) {
    const parts = (currentDateStr || todayIST).split('-').map(Number);
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
    d.setUTCDate(d.getUTCDate() + dayOffset);
    return toISODate(d);
  }

  // Update button active styling
  function updateToolbarState() {
    if (viewMode === 'today_tomorrow') {
      todayTomorrowBtn.className = 'btn btn-primary btn-sm';
      todayTomorrowBtn.innerHTML = '<i data-lucide="calendar-days" style="width: 14px; height: 14px;"></i> Today & Tomorrow';
      yesterdayBtn.className = 'btn btn-outline btn-sm';
      yesterdayBtn.innerHTML = '<i data-lucide="history" style="width: 14px; height: 14px;"></i> Yesterday';
      calendarBox.style.borderColor = 'var(--stone-30)';
    } else {
      todayTomorrowBtn.className = 'btn btn-outline btn-sm';
      todayTomorrowBtn.innerHTML = '<i data-lucide="calendar-days" style="width: 14px; height: 14px;"></i> Today & Tomorrow';

      if (selectedDate === yesterdayIST) {
        yesterdayBtn.className = 'btn btn-primary btn-sm';
        yesterdayBtn.innerHTML = '<i data-lucide="history" style="width: 14px; height: 14px;"></i> Yesterday';
      } else {
        yesterdayBtn.className = 'btn btn-outline btn-sm';
        yesterdayBtn.innerHTML = '<i data-lucide="history" style="width: 14px; height: 14px;"></i> Yesterday';
      }
      calendarBox.style.borderColor = 'var(--rust)';
      dateInput.value = selectedDate;
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: toolbar });
    }
  }

  // Event handlers for toolbar
  todayTomorrowBtn.addEventListener('click', () => {
    viewMode = 'today_tomorrow';
    renderDashboardView();
  });

  yesterdayBtn.addEventListener('click', () => {
    viewMode = 'date';
    selectedDate = yesterdayIST;
    renderDashboardView();
  });

  dateInput.addEventListener('change', (e) => {
    if (e.target.value) {
      viewMode = 'date';
      selectedDate = e.target.value;
      renderDashboardView();
    }
  });

  prevDayBtn.addEventListener('click', () => {
    if (viewMode === 'today_tomorrow') {
      viewMode = 'date';
      selectedDate = yesterdayIST;
    } else {
      selectedDate = stepDate(selectedDate, -1);
    }
    renderDashboardView();
  });

  nextDayBtn.addEventListener('click', () => {
    if (viewMode === 'today_tomorrow') {
      viewMode = 'date';
      selectedDate = tomorrowIST;
    } else {
      selectedDate = stepDate(selectedDate, 1);
    }
    renderDashboardView();
  });

  // Main Render View Function
  function renderDashboardView() {
    updateToolbarState();
    clearChildren(contentArea);

    const allBatches = store.getTrainerBatchEnrollments();

    if (viewMode === 'today_tomorrow') {
      renderTodayTomorrowView(allBatches);
    } else {
      renderSelectedDateView(allBatches, selectedDate);
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: contentArea });
    }
  }

  /**
   * Render Today & Tomorrow dual columns (default view).
   * All other days remain hidden.
   */
  function renderTodayTomorrowView(allBatches) {
    const relevantBatches = allBatches.filter(b => {
      const dIST = b.date || toISODate(b.startsAt);
      return dIST === todayIST || dIST === tomorrowIST;
    }).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

    if (relevantBatches.length === 0) {
      const empty = createEmptyState({
        icon: 'calendar',
        title: 'No Batches Scheduled for Today or Tomorrow',
        description: 'There are no active class batches for today or tomorrow. Use the calendar above to view previous days or future dates.'
      });
      contentArea.appendChild(empty);
      return;
    }

    const todayBatches = relevantBatches.filter(b => (b.date || toISODate(b.startsAt)) === todayIST);
    const tomorrowBatches = relevantBatches.filter(b => (b.date || toISODate(b.startsAt)) === tomorrowIST);

    const columnsWrap = createElement('div', {
      className: 'trainer-dashboard-grid',
      style: 'flex: 1; min-height: 0;'
    });

    const todayCol = createColumn("Today's Batches", todayBatches, 'rgba(143, 84, 83, 0.12); color: var(--rust)', 'Today');
    const tomorrowCol = createColumn("Tomorrow's Batches", tomorrowBatches, 'rgba(74, 122, 96, 0.14); color: #2E5A44', 'Tomorrow');

    columnsWrap.append(todayCol, tomorrowCol);
    contentArea.appendChild(columnsWrap);
  }

  /**
   * Render Specific Date View (Previous days, today, or future date selected from calendar).
   */
  function renderSelectedDateView(allBatches, targetDateStr) {
    const batchesOnDate = allBatches.filter(b => {
      const dIST = b.date || toISODate(b.startsAt);
      return dIST === targetDateStr;
    }).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

    const isPast = targetDateStr < todayIST;
    const isToday = targetDateStr === todayIST;
    const isTomorrow = targetDateStr === tomorrowIST;

    // Date Context Bar
    const contextBar = createElement('div', {
      style: 'display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background: white; border: 1px solid var(--stone-30); border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; flex-shrink: 0;'
    });

    const contextLeft = createElement('div', {
      style: 'display: flex; align-items: center; gap: 10px; flex-wrap: wrap;'
    });

    const backBtn = createElement('button', {
      className: 'btn btn-outline btn-sm',
      attributes: { type: 'button' },
      style: 'font-size: 12px; padding: 4px 10px;',
      html: '<i data-lucide="arrow-left" style="width: 13px; height: 13px; margin-right: 4px;"></i> Today & Tomorrow'
    });
    backBtn.addEventListener('click', () => {
      viewMode = 'today_tomorrow';
      renderDashboardView();
    });

    const dateTitle = createElement('div', {
      style: 'font-family: var(--font-serif); font-size: 16px; font-weight: 700; color: var(--ink);'
    });
    dateTitle.textContent = formatDate(targetDateStr);

    let badgeText = 'Calendar Selection';
    let badgeStyle = 'background: rgba(143, 84, 83, 0.12); color: var(--rust); border: 1px solid rgba(143, 84, 83, 0.25);';
    if (isPast) {
      badgeText = 'Past Date · Attendance Audit';
      badgeStyle = 'background: #FAF8F5; color: var(--ink-70); border: 1px solid var(--stone-30);';
    } else if (isToday) {
      badgeText = 'Today';
      badgeStyle = 'background: rgba(143, 84, 83, 0.12); color: var(--rust); border: 1px solid rgba(143, 84, 83, 0.25);';
    } else if (isTomorrow) {
      badgeText = 'Tomorrow';
      badgeStyle = 'background: rgba(74, 122, 96, 0.14); color: #2E5A44; border: 1px solid rgba(74, 122, 96, 0.25);';
    }

    const dateBadge = createElement('span', {
      style: `font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 2px 8px; border-radius: 12px; ${badgeStyle}`,
      text: badgeText
    });

    contextLeft.append(backBtn, dateTitle, dateBadge);

    // Summary statistics for this selected date
    let totalEnrolled = 0;
    let totalAttended = 0;
    let totalNoShow = 0;

    batchesOnDate.forEach(b => {
      const attendees = b.attendees || [];
      totalEnrolled += b.enrolledCount;
      totalAttended += attendees.filter(a => a.status === 'completed').length;
      totalNoShow += attendees.filter(a => a.status === 'no_show').length;
    });

    const statsPills = createElement('div', {
      style: 'display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px;'
    });
    statsPills.innerHTML = `
      <span style="font-weight: 600; color: var(--ink-70);"><strong>${batchesOnDate.length}</strong> Batches</span>
      <span style="color: var(--stone-40);">·</span>
      <span style="font-weight: 600; color: var(--ink-70);"><strong>${totalEnrolled}</strong> Enrolled</span>
      ${totalAttended > 0 ? `<span style="padding: 2px 7px; border-radius: 10px; background: rgba(74, 122, 96, 0.14); color: #2E5A44; font-weight: 700;">✓ ${totalAttended} Attended</span>` : ''}
      ${totalNoShow > 0 ? `<span style="padding: 2px 7px; border-radius: 10px; background: rgba(217, 83, 79, 0.12); color: #B52B27; font-weight: 700;">✕ ${totalNoShow} No-Show</span>` : ''}
    `;

    contextBar.append(contextLeft, statsPills);
    contentArea.appendChild(contextBar);

    // Batches Grid for selected date
    if (batchesOnDate.length === 0) {
      const empty = createEmptyState({
        icon: 'calendar-x',
        title: `No Batches on ${formatDate(targetDateStr)}`,
        description: 'No studio sessions were scheduled for this date. Use the date picker above to choose another date or return to Today & Tomorrow.'
      });
      contentArea.appendChild(empty);
    } else {
      const listContainer = createElement('div', {
        style: 'flex: 1; min-height: 0; overflow-y: auto; padding-right: 4px;'
      });

      const grid = createElement('div', {
        style: 'display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px;'
      });

      batchesOnDate.forEach(batch => {
        const card = createBatchCard(batch, renderDashboardView);
        grid.appendChild(card);
      });

      listContainer.appendChild(grid);
      contentArea.appendChild(listContainer);
    }
  }

  /**
   * Create a column of batch cards (Today or Tomorrow).
   */
  function createColumn(title, batches, badgeColor, badgeLabel) {
    const col = createElement('div', {
      className: 'trainer-batch-col'
    });

    const colHeader = createElement('div', {
      style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--stone-30); flex-shrink: 0;'
    });
    colHeader.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <h2 style="font-family: var(--font-serif); font-size: 18px; font-weight: 700; color: var(--ink); margin: 0;">
          ${title}
        </h2>
      </div>
      <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; background: ${badgeColor}; padding: 3px 10px; border-radius: 12px;">
        ${badgeLabel} (${batches.length})
      </span>
    `;
    col.appendChild(colHeader);

    const list = createElement('div', {
      style: 'display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; overflow-y: auto;'
    });

    if (batches.length === 0) {
      list.innerHTML = `<div style="text-align: center; color: var(--ink-40); font-size: 12px; padding: 20px;">No batches scheduled</div>`;
    } else {
      batches.forEach(batch => {
        const card = createBatchCard(batch, renderDashboardView);
        list.appendChild(card);
      });
    }

    col.appendChild(list);
    return col;
  }

  // Initial render of dashboard view
  renderDashboardView();

  // Reactive auto-updates on bookings, cancellations, attendance, or remote data sync
  const onDataMutated = () => {
    if (document.body.contains(container)) {
      renderDashboardView();
    }
  };
  events.on(EVENT.DATA_MUTATED, onDataMutated);
  events.on(EVENT.BOOKING_CREATED, onDataMutated);
  events.on(EVENT.BOOKING_CANCELLED, onDataMutated);
  events.on(EVENT.ATTENDANCE_MARKED, onDataMutated);
}

/**
 * Create an individual batch card — clickable to open attendance modal and view member roster.
 * @param {Object} batch
 * @param {Function} [onRefresh]
 */
function createBatchCard(batch, onRefresh) {
  const enrolled = Math.min(6, Math.max(0, batch.enrolledCount));
  const percentage = Math.round((enrolled / 6) * 100);
  const isFull = enrolled >= 6;

  let barColor = 'var(--sage, #4A7A60)';
  let badgeBg = 'background: rgba(74, 122, 96, 0.12); color: #2E5A44; border: 1px solid rgba(74, 122, 96, 0.25);';
  let statusText = `${6 - enrolled} spots left`;

  if (isFull) {
    barColor = 'var(--coral, #D9534F)';
    badgeBg = 'background: rgba(217, 83, 79, 0.12); color: #B52B27; border: 1px solid rgba(217, 83, 79, 0.25);';
    statusText = 'FULL (6/6)';
  } else if (enrolled >= 4) {
    barColor = 'var(--rust, #8F5453)';
    badgeBg = 'background: rgba(143, 84, 83, 0.12); color: #8F5453; border: 1px solid rgba(143, 84, 83, 0.25);';
  }

  const timeStr = `${formatTime(batch.startsAt)} (${batch.durationMin}m)`;
  const dateStr = formatDate(batch.startsAt);

  // Calculate attendance metrics
  const attendees = batch.attendees || [];
  const attendedCount = attendees.filter(a => a.status === 'completed').length;
  const noShowCount = attendees.filter(a => a.status === 'no_show').length;
  const pendingCount = enrolled - (attendedCount + noShowCount);

  const card = createElement('div', {
    className: 'card trainer-batch-card-clickable',
    style: 'background: white; border: 1px solid var(--stone-30); border-radius: 8px; padding: 12px 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.03); display: flex; flex-direction: column; justify-content: space-between; cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease;'
  });

  // Attendance indicators snippet
  let attendanceHtml = '';
  if (attendedCount > 0 || noShowCount > 0) {
    attendanceHtml = `
      <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; font-size: 11px;">
        ${attendedCount > 0 ? `<span style="background: rgba(74, 122, 96, 0.14); color: #2E5A44; font-weight: 700; padding: 2px 7px; border-radius: 10px;">✓ ${attendedCount} Attended</span>` : ''}
        ${noShowCount > 0 ? `<span style="background: rgba(217, 83, 79, 0.12); color: #B52B27; font-weight: 700; padding: 2px 7px; border-radius: 10px;">✕ ${noShowCount} No-Show</span>` : ''}
        ${pendingCount > 0 ? `<span style="background: var(--stone-20); color: var(--ink-60); font-weight: 600; padding: 2px 7px; border-radius: 10px;">${pendingCount} Unmarked</span>` : ''}
      </div>
    `;
  }

  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
      <h3 style="font-family: var(--font-serif); font-size: 15px; font-weight: 700; color: var(--ink); margin: 0; line-height: 1.2;">
        ${batch.title}
      </h3>
      <span style="font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 10px; white-space: nowrap; ${badgeBg}">
        ${statusText}
      </span>
    </div>

    <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-70); margin-bottom: 8px;">
      <i data-lucide="clock" style="width: 13px; height: 13px; color: var(--rust); flex-shrink: 0;"></i>
      <span style="font-weight: 600;">${dateStr} · ${timeStr}</span>
    </div>

    <div>
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
        <span style="font-size: 11px; font-weight: 600; color: var(--ink-60); text-transform: uppercase; letter-spacing: 0.04em;">
          Enrollments
        </span>
        <div style="font-size: 15px; font-weight: 800; color: var(--ink);">
          <span style="color: ${barColor};">${enrolled}</span> <span style="font-size: 12px; font-weight: 600; color: var(--ink-50);">/ 6 Enrolled</span>
        </div>
      </div>
      <div style="width: 100%; height: 6px; background: var(--stone-20, #ECE9E2); border-radius: 3px; overflow: hidden;">
        <div style="height: 100%; width: ${percentage}%; background: ${barColor}; border-radius: 3px; transition: width 0.3s ease;"></div>
      </div>
    </div>

    ${attendanceHtml}

    ${enrolled > 0 ? `<div style="margin-top: 8px; font-size: 11px; color: var(--rust); font-weight: 600; text-align: center;">
      <i data-lucide="users" style="width: 12px; height: 12px; vertical-align: -2px; margin-right: 3px;"></i>
      Tap to view members & attendance details
    </div>` : ''}
  `;

  // Click to open attendance modal
  card.addEventListener('click', () => openAttendanceModal(batch, onRefresh));

  return card;
}

/**
 * Open the attendance modal for a batch — shows enrolled members, allows marking present/no-show.
 * @param {Object} batch
 * @param {Function} [onSaveSuccess]
 */
export function openAttendanceModal(batch, onSaveSuccess) {
  const content = createElement('div', { style: 'font-size: var(--text-sm);' });

  // Session info header
  const info = createElement('div', {
    style: 'background: var(--stone-10, #FAF8F5); border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; border: 1px solid var(--stone-20);'
  });
  info.innerHTML = `
    <div style="font-size: 13px; color: var(--ink-70); margin-bottom: 4px;">
      <strong>${batch.disciplineName}</strong> · ${formatDate(batch.startsAt)} · ${formatTime(batch.startsAt)}
    </div>
    <div style="font-size: 12px; color: var(--ink-50);">
      ${batch.enrolledCount} of ${batch.capacity} enrolled · ${batch.durationMin} minutes
    </div>
  `;
  content.appendChild(info);

  const attendees = batch.attendees || [];

  if (attendees.length === 0) {
    const emptyMsg = createElement('div', {
      style: 'text-align: center; padding: 24px; color: var(--ink-40); font-size: 13px;'
    });
    emptyMsg.innerHTML = `
      <i data-lucide="user-x" style="width: 28px; height: 28px; margin-bottom: 8px; color: var(--ink-30);"></i>
      <p style="margin: 0;">No members enrolled in this batch.</p>
    `;
    content.appendChild(emptyMsg);
  } else {
    // Track attendance selections: status ('completed'|'no_show'|null), refundCredit (boolean), reason (string)
    const attendanceState = {};
    const refundState = {};
    const reasonState = {};

    attendees.forEach(a => {
      if (a.status === 'completed') {
        attendanceState[a.bookingId] = 'completed';
        refundState[a.bookingId] = false;
      } else if (a.status === 'no_show') {
        attendanceState[a.bookingId] = 'no_show';
        refundState[a.bookingId] = !!a.creditWaived;
      } else {
        attendanceState[a.bookingId] = null;
        refundState[a.bookingId] = false;
      }
    });

    const rosterList = createElement('div', {
      style: 'display: flex; flex-direction: column; gap: 12px;'
    });

    attendees.forEach((attendee) => {
      const card = createElement('div', {
        className: 'attendance-student-card',
        style: 'background: white; border: 1px solid var(--stone-30); border-radius: 8px; padding: 12px 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);'
      });

      // Member info header
      const memberHeader = createElement('div', {
        style: 'display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;'
      });

      const memberInfo = createElement('div');
      const memberName = createElement('div', {
        style: 'font-size: 14px; font-weight: 700; color: var(--ink); line-height: 1.2;',
        text: attendee.name || 'Studio Member'
      });
      const memberMeta = createElement('div', {
        style: 'font-size: 11.5px; color: var(--ink-50); margin-top: 3px;'
      });
      const metaParts = [];
      if (attendee.phone) metaParts.push(`📞 ${attendee.phone}`);
      if (attendee.email) metaParts.push(attendee.email);
      if (attendee.healthNotes && attendee.healthNotes !== 'No health restrictions') {
        metaParts.push(`⚕ ${attendee.healthNotes}`);
      }
      memberMeta.textContent = metaParts.join(' · ') || '';
      memberInfo.append(memberName, memberMeta);

      let currentBadge = null;
      if (attendee.status === 'completed') {
        currentBadge = createElement('span', {
          style: 'font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 10px; background: rgba(74,122,96,0.14); color: #2E5A44;',
          text: 'Marked: Attended'
        });
      } else if (attendee.status === 'no_show') {
        const isRefunded = !!attendee.creditWaived;
        currentBadge = createElement('span', {
          style: `font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 10px; ${isRefunded ? 'background: rgba(43,108,176,0.14); color: #2B6CB0;' : 'background: rgba(217,83,79,0.14); color: #B52B27;'}`,
          text: isRefunded ? 'Marked: Absent (Credit Refunded)' : 'Marked: Absent (Credit Forfeited)'
        });
      }

      if (currentBadge) memberHeader.append(memberInfo, currentBadge);
      else memberHeader.appendChild(memberInfo);
      card.appendChild(memberHeader);

      // 2 Primary Choice Buttons: Present vs Absent
      const btnGrid = createElement('div', {
        style: 'display: grid; grid-template-columns: 1fr 1fr; gap: 8px;'
      });

      const presentBtn = createElement('button', {
        attributes: { type: 'button' },
        style: 'display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 14px; border-radius: 6px; cursor: pointer; text-align: center; font-size: 13px; font-weight: 600; transition: all 0.15s ease;'
      });
      presentBtn.innerHTML = '<span>✓ Present</span>';

      const absentBtn = createElement('button', {
        attributes: { type: 'button' },
        style: 'display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 14px; border-radius: 6px; cursor: pointer; text-align: center; font-size: 13px; font-weight: 600; transition: all 0.15s ease;'
      });
      absentBtn.innerHTML = '<span>✕ Absent</span>';

      btnGrid.append(presentBtn, absentBtn);
      card.appendChild(btnGrid);

      // Refund Credit sub-box (shown only if Absent is chosen)
      const refundBox = createElement('div', {
        style: 'display: none; margin-top: 10px; background: #FAF8F5; border: 1px solid var(--stone-30); border-radius: 6px; padding: 10px 12px;'
      });

      const refundRow = createElement('div', {
        style: 'display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;'
      });

      const refundLabel = createElement('span', {
        style: 'font-size: 12px; font-weight: 600; color: var(--ink-80);',
        text: 'Refund credit to student?'
      });

      const toggleGroup = createElement('div', {
        style: 'display: inline-flex; border: 1px solid var(--stone-40); border-radius: 6px; overflow: hidden; background: white;'
      });

      const noBtn = createElement('button', {
        attributes: { type: 'button' },
        style: 'padding: 5px 12px; font-size: 11.5px; font-weight: 700; border: none; cursor: pointer; transition: all 0.15s ease;',
        text: 'No (Kill Credit)'
      });

      const yesBtn = createElement('button', {
        attributes: { type: 'button' },
        style: 'padding: 5px 12px; font-size: 11.5px; font-weight: 700; border: none; border-left: 1px solid var(--stone-40); cursor: pointer; transition: all 0.15s ease;',
        text: 'Yes (Refund)'
      });

      toggleGroup.append(noBtn, yesBtn);
      refundRow.append(refundLabel, toggleGroup);
      refundBox.appendChild(refundRow);

      // Optional reason input when Yes (Refund) is active
      const reasonWrap = createElement('div', {
        style: 'margin-top: 8px; display: none;'
      });
      reasonWrap.innerHTML = `
        <input type="text" placeholder="Reason for refund (e.g. medical emergency, fever)..." style="width: 100%; font-size: 12px; padding: 6px 10px; border: 1px solid var(--stone-30); border-radius: 4px; box-sizing: border-box; background: white; outline: none;" />
      `;
      const reasonInput = reasonWrap.querySelector('input');
      reasonInput.addEventListener('input', (e) => {
        reasonState[attendee.bookingId] = e.target.value;
      });
      refundBox.appendChild(reasonWrap);

      card.appendChild(refundBox);

      function updateVisuals() {
        const status = attendanceState[attendee.bookingId];
        const isRefund = refundState[attendee.bookingId];

        // Present button styling
        if (status === 'completed') {
          presentBtn.style.background = '#2E5A44';
          presentBtn.style.color = 'white';
          presentBtn.style.border = '1.5px solid #2E5A44';
        } else {
          presentBtn.style.background = '#FAF8F5';
          presentBtn.style.color = '#2E5A44';
          presentBtn.style.border = '1.5px solid var(--stone-30)';
        }

        // Absent button styling
        if (status === 'no_show') {
          absentBtn.style.background = '#B52B27';
          absentBtn.style.color = 'white';
          absentBtn.style.border = '1.5px solid #B52B27';
          refundBox.style.display = 'block';
        } else {
          absentBtn.style.background = '#FAF8F5';
          absentBtn.style.color = '#B52B27';
          absentBtn.style.border = '1.5px solid var(--stone-30)';
          refundBox.style.display = 'none';
        }

        // Refund toggle styling
        if (isRefund) {
          yesBtn.style.background = '#2B6CB0';
          yesBtn.style.color = 'white';
          noBtn.style.background = 'white';
          noBtn.style.color = 'var(--ink-60)';
          reasonWrap.style.display = 'block';
        } else {
          noBtn.style.background = '#B52B27';
          noBtn.style.color = 'white';
          yesBtn.style.background = 'white';
          yesBtn.style.color = 'var(--ink-60)';
          reasonWrap.style.display = 'none';
        }
      }

      presentBtn.addEventListener('click', () => {
        attendanceState[attendee.bookingId] = 'completed';
        updateVisuals();
      });

      absentBtn.addEventListener('click', () => {
        attendanceState[attendee.bookingId] = 'no_show';
        // default to No (Kill Credit) if not set
        if (refundState[attendee.bookingId] === undefined) {
          refundState[attendee.bookingId] = false;
        }
        updateVisuals();
      });

      noBtn.addEventListener('click', () => {
        refundState[attendee.bookingId] = false;
        updateVisuals();
      });

      yesBtn.addEventListener('click', () => {
        refundState[attendee.bookingId] = true;
        updateVisuals();
      });

      updateVisuals();
      rosterList.appendChild(card);
    });

    content.appendChild(rosterList);

    // Bulk action: Mark All Present
    const bulkRow = createElement('div', {
      style: 'display: flex; justify-content: flex-end; margin-top: 14px; gap: 8px;'
    });
    const markAllBtn = createElement('button', {
      className: 'btn btn-outline btn-sm',
      attributes: { type: 'button' },
      style: 'font-size: 12px; font-weight: 600;',
      html: '<i data-lucide="check-check" style="width: 14px; height: 14px; margin-right: 4px;"></i> Mark All Present'
    });
    markAllBtn.addEventListener('click', () => {
      attendees.forEach(a => {
        attendanceState[a.bookingId] = 'completed';
      });
      rosterList.querySelectorAll('.attendance-student-card').forEach(c => {
        const pBtn = c.querySelector('button');
        if (pBtn) pBtn.click();
      });
      showToast('All marked as present. Click Save to confirm.', 'info');
    });
    bulkRow.appendChild(markAllBtn);
    content.appendChild(bulkRow);

    // Save button
    const saveBtn = createElement('button', {
      className: 'btn btn-primary',
      attributes: { type: 'button' },
      style: 'width: 100%; margin-top: 14px; padding: 12px; font-size: 14px; font-weight: 700;',
      text: 'Save Attendance'
    });

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      let savedCount = 0;
      let errorCount = 0;
      let forfeitedCount = 0;
      let waivedCount = 0;

      for (const attendee of attendees) {
        const choice = attendanceState[attendee.bookingId];
        if (!choice) continue; // Skip unmarked

        try {
          if (choice === 'completed') {
            await store.markAttendance(attendee.bookingId, 'completed');
            savedCount++;
          } else if (choice === 'no_show') {
            const isRefund = refundState[attendee.bookingId] === true;
            const reason = reasonState[attendee.bookingId] || (isRefund ? 'Genuine reason (Trainer refund)' : '');
            await store.markAttendance(attendee.bookingId, 'no_show', {
              refundCredit: isRefund,
              reason,
              memberId: attendee.memberId,
              sessionId: batch.id,
              disciplineId: batch.disciplineId
            });
            savedCount++;
            if (isRefund) waivedCount++;
            else forfeitedCount++;
          }
        } catch (err) {
          console.error('[Attendance Save Error]', err.message);
          errorCount++;
        }
      }

      if (errorCount > 0) {
        showToast(`Saved ${savedCount} records. ${errorCount} failed.`, 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Attendance';
      } else if (savedCount === 0) {
        showToast('Please select attendance for at least one student.', 'info');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Attendance';
      } else {
        let msg = `Attendance saved for ${savedCount} student${savedCount > 1 ? 's' : ''}.`;
        if (forfeitedCount > 0) {
          msg += ` ${forfeitedCount} credit${forfeitedCount > 1 ? 's' : ''} forfeited.`;
        }
        if (waivedCount > 0) {
          msg += ` ${waivedCount} credit${waivedCount > 1 ? 's' : ''} refunded.`;
        }
        showToast(msg, 'success');
        modal.close();
        if (typeof onSaveSuccess === 'function') {
          onSaveSuccess();
        }
      }
    });

    content.appendChild(saveBtn);
  }

  const modal = openModal({
    title: `${batch.title} — Attendance`,
    content,
    maxWidth: '560px'
  });

  // Render icons inside modal
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    setTimeout(() => window.lucide.createIcons(), 50);
  }
}
