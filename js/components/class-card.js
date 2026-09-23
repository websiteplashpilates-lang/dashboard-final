/**
 * Plash Pilates — Class Card Component
 * Displays session details, spots remaining, instructor, and booking trigger.
 * @module class-card
 */

import { createElement } from '../utils/dom.js';
import { formatTime, formatDuration } from '../utils/format.js';
import * as store from '../core/store.js';

/**
 * Render a class session card.
 * @param {Object} session - Class session object
 * @param {Object} options
 * @param {boolean} [options.isBooked=false] - Whether current user already booked it
 * @param {boolean} [options.hasCredit=true] - Whether user has credits for discipline
 * @param {Function} [options.onBook] - Callback when book button clicked
 * @param {Function} [options.onCancel] - Callback when cancel button clicked (if booked)
 * @returns {HTMLElement}
 */
export function createClassCard(session, { isBooked = false, hasCredit = true, onBook, onCancel } = {}) {
  const card = createElement('div', { className: 'class-card' });

  const discipline = store.getDisciplineById(session.disciplineId) || { name: 'Class' };
  const trainer = store.getTrainerById(session.trainerId) || { name: 'Instructor', tier: 'standard' };

  const isPast = store.isSessionPast(session);
  if (isPast) {
    card.classList.add('class-card-past');
    card.style.opacity = '0.65';
    card.style.background = 'var(--stone)';
  }

  // Header
  const header = createElement('div', { className: 'class-card-header' });
  const discEl = createElement('span', {
    className: 'class-card-discipline',
    text: discipline.name
  });

  const spots = session.spotsRemaining;
  let spotClass = 'available';
  let spotText = `${spots} of ${session.capacity} spots`;

  if (isPast) {
    spotClass = 'neutral';
    spotText = 'Session Concluded';
  } else if (spots === 0) {
    spotClass = 'full';
    spotText = 'Class Full';
  } else if (spots <= 2) {
    spotClass = 'low';
    spotText = `Only ${spots} spot${spots > 1 ? 's' : ''} left`;
  }

  const spotsEl = createElement('span', {
    className: `class-card-spots ${spotClass}`,
    style: isPast ? 'background: var(--ink-10); color: var(--ink-60);' : '',
    text: spotText
  });

  header.append(discEl, spotsEl);

  // Time
  const timeEl = createElement('div', {
    className: 'class-card-time',
    text: formatTime(`2026-01-01T${session.time}`)
  });

  // Meta (duration only — no individual instructor names per studio policy)
  const meta = createElement('div', { className: 'class-card-meta' });

  const durationEl = createElement('div', { className: 'class-card-duration' }, [
    createElement('i', { attributes: { 'data-lucide': 'clock' } }),
    createElement('span', { text: formatDuration(session.durationMinutes) })
  ]);

  meta.append(durationEl);

  // Actions
  const actions = createElement('div', { className: 'class-card-actions' });

  if (isPast) {
    if (isBooked) {
      const pastBadge = createElement('span', {
        className: 'badge badge-neutral',
        style: 'font-weight: 600;',
        text: 'Attended / Past Class'
      });
      actions.appendChild(pastBadge);
    } else {
      const pastBtn = createElement('button', {
        className: 'btn btn-secondary btn-sm btn-block',
        attributes: { disabled: 'true', type: 'button' },
        style: 'opacity: 0.6; cursor: not-allowed; pointer-events: none;',
        text: 'Session Concluded'
      });
      actions.appendChild(pastBtn);
    }
  } else if (isBooked) {
    const bookedBadge = createElement('span', {
      className: 'badge badge-active',
      style: 'margin-right: var(--space-3);',
      text: 'You are booked'
    });
    actions.appendChild(bookedBadge);

    if (onCancel) {
      const cancelBtn = createElement('button', {
        className: 'btn btn-outline btn-sm',
        attributes: { type: 'button' },
        text: 'Cancel Booking'
      });
      cancelBtn.addEventListener('click', () => onCancel(session));
      actions.appendChild(cancelBtn);
    }
  } else if (spots === 0) {
    const fullBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      attributes: { disabled: 'true', type: 'button' },
      text: 'Class Full'
    });
    actions.appendChild(fullBtn);
  } else {
    const bookBtn = createElement('button', {
      className: 'btn btn-primary btn-sm btn-block',
      attributes: { type: 'button' },
      text: !hasCredit ? 'No Credits Available' : 'Book Class'
    });

    if (!hasCredit) {
      bookBtn.disabled = true;
      bookBtn.classList.replace('btn-primary', 'btn-secondary');
    } else {
      bookBtn.addEventListener('click', (e) => {
        if (onBook) onBook(session, e);
      });
    }

    actions.appendChild(bookBtn);
  }

  card.append(header, timeEl, meta, actions);
  return card;
}
