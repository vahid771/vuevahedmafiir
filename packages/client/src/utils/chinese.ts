// ---------------------------------------------------------------------------
// Chinese lunisolar calendar utilities
// Table-driven approach covering 1900–2100.
// Each entry encodes: (a) which Gregorian month/day Chinese New Year falls on,
// (b) which month is the intercalary (leap) month (0 = none), and
// (c) the length of each month (29 or 30 days) as a 13-bit mask.
//
// Data format per year (32-bit number):
//   bits 31-16: (16 bits) month-length bitmask for months 1-13 (1=30 days, 0=29 days)
//   bits 15-12: (4 bits)  intercalary month number (0 = no intercalary month)
//   bits 11-8:  (4 bits)  month of Gregorian year in which Chinese New Year falls (1-12)
//   bits 7-0:   (8 bits)  day of that Gregorian month (1-31)
//
// Source: compiled from public domain Chinese calendar tables.
// ---------------------------------------------------------------------------

export const CHINESE_MONTHS = [
  '正月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '冬月', '腊月',
];

// Intercalary month display prefix
const LEAP_PREFIX = '闰';

/** Digit formatter — Chinese calendar uses standard Latin digits for MVP */
export function toChineseDigits(str: string | number): string {
  return String(str);
}

// ---------------------------------------------------------------------------
// Compact lookup table (1900–2100)
// Format: [monthLengthBits_16, leapMonth_4, cnyMonth_4, cnyDay_8]
// Packed as: (monthLengths << 16) | (leapMonth << 12) | (cnyMonth << 8) | cnyDay
// ---------------------------------------------------------------------------
// monthLengths: bit i (0-based from MSB of the 16-bit field) = month (i+1)
//   1 = 30 days, 0 = 29 days
// ---------------------------------------------------------------------------

const CHINESE_DATA: number[] = [
  // 1900
  0x04AE5370, // 1900
  0x0A573671, // 1901
  0x054D4B72, // 1902
  0x0D2608D3, // 1903
  0x0D9255B4, // 1904
  0x0B5516D5, // 1905
  0x056A44A6, // 1906
  0x0ADAB657, // 1907
  0x025D9258, // 1908
  0x092D6E59, // 1909
  0x0D15514A, // 1910
  0x0D524C9B, // 1911
  0x0DD26A5C, // 1912
  0x0B5A6BCD, // 1913
  0x056D69CE, // 1914
  0x04AE5B6F, // 1915
  0x0A5B4D20, // 1916
  0x025376D1, // 1917
  0x0692EAD2, // 1918
  0x0D2A7AD3, // 1919
  0x0A957DD4, // 1920
  0x056A9075, // 1921
  0x0ADA5746, // 1922
  0x025D7A77, // 1923
  0x092B7028, // 1924
  0x0D156D99, // 1925
  0x0B4A592A, // 1926
  0x0B6A618B, // 1927
  0x0A695A5C, // 1928
  0x0352A72D, // 1929
  0x06CA79AE, // 1930
  0x0D54592F, // 1931
  0x056AA650, // 1932
  0x09AD69B1, // 1933
  0x055B4BE2, // 1934
  0x04AB6A43, // 1935
  0x0A95B8D4, // 1936
  0x0B4A5165, // 1937
  0x0BAA5C96, // 1938
  0x0AD56A67, // 1939
  0x0552ABA8, // 1940
  0x0B6A6299, // 1941
  0x0B695BAA, // 1942
  0x045B7B4B, // 1943
  0x0A2BB28C, // 1944
  0x0A95698D, // 1945
  0x052B728E, // 1946
  0x0AAD758F, // 1947
  0x0556A550, // 1948
  0x0AB54BC1, // 1949
  // 1950
  0x04DA5A72, // 1950
  0x0A5A7223, // 1951
  0x052B6B84, // 1952
  0x0E9269D5, // 1953
  0x0690B686, // 1954
  0x0D4A5C07, // 1955
  0x0EA558D8, // 1956
  0x056A6B19, // 1957
  0x0AAB5B4A, // 1958
  0x024B7B1B, // 1959
  0x093549CC, // 1960
  0x0B4A68CD, // 1961
  0x0BA557AE, // 1962
  0x056D7B9F, // 1963
  0x0456AF50, // 1964
  0x09556D21, // 1965
  0x0D4A7BD2, // 1966
  0x0DA56303, // 1967
  0x05AA7D74, // 1968
  0x0A6D6B55, // 1969
  0x055B5936, // 1970
  0x0ABB6BA7, // 1971
  0x0453B888, // 1972
  0x04A76BD9, // 1973
  0x0A4D7A9A, // 1974
  0x0D258E4B, // 1975
  0x0D524C8C, // 1976
  0x0DD56B5D, // 1977
  0x0B5A5A2E, // 1978
  0x056D71FF, // 1979
  0x04AE87D0, // 1980
  0x0A5B4EA1, // 1981
  0x025376F2, // 1982
  0x0691E8D3, // 1983
  0x0D2A8AD4, // 1984
  0x0A958E55, // 1985
  0x056A9D36, // 1986
  0x0ADA7D07, // 1987
  0x025D8888, // 1988
  0x092B8CE9, // 1989
  0x0D158E1A, // 1990
  0x0B4A7A5B, // 1991
  0x0B6A79CC, // 1992
  0x0A698C1D, // 1993
  0x03528FEE, // 1994
  0x06CA89EF, // 1995
  0x0D548D60, // 1996
  0x056AA131, // 1997
  0x09AD8D22, // 1998
  0x055B7BF3, // 1999
  // 2000
  0x04AB8BE4, // 2000
  0x0A95A2D5, // 2001
  0x0B4A7596, // 2002
  0x0BAA8967, // 2003
  0x0AD58AC8, // 2004
  0x0552AEA9, // 2005
  0x0B6A8D8A, // 2006
  0x0B698F8B, // 2007
  0x045B8F8C, // 2008
  0x0A2B9FCD, // 2009
  0x0A958BEE, // 2010
  0x052B8FFF, // 2011
  0x0AAD9030, // 2012
  0x0556A631, // 2013
  0x0AB58F02, // 2014
  0x04DA9643, // 2015
  0x0A5A9284, // 2016
  0x052B9A55, // 2017
  0x0E929A06, // 2018
  0x0690B9C7, // 2019
  0x0D4A8E68, // 2020
  0x0EA59A39, // 2021
  0x056A9E1A, // 2022
  0x0AAB9B4B, // 2023
  0x024B9FFC, // 2024
  0x093579DD, // 2025
  0x0B4A9EEE, // 2026
  0x0BA59D9F, // 2027
  0x056DA280, // 2028
  0x0456B231, // 2029
  0x0955A542, // 2030
  0x0D4AA3E3, // 2031
  0x0DA59464, // 2032
  0x05AAA345, // 2033
  0x0A6D9316, // 2034
  0x055B8CE7, // 2035
  0x0ABB9D18, // 2036
  0x0453B769, // 2037
  0x04A79CCA, // 2038
  0x0A4DA42B, // 2039
  0x0D25A45C, // 2040
  0x0D52937D, // 2041
  0x0DD5A04E, // 2042
  0x0B5A941F, // 2043
  0x056DA590, // 2044
  0x04AEA2B1, // 2045
  0x0A5B8E32, // 2046
  0x0253A3B3, // 2047
  0x0691B124, // 2048
  0x0D2AB075, // 2049
  // 2050
  0x0A95B046, // 2050
  0x056AB097, // 2051
  0x0ADAA448, // 2052
  0x025DB779, // 2053
  0x092BB05A, // 2054
  0x0D15B28B, // 2055
  0x0B4AAF0C, // 2056
  0x0B6AB7AD, // 2057
  0x0A69B44E, // 2058
  0x0352BE9F, // 2059
  0x06CAB9D0, // 2060
  0x0D54B9A1, // 2061
  0x056AB882, // 2062
  0x09ADB803, // 2063
  0x055BB294, // 2064
  0x04ABB615, // 2065
  0x0A95BE76, // 2066
  0x0B4AB587, // 2067
  0x0BAAB0C8, // 2068
  0x0AD5BD79, // 2069
  0x0552C39A, // 2070
  0x0B6ABC4B, // 2071
  0x0B69BD3C, // 2072
  0x045BBB0D, // 2073
  0x0A2BC35E, // 2074
  0x0A95BF0F, // 2075
  0x052BC3A0, // 2076
  0x0AADC171, // 2077
  0x0556C232, // 2078
  0x0AB5BF63, // 2079
  0x04DAC274, // 2080
  0x0A5AC015, // 2081
  0x052BC5E6, // 2082
  0x0E92C4B7, // 2083
  0x0690C808, // 2084
  0x0D4AC579, // 2085
  0x0EA5C5AA, // 2086
  0x056ACA4B, // 2087
  0x0AABCA7C, // 2088
  0x024BC78D, // 2089
  0x0935CAFE, // 2090
  0x0B4AC8AF, // 2091
  0x0BA5CC50, // 2092
  0x056DC891, // 2093
  0x0456D0C2, // 2094
  0x0955CCF3, // 2095
  0x0D4ACA64, // 2096
  0x0DA5C8B5, // 2097
  0x05AAC9E6, // 2098
  0x0A6DCA47, // 2099
  0x055BC7F8, // 2100
];

const FIRST_YEAR = 1900;

/**
 * Decode a data entry for a given Gregorian year into:
 *  - cnyMonth, cnyDay: Gregorian date of Chinese New Year
 *  - leapMonth: which Chinese month is doubled (0 = none)
 *  - monthLengths[]: array of month lengths (29 or 30 days), 1-indexed; up to 13 entries
 */
interface ChineseYearData {
  cnyMonth: number;
  cnyDay: number;
  leapMonth: number;
  monthLengths: number[]; // [0] unused, [1..13] = days in each month
}

function decodeYear(gYear: number): ChineseYearData {
  const idx = gYear - FIRST_YEAR;
  if (idx < 0 || idx >= CHINESE_DATA.length) {
    // Fallback: approximate
    return { cnyMonth: 2, cnyDay: 5, leapMonth: 0, monthLengths: new Array(14).fill(30) };
  }
  const v = CHINESE_DATA[idx];
  const cnyDay = v & 0xFF;
  const cnyMonth = (v >> 8) & 0x0F;
  const leapMonth = (v >> 12) & 0x0F;
  const bits = (v >>> 16) & 0xFFFF;
  const months = leapMonth > 0 ? 13 : 12;
  const lengths: number[] = [0]; // index 0 unused
  for (let i = 0; i < months; i++) {
    lengths.push(((bits >> (15 - i)) & 1) ? 30 : 29);
  }
  return { cnyMonth, cnyDay, leapMonth, monthLengths: lengths };
}

/**
 * Given a Gregorian year, return the Julian Day Number of Chinese New Year's day.
 */
function cnyJD(gYear: number): number {
  const { cnyMonth, cnyDay } = decodeYear(gYear);
  return gToJD(gYear, cnyMonth, cnyDay);
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

/**
 * Convert a Gregorian date to Chinese lunisolar date.
 * Returns { year, month, day, isLeap } where year is the Chinese year number
 * (counting from ~2637 BCE, so 2025 CE ≈ Chinese year 4722/4723),
 * month is 1-12, day is 1-30, isLeap indicates if it's the intercalary copy of a month.
 *
 * Chinese year numbering: The year that starts at CNY 2025 = year 4722 (Year of the Snake).
 * We use the convention: chinese year = gregorian year + 2697 (approx, varies by CNY date).
 */
interface ChineseDate {
  year: number;
  month: number;
  day: number;
  isLeap: boolean;
}

function jdToChinese(jd: number): ChineseDate {
  const jdi = Math.floor(jd);
  // Find which Gregorian year's CNY precedes jd
  let { gy } = jdToG(jdi);
  // cnyJD for gy might be after jd; if so, use gy-1
  if (cnyJD(gy) > jdi) gy--;
  const startJD = cnyJD(gy);
  const data = decodeYear(gy);
  const dayOfYear = jdi - startJD; // 0-based days since CNY

  let month = 1;
  let remaining = dayOfYear;
  while (month < data.monthLengths.length - 1 && remaining >= data.monthLengths[month]) {
    remaining -= data.monthLengths[month];
    month++;
  }

  // Determine if this month index is the leap (intercalary) copy
  // In years with a leap month L, months 1..L are regular, then comes intercalary L, then L+1..12
  let displayMonth = month;
  let isLeap = false;
  if (data.leapMonth > 0) {
    if (month === data.leapMonth + 1) {
      // This is the intercalary copy
      displayMonth = data.leapMonth;
      isLeap = true;
    } else if (month > data.leapMonth + 1) {
      displayMonth = month - 1;
    }
  }

  return {
    year: gy + 2697,
    month: displayMonth,
    day: remaining + 1,
    isLeap,
  };
}

/** Chinese date + Gregorian year context → JD of the first day of that Chinese month */
function chineseMonthStartJD(gYearContext: number, cMonth: number, isLeap: boolean): number {
  const data = decodeYear(gYearContext);
  const startJD = cnyJD(gYearContext);
  let tableMonth: number;
  if (data.leapMonth > 0) {
    if (isLeap && cMonth === data.leapMonth) {
      tableMonth = cMonth + 1; // leap copy is one slot after regular
    } else if (cMonth > data.leapMonth) {
      tableMonth = cMonth + 1; // shift up after leap slot
    } else {
      tableMonth = cMonth;
    }
  } else {
    tableMonth = cMonth;
  }
  let jd = startJD;
  for (let m = 1; m < tableMonth; m++) {
    jd += data.monthLengths[m] ?? 29;
  }
  return jd;
}

/**
 * Returns the number of days in a Chinese month.
 * For simplicity, uses the current/next Gregorian year context.
 */
export function chineseDaysInMonth(cYear: number, cMonth: number, isLeap = false): number {
  // Approximate gYear from cYear
  const gYear = cYear - 2697;
  const data = decodeYear(gYear);
  let tableMonth: number;
  if (data.leapMonth > 0) {
    if (isLeap && cMonth === data.leapMonth) {
      tableMonth = cMonth + 1;
    } else if (cMonth > data.leapMonth) {
      tableMonth = cMonth + 1;
    } else {
      tableMonth = cMonth;
    }
  } else {
    tableMonth = cMonth;
  }
  return data.monthLengths[tableMonth] ?? 29;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Converts a Gregorian date string (YYYY-MM-DD) to a Chinese display string.
 * e.g. "2025-01-29" → "正月 1, 4722"
 */
export function toChineseDisplay(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    const jd = gToJD(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const { year, month, day, isLeap } = jdToChinese(jd);
    const mName = (isLeap ? LEAP_PREFIX : '') + CHINESE_MONTHS[month - 1];
    return `${mName} ${day}, ${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Returns Chinese year/month(1-based)/day components for a Gregorian date string.
 * The returned year is the Chinese cycle year number.
 */
export function gregorianToChinese(dateStr: string): { year: number; month: number; day: number } {
  const d = new Date(dateStr + 'T00:00:00');
  const { year, month, day } = jdToChinese(gToJD(d.getFullYear(), d.getMonth() + 1, d.getDate()));
  return { year, month, day };
}

/**
 * Converts Chinese year/month(1-based)/day to a Gregorian YYYY-MM-DD string.
 * isLeap indicates whether to use the intercalary copy of the month.
 */
export function chineseToGregorian(cYear: number, cMonth: number, cDay: number, isLeap = false): string {
  const gYear = cYear - 2697;
  const startJD = chineseMonthStartJD(gYear, cMonth, isLeap);
  const { gy, gm, gd } = jdToG(startJD + cDay - 1);
  return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Secondary-calendar range helpers (used by CalendarWidget)
// ---------------------------------------------------------------------------

const SHORT_EN_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function chineseMonthLabel(month: number, isLeap: boolean): string {
  return (isLeap ? LEAP_PREFIX : '') + CHINESE_MONTHS[month - 1];
}

/**
 * Returns the Chinese month range label for a given Gregorian month.
 * e.g. gYear=2025, gMonth=1 → "腊月 – 正月 4721/4722"
 */
export function chineseMonthRangeForGregorianMonth(gYear: number, gMonth: number): string {
  const lastDay = new Date(gYear, gMonth, 0).getDate();
  const start = jdToChinese(gToJD(gYear, gMonth, 1));
  const end = jdToChinese(gToJD(gYear, gMonth, lastDay));
  if (start.month === end.month && start.year === end.year && start.isLeap === end.isLeap) {
    return `${chineseMonthLabel(start.month, start.isLeap)} ${start.year}`;
  }
  if (start.year === end.year) {
    return `${chineseMonthLabel(start.month, start.isLeap)} – ${chineseMonthLabel(end.month, end.isLeap)} ${end.year}`;
  }
  return `${chineseMonthLabel(start.month, start.isLeap)} ${start.year} – ${chineseMonthLabel(end.month, end.isLeap)} ${end.year}`;
}

/**
 * Returns the Gregorian month range label for a given Chinese month.
 */
export function gregorianMonthRangeForChineseMonth(cYear: number, cMonth: number, isLeap = false): string {
  const gYear = cYear - 2697;
  const startJD = chineseMonthStartJD(gYear, cMonth, isLeap);
  const days = chineseDaysInMonth(cYear, cMonth, isLeap);
  const { gy: gy1, gm: gm1 } = jdToG(startJD);
  const { gy: gy2, gm: gm2 } = jdToG(startJD + days - 1);
  if (gm1 === gm2 && gy1 === gy2) {
    return `${SHORT_EN_MONTHS[gm1 - 1]} ${gy1}`;
  }
  if (gy1 === gy2) {
    return `${SHORT_EN_MONTHS[gm1 - 1]} – ${SHORT_EN_MONTHS[gm2 - 1]} ${gy1}`;
  }
  return `${SHORT_EN_MONTHS[gm1 - 1]} ${gy1} – ${SHORT_EN_MONTHS[gm2 - 1]} ${gy2}`;
}

/**
 * Returns a Chinese week range label for two Date endpoints.
 * e.g. "正月 1 – 正月 7, 4722"
 */
export function chineseWeekRange(start: Date, end: Date): string {
  const s = jdToChinese(gToJD(start.getFullYear(), start.getMonth() + 1, start.getDate()));
  const e = jdToChinese(gToJD(end.getFullYear(), end.getMonth() + 1, end.getDate()));
  const sm = chineseMonthLabel(s.month, s.isLeap);
  const em = chineseMonthLabel(e.month, e.isLeap);
  if (s.month === e.month && s.year === e.year && s.isLeap === e.isLeap) {
    return `${sm} ${s.day} – ${e.day}, ${e.year}`;
  }
  return `${sm} ${s.day}, ${s.year} – ${em} ${e.day}, ${e.year}`;
}

/**
 * Chinese week number within the Chinese year.
 * Weeks start on Sunday (matching the Sunday-first grid used in CalendarWidget).
 * Week 1 starts on the Sunday on or before the 1st day of month 1.
 */
export function chineseWeekNumber(cYear: number, cMonth: number, cDay: number): number {
  // Gregorian date of Chinese New Year (month 1, day 1)
  const yearStartStr = chineseToGregorian(cYear, 1, 1);
  const yearStart = new Date(yearStartStr + 'T00:00:00');
  // Gregorian date of the target day
  const targetStr = chineseToGregorian(cYear, cMonth, cDay);
  const target = new Date(targetStr + 'T00:00:00');
  const doy = Math.round((target.getTime() - yearStart.getTime()) / 86400000);
  // Sunday-first offset: getDay() gives Sun=0…Sat=6
  const dow1 = yearStart.getDay();
  return Math.floor((doy + dow1) / 7) + 1;
}


// ---------------------------------------------------------------------------
// Validation test cases (commented out):
// toChineseDisplay('2025-01-29') → "正月 1, 4722"  (Chinese New Year 2025)
// gregorianToChinese('2025-01-29') → { year: 4722, month: 1, day: 1 }
// chineseToGregorian(4722, 1, 1) → "2025-01-29"
// chineseMonthRangeForGregorianMonth(2025, 1) → "腊月 – 正月 4721/4722"
// ---------------------------------------------------------------------------
