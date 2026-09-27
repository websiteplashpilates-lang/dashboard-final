/**
 * Plash Pilates — Partner Portal: Barre Schedule
 * Timetable of Barre Conditioning sessions with spot counts and enrolled member lists.
 * Filters to current operational window (Yesterday, Today, Tomorrow) by default,
 * while preserving full historical data.
 * @module pages/partner/schedule
 */

import { createElement, clearChildren } from '../../utils/dom.js';
import { formatDate, formatTime, APP_TIMEZONE } from '../../utils/format.js';
import * as store from '../../core/store.js';
import { openModal } from '../../components/modal.js';

/**
 * Get date string in YYYY-MM-DD for Asia/Kolkata timezone with offset in days.
 * @param {number} offsetDays
 * @returns {string}
 */
function getKolkataDateString(offsetDays = 0) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const [y, m, d] = formatter.format(new Date()).split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1, d + offsetDays));
  return target.toISOString().slice(0, 10);
}

export async function render(container) {
  clearChildren(container);
  try {
    await store.syncClassSessions();
  } catch (_) {}
  const page = createElement('div', { className: 'page-container' });

  // Header
  const header = createElement('div', {
    className: 'page-header',
    style: 'display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-4); margin-bottom: var(--space-6);'
  });

  const titleBox = createElement('div');
  const title = createElement('h1', { className: 'page-title', text: 'Barre Conditioning Schedule' });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    text: 'Physicq 57 programming: Operational timetable filtered to Yesterday, Today, and Tomorrow.'
  });
  titleBox.append(title, subtitle);
  header.appendChild(titleBox);
  page.appendChild(header);

  // Calculate target dates in Asia/Kolkata
  const yesterdayStr = getKolkataDateString(-1);
  const todayStr = getKolkataDateString(0);
  const tomorrowStr = getKolkataDateString(1);
  const activeWindowSet = new Set([yesterdayStr, todayStr, tomorrowStr]);

  const allBarreSessions = store.getBarreSchedule();

  // Filter Tabs Bar
  let activeFilter = 'window'; // 'window' | 'today' | 'tomorrow' | 'yesterday' | 'all'

  const filterBar = createElement('div', {
    className: 'card',
    style: 'margin-bottom: var(--space-6); padding: var(--space-3) var(--space-4); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-3);'
  });

  const filterTabs = createElement('div', { style: 'display: flex; gap: var(--space-2); flex-wrap: wrap;' });

  const windowCount = allBarreSessions.filter(s => {
    const sDate = s.date || (s.startsAt ? s.startsAt.slice(0, 10) : '');
    return activeWindowSet.has(sDate);
  }).length;

  const todayCount = allBarreSessions.filter(s => (s.date || (s.startsAt ? s.startsAt.slice(0, 10) : '')) === todayStr).length;
  const tomorrowCount = allBarreSessions.filter(s => (s.date || (s.startsAt ? s.startsAt.slice(0, 10) : '')) === tomorrowStr).length;
  const yesterdayCount = allBarreSessions.filter(s => (s.date || (s.startsAt ? s.startsAt.slice(0, 10) : '')) === yesterdayStr).length;

  const tabsConfig = [
    { key: 'window', label: `Yesterday, Today & Tomorrow (${windowCount})` },
    { key: 'today', label: `Today (${todayCount})` },
    { key: 'tomorrow', label: `Tomorrow (${tomorrowCount})` },
    { key: 'yesterday', label: `Yesterday (${yesterdayCount})` },
    { key: 'all', label: `All Sessions & History (${allBarreSessions.length})` }
  ];

  const tabButtons = [];

  tabsConfig.forEach(cfg => {
    const btn = createElement('button', {
      className: `btn btn-sm ${cfg.key === activeFilter ? 'btn-primary' : 'btn-outline'}`,
      attributes: { type: 'button' },
      text: cfg.label
    });

    btn.addEventListener('click', () => {
      activeFilter = cfg.key;
      tabButtons.forEach(b => b.classList.replace('btn-primary', 'btn-outline'));
      btn.classList.replace('btn-outline', 'btn-primary');
      renderScheduleGrid();
    });

    tabButtons.push(btn);
    filterTabs.appendChild(btn);
  });

  filterBar.appendChild(filterTabs);
  page.appendChild(filterBar);

  // Grid container
  const gridContainer = createElement('div');
  page.appendChild(gridContainer);
  container.appendChild(page);

  function renderScheduleGrid() {
    clearChildren(gridContainer);

    let filtered = allBarreSessions;

    if (activeFilter === 'window') {
      filtered = allBarreSessions.filter(s => {
        const sDate = s.date || (s.startsAt ? s.startsAt.slice(0, 10) : '');
        return activeWindowSet.has(sDate);
      });
    } else if (activeFilter === 'today') {
      filtered = allBarreSessions.filter(s => (s.date || (s.startsAt ? s.startsAt.slice(0, 10) : '')) === todayStr);
    } else if (activeFilter === 'tomorrow') {
      filtered = allBarreSessions.filter(s => (s.date || (s.startsAt ? s.startsAt.slice(0, 10) : '')) === tomorrowStr);
    } else if (activeFilter === 'yesterday') {
      filtered = allBarreSessions.filter(s => (s.date || (s.startsAt ? s.startsAt.slice(0, 10) : '')) === yesterdayStr);
    }

    if (filtered.length === 0) {
      const emptyCard = createElement('div', {
        className: 'card',
        style: 'padding: var(--space-8); text-align: center; color: var(--ink-50);'
      });
      emptyCard.innerHTML = `
        <i data-lucide="calendar" style="width: 40px; height: 40px; margin: 0 auto var(--space-3); color: var(--taupe); opacity: 0.7;"></i>
        <h3 style="font-family: var(--font-serif); font-size: 18px; color: var(--ink); margin-bottom: 6px;">No Barre Sessions Scheduled</h3>
        <p style="font-size: 13px; max-width: 440px; margin: 0 auto;">No classes match the selected date window. Switch tabs above to view other days or full timetable history.</p>
      `;
      gridContainer.appendChild(emptyCard);
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ root: emptyCard });
      }
      return;
    }

    const grid = createElement('div', { className: 'grid grid-3', style: 'gap: var(--space-4);' });

    filtered.forEach(session => {
      const trainer = store.getTrainerById(session.trainerId);
      const filled = session.capacity - session.spotsRemaining;
      const sDate = session.date || (session.startsAt ? session.startsAt.slice(0, 10) : '');

      let dayBadgeHtml = '';
      if (sDate === todayStr) {
        dayBadgeHtml = '<span style="background: #EAF3ED; color: #2E5A44; font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 700; margin-left: 6px;">Today</span>';
      } else if (sDate === tomorrowStr) {
        dayBadgeHtml = '<span style="background: #FDF2E9; color: #B9770E; font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 700; margin-left: 6px;">Tomorrow</span>';
      } else if (sDate === yesterdayStr) {
        dayBadgeHtml = '<span style="background: var(--stone-dark); color: var(--ink-70); font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 600; margin-left: 6px;">Yesterday</span>';
      } else if (sDate < yesterdayStr) {
        dayBadgeHtml = '<span style="background: var(--stone); color: var(--ink-50); font-size: 11px; padding: 2px 8px; border-radius: 12px; margin-left: 6px;">Past Class</span>';
      }

      const card = createElement('div', { className: 'class-card' });

      const cHeader = createElement('div', { className: 'class-card-header' });
      const cDisc = createElement('div', {
        style: 'display: flex; align-items: center;',
        html: `<span class="class-card-discipline">Barre Conditioning</span>${dayBadgeHtml}`
      });
      const cSpots = createElement('span', {
        className: `class-card-spots ${session.spotsRemaining === 0 ? 'full' : session.spotsRemaining <= 2 ? 'low' : 'available'}`,
        text: `${filled}/${session.capacity} spots filled`
      });
      cHeader.append(cDisc, cSpots);

      const sessionTimeStr = session.time ? formatTime(`2026-01-01T${session.time}`) : (session.startsAt ? formatTime(session.startsAt) : '9:00 AM');
      const cTime = createElement('div', {
        className: 'class-card-time',
        text: `${formatDate(sDate)} • ${sessionTimeStr}`
      });

      const cMeta = createElement('div', { className: 'class-card-meta' }, [
        createElement('span', { text: 'Studio Session • 60m' })
      ]);

      const cActions = createElement('div', { className: 'class-card-actions' });
      const viewRosterBtn = createElement('button', {
        className: 'btn btn-outline btn-sm btn-block',
        attributes: { type: 'button' },
        text: 'View Class Roster'
      });

      viewRosterBtn.addEventListener('click', () => {
        openSessionRosterModal(session);
      });

      cActions.appendChild(viewRosterBtn);
      card.append(cHeader, cTime, cMeta, cActions);
      grid.appendChild(card);
    });

    gridContainer.appendChild(grid);

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: gridContainer });
    }
  }

  renderScheduleGrid();

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}

function openSessionRosterModal(session) {
  const bookings = store.getAllBookings().filter(b => b.sessionId === session.id && (b.status === 'upcoming' || b.status === 'completed'));
  const content = createElement('div', { style: 'font-size: var(--text-sm);' });

  if (bookings.length === 0) {
    content.appendChild(createElement('p', {
      style: 'color: var(--ink-50);',
      text: 'No confirmed participants booked for this session yet.'
    }));
  } else {
    const list = createElement('div', { style: 'display: flex; flex-direction: column; gap: var(--space-3);' });
    bookings.forEach(b => {
      const member = b.member || store.resolveMember(b.memberId);
      const memberName = store.resolveMemberDisplayName(b.member || b.memberId, 'Member');
      const health = member ? store.getHealthProfile(member.id) : null;

      const item = createElement('div', {
        style: 'background: var(--stone); border-radius: var(--radius-sm); padding: var(--space-3); display: flex; justify-content: space-between; align-items: center;'
      });

      const info = createElement('div');
      const name = createElement('div', { style: 'font-weight: var(--weight-semibold); color: var(--ink);', text: memberName });
      const notes = createElement('div', { style: 'font-size: 11px; color: var(--ink-80);', text: health ? `Experience: ${health.experience} • ${health.injuries || 'No injury notes'}` : 'No profile' });
      info.append(name, notes);

      item.append(info);
      list.appendChild(item);
    });
    content.appendChild(list);
  }

  const sTime = session.time ? formatTime(`2026-01-01T${session.time}`) : (session.startsAt ? formatTime(session.startsAt) : '9:00 AM');
  openModal({
    title: `Session Roster (${formatDate(session.date)} at ${sTime})`,
    content
  });
}
