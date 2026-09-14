/**
 * Shared server-side date math utilities.
 */

/**
 * Returns the next yearly occurrence of a date as an ISO date string (YYYY-MM-DD).
 * If `recurs_yearly` is falsy, returns the original date string unchanged.
 */
export function nextOccurrence(dateStr: string, recurs_yearly: number): string {
  if (!recurs_yearly) return dateStr;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const d = new Date(dateStr + 'T00:00:00');
  d.setFullYear(today.getFullYear());
  if (d < today) d.setFullYear(today.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns the ISO date strings for the Monday and Sunday of the current week.
 */
export function getWeekBounds(): { monday: string; sunday: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon…
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { monday: fmt(monday), sunday: fmt(sunday) };
}
