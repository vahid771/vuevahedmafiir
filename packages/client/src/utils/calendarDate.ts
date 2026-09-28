/**
 * Returns today's date formatted in the given calendar system.
 * All display functions accept an ISO "YYYY-MM-DD" string.
 */

import type { CalendarType } from '../api/preferences';
import { toJalaliDisplay } from './jalali';
import { toHijriDisplay } from './hijri';
import { toHebrewDisplay } from './hebrew';
import { toChineseDisplay } from './chinese';
import { toSakaDisplay } from './saka';
import { toEthiopianDisplay } from './ethiopian';

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getTodayInCalendar(cal: CalendarType): string {
  const iso = todayISO();
  switch (cal) {
    case 'miladi':
      return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date());
    case 'shamsi':
      return toJalaliDisplay(iso);
    case 'qamari':
      return toHijriDisplay(iso);
    case 'hebrew':
      return toHebrewDisplay(iso);
    case 'chinese':
      return toChineseDisplay(iso);
    case 'saka':
      return toSakaDisplay(iso);
    case 'ethiopian':
      return toEthiopianDisplay(iso);
  }
}
