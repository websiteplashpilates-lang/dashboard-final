/**
 * Plash Pilates — Member Portal: Book a Class
 * Calendar strip navigation, discipline filters, real-time spot counts, and booking flow.
 * @module pages/portal/book
 */

import { createElement, clearChildren } from '../../utils/dom.js';
import { toISODate } from '../../utils/format.js';
import * as auth from '../../core/auth.js';
import * as store from '../../core/store.js';
import { createCalendarStrip } from '../../components/calendar-strip.js';
import { createClassCard } from '../../components/class-card.js';
import { createEmptyState } from '../../components/empty-state.js';
import { showToast } from '../../components/toast.js';
import { openModal } from '../../components/modal.js';
import { events, EVENT } from '../../core/events.js';

let bookRenderSeq = 0;

export async function render(container) {
  const currentSeq = ++bookRenderSeq;
  clearChildren(container);
  const memberId = auth.getCurrentMemberId();

  // Authoritative live sync for class sessions, member bookings, and passes/credits on page refresh
  try {
    await Promise.all([
      store.syncClassSessions(),
      memberId ? store.syncBookings(memberId).catch(() => {}) : Promise.resolve(),
      memberId ? store.fetchMemberPasses(memberId).catch(() => {}) : Promise.resolve()
    ]);
  } catch (_) {}

  if (currentSeq !== bookRenderSeq) return;

  const page = createElement('div', { className: 'page-container' });

  // Page header
  const header = createElement('div', { className: 'page-header' });
  const title = createElement('h1', { className: 'page-title', text: 'Book a Class' });
  const subtitle = createElement('p', {
    className: 'page-subtitle',
    text: 'Reserve your spot in upcoming Reformer, Sculpt Yoga, and Barre sessions (max 6 per class).'
  });
  header.append(title, subtitle);
  page.appendChild(header);

  // State
  let selectedDate = new Date();
  let selectedDateStr = toISODate(selectedDate);
  let selectedDisciplineId = 'all';
  let showConcluded = false;

  // Calendar Strip
  const calendarContainer = createElement('div', { style: 'margin-bottom: var(--space-6);' });
  const strip = createCalendarStrip({
    selectedDate,
    daysCount: 14,
    onDateSelect: (d, dateStr) => {
      selectedDate = d;
      selectedDateStr = dateStr;
      renderClassList();
    }
  });
  calendarContainer.appendChild(strip);
  page.appendChild(calendarContainer);

  // Filter Bar Wrapper
  const filterWrapper = createElement('div', {
    style: 'display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); margin-bottom: var(--space-6); flex-wrap: wrap;'
  });

  const filterBar = createElement('div', {
    style: 'display: flex; gap: var(--space-2); overflow-x: auto; padding-bottom: var(--space-1); flex: 1;'
  });

  const disciplines = [{ id: 'all', name: 'All Disciplines' }, ...store.getDisciplines()];

  const filterButtons = [];
  disciplines.forEach(disc => {
    const isSelected = selectedDisciplineId === disc.id;
    const btn = createElement('button', {
      className: `btn ${isSelected ? 'btn-secondary' : 'btn-outline'} btn-sm`,
      attributes: { type: 'button' },
      text: disc.name
    });

    btn.addEventListener('click', () => {
      selectedDisciplineId = disc.id;
      filterButtons.forEach(b => {
        b.className = 'btn btn-outline btn-sm';
      });
      btn.className = 'btn btn-secondary btn-sm';
      renderClassList();
    });

    filterButtons.push(btn);
    filterBar.appendChild(btn);
  });

  // Concluded classes toggle
  const toggleWrapper = createElement('label', {
    style: 'display: inline-flex; align-items: center; gap: 8px; font-size: var(--text-xs); color: var(--ink-70); cursor: pointer; user-select: none;'
  });
  const toggleInput = createElement('input', {
    attributes: { type: 'checkbox' },
    style: 'width: 15px; height: 15px; accent-color: var(--rust); cursor: pointer;'
  });
  toggleInput.checked = false;
  toggleInput.addEventListener('change', () => {
    showConcluded = toggleInput.checked;
    renderClassList();
  });
  toggleWrapper.append(toggleInput, document.createTextNode('Show past sessions'));

  filterWrapper.append(filterBar, toggleWrapper);
  page.appendChild(filterWrapper);

  // Class Grid Container
  const gridContainer = createElement('div', { className: 'class-grid' });
  page.appendChild(gridContainer);

  function renderClassList() {
    clearChildren(gridContainer);

    const allSessions = store.getAllClassSessions();
    const myBookings = store.getUpcomingBookingsForMember(memberId);
    const bookedSessionIds = new Set(myBookings.map(b => b.session?.id || b.classSessionId || b.sessionId));

    // Filter by date, discipline, and hide concluded sessions unless toggled
    const matchingSessions = allSessions.filter(s => {
      const sDate = s.date || (s.startsAt ? s.startsAt.slice(0, 10) : '');
      if (sDate !== selectedDateStr) return false;
      const sDisc = s.disciplineId || s.discipline_id;
      if (selectedDisciplineId !== 'all' && sDisc !== selectedDisciplineId) return false;
      const isPast = store.isSessionPast(s);
      const isBooked = bookedSessionIds.has(s.id);
      // If session is over and user is not booked in it, hide it by default
      if (isPast && !isBooked && !showConcluded) return false;
      return true;
    });

    if (matchingSessions.length === 0) {
      gridContainer.style.display = 'block';
      const isToday = selectedDateStr === toISODate(new Date());
      const allOnDate = allSessions.filter(s => (s.date || (s.startsAt ? s.startsAt.slice(0, 10) : '')) === selectedDateStr);
      let emptyTitle = isToday ? 'No upcoming classes remaining today' : 'No classes on this date';
      let emptyDesc = isToday
        ? 'All sessions scheduled earlier today have concluded. Check "Show past sessions" above or select tomorrow to reserve your spot.'
        : 'There are no scheduled sessions matching your selected filters for this day. Please select another date from the strip above.';
      
      if (allOnDate.length === 0 && isToday) {
        emptyTitle = 'No classes scheduled today';
        emptyDesc = 'No studio sessions scheduled for today yet. Select tomorrow or an upcoming date above to reserve your spot.';
      }

      const empty = createEmptyState({
        icon: 'calendar-x',
        title: emptyTitle,
        description: emptyDesc
      });
      gridContainer.appendChild(empty);
      return;
    }

    gridContainer.style.display = 'grid';

    matchingSessions.forEach(session => {
      const isBooked = bookedSessionIds.has(session.id);
      const remainingCredits = store.getRemainingCredits(memberId, session.disciplineId);
      const hasCredit = remainingCredits > 0;

      const card = createClassCard(session, {
        isBooked,
        hasCredit,
        onBook: (sess, evt) => handleBooking(sess, evt),
        onCancel: async (e) => {
          const booking = myBookings.find(b => (b.session?.id || b.classSessionId || b.sessionId) === session.id);
          if (booking) {
            try {
              const btn = e?.target;
              if (btn) btn.disabled = true;
              await store.cancelBooking(booking.id);
              showToast('Class booking cancelled.', 'info');
              renderClassList();
            } catch (err) {
              showToast(err.message, 'error');
              const btn = e?.target;
              if (btn) btn.disabled = false;
            }
          }
        }
      });

      gridContainer.appendChild(card);
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: gridContainer });
    }
  }

  async function handleBooking(session, e) {
    if (store.isSessionPast(session)) {
      showToast('This session has already taken place and cannot be booked.', 'error');
      renderClassList();
      return;
    }

    const disc = store.getDisciplineById(session.disciplineId);
    const sDate = session.startsAt ? new Date(session.startsAt) : (session.date && session.time ? new Date(`${session.date}T${session.time}`) : new Date());
    const now = new Date();
    const hoursUntil = (sDate.getTime() - now.getTime()) / 3600000;
    const cutoffHours = store.getCancellationWindowHours(session);
    const sessionType = cutoffHours === 12 ? 'Morning' : 'Evening';

    // If inside the 12h/6h cancellation window, warn the user that this booking cannot be cancelled
    if (hoursUntil > 0 && hoursUntil < cutoffHours) {
      const content = createElement('div', { style: 'font-size: var(--text-sm); line-height: 1.6; color: var(--ink-80);' });
      content.innerHTML = `
        <p style="margin-bottom: var(--space-3); color: var(--rust); font-weight: var(--weight-bold);">
          ⚠ Short-Notice Booking Policy (${sessionType} Session)
        </p>
        <p style="margin-bottom: var(--space-3);">
          This <strong>${disc ? disc.name : 'Class'}</strong> session on <strong>${session.date || ''}</strong> at <strong>${session.time || ''}</strong> starts in <strong>${hoursUntil.toFixed(1)} hours</strong>.
        </p>
        <p style="margin-bottom: var(--space-3); background: var(--stone); padding: var(--space-3); border-radius: var(--radius-sm); border-left: 3px solid var(--rust);">
          Because this class starts within the <strong>${cutoffHours}-hour cancellation window</strong>, you will <strong>NOT be able to cancel this booking or get your session credit refunded</strong> once booked.
        </p>
        <p>Would you like to proceed and reserve this spot?</p>
      `;

      const confirmBtn = createElement('button', {
        className: 'btn btn-primary btn-sm',
        attributes: { type: 'button' },
        text: 'Proceed & Book'
      });

      const modal = openModal({
        title: 'Non-Refundable Booking Notice',
        content,
        actions: [confirmBtn]
      });

      confirmBtn.addEventListener('click', async () => {
        try {
          confirmBtn.disabled = true;
          confirmBtn.textContent = 'Booking...';
          await store.bookClass(memberId, session.id);
          modal.close();
          showToast('Class confirmed! Spot reserved.', 'success');
          renderClassList();
        } catch (err) {
          showToast(err.message, 'error');
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Proceed & Book';
        }
      });
      return;
    }

    // Standard booking
    try {
      const btn = typeof e !== 'undefined' && e ? (e.target || e) : null;
      if (btn && btn.disabled !== undefined) btn.disabled = true;
      await store.bookClass(memberId, session.id);
      showToast('Class confirmed! Spot reserved.', 'success');
      renderClassList();
    } catch (err) {
      showToast(err.message, 'error');
      const btn = typeof e !== 'undefined' && e ? (e.target || e) : null;
      if (btn && btn.disabled !== undefined) btn.disabled = false;
    }
  }

  renderClassList();
  clearChildren(container);
  container.appendChild(page);

  const onDataMutated = () => {
    if (!document.body.contains(page)) {
      events.off(EVENT.DATA_MUTATED, onDataMutated);
      return;
    }
    renderClassList();
  };
  const onBookingCreated = () => {
    if (!document.body.contains(page)) {
      events.off(EVENT.BOOKING_CREATED, onBookingCreated);
      return;
    }
    renderClassList();
  };

  events.on(EVENT.DATA_MUTATED, onDataMutated);
  events.on(EVENT.BOOKING_CREATED, onBookingCreated);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}
