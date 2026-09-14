/**
 * Formats a date-only string (YYYY-MM-DD) or ISO datetime string into a
 * human-readable date like "Jan 5, 2025".
 *
 * The T00:00:00 suffix is appended to date-only strings before parsing so that
 * the Date constructor treats them as local time rather than UTC midnight,
 * avoiding off-by-one-day errors in negative-UTC-offset timezones.
 *
 * Returns '' for null / undefined / empty input.
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
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
 * Returns the original string unchanged if it cannot be parsed.
 */
export function formatDateTime(str: string): string {
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
