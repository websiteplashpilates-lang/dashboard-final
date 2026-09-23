/**
 * Plash Pilates — Format Utilities
 * Currency, date, time, duration formatting.
 * @module format
 */

/**
 * Format amount as Indian rupees.
 * @param {number} amount
 * @returns {string} e.g. "₹28,000"
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export const APP_TIMEZONE = 'Asia/Kolkata';
export const APP_LOCALE = 'en-IN';

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format date as readable string in Asia/Kolkata.
 * Handles calendar-only "YYYY-MM-DD" strings without UTC day-shifting.
 * @param {string|Date} date
 * @param {Object} [options]
 * @returns {string}
 */
export function formatDate(date, options = {}) {
  if (!date) return '';

  // Handle date-only "YYYY-MM-DD" strings without timezone conversion
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    const [y, m, d] = date.trim().split('-').map(Number);
    const monthStr = MONTH_NAMES_SHORT[m - 1] || '';
    if (options.day === 'numeric' && options.month === 'short' && !options.year) {
      return `${d} ${monthStr}`;
    }
    return `${d} ${monthStr} ${y}`;
  }

  const d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  const defaults = {
    timeZone: APP_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  };
  return new Intl.DateTimeFormat(APP_LOCALE, { ...defaults, ...options }).format(d);
}

/**
 * Format date as short string (e.g. "15 Mar") in Asia/Kolkata.
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDateShort(date) {
  if (!date) return '';

  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    const [, m, d] = date.trim().split('-').map(Number);
    const monthStr = MONTH_NAMES_SHORT[m - 1] || '';
    return `${d} ${monthStr}`;
  }

  const d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    day: 'numeric',
    month: 'short'
  }).format(d);
}

/**
 * Format time (e.g. "10:00 AM") in Asia/Kolkata.
 * Accepts ISO timestamps, Date objects, or "HH:mm" / "HH:mm:ss" strings.
 * @param {string|Date} date
 * @returns {string}
 */
export function formatTime(date) {
  if (!date) return '';

  // If already a simple time string like "10:00" or "10:00:00"
  if (typeof date === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(date.trim())) {
    const parts = date.trim().split(':');
    let hour = parseInt(parts[0], 10);
    const minute = parts[1];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  }

  const d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  const formatted = new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(d);
  return formatted.replace(/\s*([ap]m)/i, (_, p1) => ` ${p1.toUpperCase()}`).trim();
}

/**
 * Format date and time (e.g. "19 Sep 2026, 10:00 AM") in Asia/Kolkata.
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDateTime(date) {
  if (!date) return '';
  const d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  const formatted = new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(d);
  return formatted.replace(/\s*([ap]m)/i, (_, p1) => ` ${p1.toUpperCase()}`).trim();
}

/**
 * Format day name (e.g. "Mon") in Asia/Kolkata.
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDayName(date) {
  if (!date) return '';

  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    const [y, m, d] = date.trim().split('-').map(Number);
    // Create Date at midday in UTC to safely calculate day of week
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return new Intl.DateTimeFormat(APP_LOCALE, { timeZone: 'UTC', weekday: 'short' }).format(dt);
  }

  const d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    weekday: 'short'
  }).format(d);
}

/**
 * Format month name (e.g. "Sep") in Asia/Kolkata.
 * @param {string|Date} date
 * @returns {string}
 */
export function formatMonth(date) {
  if (!date) return '';

  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    const [, m] = date.trim().split('-').map(Number);
    return MONTH_NAMES_SHORT[m - 1] || '';
  }

  const d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    month: 'short'
  }).format(d);
}

/**
 * Format duration in minutes.
 * @param {number} minutes
 * @returns {string} e.g. "60 min"
 */
export function formatDuration(minutes) {
  if (minutes >= 60) {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }
  return `${minutes} min`;
}

/**
 * Format relative time in Asia/Kolkata perspective.
 * @param {string|Date} date
 * @returns {string}
 */
export function formatRelativeTime(date) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = d - now;
  const diffMin = Math.round(diffMs / 60000);
  const diffHr = Math.round(diffMs / 3600000);
  const diffDay = Math.round(diffMs / 86400000);

  if (Math.abs(diffMin) < 1) return 'just now';
  if (Math.abs(diffMin) < 60) {
    return diffMin > 0 ? `in ${diffMin} min` : `${Math.abs(diffMin)} min ago`;
  }
  if (Math.abs(diffHr) < 24) {
    return diffHr > 0 ? `in ${diffHr} hr` : `${Math.abs(diffHr)} hr ago`;
  }
  return diffDay > 0 ? `in ${diffDay} day${diffDay > 1 ? 's' : ''}` : `${Math.abs(diffDay)} day${Math.abs(diffDay) > 1 ? 's' : ''} ago`;
}

/**
 * Get ISO date string (YYYY-MM-DD) from a timestamp strictly in Asia/Kolkata.
 * Prevents calendar date shifting across UTC boundaries.
 * @param {Date|string} date
 * @returns {string}
 */
export function toISODate(date) {
  if (!date) return '';

  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    return date.trim();
  }

  const d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  // Extract YYYY-MM-DD in Asia/Kolkata
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(d);
}

/**
 * Extract date (YYYY-MM-DD) and time (HH:mm) parts strictly in Asia/Kolkata from an ISO timestamp.
 * @param {string|Date} isoString
 * @returns {{ date: string, time: string, formattedDate: string, formattedTime: string }}
 */
export function getISTDateParts(isoString) {
  if (!isoString) return { date: '', time: '', formattedDate: '', formattedTime: '' };
  const d = (isoString instanceof Date) ? isoString : new Date(isoString);
  if (isNaN(d.getTime())) return { date: '', time: '', formattedDate: '', formattedTime: '' };

  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);

  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d);

  const formattedDate = formatDate(d);
  const formattedTime = formatTime(d);

  return { date, time, formattedDate, formattedTime };
}

/**
 * Convert user-entered class date (YYYY-MM-DD) and time (HH:mm) interpreted in Asia/Kolkata
 * into canonical UTC ISO instant.
 * Uses Intl.DateTimeFormat with Asia/Kolkata explicitly without manual +/- 5:30 arithmetic.
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {string} timeStr - "HH:mm"
 * @returns {string} Canonical UTC ISO string (e.g. "2026-09-20T04:30:00.000Z")
 */
export function parseClassDateTimeToUTC(dateStr, timeStr) {
  if (!dateStr || !timeStr) return '';
  const cleanDate = dateStr.trim();
  const cleanTime = timeStr.trim().slice(0, 5);
  const [year, month, day] = cleanDate.split('-').map(Number);
  const [hour, minute] = cleanTime.split(':').map(Number);

  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) {
    return '';
  }

  // Initial estimate: interpret numbers as UTC millis
  const utcMillis = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  // Format that UTC instant in Asia/Kolkata to derive the exact timezone offset
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });

  const getKolkataTime = (ms) => {
    const parts = formatter.formatToParts(new Date(ms));
    const obj = {};
    for (const p of parts) {
      if (p.type !== 'literal') obj[p.type] = Number(p.value);
    }
    const h = obj.hour === 24 ? 0 : obj.hour;
    return Date.UTC(obj.year, obj.month - 1, obj.day, h, obj.minute, obj.second || 0);
  };

  const kolkataWallClock = getKolkataTime(utcMillis);
  const offset = kolkataWallClock - utcMillis;
  const targetUtcMillis = utcMillis - offset;

  const d = new Date(targetUtcMillis);
  if (isNaN(d.getTime())) return '';
  return d.toISOString();
}

/**
 * Convert Date or timestamp to ISO string with explicit Asia/Kolkata (+05:30) offset.
 * Example: "2026-09-20T15:45:00+05:30"
 * @param {Date|string|number} [date]
 * @returns {string}
 */
export function toISTISOString(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const istOffsetMs = 330 * 60 * 1000; // 5 hours 30 mins
  const istDate = new Date(d.getTime() + istOffsetMs);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  const hours = String(istDate.getUTCHours()).padStart(2, '0');
  const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(istDate.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+05:30`;
}

/**
 * Format class date (YYYY-MM-DD) and time (HH:mm) into canonical Asia/Kolkata ISO string.
 * Example: ("2026-09-20", "09:00") -> "2026-09-20T09:00:00+05:30"
 * @param {string} dateStr
 * @param {string} timeStr
 * @returns {string}
 */
export function formatClassDateTimeIST(dateStr, timeStr) {
  if (!dateStr || !timeStr) return '';
  const cleanDate = dateStr.trim();
  const cleanTime = timeStr.trim().slice(0, 5);
  const parts = cleanTime.split(':');
  const hh = parts[0].padStart(2, '0');
  const mm = (parts[1] || '00').padStart(2, '0');
  return `${cleanDate}T${hh}:${mm}:00+05:30`;
}

/**
 * Format duration in months.
 * @param {number} months
 * @returns {string}
 */
export function formatMonths(months) {
  if (months === 1) return '1 month';
  return `${months} months`;
}

/**
 * Get initials from a name.
 * @param {string} name
 * @returns {string}
 */
export function getInitials(name) {
  if (!name) return '';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/**
 * Convert number to Indian currency words format.
 * @param {number} num
 * @returns {string} e.g. "Indian Rupees Twenty Seven Thousand Only"
 */
export function amountInWordsINR(num) {
  if (!num || isNaN(num)) return 'Indian Rupees Zero Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n) {
    if (n < 20) return a[n];
    const digit = n % 10;
    return `${b[Math.floor(n / 10)]}${digit ? ' ' + a[digit] : ''}`;
  }

  let n = Math.floor(num);
  let words = [];

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  if (crore) words.push(`${inWords(crore)} Crore`);

  const lakh = Math.floor(n / 100000);
  n %= 100000;
  if (lakh) words.push(`${inWords(lakh)} Lakh`);

  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (thousand) words.push(`${inWords(thousand)} Thousand`);

  const hundred = Math.floor(n / 100);
  n %= 100;
  if (hundred) words.push(`${inWords(hundred)} Hundred`);

  if (n) {
    if (words.length > 0) words.push('and');
    words.push(inWords(n));
  }

  return `Indian Rupees ${words.join(' ')} Only`;
}

export { escapeHtml } from './dom.js';


