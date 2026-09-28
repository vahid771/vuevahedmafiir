// ---------------------------------------------------------------------------
// Hijri (Islamic/Qamari) calendar utilities
// Uses the arithmetic/tabular Hijri calendar (Kuwaiti algorithm).
// No external library required — pure math, ~30 lines of core conversion.
// ---------------------------------------------------------------------------

export const HIJRI_MONTHS = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني',
  'جمادى الأولى', 'جمادى الثانية', 'رجب', 'شعبان',
  'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];

/** Mon–Sun short Arabic day names (Monday-start, matching ISO 8601 week) */
export const SHORT_AR_DAYS = [
  'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس',
  'الجمعة', 'السبت', 'الأحد',
];

// ---------------------------------------------------------------------------
// Internal: Julian Day Number conversions
// ---------------------------------------------------------------------------

/** Gregorian date → Julian Day Number (integer) */
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

/** Julian Day Number → Hijri date (arithmetic/tabular Kuwaiti algorithm) */
function jdToH(jd: number): { hY: number; hM: number; hD: number } {
  const jdi = Math.floor(jd);
  const l = jdi - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) +
    Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 =
    l2 -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const hM = Math.floor((24 * l3) / 709);
  const hD = l3 - Math.floor((709 * hM) / 24);
  const hY = 30 * n + j - 30;
  return { hY, hM, hD };
}

/** Hijri date → Julian Day Number */
function hToJD(hY: number, hM: number, hD: number): number {
  return (
    Math.floor((11 * hY + 3) / 30) +
    354 * hY +
    30 * hM -
    Math.floor((hM - 1) / 2) +
    hD +
    1948439 -
    385
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Convert Western-Arabic digit string/number to Eastern Arabic-Indic digits */
export function toArabicDigits(str: string | number): string {
  return String(str).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

/**
 * Converts a Gregorian date string (YYYY-MM-DD) to a Hijri display string.
 * e.g. "2025-03-21" → "٢١ رمضان ١٤٤٦"
 */
export function toHijriDisplay(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    const { hY, hM, hD } = jdToH(gToJD(d.getFullYear(), d.getMonth() + 1, d.getDate()));
    return `${toArabicDigits(hD)} ${HIJRI_MONTHS[hM - 1]} ${toArabicDigits(hY)}`;
  } catch {
    return dateStr;
  }
}

/**
 * Returns Hijri year/month(1-based)/day components for a Gregorian date string.
 */
export function gregorianToHijri(dateStr: string): { year: number; month: number; day: number } {
  const d = new Date(dateStr + 'T00:00:00');
  const { hY, hM, hD } = jdToH(gToJD(d.getFullYear(), d.getMonth() + 1, d.getDate()));
  return { year: hY, month: hM, day: hD };
}

/**
 * Converts Hijri year/month(1-based)/day to a Gregorian YYYY-MM-DD string.
 */
export function hijriToGregorian(hY: number, hM: number, hD: number): string {
  const { gy, gm, gd } = jdToG(hToJD(hY, hM, hD));
  return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
}

/** Returns the number of days in a given Hijri month (hM is 1-based) */
export function hijriDaysInMonth(hY: number, hM: number): number {
  const nm = hM === 12 ? 1 : hM + 1;
  const ny = hM === 12 ? hY + 1 : hY;
  return hToJD(ny, nm, 1) - hToJD(hY, hM, 1);
}

// ---------------------------------------------------------------------------
// Secondary-calendar range helpers (used by CalendarWidget)
// ---------------------------------------------------------------------------

const SHORT_EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Returns the Hijri month range label for a given Gregorian month.
 * e.g. gYear=2025, gMonth=3 → "رمضان – شوال ١٤٤٦"
 * If the whole Gregorian month falls in one Hijri month, returns just that month + year.
 */
export function hijriMonthRangeForGregorianMonth(gYear: number, gMonth: number): string {
  const lastDay = new Date(gYear, gMonth, 0).getDate();
  const { hY: hy1, hM: hm1 } = jdToH(gToJD(gYear, gMonth, 1));
  const { hY: hy2, hM: hm2 } = jdToH(gToJD(gYear, gMonth, lastDay));
  if (hm1 === hm2 && hy1 === hy2) {
    return `${HIJRI_MONTHS[hm1 - 1]} ${toArabicDigits(hy1)}`;
  }
  if (hy1 === hy2) {
    return `${HIJRI_MONTHS[hm1 - 1]} – ${HIJRI_MONTHS[hm2 - 1]} ${toArabicDigits(hy1)}`;
  }
  return `${HIJRI_MONTHS[hm1 - 1]} ${toArabicDigits(hy1)} – ${HIJRI_MONTHS[hm2 - 1]} ${toArabicDigits(hy2)}`;
}

/**
 * Returns the Gregorian month range label for a given Hijri month.
 * e.g. hYear=1446, hMonth=9 → "Mar – Apr 2025"
 */
export function gregorianMonthRangeForHijriMonth(hYear: number, hMonth: number): string {
  const lastHDay = hijriDaysInMonth(hYear, hMonth);
  const { gy: gy1, gm: gm1 } = jdToG(hToJD(hYear, hMonth, 1));
  const { gy: gy2, gm: gm2 } = jdToG(hToJD(hYear, hMonth, lastHDay));
  if (gm1 === gm2 && gy1 === gy2) {
    return `${SHORT_EN_MONTHS[gm1 - 1]} ${gy1}`;
  }
  if (gy1 === gy2) {
    return `${SHORT_EN_MONTHS[gm1 - 1]} – ${SHORT_EN_MONTHS[gm2 - 1]} ${gy1}`;
  }
  return `${SHORT_EN_MONTHS[gm1 - 1]} ${gy1} – ${SHORT_EN_MONTHS[gm2 - 1]} ${gy2}`;
}

/**
 * Returns an Arabic Hijri week range label for two Date endpoints.
 * e.g. "١ رمضان – ٧ رمضان ١٤٤٦"
 */
export function hijriWeekRange(start: Date, end: Date): string {
  const { hY: hy1, hM: hm1, hD: hd1 } = jdToH(gToJD(start.getFullYear(), start.getMonth() + 1, start.getDate()));
  const { hY: hy2, hM: hm2, hD: hd2 } = jdToH(gToJD(end.getFullYear(), end.getMonth() + 1, end.getDate()));
  const startStr = `${toArabicDigits(hd1)} ${HIJRI_MONTHS[hm1 - 1]}`;
  const endStr = `${toArabicDigits(hd2)} ${HIJRI_MONTHS[hm2 - 1]} ${toArabicDigits(hy2)}`;
  // If same month and year, omit month from start
  if (hm1 === hm2 && hy1 === hy2) {
    return `${toArabicDigits(hd1)} – ${toArabicDigits(hd2)} ${HIJRI_MONTHS[hm2 - 1]} ${toArabicDigits(hy2)}`;
  }
  return `${startStr} – ${endStr}`;
}

/**
 * Hijri week number within the Hijri year.
 * Weeks start on Monday (ISO-like convention for qamari calendar).
 * Week 1 starts on the Monday on or before 1 Muharram.
 */
export function hijriWeekNumber(hY: number, hM: number, hD: number): number {
  // Gregorian date of 1 Muharram of hY
  const { gy, gm, gd } = jdToG(hToJD(hY, 1, 1));
  const yearStart = new Date(gy, gm - 1, gd);
  // Gregorian date of the target day
  const { gy: dy, gm: dm, gd: dd } = jdToG(hToJD(hY, hM, hD));
  const target = new Date(dy, dm - 1, dd);
  const doy = Math.round((target.getTime() - yearStart.getTime()) / 86400000);
  // Monday-first offset: (getDay()+6)%7 gives Mon=0…Sun=6
  const dow1 = (yearStart.getDay() + 6) % 7;
  return Math.floor((doy + dow1) / 7) + 1;
}

