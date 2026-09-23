/**
 * Plash Pilates — Studio Admin: All Bookings & Attendance Calendar
 * Comprehensive booking ledger with interactive daily attendance calendar,
 * live batch rosters, no-show marking, credit audit (killed vs refunded), and cancellation overrides.
 * @module pages/admin/bookings
 */

import { createElement, clearChildren } from '../../utils/dom.js';
import { formatDate, formatTime, toISODate } from '../../utils/format.js';
import { events, EVENT } from '../../core/events.js';
import * as store from '../../core/store.js';
import { createDataTable } from '../../components/data-table.js';
import { createBadge } from '../../components/badge.js';
import { createEmptyState } from '../../components/empty-state.js';
import { showToast } from '../../components/toast.js';
import { openAttendanceModal } from '../trainer/dashboard.js';

let renderSeq = 0;
let isEventsSubscribed = false;

// Persistent view state across re-renders
let currentTab = 'calendar'; // 'calendar' | 'ledger'
let viewMode = 'today_tomorrow'; // 'today_tomorrow' | 'date'
let selectedDate = '';

function getISTDateString(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

function stepDate(currentDateStr, dayOffset) {
  const parts = currentDateStr.split('-').map(Number);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return toISODate(d);
}

export async function render(container) {
  const currentSeq = ++renderSeq;

  try {
    await Promise.all([
      store.syncBookings().catch(() => {}),
      store.syncClassSessions().catch(() => {})
    ]);
  } catch (_) {}

  // Guard against race conditions from overlapping async calls
  if (currentSeq !== renderSeq) return;

  clearChildren(container);

  const todayIST = getISTDateString();
  const yesterdayIST = stepDate(todayIST, -1);
  const tomorrowIST = stepDate(todayIST, 1);

  if (!selectedDate) {
    selectedDate = todayIST;
  }

  const page = createElement('div', {
    className: 'page-container',
    style: 'display: flex; flex-direction: column; height: 100%; min-height: 0;'
  });

  // 1. Header with View Tabs
  const headerWrapper = createElement('div', {
    style: 'display: flex; flex-direction: column; gap: 14px; margin-bottom: 16px; flex-shrink: 0;'
  });

  const headerRow = createElement('div', {
    style: 'display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;'
  });

  const titleBox = createElement('div');
  titleBox.innerHTML = `
    <h1 class="page-title" style="margin: 0 0 2px;">All Bookings & Attendance</h1>
    <p class="page-subtitle" style="margin: 0;">Audit studio session reservations, live daily attendance calendar, and member credit decisions.</p>
  `;

  // Tab switcher
  const tabSwitcher = createElement('div', {
    style: 'display: inline-flex; background: var(--stone-20, #F0ECE1); padding: 3px; border-radius: 8px;'
  });

  const calendarTabBtn = createElement('button', {
    className: 'btn btn-sm',
    attributes: { type: 'button' },
    style: `font-size: 12.5px; font-weight: 700; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; ${currentTab === 'calendar' ? 'background: white; color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,0.08);' : 'background: transparent; color: var(--ink-60);'}`,
    html: '<i data-lucide="calendar" style="width: 14px; height: 14px; margin-right: 6px; vertical-align: -2px;"></i> Attendance Calendar'
  });

  const ledgerTabBtn = createElement('button', {
    className: 'btn btn-sm',
    attributes: { type: 'button' },
    style: `font-size: 12.5px; font-weight: 700; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; ${currentTab === 'ledger' ? 'background: white; color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,0.08);' : 'background: transparent; color: var(--ink-60);'}`,
    html: '<i data-lucide="list-checks" style="width: 14px; height: 14px; margin-right: 6px; vertical-align: -2px;"></i> Master Ledger'
  });

  calendarTabBtn.addEventListener('click', () => {
    currentTab = 'calendar';
    render(container);
  });

  ledgerTabBtn.addEventListener('click', () => {
    currentTab = 'ledger';
    render(container);
  });

  tabSwitcher.append(calendarTabBtn, ledgerTabBtn);
  headerRow.append(titleBox, tabSwitcher);
  headerWrapper.appendChild(headerRow);

  // 2. Render chosen view
  if (currentTab === 'calendar') {
    renderCalendarView(headerWrapper, page, container, { todayIST, yesterdayIST, tomorrowIST });
  } else {
    renderLedgerView(page, container);
  }

  page.prepend(headerWrapper);
  container.appendChild(page);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }

  // Reactive auto-updates on bookings or remote data sync
  if (!isEventsSubscribed) {
    isEventsSubscribed = true;
    const onBookingMutated = () => {
      const activeContainer = document.querySelector('#app-content') || document.querySelector('.main-content');
      if (activeContainer && window.location.hash.startsWith('#/admin/bookings')) {
        render(activeContainer);
      }
    };
    events.on(EVENT.BOOKING_CREATED, onBookingMutated);
    events.on(EVENT.BOOKING_CANCELLED, onBookingMutated);
    events.on(EVENT.DATA_MUTATED, onBookingMutated);
  }
}

/**
 * Render Interactive Attendance Calendar & Batch Rosters View
 */
function renderCalendarView(headerWrapper, page, container, { todayIST, yesterdayIST, tomorrowIST }) {
  // Toolbar controls
  const toolbar = createElement('div', {
    style: 'display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding-top: 6px; border-top: 1px solid var(--stone-30);'
  });

  const leftControls = createElement('div', {
    style: 'display: flex; align-items: center; flex-wrap: wrap; gap: 8px;'
  });

  const todayTomorrowBtn = createElement('button', {
    className: `btn btn-sm ${viewMode === 'today_tomorrow' ? 'btn-primary' : 'btn-outline'}`,
    attributes: { type: 'button' },
    style: 'display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600;',
    html: '<i data-lucide="calendar-days" style="width: 14px; height: 14px;"></i> Today & Tomorrow'
  });

  const yesterdayBtn = createElement('button', {
    className: `btn btn-sm ${viewMode === 'date' && selectedDate === yesterdayIST ? 'btn-primary' : 'btn-outline'}`,
    attributes: { type: 'button' },
    style: 'display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600;',
    html: '<i data-lucide="history" style="width: 14px; height: 14px;"></i> Yesterday'
  });

  const calendarBox = createElement('div', {
    style: `display: inline-flex; align-items: center; gap: 6px; background: white; border: 1px solid ${viewMode === 'date' ? 'var(--rust)' : 'var(--stone-30)'}; border-radius: 6px; padding: 3px 8px;`
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
  leftControls.append(todayTomorrowBtn, yesterdayBtn, calendarBox, prevDayBtn, nextDayBtn);
  toolbar.appendChild(leftControls);
  headerWrapper.appendChild(toolbar);

  todayTomorrowBtn.addEventListener('click', () => {
    viewMode = 'today_tomorrow';
    render(container);
  });

  yesterdayBtn.addEventListener('click', () => {
    viewMode = 'date';
    selectedDate = yesterdayIST;
    render(container);
  });

  dateInput.addEventListener('change', (e) => {
    if (e.target.value) {
      viewMode = 'date';
      selectedDate = e.target.value;
      render(container);
    }
  });

  prevDayBtn.addEventListener('click', () => {
    const baseDate = viewMode === 'today_tomorrow' ? todayIST : selectedDate;
    selectedDate = stepDate(baseDate, -1);
    viewMode = 'date';
    render(container);
  });

  nextDayBtn.addEventListener('click', () => {
    const baseDate = viewMode === 'today_tomorrow' ? todayIST : selectedDate;
    selectedDate = stepDate(baseDate, 1);
    viewMode = 'date';
    render(container);
  });

  // Content Area for Batches
  const contentArea = createElement('div', {
    style: 'flex: 1; min-height: 0; display: flex; flex-direction: column;'
  });
  page.appendChild(contentArea);

  const allBatches = store.getTrainerBatchEnrollments();

  if (viewMode === 'today_tomorrow') {
    const todayBatches = allBatches.filter(b => b.date === todayIST);
    const tomorrowBatches = allBatches.filter(b => b.date === tomorrowIST);

    const colsGrid = createElement('div', {
      style: 'flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; overflow: hidden;'
    });

    colsGrid.appendChild(buildDayBatchColumn("Today's Batches", todayIST, todayBatches, 'TODAY', () => render(container)));
    colsGrid.appendChild(buildDayBatchColumn("Tomorrow's Batches", tomorrowIST, tomorrowBatches, 'TOMORROW', () => render(container)));
    contentArea.appendChild(colsGrid);
  } else {
    // Single Selected Date Mode
    const targetDateStr = selectedDate || todayIST;
    const batchesOnDate = allBatches.filter(b => b.date === targetDateStr);

    let totalEnrolled = 0;
    let totalAttended = 0;
    let totalKilled = 0;
    let totalRefunded = 0;

    batchesOnDate.forEach(b => {
      const attendees = b.attendees || [];
      totalEnrolled += b.enrolledCount;
      totalAttended += attendees.filter(a => a.status === 'completed').length;
      totalKilled += attendees.filter(a => a.status === 'no_show' && !a.creditWaived).length;
      totalRefunded += attendees.filter(a => a.status === 'no_show' && a.creditWaived).length;
    });

    const contextBar = createElement('div', {
      style: 'display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; padding: 10px 14px; background: white; border: 1px solid var(--stone-30); border-radius: 8px;'
    });

    const contextLeft = createElement('div', {
      style: 'display: flex; align-items: center; gap: 10px;'
    });

    const dateTitle = createElement('div', {
      style: 'font-weight: 700; font-size: 14px; color: var(--ink);',
      text: formatDate(targetDateStr)
    });

    contextLeft.appendChild(dateTitle);

    const statsPills = createElement('div', {
      style: 'display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px;'
    });
    statsPills.innerHTML = `
      <span style="font-weight: 600; color: var(--ink-70);"><strong>${batchesOnDate.length}</strong> Batches</span>
      <span style="color: var(--stone-40);">·</span>
      <span style="font-weight: 600; color: var(--ink-70);"><strong>${totalEnrolled}</strong> Enrolled</span>
      ${totalAttended > 0 ? `<span style="padding: 2px 8px; border-radius: 10px; background: rgba(74, 122, 96, 0.14); color: #2E5A44; font-weight: 700;">✓ ${totalAttended} Attended</span>` : ''}
      ${totalKilled > 0 ? `<span style="padding: 2px 8px; border-radius: 10px; background: rgba(217, 83, 79, 0.14); color: #B52B27; font-weight: 700;">✕ ${totalKilled} Credit Killed</span>` : ''}
      ${totalRefunded > 0 ? `<span style="padding: 2px 8px; border-radius: 10px; background: rgba(43, 108, 176, 0.14); color: #2B6CB0; font-weight: 700;">↺ ${totalRefunded} Refunded</span>` : ''}
    `;

    contextBar.append(contextLeft, statsPills);
    contentArea.appendChild(contextBar);

    if (batchesOnDate.length === 0) {
      const empty = createEmptyState({
        icon: 'calendar-x',
        title: `No Batches on ${formatDate(targetDateStr)}`,
        description: 'No sessions scheduled for this date. Use the date picker above to choose another date.'
      });
      contentArea.appendChild(empty);
    } else {
      const scrollWrap = createElement('div', {
        style: 'flex: 1; min-height: 0; overflow-y: auto; padding-right: 4px;'
      });
      const grid = createElement('div', {
        style: 'display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 14px;'
      });
      batchesOnDate.forEach(batch => {
        grid.appendChild(createBatchAttendanceCard(batch, () => render(container)));
      });
      scrollWrap.appendChild(grid);
      contentArea.appendChild(scrollWrap);
    }
  }
}

/**
 * Build 1 Day Batch Column for Today & Tomorrow View
 */
function buildDayBatchColumn(title, dateStr, batches, badgeLabel, onRefresh) {
  const col = createElement('div', {
    style: 'display: flex; flex-direction: column; height: 100%; min-height: 0; background: #FAF8F5; border: 1px solid var(--stone-30); border-radius: 10px; padding: 14px;'
  });

  const colHeader = createElement('div', {
    style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-shrink: 0;'
  });
  colHeader.innerHTML = `
    <div>
      <div style="font-size: 14px; font-weight: 700; color: var(--ink);">${title}</div>
      <div style="font-size: 11.5px; color: var(--ink-50);">${formatDate(dateStr)}</div>
    </div>
    <span style="font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 10px; background: rgba(143, 84, 83, 0.12); color: var(--rust);">${badgeLabel} (${batches.length})</span>
  `;
  col.appendChild(colHeader);

  const scrollArea = createElement('div', {
    style: 'flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;'
  });

  if (batches.length === 0) {
    const empty = createElement('div', {
      style: 'text-align: center; padding: 24px; color: var(--ink-40); font-size: 12.5px;',
      text: `No batches scheduled for ${badgeLabel.toLowerCase()}.`
    });
    scrollArea.appendChild(empty);
  } else {
    batches.forEach(b => {
      scrollArea.appendChild(createBatchAttendanceCard(b, onRefresh));
    });
  }

  col.appendChild(scrollArea);
  return col;
}

/**
 * Create Interactive Batch Attendance Card for Admin
 */
function createBatchAttendanceCard(batch, onRefresh) {
  const card = createElement('div', {
    className: 'admin-batch-card',
    style: 'background: white; border: 1px solid var(--stone-30); border-radius: 8px; padding: 12px 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.03); display: flex; flex-direction: column; gap: 10px;'
  });

  const cardHeader = createElement('div', {
    style: 'display: flex; justify-content: space-between; align-items: flex-start;'
  });

  const titleDiv = createElement('div');
  titleDiv.innerHTML = `
    <div style="font-size: 13.5px; font-weight: 700; color: var(--ink); line-height: 1.2;">${batch.disciplineName}</div>
    <div style="font-size: 11.5px; color: var(--ink-60); margin-top: 2px;">
      🕒 ${formatTime(batch.startsAt)} · Coach ${batch.trainerName || 'Instructor'}
    </div>
  `;

  const enrolledBadge = createElement('span', {
    style: `font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; ${batch.enrolledCount > 0 ? 'background: rgba(74, 122, 96, 0.14); color: #2E5A44;' : 'background: var(--stone-20); color: var(--ink-60);'}`,
    text: `${batch.enrolledCount} / ${batch.capacity} Enrolled`
  });

  cardHeader.append(titleDiv, enrolledBadge);
  card.appendChild(cardHeader);

  // Attendees list
  const attendees = batch.attendees || [];
  if (attendees.length > 0) {
    const attendeeList = createElement('div', {
      style: 'display: flex; flex-direction: column; gap: 6px; background: #FAF8F5; border-radius: 6px; padding: 8px 10px; font-size: 12px;'
    });

    attendees.forEach(a => {
      const aRow = createElement('div', {
        style: 'display: flex; justify-content: space-between; align-items: center; gap: 6px;'
      });

      const aName = createElement('div', {
        style: 'font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
        text: a.name || 'Studio Member'
      });

      let badgeEl = null;
      if (a.status === 'completed') {
        badgeEl = createElement('span', {
          style: 'font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 8px; background: rgba(74, 122, 96, 0.16); color: #2E5A44; flex-shrink: 0;',
          text: '✓ Attended'
        });
      } else if (a.status === 'no_show') {
        if (a.creditWaived) {
          badgeEl = createElement('span', {
            style: 'font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 8px; background: rgba(43, 108, 176, 0.16); color: #2B6CB0; flex-shrink: 0;',
            attributes: { title: a.attendanceNotes ? `Refunded: ${a.attendanceNotes}` : 'Refunded' },
            text: '↺ Refunded'
          });
        } else {
          badgeEl = createElement('span', {
            style: 'font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 8px; background: rgba(217, 83, 79, 0.16); color: #B52B27; flex-shrink: 0;',
            text: '✕ Killed'
          });
        }
      } else {
        badgeEl = createElement('span', {
          style: 'font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 8px; background: var(--stone-20); color: var(--ink-50); flex-shrink: 0;',
          text: 'Unmarked'
        });
      }

      aRow.append(aName, badgeEl);
      attendeeList.appendChild(aRow);
    });

    card.appendChild(attendeeList);
  }

  // Card Action Button: Audit / Mark Attendance
  const auditBtn = createElement('button', {
    className: 'btn btn-outline btn-sm',
    attributes: { type: 'button' },
    style: 'width: 100%; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px;',
    html: '<i data-lucide="check-circle" style="width: 13px; height: 13px;"></i> Audit / Mark Attendance'
  });

  auditBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openAttendanceModal(batch, onRefresh);
  });

  card.appendChild(auditBtn);
  return card;
}

/**
 * Render Master Bookings Ledger View (Table)
 */
function renderLedgerView(page, container) {
  const bookings = store.getAllBookings();

  const tableData = bookings.map(b => {
    const memberId = b.memberId || b.member_id;
    const sessionId = b.sessionId || b.classSessionId || b.session_id;
    const member = b.member || store.resolveMember(memberId);
    let memberName = b.memberName || b.member_name || (member ? (member.name || member.fullName || member.full_name) : null);
    if (!memberName || memberName === 'Studio Member') {
      memberName = store.resolveMemberDisplayName(member || memberId, 'Studio Member');
    }
    if ((!memberName || memberName === 'Studio Member') && memberId) {
      const m = store.getMemberById(memberId);
      if (m) memberName = m.name || m.fullName || m.full_name || m.email || memberName;
    }
    const memberContact = (member ? (member.phone || member.email) : null) || b.memberPhone || b.member_phone || b.memberEmail || b.member_email || '';
    const session = store.getClassSessionById(sessionId) || b.session;
    const disc = session ? store.getDisciplineById(session.disciplineId || session.discipline_id) : null;
    const trainer = session ? store.getTrainerById(session.trainerId || session.trainer_id) : null;

    return {
      id: b.id,
      memberName,
      memberPhone: memberContact,
      discipline: disc ? disc.name : 'Unknown',
      date: session ? session.date : '',
      time: session ? (session.formattedTime || formatTime(session.time)) : '',
      trainer: trainer ? trainer.name : 'Unassigned',
      status: b.status,
      creditWaived: b.creditWaived ?? b.credit_waived ?? false,
      attendanceNotes: b.attendanceNotes || b.attendance_notes || '',
      session,
      raw: b
    };
  });

  const columns = [
    {
      key: 'memberName',
      label: 'Member',
      sortable: true,
      render: (val, row) => {
        const wrap = createElement('div');
        const name = createElement('div', { style: 'font-weight: var(--weight-semibold); color: var(--ink);', text: val });
        const sub = createElement('div', { style: 'font-size: 11px; color: var(--ink-50);', text: row.memberPhone });
        wrap.append(name, sub);
        return wrap;
      }
    },
    { key: 'discipline', label: 'Discipline', sortable: true },
    { key: 'date', label: 'Date', sortable: true, render: (val) => formatDate(val) },
    { key: 'time', label: 'Time', sortable: true, render: (val) => val || '—' },
    { key: 'trainer', label: 'Instructor', sortable: true },
    {
      key: 'status',
      label: 'Attendance & Status',
      sortable: true,
      render: (val, row) => {
        if (val === 'completed') {
          return createBadge({ text: '✓ Attended', status: 'completed' });
        }
        if (val === 'no_show') {
          if (row.creditWaived) {
            const wrap = createElement('div');
            const b = createBadge({ text: '↺ No-Show (Refunded)', status: 'pending' });
            wrap.appendChild(b);
            if (row.attendanceNotes) {
              const note = createElement('div', {
                style: 'font-size: 10px; color: var(--ink-50); margin-top: 2px;',
                text: `Note: ${row.attendanceNotes}`
              });
              wrap.appendChild(note);
            }
            return wrap;
          }
          return createBadge({ text: '✕ No-Show (Killed)', status: 'no-show' });
        }
        if (val === 'cancelled') {
          return createBadge({ text: 'Cancelled', status: 'cancelled' });
        }
        if (val === 'pending_partner_approval') {
          return createBadge({ text: 'Pending Approval', status: 'pending' });
        }
        return createBadge({ text: 'Upcoming', status: 'active', showDot: true });
      }
    },
    {
      key: 'actions',
      label: 'Admin Action',
      render: (_, row) => {
        const btnGroup = createElement('div', { style: 'display: flex; gap: var(--space-2); flex-wrap: wrap;' });

        if (row.status === 'upcoming') {
          const noShowBtn = createElement('button', {
            className: 'btn btn-outline btn-sm',
            attributes: { type: 'button' },
            text: 'Mark No-Show'
          });
          noShowBtn.addEventListener('click', () => {
            store.markNoShow(row.id);
            showToast(`Marked ${row.memberName} as no-show. Credit forfeited.`, 'info');
            render(container);
          });

          const cancelBtn = createElement('button', {
            className: 'btn btn-destructive btn-sm',
            attributes: { type: 'button' },
            text: 'Cancel'
          });
          cancelBtn.addEventListener('click', () => {
            store.adminCancelBooking(row.id);
            showToast(`Booking cancelled. Credit refunded to ${row.memberName}.`, 'info');
            render(container);
          });

          btnGroup.append(noShowBtn, cancelBtn);
        } else {
          // If session exists, allow opening attendance audit modal
          const session = row.session;
          if (session) {
            const auditBtn = createElement('button', {
              className: 'btn btn-outline btn-sm',
              attributes: { type: 'button', title: 'Audit Attendance' },
              style: 'font-size: 11px; padding: 3px 8px;',
              html: '<i data-lucide="edit-3" style="width: 12px; height: 12px; margin-right: 3px;"></i> Audit'
            });
            auditBtn.addEventListener('click', () => {
              const allBatches = store.getTrainerBatchEnrollments();
              const targetBatch = allBatches.find(b => b.id === session.id) || {
                id: session.id,
                title: `${row.discipline} Batch`,
                disciplineName: row.discipline,
                startsAt: session.startsAt || `${row.date}T${row.time || '10:00'}:00`,
                durationMin: session.durationMinutes || 60,
                enrolledCount: 1,
                capacity: session.capacity || 6,
                attendees: [{
                  bookingId: row.id,
                  memberId: row.raw.memberId,
                  name: row.memberName,
                  phone: row.memberPhone,
                  status: row.status,
                  creditWaived: row.creditWaived
                }]
              };
              openAttendanceModal(targetBatch, () => render(container));
            });
            btnGroup.appendChild(auditBtn);
          } else {
            const span = createElement('span', {
              style: 'font-size: 11px; color: var(--ink-50);',
              text: '—'
            });
            btnGroup.appendChild(span);
          }
        }

        return btnGroup;
      }
    }
  ];

  const table = createDataTable({
    columns,
    data: tableData,
    searchable: true,
    searchPlaceholder: 'Search by member, discipline, instructor...',
    filters: [
      {
        key: 'status',
        label: 'Status',
        options: [
          { value: 'upcoming', label: 'Upcoming' },
          { value: 'completed', label: 'Attended' },
          { value: 'pending_partner_approval', label: 'Pending Partner' },
          { value: 'no_show', label: 'No-Show' },
          { value: 'cancelled', label: 'Cancelled' }
        ]
      },
      {
        key: 'discipline',
        label: 'Discipline',
        options: store.getDisciplines().map(d => ({ value: d.name, label: d.name }))
      }
    ]
  });

  page.appendChild(table);
}
