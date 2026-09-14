import { toJalaali, toGregorian, jalaaliMonthLength, isLeapJalaaliYear } from 'jalaali-js';
import { getYear, getMonth, getDate } from 'date-fns-jalali';

export const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد',
  'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر',
  'دی', 'بهمن', 'اسفند',
];

/** Convert Western-Arabic digit string/number to Persian/Arabic-Indic digits */
export function toPersianDigits(str: string | number): string {
  return String(str).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

/**
 * Converts a Gregorian date string (YYYY-MM-DD) to a Persian display string.
 * e.g. "2025-01-05" → "۱۶ دی ۱۴۰۳"
 */
export function toJalaliDisplay(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    const { jy, jm, jd } = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return `${toPersianDigits(jd)} ${PERSIAN_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
  } catch {
    return dateStr;
  }
}

/**
 * Converts an ISO datetime string to a Persian display string with time.
 * e.g. "2025-01-05T15:30:00" → "۱۶ دی ۱۴۰۳، ساعت ۱۵:۳۰"
 */
export function toJalaliDisplayTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const { jy, jm, jd } = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${toPersianDigits(jd)} ${PERSIAN_MONTHS[jm - 1]} ${toPersianDigits(jy)}، ساعت ${toPersianDigits(hours)}:${toPersianDigits(minutes)}`;
  } catch {
    return isoStr;
  }
}

/**
 * Returns Jalali year/month(1-based)/day components for a Gregorian date string.
 */
export function gregorianToJalali(dateStr: string): { year: number; month: number; day: number } {
  const d = new Date(dateStr + 'T00:00:00');
  const { jy, jm, jd } = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return { year: jy, month: jm, day: jd };
}

/**
 * Converts Jalali year/month(1-based)/day to a Gregorian YYYY-MM-DD string.
 */
export function jalaliToGregorian(jY: number, jM: number, jD: number): string {
  const { gy, gm, gd } = toGregorian(jY, jM, jD);
  return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
}

/** Returns the number of days in a given Jalali month (jM is 1-based) */
export function jalaliDaysInMonth(jY: number, jM: number): number {
  return jalaaliMonthLength(jY, jM);
}

export { isLeapJalaaliYear };

// Re-export date-fns-jalali helpers for use in picker
export { getYear as jalaliGetYear, getMonth as jalaliGetMonth, getDate as jalaliGetDate };

// ---------------------------------------------------------------------------
// Secondary-calendar range helpers (used by CalendarWidget)
// ---------------------------------------------------------------------------

/**
 * Returns the Jalali month range label for a given Gregorian month.
 * e.g. gYear=2025, gMonth=1 → "دی – بهمن ۱۴۰۳"
 * If the whole month falls in one Jalali month, returns just that month name + year.
 */
export function jalaliMonthRangeForGregorianMonth(gYear: number, gMonth: number): string {
  const lastDay = new Date(gYear, gMonth, 0).getDate(); // day 0 of next month = last day
  const { jy: jy1, jm: jm1 } = toJalaali(gYear, gMonth, 1);
  const { jy: jy2, jm: jm2 } = toJalaali(gYear, gMonth, lastDay);
  if (jm1 === jm2 && jy1 === jy2) {
    return `${PERSIAN_MONTHS[jm1 - 1]} ${toPersianDigits(jy1)}`;
  }
  if (jy1 === jy2) {
    return `${PERSIAN_MONTHS[jm1 - 1]} – ${PERSIAN_MONTHS[jm2 - 1]} ${toPersianDigits(jy1)}`;
  }
  return `${PERSIAN_MONTHS[jm1 - 1]} ${toPersianDigits(jy1)} – ${PERSIAN_MONTHS[jm2 - 1]} ${toPersianDigits(jy2)}`;
}

const SHORT_EN_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Returns the Gregorian month range label for a given Jalali month.
 * e.g. jYear=1403, jMonth=10 → "Dec 2024 – Jan 2025"
 */
export function gregorianMonthRangeForJalaliMonth(jYear: number, jMonth: number): string {
  const lastJDay = jalaaliMonthLength(jYear, jMonth);
  const { gy: gy1, gm: gm1 } = toGregorian(jYear, jMonth, 1);
  const { gy: gy2, gm: gm2 } = toGregorian(jYear, jMonth, lastJDay);
  if (gm1 === gm2 && gy1 === gy2) {
    return `${SHORT_EN_MONTHS[gm1 - 1]} ${gy1}`;
  }
  if (gy1 === gy2) {
    return `${SHORT_EN_MONTHS[gm1 - 1]} – ${SHORT_EN_MONTHS[gm2 - 1]} ${gy1}`;
  }
  return `${SHORT_EN_MONTHS[gm1 - 1]} ${gy1} – ${SHORT_EN_MONTHS[gm2 - 1]} ${gy2}`;
}

/**
 * Returns a Persian week range label for two Date endpoints.
 * e.g. "۲ دی – ۸ دی ۱۴۰۳" or "۲۹ آذر – ۵ دی ۱۴۰۳"
 */
export function jalaliWeekRange(start: Date, end: Date): string {
  const { jy: jy1, jm: jm1, jd: jd1 } = toJalaali(start.getFullYear(), start.getMonth() + 1, start.getDate());
  const { jy: jy2, jm: jm2, jd: jd2 } = toJalaali(end.getFullYear(), end.getMonth() + 1, end.getDate());
  const startStr = `${toPersianDigits(jd1)} ${PERSIAN_MONTHS[jm1 - 1]}`;
  const endStr = jy1 === jy2
    ? `${toPersianDigits(jd2)} ${PERSIAN_MONTHS[jm2 - 1]} ${toPersianDigits(jy2)}`
    : `${toPersianDigits(jd2)} ${PERSIAN_MONTHS[jm2 - 1]} ${toPersianDigits(jy2)}`;
  return `${startStr} – ${endStr}`;
}

/**
 * Returns a Gregorian week range label for two Date endpoints.
 * e.g. "Dec 29 – Jan 4, 2025"
 */
export function gregorianWeekRange(start: Date, end: Date): string {
  const sm = SHORT_EN_MONTHS[start.getMonth()];
  const em = SHORT_EN_MONTHS[end.getMonth()];
  const sy = start.getFullYear();
  const ey = end.getFullYear();
  if (sy === ey) {
    return sm === em
      ? `${sm} ${start.getDate()} – ${end.getDate()}, ${ey}`
      : `${sm} ${start.getDate()} – ${em} ${end.getDate()}, ${ey}`;
  }
  return `${sm} ${start.getDate()}, ${sy} – ${em} ${end.getDate()}, ${ey}`;
}
