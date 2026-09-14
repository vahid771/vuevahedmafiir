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
