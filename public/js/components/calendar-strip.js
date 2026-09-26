/**
 * Plash Pilates — Calendar Strip Component
 * Date navigation strip for class schedule selection.
 * @module calendar-strip
 */

import { createElement } from '../utils/dom.js';
import { toISODate, formatDayName } from '../utils/format.js';

/**
 * Render a calendar date selector strip.
 * @param {Object} options
 * @param {Date} [options.selectedDate] - Initially selected date
 * @param {number} [options.daysCount=14] - Number of days to display
 * @param {Function} options.onDateSelect - Callback when date is selected
 * @returns {HTMLElement}
 */
export function createCalendarStrip({ selectedDate = new Date(), daysCount = 14, onDateSelect }) {
  const container = createElement('div', { className: 'calendar-strip' });
  const daysContainer = createElement('div', { className: 'calendar-strip-days' });

  let activeDateStr = toISODate(selectedDate);

  const prevBtn = createElement('button', {
    className: 'calendar-strip-nav',
    attributes: { 'aria-label': 'Scroll previous days', type: 'button' },
    children: [createElement('i', { attributes: { 'data-lucide': 'chevron-left' } })]
  });

  const nextBtn = createElement('button', {
    className: 'calendar-strip-nav',
    attributes: { 'aria-label': 'Scroll next days', type: 'button' },
    children: [createElement('i', { attributes: { 'data-lucide': 'chevron-right' } })]
  });

  prevBtn.addEventListener('click', () => {
    daysContainer.scrollBy({ left: -200, behavior: 'smooth' });
  });

  nextBtn.addEventListener('click', () => {
    daysContainer.scrollBy({ left: 200, behavior: 'smooth' });
  });

  const today = new Date();
  const todayStr = toISODate(today);

  const dayButtons = [];

  for (let i = 0; i < daysCount; i++) {
    const d = new Date();
    d.setDate(today.getDate() + i);

    const dateStr = toISODate(d);
    const dayName = formatDayName(d);
    const dayNum = parseInt(dateStr.split('-')[2], 10);

    const isToday = dateStr === todayStr;
    const isActive = dateStr === activeDateStr;

    const dayBtn = createElement('button', {
      className: `calendar-strip-day ${isActive ? 'active' : ''} ${isToday ? 'today' : ''}`,
      attributes: {
        type: 'button',
        'aria-pressed': isActive ? 'true' : 'false',
        'aria-label': `${dayName} ${dateStr}`
      }
    });

    const nameEl = createElement('span', {
      className: 'calendar-strip-day-name',
      text: dayName
    });

    const numEl = createElement('span', {
      className: 'calendar-strip-day-number',
      text: String(dayNum)
    });

    dayBtn.append(nameEl, numEl);

    dayBtn.addEventListener('click', () => {
      dayButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      });
      dayBtn.classList.add('active');
      dayBtn.setAttribute('aria-pressed', 'true');
      activeDateStr = dateStr;

      if (onDateSelect) onDateSelect(d, dateStr);
    });

    dayButtons.push(dayBtn);
    daysContainer.appendChild(dayBtn);
  }

  container.append(prevBtn, daysContainer, nextBtn);
  return container;
}
