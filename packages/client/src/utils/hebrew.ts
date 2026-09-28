// ---------------------------------------------------------------------------
// Hebrew (Jewish) lunisolar calendar utilities
// Pure math — no external library. Uses the standard Hebrew calendar algorithm
// based on the Metonic cycle (19-year cycle, 7 leap years).
// Hebrew epoch: 1 Tishri 1 AM = Julian Day 347997.5 (= Mon 7 Oct 3761 BCE proleptic Julian)
// ---------------------------------------------------------------------------

export const HEBREW_MONTHS = [
  'תִּשְׁרֵי', 'חֶשְׁוָן', 'כִּסְלֵו', 'טֵבֵת', 'שְׁבָט',
  'אֲדָר', 'נִיסָן', 'אִיָּר', 'סִיוָן', 'תַּמּוּז', 'אָב', 'אֱלוּל',
  'אֲדָר ב׳', // index 12 — used in leap years instead of index 5
];

/** Digit formatter — Hebrew calendar uses standard Latin digits (stretch: Hebrew letters) */
export function toHebrewDigits(str: string | number): string {
  return String(str);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns true if the Hebrew year hY is a leap year (has 13 months) */
function isHebrewLeap(hY: number): boolean {
  return ((7 * hY + 1) % 19) < 7;
}

/** Number of months in a Hebrew year */
function hebrewMonthsInYear(hY: number): number {
  return isHebrewLeap(hY) ? 13 : 12;
}

/**
 * Elapsed days from Hebrew epoch to the start (Tishri 1) of Hebrew year hY.
 * Uses the standard Molad Tohu calculation.
 */
function hebrewElapsedDays(hY: number): number {
  const monthsElapsed =
    235 * Math.floor((hY - 1) / 19) +          // complete 19-year cycles
    12 * ((hY - 1) % 19) +                       // ordinary years in partial cycle
    Math.floor((7 * ((hY - 1) % 19) + 1) / 19); // leap months in partial cycle

  // Molad (new moon) in parts (chalakim)
  // Each month = 29 days 12 hours 793 chalakim = 765433 chalakim
  const parts = 204 + 793 * (monthsElapsed % 1080);
  const hours = 5 + 12 * monthsElapsed + 793 * Math.floor(monthsElapsed / 1080) + Math.floor(parts / 1080);
  const conjunctionDay = 1 + 29 * monthsElapsed + Math.floor(hours / 24);
  const conjunctionParts = 1080 * (hours % 24) + (parts % 1080);

  // Four postponement rules (Dechiyot)
  const altDay =
    (conjunctionParts >= 19440) ||
    (conjunctionDay % 7 === 2 && conjunctionParts >= 9924 && !isHebrewLeap(hY)) ||
    (conjunctionDay % 7 === 1 && conjunctionParts >= 16789 && isHebrewLeap(hY - 1))
      ? conjunctionDay + 1
      : conjunctionDay;

  return (altDay % 7 === 0 || altDay % 7 === 3 || altDay % 7 === 5) ? altDay + 1 : altDay;
}

/** Days in Hebrew year hY */
function hebrewDaysInYear(hY: number): number {
  return hebrewElapsedDays(hY + 1) - hebrewElapsedDays(hY);
}

/**
 * Returns the number of days in Hebrew month hM (1-based) of year hY.
 * Month order (1-based): Tishri(1) Cheshvan(2) Kislev(3) Tevet(4) Shvat(5)
 *   Adar/AdarI(6) [AdarII(7) in leap] Nisan Iyar Sivan Tammuz Av Elul
 */
export function hebrewDaysInMonth(hY: number, hM: number): number {
  const leap = isHebrewLeap(hY);
  const days = hebrewDaysInYear(hY);
  switch (hM) {
    case 1:  return 30; // Tishri always 30
    case 2:  return (days === 355 || days === 385) ? 30 : 29; // Cheshvan
    case 3:  return (days === 353 || days === 383) ? 29 : 30; // Kislev
    case 4:  return 29; // Tevet
    case 5:  return 30; // Shvat
    case 6:  return leap ? 30 : 29; // Adar I (30 in leap) / Adar (29 in regular)
    case 7:  return leap ? 29 : 30; // Adar II (29) in leap; Nisan (30) in regular
    case 8:  return leap ? 30 : 30; // Nisan in leap
    case 9:  return 29;              // Iyar
    case 10: return 30;              // Sivan
    case 11: return 29;              // Tammuz
    case 12: return 30;              // Av
    case 13: return 29;              // Elul (only in leap years)
    default: return 29;
  }
}

/**
 * Hebrew year/month/day → Julian Day Number
 */
function hebrewToJD(hY: number, hM: number, hD: number): number {
  const epoch = 347997; // JD of 1 Tishri 1 AM (Julian Day, integer part)
  let elapsed = hebrewElapsedDays(hY) + epoch;
  for (let m = 1; m < hM; m++) {
    elapsed += hebrewDaysInMonth(hY, m);
  }
  return elapsed + hD - 1;
}

/** Julian Day Number → Hebrew date */
function jdToHebrew(jd: number): { hY: number; hM: number; hD: number } {
  const jdi = Math.floor(jd);
  // Estimate year
  let hY = Math.floor((jdi - 347997) * 19 / 6935) + 1;
  // Adjust year: ensure 1 Tishri of hY is <= jdi
  while (hebrewToJD(hY + 1, 1, 1) <= jdi) hY++;
  while (hebrewToJD(hY, 1, 1) > jdi) hY--;

  const startOfYear = hebrewToJD(hY, 1, 1);
  const months = hebrewMonthsInYear(hY);
  let hM = 1;
  let elapsed = startOfYear;
  while (hM < months) {
    const dim = hebrewDaysInMonth(hY, hM);
    if (elapsed + dim > jdi) break;
    elapsed += dim;
    hM++;
  }
  const hD = jdi - elapsed + 1;
  return { hY, hM, hD };
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
// Month name helper — returns the correct display name for a month index (1-based)
// In leap years month 7 is Adar II; in regular years month 6 is Adar (index 5 in array)
// ---------------------------------------------------------------------------
function hebrewMonthName(hY: number, hM: number): string {
  const leap = isHebrewLeap(hY);
  if (leap) {
    // months 1-6 → indices 0-5, month 7 (Adar II) → index 12, months 8-13 → indices 6-11
    if (hM <= 6) return HEBREW_MONTHS[hM - 1];
    if (hM === 7) return HEBREW_MONTHS[12]; // אֲדָר ב׳
    return HEBREW_MONTHS[hM - 2]; // shift back one for months 8-13
  }
  // non-leap: months 1-12 → indices 0-5, 6-11 (skip index 12)
  return HEBREW_MONTHS[hM - 1];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Converts a Gregorian date string (YYYY-MM-DD) to a Hebrew display string.
 * e.g. "2025-03-22" → "22 אֲדָר ב׳ 5785"
 */
export function toHebrewDisplay(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    const { hY, hM, hD } = jdToHebrew(gToJD(d.getFullYear(), d.getMonth() + 1, d.getDate()));
    return `${hD} ${hebrewMonthName(hY, hM)} ${hY}`;
  } catch {
    return dateStr;
  }
}

/**
 * Returns Hebrew year/month(1-based)/day components for a Gregorian date string.
 */
export function gregorianToHebrew(dateStr: string): { year: number; month: number; day: number } {
  const d = new Date(dateStr + 'T00:00:00');
  const { hY, hM, hD } = jdToHebrew(gToJD(d.getFullYear(), d.getMonth() + 1, d.getDate()));
  return { year: hY, month: hM, day: hD };
}

/**
 * Converts Hebrew year/month(1-based)/day to a Gregorian YYYY-MM-DD string.
 */
export function hebrewToGregorian(hY: number, hM: number, hD: number): string {
  const { gy, gm, gd } = jdToG(hebrewToJD(hY, hM, hD));
  return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Secondary-calendar range helpers (used by CalendarWidget)
// ---------------------------------------------------------------------------

const SHORT_EN_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Returns the Hebrew month range label for a given Gregorian month.
 * e.g. gYear=2025, gMonth=3 → "אֲדָר ב׳ – נִיסָן 5785"
 */
export function hebrewMonthRangeForGregorianMonth(gYear: number, gMonth: number): string {
  const lastDay = new Date(gYear, gMonth, 0).getDate();
  const { hY: hy1, hM: hm1 } = jdToHebrew(gToJD(gYear, gMonth, 1));
  const { hY: hy2, hM: hm2 } = jdToHebrew(gToJD(gYear, gMonth, lastDay));
  if (hm1 === hm2 && hy1 === hy2) {
    return `${hebrewMonthName(hy1, hm1)} ${hy1}`;
  }
  if (hy1 === hy2) {
    return `${hebrewMonthName(hy1, hm1)} – ${hebrewMonthName(hy2, hm2)} ${hy1}`;
  }
  return `${hebrewMonthName(hy1, hm1)} ${hy1} – ${hebrewMonthName(hy2, hm2)} ${hy2}`;
}

/**
 * Returns the Gregorian month range label for a given Hebrew month.
 * e.g. hYear=5785, hMonth=7 → "Mar – Apr 2025"
 */
export function gregorianMonthRangeForHebrewMonth(hYear: number, hMonth: number): string {
  const lastHDay = hebrewDaysInMonth(hYear, hMonth);
  const { gy: gy1, gm: gm1 } = jdToG(hebrewToJD(hYear, hMonth, 1));
  const { gy: gy2, gm: gm2 } = jdToG(hebrewToJD(hYear, hMonth, lastHDay));
  if (gm1 === gm2 && gy1 === gy2) {
    return `${SHORT_EN_MONTHS[gm1 - 1]} ${gy1}`;
  }
  if (gy1 === gy2) {
    return `${SHORT_EN_MONTHS[gm1 - 1]} – ${SHORT_EN_MONTHS[gm2 - 1]} ${gy1}`;
  }
  return `${SHORT_EN_MONTHS[gm1 - 1]} ${gy1} – ${SHORT_EN_MONTHS[gm2 - 1]} ${gy2}`;
}

/**
 * Returns a Hebrew week range label for two Date endpoints.
 * e.g. "22 אֲדָר ב׳ – 28 אֲדָר ב׳ 5785"
 */
export function hebrewWeekRange(start: Date, end: Date): string {
  const { hY: hy1, hM: hm1, hD: hd1 } = jdToHebrew(gToJD(start.getFullYear(), start.getMonth() + 1, start.getDate()));
  const { hY: hy2, hM: hm2, hD: hd2 } = jdToHebrew(gToJD(end.getFullYear(), end.getMonth() + 1, end.getDate()));
  if (hm1 === hm2 && hy1 === hy2) {
    return `${hd1} – ${hd2} ${hebrewMonthName(hy2, hm2)} ${hy2}`;
  }
  return `${hd1} ${hebrewMonthName(hy1, hm1)} – ${hd2} ${hebrewMonthName(hy2, hm2)} ${hy2}`;
}

/**
 * Hebrew week number within the Hebrew year.
 * Weeks start on Sunday (traditional Jewish week).
 * Week 1 starts on the Sunday on or before 1 Tishri.
 */
export function hebrewWeekNumber(hY: number, hM: number, hD: number): number {
  // Gregorian date of 1 Tishri of hY
  const { gy, gm, gd } = jdToG(hebrewToJD(hY, 1, 1));
  const yearStart = new Date(gy, gm - 1, gd);
  // Gregorian date of the target day
  const { gy: dy, gm: dm, gd: dd } = jdToG(hebrewToJD(hY, hM, hD));
  const target = new Date(dy, dm - 1, dd);
  const doy = Math.round((target.getTime() - yearStart.getTime()) / 86400000);
  // Sunday-first offset: getDay() gives Sun=0…Sat=6
  const dow1 = yearStart.getDay();
  return Math.floor((doy + dow1) / 7) + 1;
}


// ---------------------------------------------------------------------------
// Validation test cases (commented out):
// toHebrewDisplay('2025-03-22') → "22 אֲדָר ב׳ 5785"
// gregorianToHebrew('2025-03-22') → { year: 5785, month: 7, day: 22 }
// hebrewToGregorian(5785, 7, 22) → "2025-03-22"
// hebrewDaysInMonth(5785, 1) → 30  (Tishri)
// hebrewDaysInMonth(5785, 7) → 29  (Adar II in leap year 5785)
// hebrewMonthRangeForGregorianMonth(2025, 3) → "אֲדָר ב׳ – נִיסָן 5785"
// ---------------------------------------------------------------------------
