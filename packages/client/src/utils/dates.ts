/**
 * Shared client-side Gregorian date math utilities.
 * Jalali-specific helpers live in utils/jalali.ts.
 */

/**
 * Returns an array of 7 ISO date strings (YYYY-MM-DD) representing
 * Monday through Sunday of the current week.
 */
export function getWeekDates(): string[] {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon…
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/**
 * Returns an array of 7 ISO date strings (YYYY-MM-DD) representing
 * Saturday through Friday of the current Shamsi week.
 */
export function getShamsiWeekDates(): string[] {
  const now = new Date();
  const day = now.getDay(); // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  const daysSinceSat = day === 6 ? 0 : day + 1;
  const saturday = new Date(now);
  saturday.setDate(now.getDate() - daysSinceSat);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(saturday);
    d.setDate(saturday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}
