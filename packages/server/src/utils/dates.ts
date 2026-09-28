/**
 * Shared server-side date math utilities.
 */

// ---------------------------------------------------------------------------
// Hijri (Qamari) conversion — arithmetic/tabular Kuwaiti algorithm
// ---------------------------------------------------------------------------

const HIJRI_MONTHS = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني',
  'جمادى الأولى', 'جمادى الثانية', 'رجب', 'شعبان',
  'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];

/** Gregorian → Julian Day Number */
function gToJD(gy: number, gm: number, gd: number): number {
  let y = gy, m = gm;
  if (m <= 2) { y--; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + gd + B - 1524;
}

/** JDN → Hijri { hY, hM, hD } (Kuwaiti algorithm) */
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

/** Convert Western digits to Eastern Arabic-Indic digits (٠١٢…) */
function toArabicDigits(n: number | string): string {
  return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

/**
 * Format a YYYY-MM-DD string as a Hijri display string.
 * e.g. "2025-07-10" → "١٤ محرم ١٤٤٧"
 */
export function formatHijri(dateStr: string): string {
  try {
    const [gy, gm, gd] = dateStr.split('-').map(Number);
    const { hY, hM, hD } = jdToH(gToJD(gy, gm, gd));
    return `${toArabicDigits(hD)} ${HIJRI_MONTHS[hM - 1]} ${toArabicDigits(hY)}`;
  } catch {
    return dateStr;
  }
}

/**
 * Format a Date object as a Hijri display string including weekday (Persian names for fa lang).
 * e.g. "یکشنبه، ١٤ محرم ١٤٤٧"
 */
export function formatHijriWithWeekday(date: Date, lang = 'fa'): string {
  const faWeekdays = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
  const arWeekdays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const weekdays = lang === 'ar' ? arWeekdays : faWeekdays;
  const { hY, hM, hD } = jdToH(gToJD(date.getFullYear(), date.getMonth() + 1, date.getDate()));
  return `${weekdays[date.getDay()]}، ${toArabicDigits(hD)} ${HIJRI_MONTHS[hM - 1]} ${toArabicDigits(hY)}`;
}

/**
 * Format a week range (start/end as YYYY-MM-DD) in Hijri.
 * e.g. "٨ – ١٤ محرم ١٤٤٧"
 */
export function formatHijriWeekRange(weekStartStr: string, weekEndStr: string): string {
  const [sy, sm, sd] = weekStartStr.split('-').map(Number);
  const [ey, em, ed] = weekEndStr.split('-').map(Number);
  const s = jdToH(gToJD(sy, sm, sd));
  const e = jdToH(gToJD(ey, em, ed));
  if (s.hM === e.hM && s.hY === e.hY) {
    return `${toArabicDigits(s.hD)} – ${toArabicDigits(e.hD)} ${HIJRI_MONTHS[e.hM - 1]} ${toArabicDigits(e.hY)}`;
  }
  return `${toArabicDigits(s.hD)} ${HIJRI_MONTHS[s.hM - 1]} – ${toArabicDigits(e.hD)} ${HIJRI_MONTHS[e.hM - 1]} ${toArabicDigits(e.hY)}`;
}

/**
 * Format an ISO datetime string as a Hijri date+time.
 * e.g. "2025-07-10T14:30:00" → "١٤ محرم ١٤٤٧، ساعت ۱۴:۳۰"
 */
export function formatHijriDateTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const { hY, hM, hD } = jdToH(gToJD(d.getFullYear(), d.getMonth() + 1, d.getDate()));
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${toArabicDigits(hD)} ${HIJRI_MONTHS[hM - 1]} ${toArabicDigits(hY)}، ساعت ${toArabicDigits(h)}:${toArabicDigits(min)}`;
  } catch {
    return isoStr;
  }
}

// ---------------------------------------------------------------------------
// Jalali (Shamsi) conversion — dependency-free algorithm
// ---------------------------------------------------------------------------

const PERSIAN_MONTHS = [
  'فروردین','اردیبهشت','خرداد',
  'تیر','مرداد','شهریور',
  'مهر','آبان','آذر',
  'دی','بهمن','اسفند',
];

/** Convert Gregorian date to Jalali { jy, jm, jd }. Verbatim port of jalaali-js. */
function toJalali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  // Normalize year relative to the Jalali epoch base (1600 CE = 979 AH)
  const gyNorm = gy <= 1600 ? gy - 621 : gy - 1600;

  // Cumulative day-of-year offsets for each Gregorian month (non-leap)
  const gDM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gDayNo = 365 * gyNorm
    + Math.floor((gyNorm + 3) / 4)
    - Math.floor((gyNorm + 99) / 100)
    + Math.floor((gyNorm + 399) / 400);
  gDayNo += gDM[gm - 1] + gd;
  // Add leap-day if past February in a Gregorian leap year
  if (gm > 2 && (gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0))) gDayNo++;

  // Offset to Jalali epoch
  let jDayNo = gDayNo - 79;

  const jNP = Math.floor(jDayNo / 12053);
  jDayNo %= 12053;

  let jy = 979 + 33 * jNP + 4 * Math.floor(jDayNo / 1461);
  jDayNo %= 1461;

  if (jDayNo >= 366) {
    jy += Math.floor((jDayNo - 1) / 365);
    jDayNo = (jDayNo - 1) % 365;
  }

  const jMonthDays = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
  let jm = 0;
  for (; jm < 11 && jDayNo >= jMonthDays[jm]; jm++) jDayNo -= jMonthDays[jm];
  return { jy, jm: jm + 1, jd: jDayNo + 1 };
}

/** Convert Western digits to Persian/Arabic-Indic digits. */
function toPersianDigits(n: number | string): string {
  return String(n).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

/**
 * Format a YYYY-MM-DD string as a Jalali display string.
 * e.g. "2025-07-10" → "۱۹ تیر ۱۴۰۴"
 */
export function formatJalali(dateStr: string): string {
  try {
    const [gy, gm, gd] = dateStr.split('-').map(Number);
    const { jy, jm, jd } = toJalali(gy, gm, gd);
    return `${toPersianDigits(jd)} ${PERSIAN_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
  } catch {
    return dateStr;
  }
}

/**
 * Format a Date object as a Jalali display string including weekday.
 * e.g. "چهارشنبه، ۱۹ تیر ۱۴۰۴"
 */
export function formatJalaliWithWeekday(date: Date): string {
  const weekdays = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنج‌شنبه','جمعه','شنبه'];
  const { jy, jm, jd } = toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return `${weekdays[date.getDay()]}، ${toPersianDigits(jd)} ${PERSIAN_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
}

/**
 * Format a week range (start/end as YYYY-MM-DD) in Jalali.
 * e.g. "۱۴ تیر – ۲۰ تیر ۱۴۰۴"
 */
export function formatJalaliWeekRange(weekStartStr: string, weekEndStr: string): string {
  const [my, mm, md] = weekStartStr.split('-').map(Number);
  const [sy, sm, sd] = weekEndStr.split('-').map(Number);
  const s = toJalali(my, mm, md);
  const e = toJalali(sy, sm, sd);
  const startLabel = `${toPersianDigits(s.jd)} ${PERSIAN_MONTHS[s.jm - 1]}`;
  const endLabel = `${toPersianDigits(e.jd)} ${PERSIAN_MONTHS[e.jm - 1]} ${toPersianDigits(e.jy)}`;
  return `${startLabel} – ${endLabel}`;
}

/**
 * Format an ISO datetime string as a Jalali date+time.
 * e.g. "2025-07-10T14:30:00" → "۱۹ تیر ۱۴۰۴، ساعت ۱۴:۳۰"
 */
export function formatJalaliDateTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const { jy, jm, jd } = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${toPersianDigits(jd)} ${PERSIAN_MONTHS[jm - 1]} ${toPersianDigits(jy)}، ساعت ${toPersianDigits(h)}:${toPersianDigits(min)}`;
  } catch {
    return isoStr;
  }
}

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
 * Returns the ISO date strings for the Monday–Sunday bounds of the current week (Gregorian/Western).
 */
export function getWeekBounds(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon…
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

/**
 * Returns the ISO date strings for the Saturday–Friday bounds of the current week (Shamsi/Persian).
 * Saturday = getDay() 6, Friday = getDay() 5.
 */
export function getShamsiWeekBounds(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  // Days since Saturday: Sat=0, Sun=1, Mon=2, Tue=3, Wed=4, Thu=5, Fri=6
  const daysSinceSat = day === 6 ? 0 : day + 1;
  const start = new Date(now);
  start.setDate(now.getDate() - daysSinceSat);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

/**
 * Returns how many days of the current Shamsi week (Sat–Fri) have elapsed so far, including today.
 * Returns 1–7.
 */
export function getShamsiDaysSoFar(): number {
  const day = new Date().getDay();
  // Sat=1, Sun=2, Mon=3, Tue=4, Wed=5, Thu=6, Fri=7
  return day === 6 ? 1 : day + 2;
}
