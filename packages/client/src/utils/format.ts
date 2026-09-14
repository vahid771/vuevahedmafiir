import { toJalaliDisplay, toJalaliDisplayTime } from './jalali';
import type { CalendarType } from '../api/preferences';

/**
 * Formats a date-only string (YYYY-MM-DD) or ISO datetime string into a
 * human-readable date like "Jan 5, 2025".
 *
 * When calendar is "shamsi", returns the Jalali equivalent (e.g. "۱۶ دی ۱۴۰۳").
 *
 * The T00:00:00 suffix is appended to date-only strings before parsing so that
 * the Date constructor treats them as local time rather than UTC midnight,
 * avoiding off-by-one-day errors in negative-UTC-offset timezones.
 *
 * Returns '' for null / undefined / empty input.
 */
export function formatDate(dateStr: string | null | undefined, calendar: CalendarType = 'miladi'): string {
  if (!dateStr) return '';
  if (calendar === 'shamsi') return toJalaliDisplay(dateStr);
  // If it looks like a date-only string (YYYY-MM-DD), pin it to local midnight.
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? dateStr + 'T00:00:00'
    : dateStr;
  const d = new Date(normalized);
  return isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Formats an ISO datetime string into a human-readable date+time like
 * "Mon, Jan 5, 3:30 PM".
 *
 * When calendar is "shamsi", returns the Jalali equivalent with time
 * (e.g. "۱۶ دی ۱۴۰۳، ساعت ۱۵:۳۰").
 *
 * Returns the original string unchanged if it cannot be parsed.
 */
export function formatDateTime(str: string, calendar: CalendarType = 'miladi'): string {
  if (calendar === 'shamsi') return toJalaliDisplayTime(str);
  const d = new Date(str);
  return isNaN(d.getTime())
    ? str
    : d.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
}
