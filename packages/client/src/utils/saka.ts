// ---------------------------------------------------------------------------
// Indian National Calendar (Saka Era) utilities
// Pure math — no external library.
//
// The Saka solar calendar:
//   - Saka year = Gregorian year − 78 (approx; exact offset depends on Chaitra 1)
//   - Chaitra 1 = March 22 in non-Gregorian-leap years, March 21 in Gregorian leap years
//   - Month lengths:
//       Chaitra (month 1):  30 days (non-Gregorian-leap), 31 days (Gregorian-leap)
//       Vaisakha–Bhadra (months 2–6): 31 days each
//       Asvina–Phalguna (months 7–12): 30 days each
// ---------------------------------------------------------------------------

export const SAKA_MONTHS = [
  'चैत्र', 'वैशाख', 'ज्येष्ठ', 'आषाढ़', 'श्रावण', 'भाद्रपद',
  'आश्विन', 'कार्तिक', 'मार्गशीर्ष', 'पौष', 'माघ', 'फाल्गुन',
];

/** Convert standard Latin digit string/number to Devanagari digits */
export function toSakaDigits(str: string | number): string {
  return String(str).replace(/[0-9]/g, d => '०१२३४५६७८९'[Number(d)]);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns true if the Gregorian year is a leap year */
function isGregorianLeap(gy: number): boolean {
  return (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
}

/** Days in Saka month (sM is 1-based), given the Gregorian year in which Chaitra starts */
export function sakaDaysInMonth(sY: number, sM: number): number {
  // Chaitra starts in the Gregorian year sY + 78
  const gy = sY + 78;
  if (sM === 1) return isGregorianLeap(gy) ? 31 : 30;
  if (sM <= 6) return 31;
  return 30;
}

/**
 * Returns the Gregorian date of Chaitra 1 for a given Saka year.
 * Chaitra 1 = March 22 (non-leap Gregorian) or March 21 (Gregorian leap year).
 */
function chaitraOneGregorian(sY: number): { gy: number; gm: number; gd: number } {
  const gy = sY + 78;
  return { gy, gm: 3, gd: isGregorianLeap(gy) ? 21 : 22 };
}

/**
 * Returns the total days elapsed from Chaitra 1 to the start of Saka month sM (1-based).
 */
function sakaDayOffset(sY: number, sM: number): number {
  let offset = 0;
  for (let m = 1; m < sM; m++) {
    offset += sakaDaysInMonth(sY, m);
  }
  return offset;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Converts a Gregorian date string (YYYY-MM-DD) to a Saka display string.
 * e.g. "2025-03-22" → "१ चैत्र १९४७"
 */
export function toSakaDisplay(dateStr: string): string {
  try {
    const { year, month, day } = gregorianToSaka(dateStr);
    return `${toSakaDigits(day)} ${SAKA_MONTHS[month - 1]} ${toSakaDigits(year)}`;
  } catch {
    return dateStr;
  }
}

/**
 * Returns Saka year/month(1-based)/day for a Gregorian date string.
 */
export function gregorianToSaka(dateStr: string): { year: number; month: number; day: number } {
  const d = new Date(dateStr + 'T00:00:00');
  const gy = d.getFullYear();
  const gm = d.getMonth() + 1;
  const gd = d.getDate();

  // Determine Saka year: starts in March (Gregorian)
  // If Gregorian date is before Chaitra 1 of gy, we are still in saka year (gy - 78 - 1)
  const sYCandidate = gy - 78;
  const { gd: chaitraDay } = chaitraOneGregorian(sYCandidate);
  // chaitraOneGregorian always returns gm=3
  const inNewSakaYear = gm > 3 || (gm === 3 && gd >= chaitraDay);
  const sY = inNewSakaYear ? sYCandidate : sYCandidate - 1;

  // Day of year within Saka year (0-based from Chaitra 1)
  const { gy: cGy, gd: cGd } = chaitraOneGregorian(sY);
  // Both dates are in the same Gregorian year (Chaitra 1 always falls in March)
  // But if sY's Chaitra is in (gy-1) and current date is in gy after Chaitra of sY+1,
  // we already handled that via sY selection above.
  const chaitraDate = new Date(`${cGy}-03-${String(cGd).padStart(2, '0')}T00:00:00`);
  const diffMs = d.getTime() - chaitraDate.getTime();
  const diffDays = Math.round(diffMs / 86400000); // round to handle DST edge

  // Convert diffDays to month/day
  let remaining = diffDays;
  let sM = 1;
  while (sM < 12) {
    const dim = sakaDaysInMonth(sY, sM);
    if (remaining < dim) break;
    remaining -= dim;
    sM++;
  }

  return { year: sY, month: sM, day: remaining + 1 };
}

/**
 * Converts Saka year/month(1-based)/day to a Gregorian YYYY-MM-DD string.
 */
export function sakaToGregorian(sY: number, sM: number, sD: number): string {
  const { gy, gd } = chaitraOneGregorian(sY);
  // Chaitra 1 is March 21 or 22; compute offset
  const offset = sakaDayOffset(sY, sM) + (sD - 1);
  const base = new Date(`${gy}-03-${String(gd).padStart(2, '0')}T00:00:00`);
  base.setDate(base.getDate() + offset);
  const gy2 = base.getFullYear();
  const gm2 = base.getMonth() + 1;
  const gd2 = base.getDate();
  return `${gy2}-${String(gm2).padStart(2, '0')}-${String(gd2).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Secondary-calendar range helpers (used by CalendarWidget)
// ---------------------------------------------------------------------------

const SHORT_EN_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Returns the Saka month range label for a given Gregorian month.
 * e.g. gYear=2025, gMonth=3 → "फाल्गुन १९४६ – चैत्र १९४७"
 */
export function sakaMonthRangeForGregorianMonth(gYear: number, gMonth: number): string {
  const lastDay = new Date(gYear, gMonth, 0).getDate();
  const fmt = (n: number) => String(n).padStart(2, '0');
  const start = gregorianToSaka(`${gYear}-${fmt(gMonth)}-01`);
  const end = gregorianToSaka(`${gYear}-${fmt(gMonth)}-${fmt(lastDay)}`);
  if (start.month === end.month && start.year === end.year) {
    return `${SAKA_MONTHS[start.month - 1]} ${toSakaDigits(start.year)}`;
  }
  if (start.year === end.year) {
    return `${SAKA_MONTHS[start.month - 1]} – ${SAKA_MONTHS[end.month - 1]} ${toSakaDigits(end.year)}`;
  }
  return `${SAKA_MONTHS[start.month - 1]} ${toSakaDigits(start.year)} – ${SAKA_MONTHS[end.month - 1]} ${toSakaDigits(end.year)}`;
}

/**
 * Returns the Gregorian month range label for a given Saka month.
 * e.g. sYear=1947, sMonth=1 → "Mar – Apr 2025"
 */
export function gregorianMonthRangeForSakaMonth(sYear: number, sMonth: number): string {
  const start = sakaToGregorian(sYear, sMonth, 1);
  const lastD = sakaDaysInMonth(sYear, sMonth);
  const end = sakaToGregorian(sYear, sMonth, lastD);
  const gm1 = Number(start.slice(5, 7));
  const gy1 = Number(start.slice(0, 4));
  const gm2 = Number(end.slice(5, 7));
  const gy2 = Number(end.slice(0, 4));
  if (gm1 === gm2 && gy1 === gy2) {
    return `${SHORT_EN_MONTHS[gm1 - 1]} ${gy1}`;
  }
  if (gy1 === gy2) {
    return `${SHORT_EN_MONTHS[gm1 - 1]} – ${SHORT_EN_MONTHS[gm2 - 1]} ${gy1}`;
  }
  return `${SHORT_EN_MONTHS[gm1 - 1]} ${gy1} – ${SHORT_EN_MONTHS[gm2 - 1]} ${gy2}`;
}

/**
 * Returns a Saka week range label for two Date endpoints.
 * e.g. "१ चैत्र – ७ चैत्र १९४७"
 */
export function sakaWeekRange(start: Date, end: Date): string {
  const fmt = (d: Date) => {
    const m = d.getMonth() + 1;
    return `${d.getFullYear()}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const s = gregorianToSaka(fmt(start));
  const e = gregorianToSaka(fmt(end));
  if (s.month === e.month && s.year === e.year) {
    return `${toSakaDigits(s.day)} – ${toSakaDigits(e.day)} ${SAKA_MONTHS[e.month - 1]} ${toSakaDigits(e.year)}`;
  }
  return `${toSakaDigits(s.day)} ${SAKA_MONTHS[s.month - 1]} – ${toSakaDigits(e.day)} ${SAKA_MONTHS[e.month - 1]} ${toSakaDigits(e.year)}`;
}

/**
 * Saka week number within the Saka year.
 * Weeks start on Monday (ISO-like convention, matching the Monday-first grid).
 * Week 1 starts on the Monday on or before Chaitra 1.
 */
export function sakaWeekNumber(sY: number, sM: number, sD: number): number {
  // Gregorian date of Chaitra 1 (month 1, day 1)
  const yearStartStr = sakaToGregorian(sY, 1, 1);
  const yearStart = new Date(yearStartStr + 'T00:00:00');
  // Gregorian date of the target day
  const targetStr = sakaToGregorian(sY, sM, sD);
  const target = new Date(targetStr + 'T00:00:00');
  const doy = Math.round((target.getTime() - yearStart.getTime()) / 86400000);
  // Monday-first offset: (getDay()+6)%7 gives Mon=0…Sun=6
  const dow1 = (yearStart.getDay() + 6) % 7;
  return Math.floor((doy + dow1) / 7) + 1;
}


// ---------------------------------------------------------------------------
// Validation test cases (commented out):
// toSakaDisplay('2025-03-22') → "१ चैत्र १९४७"
// gregorianToSaka('2025-03-22') → { year: 1947, month: 1, day: 1 }
// sakaToGregorian(1947, 1, 1) → "2025-03-22"
// sakaDaysInMonth(1947, 1) → 30  (2025 is not a Gregorian leap year)
// sakaDaysInMonth(1947, 2) → 31  (Vaisakha always 31)
// sakaDaysInMonth(1947, 7) → 30  (Asvina always 30)
// gregorianToSaka('2024-03-21') → { year: 1946, month: 1, day: 1 }  (2024 is Gregorian leap)
// ---------------------------------------------------------------------------
