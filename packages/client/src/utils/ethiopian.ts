// ---------------------------------------------------------------------------
// Ethiopian (Ge'ez/Ethiopic) solar calendar utilities
// Pure math — no external library.
//
// Structure:
//   - 12 months of 30 days + Pagumē (month 13): 5 days (non-leap), 6 days (leap)
//   - Ethiopian leap year: every 4 years where (eYear % 4 === 3)
//     (i.e., the year BEFORE a Gregorian leap year — the Ethiopian year that ends
//      in a Gregorian leap year has 366 days)
//   - Ethiopian New Year (Enkutatash): September 11 in non-Gregorian-leap years,
//     September 12 in Gregorian leap years (Julian-based rule).
//   - Ethiopian year ≈ Gregorian year − 7 (before Sep 11) or − 8 (after Sep 11 in some years)
// ---------------------------------------------------------------------------

export const ETHIOPIAN_MONTHS = [
  'መስከረም', 'ጥቅምት', 'ህዳር', 'ታህሳስ', 'ጥር', 'የካቲት',
  'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ',
];

/** Digit formatter — Ethiopian calendar uses standard Latin digits */
export function toEthiopianDigits(str: string | number): string {
  return String(str);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns true if the Ethiopian year eY is a leap year (has 366 days / Pagumē has 6 days) */
function isEthiopianLeap(eY: number): boolean {
  return eY % 4 === 3;
}

/** Days in Ethiopian month (eM is 1-based, 1-12 = 30 days; 13 = Pagumē 5 or 6) */
export function ethiopianDaysInMonth(eY: number, eM: number): number {
  if (eM < 13) return 30;
  return isEthiopianLeap(eY) ? 6 : 5;
}

/**
 * The Ethiopian calendar is a modified Julian calendar.
 * Ethiopian New Year (Meskerem 1):
 *   = August 29 Julian = September 11 Gregorian (non-Gregorian-leap year)
 *   = August 29 Julian = September 12 Gregorian (Gregorian leap year — the preceding year)
 *
 * Julian Day Number of Meskerem 1, Ethiopian year eY:
 *   JDN = 1723856 + 365*(eY - 1) + floor((eY - 1)/4) + 0 (offset from Ethiopian epoch)
 * Ethiopian epoch: Meskerem 1, 1 ET = JDN 1724221 (29 Aug 8 CE Julian = ~27 Aug 8 CE Gregorian)
 *
 * More precisely: Meskerem 1, 1 ET = 27 August 8 CE (proleptic Julian)
 * JD of that date: JD 1724221 (noon). We use integer JDs for day counts.
 */
const ETHIOPIAN_EPOCH = 1724221; // JD of Meskerem 1, 1 ET (Julian calendar)

function ethiopianToJD(eY: number, eM: number, eD: number): number {
  return ETHIOPIAN_EPOCH +
    365 * (eY - 1) +
    Math.floor(eY / 4) +
    30 * (eM - 1) +
    (eD - 1);
}

function jdToEthiopian(jd: number): { eY: number; eM: number; eD: number } {
  const jdi = Math.floor(jd);
  // Days since Ethiopian epoch
  const r = jdi - ETHIOPIAN_EPOCH;
  // Each 4-year cycle = 365*4 + 1 = 1461 days
  const n4 = Math.floor(r / 1461);
  const rem = r % 1461;
  const n1 = Math.min(Math.floor(rem / 365), 3); // 0-3 within the cycle
  const eY = 4 * n4 + n1 + 1;
  const dayOfYear = rem - 365 * n1; // 0-based within the Ethiopian year
  const eM = Math.floor(dayOfYear / 30) + 1;
  const eD = (dayOfYear % 30) + 1;
  return { eY, eM, eD };
}

/** Gregorian date → Julian Day Number */
function gToJD(gy: number, gm: number, gd: number): number {
  let y = gy, m = gm;
  if (m <= 2) { y--; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + gd + B - 1524;
}

/** Julian Day Number → Gregorian date */
function jdToG(jd: number): { gy: number; gm: number; gd: number } {
  const z = Math.floor(jd) + 1;
  const a = Math.floor((z - 1867216.25) / 36524.25);
  const b = z + 1 + a - Math.floor(a / 4);
  const c = b + 1524;
  const d = Math.floor((c - 122.1) / 365.25);
  const e = Math.floor(365.25 * d);
  const f = Math.floor((c - e) / 30.6001);
  const gd = c - e - Math.floor(30.6001 * f);
  const gm = f < 14 ? f - 1 : f - 13;
  const gy = gm > 2 ? d - 4716 : d - 4715;
  return { gy, gm, gd };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Converts a Gregorian date string (YYYY-MM-DD) to an Ethiopian display string.
 * e.g. "2025-09-11" → "1 መስከረም 2018"
 */
export function toEthiopianDisplay(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    const { eY, eM, eD } = jdToEthiopian(gToJD(d.getFullYear(), d.getMonth() + 1, d.getDate()));
    return `${eD} ${ETHIOPIAN_MONTHS[eM - 1]} ${eY}`;
  } catch {
    return dateStr;
  }
}

/**
 * Returns Ethiopian year/month(1-based)/day for a Gregorian date string.
 */
export function gregorianToEthiopian(dateStr: string): { year: number; month: number; day: number } {
  const d = new Date(dateStr + 'T00:00:00');
  const { eY, eM, eD } = jdToEthiopian(gToJD(d.getFullYear(), d.getMonth() + 1, d.getDate()));
  return { year: eY, month: eM, day: eD };
}

/**
 * Converts Ethiopian year/month(1-based)/day to a Gregorian YYYY-MM-DD string.
 */
export function ethiopianToGregorian(eY: number, eM: number, eD: number): string {
  const { gy, gm, gd } = jdToG(ethiopianToJD(eY, eM, eD));
  return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Secondary-calendar range helpers (used by CalendarWidget)
// ---------------------------------------------------------------------------

const SHORT_EN_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Returns the Ethiopian month range label for a given Gregorian month.
 * e.g. gYear=2025, gMonth=9 → "ጳጉሜ 2017 – መስከረም 2018"
 */
export function ethiopianMonthRangeForGregorianMonth(gYear: number, gMonth: number): string {
  const lastDay = new Date(gYear, gMonth, 0).getDate();
  const fmt = (m: number, d: number) => `${gYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const start = gregorianToEthiopian(fmt(gMonth, 1));
  const end = gregorianToEthiopian(fmt(gMonth, lastDay));
  if (start.month === end.month && start.year === end.year) {
    return `${ETHIOPIAN_MONTHS[start.month - 1]} ${start.year}`;
  }
  if (start.year === end.year) {
    return `${ETHIOPIAN_MONTHS[start.month - 1]} – ${ETHIOPIAN_MONTHS[end.month - 1]} ${end.year}`;
  }
  return `${ETHIOPIAN_MONTHS[start.month - 1]} ${start.year} – ${ETHIOPIAN_MONTHS[end.month - 1]} ${end.year}`;
}

/**
 * Returns the Gregorian month range label for a given Ethiopian month.
 * e.g. eYear=2018, eMonth=1 → "Sep – Oct 2025"
 */
export function gregorianMonthRangeForEthiopianMonth(eYear: number, eMonth: number): string {
  const lastED = ethiopianDaysInMonth(eYear, eMonth);
  const { gy: gy1, gm: gm1 } = jdToG(ethiopianToJD(eYear, eMonth, 1));
  const { gy: gy2, gm: gm2 } = jdToG(ethiopianToJD(eYear, eMonth, lastED));
  if (gm1 === gm2 && gy1 === gy2) {
    return `${SHORT_EN_MONTHS[gm1 - 1]} ${gy1}`;
  }
  if (gy1 === gy2) {
    return `${SHORT_EN_MONTHS[gm1 - 1]} – ${SHORT_EN_MONTHS[gm2 - 1]} ${gy1}`;
  }
  return `${SHORT_EN_MONTHS[gm1 - 1]} ${gy1} – ${SHORT_EN_MONTHS[gm2 - 1]} ${gy2}`;
}

/**
 * Returns an Ethiopian week range label for two Date endpoints.
 * e.g. "1 – 7 መስከረም 2018"
 */
export function ethiopianWeekRange(start: Date, end: Date): string {
  const s = jdToEthiopian(gToJD(start.getFullYear(), start.getMonth() + 1, start.getDate()));
  const e = jdToEthiopian(gToJD(end.getFullYear(), end.getMonth() + 1, end.getDate()));
  if (s.eM === e.eM && s.eY === e.eY) {
    return `${s.eD} – ${e.eD} ${ETHIOPIAN_MONTHS[e.eM - 1]} ${e.eY}`;
  }
  return `${s.eD} ${ETHIOPIAN_MONTHS[s.eM - 1]} – ${e.eD} ${ETHIOPIAN_MONTHS[e.eM - 1]} ${e.eY}`;
}

/**
 * Ethiopian week number within the Ethiopian year.
 * Weeks start on Sunday (matching the Sunday-first grid used in CalendarWidget).
 * Week 1 starts on the Sunday on or before 1 Meskerem.
 */
export function ethiopianWeekNumber(eY: number, eM: number, eD: number): number {
  // Gregorian date of 1 Meskerem (month 1, day 1)
  const yearStartStr = ethiopianToGregorian(eY, 1, 1);
  const yearStart = new Date(yearStartStr + 'T00:00:00');
  // Gregorian date of the target day
  const targetStr = ethiopianToGregorian(eY, eM, eD);
  const target = new Date(targetStr + 'T00:00:00');
  const doy = Math.round((target.getTime() - yearStart.getTime()) / 86400000);
  // Sunday-first offset: getDay() gives Sun=0…Sat=6
  const dow1 = yearStart.getDay();
  return Math.floor((doy + dow1) / 7) + 1;
}


// ---------------------------------------------------------------------------
// Validation test cases (commented out):
// toEthiopianDisplay('2025-09-11') → "1 መስከረም 2018"
// gregorianToEthiopian('2025-09-11') → { year: 2018, month: 1, day: 1 }
// ethiopianToGregorian(2018, 1, 1) → "2025-09-11"
// ethiopianDaysInMonth(2017, 13) → 5   (2017 ET is not a leap ET year: 2017 % 4 = 1)
// ethiopianDaysInMonth(2019, 13) → 6   (2019 ET is a leap ET year: 2019 % 4 = 3)
// toEthiopianDisplay('2017-09-10') → "5 ጳጉሜ 2009"  (last day of Pagume before new year)
// ---------------------------------------------------------------------------
