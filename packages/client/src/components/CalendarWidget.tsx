import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toJalaali, toGregorian, jalaaliMonthLength } from 'jalaali-js';
import { useCalendar } from '../context/CalendarContext';
import { useLanguage } from '../context/LanguageContext';
import { useHolidays, getHolidayDisplayName } from '../hooks/useHolidays';
import { useWeekends } from '../hooks/useWeekends';
import {
  PERSIAN_MONTHS,
  toPersianDigits,
  jalaliDaysInMonth,
  gregorianMonthRangeForJalaliMonth,
  jalaliWeekRange,
  toJalaliDisplay,
  gregorianToJalali,
} from '../utils/jalali';
import {
  HIJRI_MONTHS,
  toArabicDigits,
  gregorianToHijri,
  hijriToGregorian,
  hijriDaysInMonth,
  hijriMonthRangeForGregorianMonth,
  gregorianMonthRangeForHijriMonth,
  hijriWeekRange,
  hijriWeekNumber,
} from '../utils/hijri';
import {
  HEBREW_MONTHS,
  toHebrewDigits,
  gregorianToHebrew,
  hebrewToGregorian,
  hebrewDaysInMonth,
  hebrewMonthRangeForGregorianMonth,
  gregorianMonthRangeForHebrewMonth,
  hebrewWeekRange,
  hebrewWeekNumber,
  toHebrewDisplay,
} from '../utils/hebrew';
import {
  CHINESE_MONTHS,
  toChineseDigits,
  gregorianToChinese,
  chineseToGregorian,
  chineseDaysInMonth,
  chineseMonthRangeForGregorianMonth,
  gregorianMonthRangeForChineseMonth,
  chineseWeekRange,
  chineseWeekNumber,
  toChineseDisplay,
} from '../utils/chinese';
import {
  SAKA_MONTHS,
  toSakaDigits,
  gregorianToSaka,
  sakaToGregorian,
  sakaDaysInMonth,
  sakaMonthRangeForGregorianMonth,
  gregorianMonthRangeForSakaMonth,
  sakaWeekRange,
  sakaWeekNumber,
  toSakaDisplay,
} from '../utils/saka';
import {
  ETHIOPIAN_MONTHS,
  toEthiopianDigits,
  gregorianToEthiopian,
  ethiopianToGregorian,
  ethiopianDaysInMonth,
  ethiopianMonthRangeForGregorianMonth,
  gregorianMonthRangeForEthiopianMonth,
  ethiopianWeekRange,
  ethiopianWeekNumber,
  toEthiopianDisplay,
} from '../utils/ethiopian';
import { getTasks, type Task } from '../api/tasks';
import type { CalendarType } from '../api/preferences';
import { getReminders, type Reminder } from '../api/reminders';
import { getDates, type ImportantDate } from '../api/dates';
import { useAuth } from '../context/AuthContext';

type View = 'month' | 'week' | 'day';

// ---------------------------------------------------------------------------
// calRangeLabel — returns the month/week/day range label for any calendar
// used to render secondary and tertiary calendar headers
// ---------------------------------------------------------------------------

function calRangeLabel(cal: CalendarType, cursor: Date, view: 'month' | 'week' | 'day', primaryMode: CalendarType, monthsShort: string[], daysShort: string[]): string {
  const ymd = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
  const gYear = cursor.getFullYear();
  const gMonth = cursor.getMonth() + 1;

  // week-start is determined by the PRIMARY calendar's orientation
  function ws() { return weekStart(cursor, primaryMode); }
  function we() { return addDays(ws(), 6); }

  if (view === 'day') {
    if (cal === 'miladi') return `${daysShort[cursor.getDay()]} ${monthsShort[cursor.getMonth()]} ${cursor.getDate()}, ${cursor.getFullYear()}`;
    if (cal === 'shamsi') return toJalaliDisplay(ymd);
    if (cal === 'qamari') {
      const { year: hy, month: hm, day: hd } = gregorianToHijri(ymd);
      return `${hd} ${HIJRI_MONTHS[hm - 1]} ${toArabicDigits(hy)}`;
    }
    if (cal === 'hebrew') return toHebrewDisplay(ymd);
    if (cal === 'chinese') return toChineseDisplay(ymd);
    if (cal === 'saka') return toSakaDisplay(ymd);
    if (cal === 'ethiopian') return toEthiopianDisplay(ymd);
  }

  if (view === 'week') {
    const s = ws(); const e = we();
    if (cal === 'miladi') return `${monthsShort[s.getMonth()]} ${s.getDate()} – ${monthsShort[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
    if (cal === 'shamsi') return jalaliWeekRange(s, e);
    if (cal === 'qamari') return hijriWeekRange(s, e);
    if (cal === 'hebrew') return hebrewWeekRange(s, e);
    if (cal === 'chinese') return chineseWeekRange(s, e);
    if (cal === 'saka') return sakaWeekRange(s, e);
    if (cal === 'ethiopian') return ethiopianWeekRange(s, e);
  }

  // month view — show what range of *this* calendar covers the primary calendar's current month.
  // For miladi as secondary, return the Gregorian date range the primary month spans.
  if (cal === 'miladi') {
    if (primaryMode === 'shamsi') {
      const { year: jy, month: jm } = gregorianToJalali(ymd);
      return gregorianMonthRangeForJalaliMonth(jy, jm);
    }
    if (primaryMode === 'qamari') {
      const { year: hy, month: hm } = gregorianToHijri(ymd);
      return gregorianMonthRangeForHijriMonth(hy, hm);
    }
    if (primaryMode === 'hebrew') {
      const { year: hy, month: hm } = gregorianToHebrew(ymd);
      return gregorianMonthRangeForHebrewMonth(hy, hm);
    }
    if (primaryMode === 'chinese') {
      const { year: cy, month: cm } = gregorianToChinese(ymd);
      return gregorianMonthRangeForChineseMonth(cy, cm);
    }
    if (primaryMode === 'saka') {
      const { year: sy, month: sm } = gregorianToSaka(ymd);
      return gregorianMonthRangeForSakaMonth(sy, sm);
    }
    if (primaryMode === 'ethiopian') {
      const { year: ey, month: em } = gregorianToEthiopian(ymd);
      return gregorianMonthRangeForEthiopianMonth(ey, em);
    }
    // primary is also miladi — just show the month name (they're the same grid)
    return cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  if (cal === 'shamsi') {
    const { year: jy, month: jm } = gregorianToJalali(ymd);
    return gregorianMonthRangeForJalaliMonth(jy, jm);
  }
  if (cal === 'qamari') {
    return hijriMonthRangeForGregorianMonth(gYear, gMonth);
  }
  if (cal === 'hebrew') {
    return hebrewMonthRangeForGregorianMonth(gYear, gMonth);
  }
  if (cal === 'chinese') {
    return chineseMonthRangeForGregorianMonth(gYear, gMonth);
  }
  if (cal === 'saka') {
    return sakaMonthRangeForGregorianMonth(gYear, gMonth);
  }
  // ethiopian
  return ethiopianMonthRangeForGregorianMonth(gYear, gMonth);
}

/**
 * Returns localised short weekday names for Mon-first calendars (miladi, saka, qamari).
 * Uses the i18n `settings.days` array (Sun=0…Sat=6) and reorders to Mon-first.
 */
function useMonFirstDays(): string[] {
  const { t } = useTranslation();
  const raw = t('settings.days', { returnObjects: true }) as string[];
  // raw is [Sun, Mon, Tue, Wed, Thu, Fri, Sat] → reorder to Mon-first
  return [raw[1], raw[2], raw[3], raw[4], raw[5], raw[6], raw[0]];
}

/** Returns i18n short weekday names (Sun=0…Sat=6) in the active language. */
function useDaysShort(): string[] {
  const { t } = useTranslation();
  return t('settings.days', { returnObjects: true }) as string[];
}

/** Returns i18n short month names (Jan=0…Dec=11) in the active language. */
function useMonthsShort(): string[] {
  const { t } = useTranslation();
  return t('settings.months', { returnObjects: true }) as string[];
}

/** Returns i18n long month names (January=0…December=11) in the active language. */
function useMonthsLong(): string[] {
  const { t } = useTranslation();
  return t('settings.monthsLong', { returnObjects: true }) as string[];
}

/** Returns i18n long weekday names (Sun=0…Sat=6) in the active language. */
function useDaysLong(): string[] {
  const { t } = useTranslation();
  return t('settings.daysLong', { returnObjects: true }) as string[];
}

/**
 * Returns localised month names for all non-Gregorian calendar systems.
 * Falls back to the native-script arrays when the active language has no translation.
 */
function useCalendarMonths(): Record<string, string[]> {
  const { t } = useTranslation();
  const i18n = t('settings.calendarMonths', { returnObjects: true, defaultValue: null }) as Record<string, string[]> | null;
  return {
    shamsi:    i18n?.shamsi    ?? PERSIAN_MONTHS,
    qamari:    i18n?.qamari    ?? HIJRI_MONTHS,
    hebrew:    i18n?.hebrew    ?? HEBREW_MONTHS,
    chinese:   i18n?.chinese   ?? CHINESE_MONTHS,
    saka:      i18n?.saka      ?? SAKA_MONTHS,
    ethiopian: i18n?.ethiopian ?? ETHIOPIAN_MONTHS,
  };
}
// Week-start offsets: 0 = Sunday-first, 1 = Monday-first, 6 = Saturday-first
// Hebrew: Sunday-first → getDay() as-is (Sun=0)
// Chinese: Sunday-first
// Saka: Monday-first (same as miladi/qamari)
// Ethiopian: Sunday-first

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalEvent {
  id: string;
  kind: 'task' | 'reminder' | 'date';
  title: string;
  date: string;       // YYYY-MM-DD
  time?: string;      // HH:MM (reminders only)
  done?: boolean;
  priority?: 'low' | 'medium' | 'high';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Language-aware digit renderer for the primary calendar number
// ---------------------------------------------------------------------------

/** Convert n to the digit script of the active UI language. */
function toLangDigits(n: string | number, lang: string): string {
  if (lang === 'fa') return toPersianDigits(n);
  if (lang === 'ar') return toArabicDigits(n);
  if (lang === 'hi') return toSakaDigits(n); // Devanagari: same Unicode block ०-९
  return String(n);
}

// ---------------------------------------------------------------------------
// Per-cell day-number formatter for any calendar system
// ---------------------------------------------------------------------------

function calDayNumber(cal: CalendarType, d: Date): string {
  if (cal === 'miladi') return String(d.getDate());
  if (cal === 'shamsi') {
    const { jd } = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return toPersianDigits(jd);
  }
  if (cal === 'qamari') {
    const { day } = gregorianToHijri(toYMD(d));
    return toArabicDigits(day);
  }
  if (cal === 'hebrew') {
    const { day } = gregorianToHebrew(toYMD(d));
    return toHebrewDigits(day);
  }
  if (cal === 'chinese') {
    const { day } = gregorianToChinese(toYMD(d));
    return toChineseDigits(day);
  }
  if (cal === 'saka') {
    const { day } = gregorianToSaka(toYMD(d));
    return toSakaDigits(day);
  }
  // ethiopian
  const { day } = gregorianToEthiopian(toYMD(d));
  return toEthiopianDigits(day);
}

/** Returns the start of the week for the given date and calendar mode. */
function weekStart(d: Date, calMode: CalendarType): Date {
  const dow = d.getDay();
  if (calMode === 'shamsi') {
    // Shamsi: week starts Saturday (6)
    const offset = dow === 6 ? 0 : (dow + 1) % 7;
    return addDays(d, -offset);
  }
  if (calMode === 'hebrew' || calMode === 'chinese' || calMode === 'ethiopian') {
    // Sunday-first: offset = getDay() (Sun=0 → offset 0, Mon=1 → offset 1, …)
    return addDays(d, -dow);
  }
  // miladi, qamari, saka: Monday-first (ISO 8601)
  return addDays(d, -(( dow + 6) % 7));
}

// ---------------------------------------------------------------------------
// Event pill colours
// ---------------------------------------------------------------------------

const KIND_STYLE: Record<CalEvent['kind'], string> = {
  task:     'bg-blue-100 text-blue-700 border-blue-200',
  reminder: 'bg-amber-100 text-amber-700 border-amber-200',
  date:     'bg-purple-100 text-purple-700 border-purple-200',
};

const KIND_DOT: Record<CalEvent['kind'], string> = {
  task:     'bg-blue-500',
  reminder: 'bg-amber-500',
  date:     'bg-purple-500',
};

const KIND_ICON: Record<CalEvent['kind'], string> = {
  task:     '✓',
  reminder: '🔔',
  date:     '★',
};

// ---------------------------------------------------------------------------
// EventPill — used in week + day views
// ---------------------------------------------------------------------------

function EventPill({ ev }: { ev: CalEvent }) {
  return (
    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border leading-tight truncate ${KIND_STYLE[ev.kind]} ${ev.done ? 'opacity-50 line-through' : ''}`}>
      <span className="shrink-0 text-[10px]">{KIND_ICON[ev.kind]}</span>
      <span className="truncate">{ev.title}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Week-number helpers
// ---------------------------------------------------------------------------

/** ISO 8601 week number for a Gregorian date. */
function isoWeekNumber(d: Date): number {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number; Sunday = 7
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Jalali week number within the Jalali year.
 * Week 1 starts on the first Shanbe (Saturday) on or before 1 Farvardin.
 * Each week runs Sat→Fri.
 */
function jalaliWeekNumber(jy: number, jm: number, jd: number): number {
  // Day-of-year in Jalali calendar (1-based)
  const doyPerMonth = [0, 31, 62, 93, 124, 155, 186, 216, 246, 276, 306, 336];
  const doy = doyPerMonth[jm - 1] + jd; // 1..365/366
  // Find what day-of-week Farvardin 1 is (0=Sun..6=Sat)
  const { gy, gm, gd } = toGregorian(jy, 1, 1);
  const dow1 = new Date(gy, gm - 1, gd).getDay(); // 0=Sun..6=Sat
  // Offset from nearest preceding Saturday (6)
  const offsetToSat = (dow1 - 6 + 7) % 7; // days before Farvardin 1 that the week started
  return Math.floor((doy + offsetToSat - 1) / 7) + 1;
}

// ---------------------------------------------------------------------------
// Month view
// ---------------------------------------------------------------------------

function MonthGrid({ cursor, calMode, secondaryCal, tertiaryCal, lang, events, holidayNames, weekendSet, onDayClick, onWeekClick }: {
  cursor: Date;
  calMode: CalendarType;
  secondaryCal: CalendarType | null;
  tertiaryCal: CalendarType | null;
  lang: string;
  events: CalEvent[];
  holidayNames: Map<string, string>;
  weekendSet: Set<number>;
  onDayClick: (d: Date) => void;
  onWeekClick: (d: Date) => void;
}) {
  const now = today();
  const monFirstDays = useMonFirstDays();
  const daysShort = useDaysShort(); // [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
  // Sat-first for shamsi
  const satFirstDays = [daysShort[6], daysShort[0], daysShort[1], daysShort[2], daysShort[3], daysShort[4], daysShort[5]];
  // Sun-first for hebrew, chinese, ethiopian
  const sunFirstDays = [...daysShort];

  // Index events by YYYY-MM-DD
  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [events]);

  if (calMode === 'qamari') {
    const { year: hy, month: hm } = gregorianToHijri(toYMD(cursor));
    const daysInMonth = hijriDaysInMonth(hy, hm);
    const firstGregStr = hijriToGregorian(hy, hm, 1);
    const firstGregDate = new Date(firstGregStr + 'T00:00:00');
    const firstDow = (firstGregDate.getDay() + 6) % 7; // Mon=0 … Sun=6
    const cells: (number | null)[] = [
      ...Array(firstDow).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    const qamariRows: (number | null)[][] = [];
    for (let r = 0; r < cells.length; r += 7) qamariRows.push(cells.slice(r, r + 7));

    return (
      <div className="select-none" dir="rtl">
        <div className="grid grid-cols-[repeat(7,1fr)_1.5rem] mb-1">
          {monFirstDays.map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
          ))}
          <div className="text-center text-[9px] font-medium text-gray-300 py-1">W</div>
        </div>
        <div className="space-y-1">
          {qamariRows.map((row, ri) => {
            const firstHDay = row.find(d => d !== null)!;
            const repGregStr = hijriToGregorian(hy, hm, firstHDay);
            const repDate = new Date(repGregStr + 'T00:00:00');
            const wn = hijriWeekNumber(hy, hm, firstHDay);
            return (
              <div key={ri} className="grid grid-cols-[repeat(7,1fr)_1.5rem] gap-1">
                {row.map((hDay, ci) => {
                  if (hDay === null) return <div key={ci} className="min-h-[60px]" />;
                  const gregStr = hijriToGregorian(hy, hm, hDay);
                  const cellDate = new Date(gregStr + 'T00:00:00');
                  const isToday = isSameDay(cellDate, now);
                  const ymd = toYMD(cellDate);
                  const dayEvents = byDay.get(ymd) ?? [];
                  const isWeekend = weekendSet.has(cellDate.getDay());
                  const holidayName = holidayNames.get(ymd);
                  return (
                    <div
                      key={ci}
                      onClick={() => onDayClick(cellDate)}
                      className={`min-h-[60px] p-0.5 rounded-lg border cursor-pointer overflow-hidden
                        ${isToday
                          ? 'bg-blue-50 border-blue-300'
                          : holidayName
                            ? 'bg-red-50 border-red-300'
                            : isWeekend
                              ? 'bg-red-50 border-red-200'
                              : 'border-gray-100 hover:border-gray-300'}`}
                    >
                      <div className="flex flex-col items-center mb-0.5">
                        <span className={`w-6 h-6 flex items-center justify-center text-xs font-medium
                          ${isToday ? 'bg-blue-600 text-white rounded-md' : isWeekend ? 'text-red-600 hover:bg-red-100 rounded-full' : 'text-gray-700 hover:bg-gray-100 rounded-full'}`}>
                          {toLangDigits(hDay, lang)}
                        </span>
                        {(secondaryCal || tertiaryCal) && (
                          <div className="flex w-full justify-between px-0.5 mt-0.5">
                            <span className={`text-[9px] leading-none ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>{secondaryCal && secondaryCal !== 'qamari' ? calDayNumber(secondaryCal, cellDate) : ''}</span>
                            <span className={`text-[9px] leading-none ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>{tertiaryCal && tertiaryCal !== 'qamari' ? calDayNumber(tertiaryCal, cellDate) : ''}</span>
                          </div>
                        )}
                      </div>
                      {holidayName && (
                        <p className="text-[8px] leading-tight text-red-500 text-center truncate px-0.5 mb-0.5 w-full" title={holidayName}>
                          {holidayName}
                        </p>
                      )}
                      {dayEvents.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 justify-center px-0.5">
                          {dayEvents.slice(0, 3).map(ev => (
                            <span key={ev.id} title={ev.title} className={`w-1.5 h-1.5 rounded-full shrink-0 ${KIND_DOT[ev.kind]} ${ev.done ? 'opacity-40' : ''}`} />
                          ))}
                          {dayEvents.length > 3 && (
                            <span className="text-[9px] text-gray-400 leading-none">+{dayEvents.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  onClick={() => onWeekClick(repDate)}
                  className="flex items-center justify-center text-[9px] font-semibold text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title={`أسبوع ${toArabicDigits(wn)}`}
                >
                  {toArabicDigits(wn)}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }


  // ── Hebrew month grid (RTL, Sunday-first) ─────────────────────────────────
  if (calMode === 'hebrew') {
    const { year: hYear, month: hMonth } = gregorianToHebrew(toYMD(cursor));
    const daysInHMonth = hebrewDaysInMonth(hYear, hMonth);
    const firstGregStr = hebrewToGregorian(hYear, hMonth, 1);
    const firstGregDate = new Date(firstGregStr + 'T00:00:00');
    const firstDow = firstGregDate.getDay(); // Sun=0 … Sat=6 (Sunday-first)
    const cells: (number | null)[] = [
      ...Array(firstDow).fill(null),
      ...Array.from({ length: daysInHMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    const hebrewRows: (number | null)[][] = [];
    for (let r = 0; r < cells.length; r += 7) hebrewRows.push(cells.slice(r, r + 7));

    return (
      <div className="select-none" dir="rtl">
        <div className="grid grid-cols-[repeat(7,1fr)_1.5rem] mb-1">
          {sunFirstDays.map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
          ))}
          <div className="text-center text-[9px] font-medium text-gray-300 py-1">W</div>
        </div>
        <div className="space-y-1">
          {hebrewRows.map((row, ri) => {
            const firstHDay = row.find(d => d !== null)!;
            const repGregStr = hebrewToGregorian(hYear, hMonth, firstHDay);
            const repDate = new Date(repGregStr + 'T00:00:00');
            const wn = hebrewWeekNumber(hYear, hMonth, firstHDay);
            return (
              <div key={ri} className="grid grid-cols-[repeat(7,1fr)_1.5rem] gap-1">
                {row.map((hDay, ci) => {
                  if (hDay === null) return <div key={ci} className="min-h-[60px]" />;
                  const gregStr = hebrewToGregorian(hYear, hMonth, hDay);
                  const cellDate = new Date(gregStr + 'T00:00:00');
                  const isToday = isSameDay(cellDate, now);
                  const ymd = toYMD(cellDate);
                  const dayEvents = byDay.get(ymd) ?? [];
                  const isWeekend = weekendSet.has(cellDate.getDay());
                  const holidayName = holidayNames.get(ymd);
                  return (
                    <div
                      key={ci}
                      onClick={() => onDayClick(cellDate)}
                      className={`min-h-[60px] p-0.5 rounded-lg border cursor-pointer overflow-hidden
                        ${isToday
                          ? 'bg-blue-50 border-blue-300'
                          : holidayName
                            ? 'bg-red-50 border-red-300'
                            : isWeekend
                              ? 'bg-red-50 border-red-200'
                              : 'border-gray-100 hover:border-gray-300'}`}
                    >
                      <div className="flex flex-col items-center mb-0.5">
                        <span className={`w-6 h-6 flex items-center justify-center text-xs font-medium
                          ${isToday ? 'bg-blue-600 text-white rounded-md' : isWeekend ? 'text-red-600 hover:bg-red-100 rounded-full' : 'text-gray-700 hover:bg-gray-100 rounded-full'}`}>
                          {toLangDigits(hDay, lang)}
                        </span>
                        {(secondaryCal || tertiaryCal) && (
                          <div className="flex w-full justify-between px-0.5 mt-0.5">
                            <span className={`text-[9px] leading-none ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>{secondaryCal && secondaryCal !== 'hebrew' ? calDayNumber(secondaryCal, cellDate) : ''}</span>
                            <span className={`text-[9px] leading-none ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>{tertiaryCal && tertiaryCal !== 'hebrew' ? calDayNumber(tertiaryCal, cellDate) : ''}</span>
                          </div>
                        )}
                      </div>
                      {holidayName && (
                        <p className="text-[8px] leading-tight text-red-500 text-center truncate px-0.5 mb-0.5 w-full" title={holidayName}>
                          {holidayName}
                        </p>
                      )}
                      {dayEvents.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 justify-center px-0.5">
                          {dayEvents.slice(0, 3).map(ev => (
                            <span key={ev.id} title={ev.title} className={`w-1.5 h-1.5 rounded-full shrink-0 ${KIND_DOT[ev.kind]} ${ev.done ? 'opacity-40' : ''}`} />
                          ))}
                          {dayEvents.length > 3 && (
                            <span className="text-[9px] text-gray-400 leading-none">+{dayEvents.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  onClick={() => onWeekClick(repDate)}
                  className="flex items-center justify-center text-[9px] font-semibold text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title={`שבוע ${toHebrewDigits(wn)}`}
                >
                  {toHebrewDigits(wn)}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Chinese month grid (LTR, Sunday-first) ────────────────────────────────
  if (calMode === 'chinese') {
    const { year: cYear, month: cMonth } = gregorianToChinese(toYMD(cursor));
    const daysInCMonth = chineseDaysInMonth(cYear, cMonth);
    const firstGregStr = chineseToGregorian(cYear, cMonth, 1);
    const firstGregDate = new Date(firstGregStr + 'T00:00:00');
    const firstDow = firstGregDate.getDay(); // Sun=0 … Sat=6
    const cells: (number | null)[] = [
      ...Array(firstDow).fill(null),
      ...Array.from({ length: daysInCMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    const chineseRows: (number | null)[][] = [];
    for (let r = 0; r < cells.length; r += 7) chineseRows.push(cells.slice(r, r + 7));

    return (
      <div className="select-none">
        <div className="grid grid-cols-[1.5rem_repeat(7,1fr)] mb-1">
          <div className="text-center text-[9px] font-medium text-gray-300 py-1">W</div>
          {sunFirstDays.map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
          ))}
        </div>
        <div className="space-y-1">
          {chineseRows.map((row, ri) => {
            const firstCDay = row.find(d => d !== null)!;
            const repGregStr = chineseToGregorian(cYear, cMonth, firstCDay);
            const repDate = new Date(repGregStr + 'T00:00:00');
            const wn = chineseWeekNumber(cYear, cMonth, firstCDay);
            return (
              <div key={ri} className="grid grid-cols-[1.5rem_repeat(7,1fr)] gap-1">
                <button
                  onClick={() => onWeekClick(repDate)}
                  className="flex items-center justify-center text-[9px] font-semibold text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title={`第${toChineseDigits(wn)}周`}
                >
                  {toChineseDigits(wn)}
                </button>
                {row.map((cDay, ci) => {
                  if (cDay === null) return <div key={ci} className="min-h-[60px]" />;
                  const gregStr = chineseToGregorian(cYear, cMonth, cDay);
                  const cellDate = new Date(gregStr + 'T00:00:00');
                  const isToday = isSameDay(cellDate, now);
                  const ymd = toYMD(cellDate);
                  const dayEvents = byDay.get(ymd) ?? [];
                  const isWeekend = weekendSet.has(cellDate.getDay());
                  const holidayName = holidayNames.get(ymd);
                  return (
                    <div
                      key={ci}
                      onClick={() => onDayClick(cellDate)}
                      className={`min-h-[60px] p-0.5 rounded-lg border cursor-pointer overflow-hidden
                        ${isToday
                          ? 'bg-blue-50 border-blue-300'
                          : holidayName
                            ? 'bg-red-50 border-red-300'
                            : isWeekend
                              ? 'bg-red-50 border-red-200'
                              : 'border-gray-100 hover:border-gray-300'}`}
                    >
                      <div className="flex flex-col items-center mb-0.5">
                        <span className={`w-6 h-6 flex items-center justify-center text-xs font-medium
                          ${isToday ? 'bg-blue-600 text-white rounded-md' : isWeekend ? 'text-red-600 hover:bg-red-100 rounded-full' : 'text-gray-700 hover:bg-gray-100 rounded-full'}`}>
                          {toLangDigits(cDay, lang)}
                        </span>
                        {(secondaryCal || tertiaryCal) && (
                          <div className="flex w-full justify-between px-0.5 mt-0.5">
                            <span className={`text-[9px] leading-none ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>{secondaryCal && secondaryCal !== 'chinese' ? calDayNumber(secondaryCal, cellDate) : ''}</span>
                            <span className={`text-[9px] leading-none ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>{tertiaryCal && tertiaryCal !== 'chinese' ? calDayNumber(tertiaryCal, cellDate) : ''}</span>
                          </div>
                        )}
                      </div>
                      {holidayName && (
                        <p className="text-[8px] leading-tight text-red-500 text-center truncate px-0.5 mb-0.5 w-full" title={holidayName}>
                          {holidayName}
                        </p>
                      )}
                      {dayEvents.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 justify-center px-0.5">
                          {dayEvents.slice(0, 3).map(ev => (
                            <span key={ev.id} title={ev.title} className={`w-1.5 h-1.5 rounded-full shrink-0 ${KIND_DOT[ev.kind]} ${ev.done ? 'opacity-40' : ''}`} />
                          ))}
                          {dayEvents.length > 3 && (
                            <span className="text-[9px] text-gray-400 leading-none">+{dayEvents.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Saka month grid (LTR, Monday-first) ──────────────────────────────────
  if (calMode === 'saka') {
    const { year: sYear, month: sMonth } = gregorianToSaka(toYMD(cursor));
    const daysInSMonth = sakaDaysInMonth(sYear, sMonth);
    const firstGregStr = sakaToGregorian(sYear, sMonth, 1);
    const firstGregDate = new Date(firstGregStr + 'T00:00:00');
    const firstDow = (firstGregDate.getDay() + 6) % 7; // Mon=0 … Sun=6
    const cells: (number | null)[] = [
      ...Array(firstDow).fill(null),
      ...Array.from({ length: daysInSMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    const sakaRows: (number | null)[][] = [];
    for (let r = 0; r < cells.length; r += 7) sakaRows.push(cells.slice(r, r + 7));

    return (
      <div className="select-none">
        <div className="grid grid-cols-[1.5rem_repeat(7,1fr)] mb-1">
          <div className="text-center text-[9px] font-medium text-gray-300 py-1">W</div>
          {monFirstDays.map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
          ))}
        </div>
        <div className="space-y-1">
          {sakaRows.map((row, ri) => {
            const firstSDay = row.find(d => d !== null)!;
            const repGregStr = sakaToGregorian(sYear, sMonth, firstSDay);
            const repDate = new Date(repGregStr + 'T00:00:00');
            const wn = sakaWeekNumber(sYear, sMonth, firstSDay);
            return (
              <div key={ri} className="grid grid-cols-[1.5rem_repeat(7,1fr)] gap-1">
                <button
                  onClick={() => onWeekClick(repDate)}
                  className="flex items-center justify-center text-[9px] font-semibold text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title={`सप्ताह ${toSakaDigits(wn)}`}
                >
                  {toSakaDigits(wn)}
                </button>
                {row.map((sDay, ci) => {
                  if (sDay === null) return <div key={ci} className="min-h-[60px]" />;
                  const gregStr = sakaToGregorian(sYear, sMonth, sDay);
                  const cellDate = new Date(gregStr + 'T00:00:00');
                  const isToday = isSameDay(cellDate, now);
                  const ymd = toYMD(cellDate);
                  const dayEvents = byDay.get(ymd) ?? [];
                  const isWeekend = weekendSet.has(cellDate.getDay());
                  const holidayName = holidayNames.get(ymd);
                  return (
                    <div
                      key={ci}
                      onClick={() => onDayClick(cellDate)}
                      className={`min-h-[60px] p-0.5 rounded-lg border cursor-pointer overflow-hidden
                        ${isToday
                          ? 'bg-blue-50 border-blue-300'
                          : holidayName
                            ? 'bg-red-50 border-red-300'
                            : isWeekend
                              ? 'bg-red-50 border-red-200'
                              : 'border-gray-100 hover:border-gray-300'}`}
                    >
                      <div className="flex flex-col items-center mb-0.5">
                        <span className={`w-6 h-6 flex items-center justify-center text-xs font-medium
                          ${isToday ? 'bg-blue-600 text-white rounded-md' : isWeekend ? 'text-red-600 hover:bg-red-100 rounded-full' : 'text-gray-700 hover:bg-gray-100 rounded-full'}`}>
                          {toLangDigits(sDay, lang)}
                        </span>
                        {(secondaryCal || tertiaryCal) && (
                          <div className="flex w-full justify-between px-0.5 mt-0.5">
                            <span className={`text-[9px] leading-none ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>{secondaryCal && secondaryCal !== 'saka' ? calDayNumber(secondaryCal, cellDate) : ''}</span>
                            <span className={`text-[9px] leading-none ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>{tertiaryCal && tertiaryCal !== 'saka' ? calDayNumber(tertiaryCal, cellDate) : ''}</span>
                          </div>
                        )}
                      </div>
                      {holidayName && (
                        <p className="text-[8px] leading-tight text-red-500 text-center truncate px-0.5 mb-0.5 w-full" title={holidayName}>
                          {holidayName}
                        </p>
                      )}
                      {dayEvents.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 justify-center px-0.5">
                          {dayEvents.slice(0, 3).map(ev => (
                            <span key={ev.id} title={ev.title} className={`w-1.5 h-1.5 rounded-full shrink-0 ${KIND_DOT[ev.kind]} ${ev.done ? 'opacity-40' : ''}`} />
                          ))}
                          {dayEvents.length > 3 && (
                            <span className="text-[9px] text-gray-400 leading-none">+{dayEvents.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Ethiopian month grid (LTR, Sunday-first) ──────────────────────────────
  if (calMode === 'ethiopian') {
    const { year: eYear, month: eMonth } = gregorianToEthiopian(toYMD(cursor));
    const daysInEMonth = ethiopianDaysInMonth(eYear, eMonth);
    const firstGregStr = ethiopianToGregorian(eYear, eMonth, 1);
    const firstGregDate = new Date(firstGregStr + 'T00:00:00');
    const firstDow = firstGregDate.getDay(); // Sun=0 … Sat=6
    const cells: (number | null)[] = [
      ...Array(firstDow).fill(null),
      ...Array.from({ length: daysInEMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    const ethiopianRows: (number | null)[][] = [];
    for (let r = 0; r < cells.length; r += 7) ethiopianRows.push(cells.slice(r, r + 7));

    return (
      <div className="select-none">
        <div className="grid grid-cols-[1.5rem_repeat(7,1fr)] mb-1">
          <div className="text-center text-[9px] font-medium text-gray-300 py-1">W</div>
          {sunFirstDays.map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
          ))}
        </div>
        <div className="space-y-1">
          {ethiopianRows.map((row, ri) => {
            const firstEDay = row.find(d => d !== null)!;
            const repGregStr = ethiopianToGregorian(eYear, eMonth, firstEDay);
            const repDate = new Date(repGregStr + 'T00:00:00');
            const wn = ethiopianWeekNumber(eYear, eMonth, firstEDay);
            return (
              <div key={ri} className="grid grid-cols-[1.5rem_repeat(7,1fr)] gap-1">
                <button
                  onClick={() => onWeekClick(repDate)}
                  className="flex items-center justify-center text-[9px] font-semibold text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title={`ሳምንት ${toEthiopianDigits(wn)}`}
                >
                  {toEthiopianDigits(wn)}
                </button>
                {row.map((eDay, ci) => {
                  if (eDay === null) return <div key={ci} className="min-h-[60px]" />;
                  const gregStr = ethiopianToGregorian(eYear, eMonth, eDay);
                  const cellDate = new Date(gregStr + 'T00:00:00');
                  const isToday = isSameDay(cellDate, now);
                  const ymd = toYMD(cellDate);
                  const dayEvents = byDay.get(ymd) ?? [];
                  const isWeekend = weekendSet.has(cellDate.getDay());
                  const holidayName = holidayNames.get(ymd);
                  return (
                    <div
                      key={ci}
                      onClick={() => onDayClick(cellDate)}
                      className={`min-h-[60px] p-0.5 rounded-lg border cursor-pointer overflow-hidden
                        ${isToday
                          ? 'bg-blue-50 border-blue-300'
                          : holidayName
                            ? 'bg-red-50 border-red-300'
                            : isWeekend
                              ? 'bg-red-50 border-red-200'
                              : 'border-gray-100 hover:border-gray-300'}`}
                    >
                      <div className="flex flex-col items-center mb-0.5">
                        <span className={`w-6 h-6 flex items-center justify-center text-xs font-medium
                          ${isToday ? 'bg-blue-600 text-white rounded-md' : isWeekend ? 'text-red-600 hover:bg-red-100 rounded-full' : 'text-gray-700 hover:bg-gray-100 rounded-full'}`}>
                          {toLangDigits(eDay, lang)}
                        </span>
                        {(secondaryCal || tertiaryCal) && (
                          <div className="flex w-full justify-between px-0.5 mt-0.5">
                            <span className={`text-[9px] leading-none ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>{secondaryCal && secondaryCal !== 'ethiopian' ? calDayNumber(secondaryCal, cellDate) : ''}</span>
                            <span className={`text-[9px] leading-none ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>{tertiaryCal && tertiaryCal !== 'ethiopian' ? calDayNumber(tertiaryCal, cellDate) : ''}</span>
                          </div>
                        )}
                      </div>
                      {holidayName && (
                        <p className="text-[8px] leading-tight text-red-500 text-center truncate px-0.5 mb-0.5 w-full" title={holidayName}>
                          {holidayName}
                        </p>
                      )}
                      {dayEvents.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 justify-center px-0.5">
                          {dayEvents.slice(0, 3).map(ev => (
                            <span key={ev.id} title={ev.title} className={`w-1.5 h-1.5 rounded-full shrink-0 ${KIND_DOT[ev.kind]} ${ev.done ? 'opacity-40' : ''}`} />
                          ))}
                          {dayEvents.length > 3 && (
                            <span className="text-[9px] text-gray-400 leading-none">+{dayEvents.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }


  if (calMode === 'miladi') {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0 … Sun=6
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [
      ...Array(firstDow).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (number | null)[][] = [];
    for (let r = 0; r < cells.length; r += 7) rows.push(cells.slice(r, r + 7));

    return (
      <div className="select-none">
        <div className="grid grid-cols-[1.5rem_repeat(7,1fr)] mb-1">
          <div className="text-center text-[9px] font-medium text-gray-300 py-1">W</div>
          {monFirstDays.map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
          ))}
        </div>
        <div className="space-y-1">
          {rows.map((row, ri) => {
            const firstDay = row.find(d => d !== null)!;
            const repDate = new Date(year, month, firstDay);
            const wn = isoWeekNumber(repDate);
            return (
              <div key={ri} className="grid grid-cols-[1.5rem_repeat(7,1fr)] gap-1">
                <button
                  onClick={() => onWeekClick(repDate)}
                  className="flex items-center justify-center text-[9px] font-semibold text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title={`Week ${wn}`}
                >
                  {wn}
                </button>
                {row.map((day, ci) => {
                  if (day === null) return <div key={ci} className="min-h-[60px]" />;
                  const cellDate = new Date(year, month, day);
                  const isToday = isSameDay(cellDate, now);
                  const ymd = toYMD(cellDate);
                  const dayEvents = byDay.get(ymd) ?? [];
                  const isWeekend = weekendSet.has(cellDate.getDay());
                  const holidayName = holidayNames.get(ymd);
                  return (
                    <div
                      key={ci}
                      onClick={() => onDayClick(cellDate)}
                      className={`min-h-[60px] p-0.5 rounded-lg border cursor-pointer overflow-hidden
                        ${isToday
                          ? 'bg-blue-50 border-blue-300'
                          : holidayName
                            ? 'bg-red-50 border-red-300'
                            : isWeekend
                              ? 'bg-red-50 border-red-200'
                              : 'border-gray-100 hover:border-gray-300'}`}
                    >
                      <div className="flex flex-col items-center mb-0.5">
                        <span className={`w-6 h-6 flex items-center justify-center text-xs font-medium
                          ${isToday ? 'bg-blue-600 text-white rounded-md' : isWeekend ? 'text-red-600 hover:bg-red-100 rounded-full' : 'text-gray-700 hover:bg-gray-100 rounded-full'}`}>
                          {toLangDigits(day, lang)}
                        </span>
                        {(secondaryCal || tertiaryCal) && (
                          <div className="flex w-full justify-between px-0.5 mt-0.5">
                            <span className={`text-[9px] leading-none ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>{secondaryCal && secondaryCal !== 'miladi' ? calDayNumber(secondaryCal, cellDate) : ''}</span>
                            <span className={`text-[9px] leading-none ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>{tertiaryCal && tertiaryCal !== 'miladi' ? calDayNumber(tertiaryCal, cellDate) : ''}</span>
                          </div>
                        )}
                      </div>
                      {holidayName && (
                        <p className="text-[8px] leading-tight text-red-500 text-center truncate px-0.5 mb-0.5 w-full" title={holidayName}>
                          {holidayName}
                        </p>
                      )}
                      {dayEvents.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 justify-center px-0.5">
                          {dayEvents.slice(0, 3).map(ev => (
                            <span key={ev.id} title={ev.title} className={`w-1.5 h-1.5 rounded-full shrink-0 ${KIND_DOT[ev.kind]} ${ev.done ? 'opacity-40' : ''}`} />
                          ))}
                          {dayEvents.length > 3 && (
                            <span className="text-[9px] text-gray-400 leading-none">+{dayEvents.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Shamsi
  const { jy, jm } = toJalaali(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
  const daysInJMonth = jalaliDaysInMonth(jy, jm);
  const { gy: fy, gm: fm, gd: fd } = toGregorian(jy, jm, 1);
  const firstDow = new Date(fy, fm - 1, fd).getDay();
  const offset = firstDow === 6 ? 0 : (firstDow + 1) % 7;
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInJMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const { jy: ty, jm: tm, jd: td } = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const todayIsInMonth = ty === jy && tm === jm;
  const shamsiRows: (number | null)[][] = [];
  for (let r = 0; r < cells.length; r += 7) shamsiRows.push(cells.slice(r, r + 7));

  return (
    <div className="select-none" dir="rtl">
      <div className="grid grid-cols-[repeat(7,1fr)_1.5rem] mb-1">
        {satFirstDays.map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
        <div className="text-center text-[9px] font-medium text-gray-300 py-1">ه</div>
      </div>
      <div className="space-y-1">
        {shamsiRows.map((row, ri) => {
          const firstJDay = row.find(d => d !== null)!;
          const { gy: ry, gm: rgm, gd: rgd } = toGregorian(jy, jm, firstJDay);
          const repDate = new Date(ry, rgm - 1, rgd);
          const wn = jalaliWeekNumber(jy, jm, firstJDay);
          return (
            <div key={ri} className="grid grid-cols-[repeat(7,1fr)_1.5rem] gap-1">
              {row.map((jDay, ci) => {
                if (jDay === null) return <div key={ci} className="min-h-[60px]" />;
                const isToday = todayIsInMonth && td === jDay;
                const { gy, gm: gmonth, gd } = toGregorian(jy, jm, jDay);
                const ymd = `${gy}-${String(gmonth).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
                const cellDate = new Date(gy, gmonth - 1, gd);
                const isWeekend = weekendSet.has(cellDate.getDay());
                const holidayName = holidayNames.get(ymd);
                const dayEvents = byDay.get(ymd) ?? [];
                return (
                  <div
                    key={ci}
                    onClick={() => onDayClick(cellDate)}
                    className={`min-h-[60px] p-0.5 rounded-lg border cursor-pointer overflow-hidden
                      ${isToday
                        ? 'bg-blue-50 border-blue-300'
                        : holidayName
                          ? 'bg-red-50 border-red-300'
                          : isWeekend
                            ? 'bg-red-50 border-red-200'
                            : 'border-gray-100 hover:border-gray-300'}`}
                  >
                    <div className="flex flex-col items-center mb-0.5">
                      <span className={`w-6 h-6 flex items-center justify-center text-xs font-medium
                        ${isToday ? 'bg-blue-600 text-white rounded-md' : isWeekend ? 'text-red-600 hover:bg-red-100 rounded-full' : 'text-gray-700 hover:bg-gray-100 rounded-full'}`}>
                        {toLangDigits(jDay, lang)}
                      </span>
                      {(secondaryCal || tertiaryCal) && (
                        <div className="flex w-full justify-between px-0.5 mt-0.5">
                          <span className={`text-[9px] leading-none ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>{secondaryCal && secondaryCal !== 'shamsi' ? calDayNumber(secondaryCal, cellDate) : ''}</span>
                          <span className={`text-[9px] leading-none ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>{tertiaryCal && tertiaryCal !== 'shamsi' ? calDayNumber(tertiaryCal, cellDate) : ''}</span>
                        </div>
                      )}
                    </div>
                    {holidayName && (
                      <p className="text-[8px] leading-tight text-red-500 text-center truncate px-0.5 mb-0.5 w-full" title={holidayName}>
                        {holidayName}
                      </p>
                    )}
                    {dayEvents.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 justify-center px-0.5">
                        {dayEvents.slice(0, 3).map(ev => (
                          <span key={ev.id} title={ev.title} className={`w-1.5 h-1.5 rounded-full shrink-0 ${KIND_DOT[ev.kind]} ${ev.done ? 'opacity-40' : ''}`} />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[9px] text-gray-400 leading-none">+{dayEvents.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                onClick={() => onWeekClick(repDate)}
                className="flex items-center justify-center text-[9px] font-semibold text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title={`هفته ${toPersianDigits(wn)}`}
              >
                {toPersianDigits(wn)}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Week view
// ---------------------------------------------------------------------------

function WeekPanel({ cursor, calMode, secondaryCal, tertiaryCal, lang, events, holidayNames, weekendSet, onDayClick }: {
  cursor: Date;
  calMode: CalendarType;
  secondaryCal: CalendarType | null;
  tertiaryCal: CalendarType | null;
  lang: string;
  events: CalEvent[];
  holidayNames: Map<string, string>;
  weekendSet: Set<number>;
  onDayClick: (d: Date) => void;
}) {
  const now = today();
  const daysShort = useDaysShort(); // [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
  const ws = weekStart(cursor, calMode);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  // Build day-name array ordered by this calendar's week-start, indexed by Date.getDay()
  // shamsi: Sat-first → [Sat,Sun,Mon,Tue,Wed,Thu,Fri] = [6,0,1,2,3,4,5]
  // hebrew/chinese/ethiopian: Sun-first → [Sun…Sat] = [0,1,2,3,4,5,6]
  // miladi/saka/qamari: Mon-first → [Mon…Sun] = [1,2,3,4,5,6,0]
  const dayNames: string[] = calMode === 'shamsi'
    ? [daysShort[6], daysShort[0], daysShort[1], daysShort[2], daysShort[3], daysShort[4], daysShort[5]]
    : (calMode === 'hebrew' || calMode === 'chinese' || calMode === 'ethiopian')
      ? [...daysShort]
      : [daysShort[1], daysShort[2], daysShort[3], daysShort[4], daysShort[5], daysShort[6], daysShort[0]];

  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [events]);

  return (
    <div className="select-none" dir={calMode === 'hebrew' ? 'rtl' : calMode === 'shamsi' ? 'rtl' : calMode === 'qamari' ? 'rtl' : 'ltr'}>
      {/* Day headers */}
      <div className="grid grid-cols-7 border border-gray-200 rounded-t-lg overflow-hidden">
        {days.map((d, i) => {
          const isToday = isSameDay(d, now);
          const label = toLangDigits(calDayNumber(calMode, d), lang);
          // nameIdx: index into the dayNames array for this day
          const nameIdx = calMode === 'shamsi'
            ? (d.getDay() === 6 ? 0 : d.getDay() + 1)               // Sat-first
            : (calMode === 'hebrew' || calMode === 'chinese' || calMode === 'ethiopian')
              ? d.getDay()                                            // Sun-first (Sun=0)
              : (d.getDay() + 6) % 7;                                // Mon-first (Mon=0)
          const ymd = toYMD(d);
          const isWeekend = weekendSet.has(d.getDay());
          const holidayName = holidayNames.get(ymd);
          return (
            <div
              key={i}
              onClick={() => onDayClick(d)}
              className={`flex flex-col items-center py-2 border-r last:border-r-0 border-gray-200 cursor-pointer
                ${isToday ? 'bg-blue-50' : isWeekend ? 'bg-red-50 hover:bg-red-100' : 'bg-white hover:bg-gray-50'}`}
            >
              <span className={`text-xs mb-1 ${isWeekend && !isToday ? 'text-red-400' : 'text-gray-400'}`}>{dayNames[nameIdx]}</span>
              <span className={`w-6 h-6 flex items-center justify-center text-sm font-medium
                ${isToday ? 'bg-blue-600 text-white rounded-md' : isWeekend ? 'text-red-600 rounded-full' : 'text-gray-700 rounded-full'}`}>
                {label}
              </span>
              {(secondaryCal || tertiaryCal) && (
                <div className="flex w-full justify-between px-1 mt-1">
                  <span className={`text-[9px] leading-none ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>
                    {secondaryCal && secondaryCal !== calMode ? calDayNumber(secondaryCal, d) : ''}
                  </span>
                  <span className={`text-[9px] leading-none ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>
                    {tertiaryCal && tertiaryCal !== calMode ? calDayNumber(tertiaryCal, d) : ''}
                  </span>
                </div>
              )}
              {holidayName && (
                <p className="text-[8px] leading-tight text-red-500 text-center truncate px-0.5 mt-0.5 w-full" title={holidayName}>
                  {holidayName}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Event rows per day */}
      <div className="grid grid-cols-7 border-x border-b border-gray-200 rounded-b-lg overflow-hidden min-h-[80px]">
        {days.map((d, i) => {
          const isToday = isSameDay(d, now);
          const isWeekend = weekendSet.has(d.getDay());
          const ymd = toYMD(d);
          const dayEvents = byDay.get(ymd) ?? [];
          return (
            <div key={i} className={`p-1 border-r last:border-r-0 border-gray-100 space-y-0.5
              ${isToday ? 'bg-blue-50' : isWeekend ? 'bg-red-50' : ''}`}>
              {dayEvents.map(ev => <EventPill key={ev.id} ev={ev} />)}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 px-1">
        {(['task', 'reminder', 'date'] as CalEvent['kind'][]).map(k => (
          <div key={k} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${KIND_DOT[k]}`} />
            <span className="text-xs text-gray-400 capitalize">{k === 'date' ? 'important date' : k}</span>
          </div>
        ))}
        {weekendSet.size > 0 && (
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-red-100 border border-red-200" />
            <span className="text-xs text-gray-400">
              {calMode === 'shamsi' ? 'آخر هفته' : calMode === 'qamari' ? 'آخر الأسبوع' : calMode === 'hebrew' ? 'שבת/ראשון' : 'Weekend'}
            </span>
          </div>
        )}
        {holidayNames.size > 0 && (
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-xs text-gray-400">
              {calMode === 'shamsi' ? 'تعطیل رسمی' : calMode === 'qamari' ? 'عطلة رسمية' : 'Holiday'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day view
// ---------------------------------------------------------------------------

function DayPanel({ cursor, calMode, lang, events, holidayNames, weekendSet }: {
  cursor: Date;
  calMode: CalendarType;
  lang: string;
  events: CalEvent[];
  holidayNames: Map<string, string>;
  weekendSet: Set<number>;
}) {
  const now = today();
  const isToday = isSameDay(cursor, now);
  const currentHour = new Date().getHours();
  const ymd = toYMD(cursor);

  const dayEvents = useMemo(
    () => events.filter(ev => ev.date === ymd),
    [events, ymd],
  );

  // Split into timed (reminders with HH:MM) and all-day
  const timedEvents = dayEvents.filter(ev => ev.time);
  const allDayEvents = dayEvents.filter(ev => !ev.time);

  // Group timed by hour
  const byHour = useMemo(() => {
    const map = new Map<number, CalEvent[]>();
    for (const ev of timedEvents) {
      const h = parseInt(ev.time!.split(':')[0], 10);
      const list = map.get(h) ?? [];
      list.push(ev);
      map.set(h, list);
    }
    return map;
  }, [timedEvents]);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const isWeekend = weekendSet.has(cursor.getDay());
  const holidayName = holidayNames.get(ymd);

  const isRtl = calMode === 'shamsi' || calMode === 'qamari' || calMode === 'hebrew';
  return (
    <div className="select-none" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Holiday / weekend banner */}
      {(holidayName || isWeekend) && (
        <div className={`mb-2 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5
          ${holidayName ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-red-50 text-red-400 border border-red-100'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
          {holidayName ?? (calMode === 'shamsi' ? 'آخر هفته' : calMode === 'qamari' ? 'آخر الأسبوع' : 'Weekend')}
        </div>
      )}
      {/* All-day events strip */}
      {allDayEvents.length > 0 && (
        <div className="mb-2 p-2 border border-gray-200 rounded-lg bg-gray-50">
          <div className="text-xs text-gray-400 mb-1 font-medium">
            {calMode === 'shamsi' ? 'تمام روز' : calMode === 'qamari' ? 'طوال اليوم' : 'All day'}
          </div>
          <div className="flex flex-wrap gap-1">
            {allDayEvents.map(ev => <EventPill key={ev.id} ev={ev} />)}
          </div>
        </div>
      )}

      {/* Hourly grid */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {hours.map(h => {
          const hh = String(h).padStart(2, '0');
          const zero = lang === 'fa' ? '۰۰' : lang === 'ar' ? '٠٠' : lang === 'hi' ? '००' : '00';
          const label = `${toLangDigits(hh, lang)}:${zero}`;
          const hourEvents = byHour.get(h) ?? [];
          const isCurrentHour = h === currentHour && isToday;
          return (
            <div key={h} className={`flex items-start border-b last:border-b-0 border-gray-100 min-h-[32px]
              ${isCurrentHour ? 'bg-blue-50' : ''}`}>
              <span className={`w-14 shrink-0 text-xs px-2 py-2 border-r border-gray-100 leading-tight
                ${isCurrentHour ? 'text-blue-500 font-medium' : 'text-gray-400'}`}>
                {label}
              </span>
              <div className="flex-1 py-1 px-1.5 flex flex-wrap gap-1">
                {hourEvents.map(ev => <EventPill key={ev.id} ev={ev} />)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 px-1">
        {(['task', 'reminder', 'date'] as CalEvent['kind'][]).map(k => (
          <div key={k} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${KIND_DOT[k]}`} />
            <span className="text-xs text-gray-400 capitalize">{k === 'date' ? 'important date' : k}</span>
          </div>
        ))}
        {weekendSet.size > 0 && (
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-red-100 border border-red-200" />
            <span className="text-xs text-gray-400">
              {calMode === 'shamsi' ? 'آخر هفته' : calMode === 'qamari' ? 'آخر الأسبوع' : 'Weekend'}
            </span>
          </div>
        )}
        {holidayNames.size > 0 && (
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-xs text-gray-400">
              {calMode === 'shamsi' ? 'تعطیل رسمی' : calMode === 'qamari' ? 'عطلة رسمية' : 'Holiday'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main CalendarWidget
// ---------------------------------------------------------------------------

export default function CalendarWidget() {
  const { t } = useTranslation();
  const { calendar, country, secondaryCalendar, tertiaryCalendar } = useCalendar();
  const { lang } = useLanguage();
  const { token } = useAuth();
  const calMode = calendar as CalendarType;
  const monthsShort  = useMonthsShort();
  const monthsLong   = useMonthsLong();
  const daysLong     = useDaysLong();
  const calMonths    = useCalendarMonths();
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState<Date>(today);
  const [events, setEvents] = useState<CalEvent[]>([]);

  // Holiday data — always fetch the adjacent year too, because:
  // • Shamsi months routinely span two Gregorian years (e.g. Dey straddles Dec/Jan)
  // • Week view can show days from the previous month
  const cursorYear = cursor.getFullYear();
  const holidaysThisYear  = useHolidays(country, cursorYear, token);
  const holidaysPrevYear  = useHolidays(country, cursorYear - 1, token);
  const holidaysNextYear  = useHolidays(country, cursorYear + 1, token);
  const allHolidays = useMemo(
    () => [...holidaysPrevYear, ...holidaysThisYear, ...holidaysNextYear],
    [holidaysPrevYear, holidaysThisYear, holidaysNextYear],
  );

  // Build O(1) lookup: date → display name (language-aware)
  const holidayNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of allHolidays) {
      if (!h.hidden) m.set(h.date, getHolidayDisplayName(h, lang));
    }
    return m;
  }, [allHolidays, lang]);

  const weekendDays = useWeekends(country, token);
  const weekendSet = useMemo(() => new Set(weekendDays), [weekendDays]);

  // Fetch all data once on mount
  useEffect(() => {
    if (!token) return;
    Promise.all([
      getTasks(token).catch(() => [] as Task[]),
      getReminders(token).catch(() => [] as Reminder[]),
      getDates(token).catch(() => [] as ImportantDate[]),
    ]).then(([tasks, reminders, dates]) => {
      const evs: CalEvent[] = [];

      for (const t of tasks) {
        if (t.due_date) {
          evs.push({
            id: `task-${t.id}`,
            kind: 'task',
            title: t.title,
            date: t.due_date.slice(0, 10),
            done: t.status === 'done',
            priority: t.priority,
          });
        }
      }

      for (const r of reminders) {
        const dt = new Date(r.remind_at);
        if (!isNaN(dt.getTime())) {
          evs.push({
            id: `reminder-${r.id}`,
            kind: 'reminder',
            title: r.title,
            date: toYMD(dt),
            time: `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`,
            done: !!r.done,
          });
        }
      }

      for (const d of dates) {
        const dateStr = (d.next_occurrence || d.date).slice(0, 10);
        evs.push({
          id: `date-${d.id}`,
          kind: 'date',
          title: d.title,
          date: dateStr,
        });
      }

      setEvents(evs);
    });
  }, [token]);

  // ── Navigation ──────────────────────────────────────────────────────────
  function navigate(dir: 1 | -1) {
    if (view === 'day') { setCursor(c => addDays(c, dir)); return; }
    if (view === 'week') { setCursor(c => addDays(c, dir * 7)); return; }
    if (calMode === 'miladi') {
      setCursor(c => { const d = new Date(c); d.setDate(1); d.setMonth(d.getMonth() + dir); return d; });
    } else if (calMode === 'shamsi') {
      setCursor(c => {
        const { jy, jm } = toJalaali(c.getFullYear(), c.getMonth() + 1, c.getDate());
        let nm = jm + dir; let ny = jy;
        if (nm < 1) { nm = 12; ny--; }
        if (nm > 12) { nm = 1; ny++; }
        const safeDays = jalaaliMonthLength(ny, nm);
        const { gy, gm: gmonth, gd } = toGregorian(ny, nm, Math.min(1, safeDays));
        return new Date(gy, gmonth - 1, gd);
      });
    } else if (calMode === 'qamari') {
      setCursor(c => {
        const { year: hy, month: hm } = gregorianToHijri(toYMD(c));
        let nm = hm + dir; let ny = hy;
        if (nm < 1) { nm = 12; ny--; }
        if (nm > 12) { nm = 1; ny++; }
        const gStr = hijriToGregorian(ny, nm, 1);
        const [gy, gmonth, gd] = gStr.split('-').map(Number);
        return new Date(gy, gmonth - 1, gd);
      });
    } else if (calMode === 'hebrew') {
      setCursor(c => {
        const { year: hy, month: hm } = gregorianToHebrew(toYMD(c));
        let nm = hm + dir; let ny = hy;
        if (nm < 1) { nm = 12; ny--; }
        if (nm > 12) { nm = 1; ny++; }
        const gStr = hebrewToGregorian(ny, nm, 1);
        const [gy, gmonth, gd] = gStr.split('-').map(Number);
        return new Date(gy, gmonth - 1, gd);
      });
    } else if (calMode === 'chinese') {
      setCursor(c => {
        const { year: cy, month: cm } = gregorianToChinese(toYMD(c));
        let nm = cm + dir; let ny = cy;
        if (nm < 1) { nm = 12; ny--; }
        if (nm > 12) { nm = 1; ny++; }
        const gStr = chineseToGregorian(ny, nm, 1);
        const [gy, gmonth, gd] = gStr.split('-').map(Number);
        return new Date(gy, gmonth - 1, gd);
      });
    } else if (calMode === 'saka') {
      setCursor(c => {
        const { year: sy, month: sm } = gregorianToSaka(toYMD(c));
        let nm = sm + dir; let ny = sy;
        if (nm < 1) { nm = 12; ny--; }
        if (nm > 12) { nm = 1; ny++; }
        const gStr = sakaToGregorian(ny, nm, 1);
        const [gy, gmonth, gd] = gStr.split('-').map(Number);
        return new Date(gy, gmonth - 1, gd);
      });
    } else if (calMode === 'ethiopian') {
      setCursor(c => {
        const { year: ey, month: em } = gregorianToEthiopian(toYMD(c));
        let nm = em + dir; let ny = ey;
        if (nm < 1) { nm = 13; ny--; }
        if (nm > 13) { nm = 1; ny++; }
        const gStr = ethiopianToGregorian(ny, nm, 1);
        const [gy, gmonth, gd] = gStr.split('-').map(Number);
        return new Date(gy, gmonth - 1, gd);
      });
    }
  }

  // ── Primary title ────────────────────────────────────────────────────────
  function primaryTitle(): string {
    if (view === 'day') {
      if (calMode === 'miladi') return `${daysLong[cursor.getDay()]}, ${monthsLong[cursor.getMonth()]} ${cursor.getDate()}, ${cursor.getFullYear()}`;
      if (calMode === 'shamsi') {
        const { jy, jm, jd } = toJalaali(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
        return `${daysLong[cursor.getDay()]}, ${toPersianDigits(jd)} ${calMonths.shamsi[jm - 1]} ${toPersianDigits(jy)}`;
      }
      if (calMode === 'qamari') {
        const { year: hy, month: hm, day: hd } = gregorianToHijri(toYMD(cursor));
        return `${daysLong[cursor.getDay()]}, ${toArabicDigits(hd)} ${calMonths.qamari[hm - 1]} ${toArabicDigits(hy)}`;
      }
      if (calMode === 'hebrew') {
        const { year: hy, month: hm, day: hd } = gregorianToHebrew(toYMD(cursor));
        return `${daysLong[cursor.getDay()]}, ${toHebrewDigits(hd)} ${calMonths.hebrew[hm - 1]} ${toHebrewDigits(hy)}`;
      }
      if (calMode === 'chinese') {
        const { year: cy, month: cm, day: cd } = gregorianToChinese(toYMD(cursor));
        return `${daysLong[cursor.getDay()]}, ${calMonths.chinese[cm - 1]} ${toChineseDigits(cd)}, ${toChineseDigits(cy)}`;
      }
      if (calMode === 'saka') {
        const { year: sy, month: sm, day: sd } = gregorianToSaka(toYMD(cursor));
        return `${daysLong[cursor.getDay()]}, ${toSakaDigits(sd)} ${calMonths.saka[sm - 1]} ${toSakaDigits(sy)}`;
      }
      if (calMode === 'ethiopian') {
        const { year: ey, month: em, day: ed } = gregorianToEthiopian(toYMD(cursor));
        return `${daysLong[cursor.getDay()]}, ${toEthiopianDigits(ed)} ${calMonths.ethiopian[em - 1]} ${toEthiopianDigits(ey)}`;
      }
      return `${daysLong[cursor.getDay()]}, ${monthsLong[cursor.getMonth()]} ${cursor.getDate()}, ${cursor.getFullYear()}`;
    }
    if (view === 'week') {
      const ws = weekStart(cursor, calMode);
      const we = addDays(ws, 6);
      if (calMode === 'miladi') return `${monthsShort[ws.getMonth()]} ${ws.getDate()} – ${monthsShort[we.getMonth()]} ${we.getDate()}, ${we.getFullYear()}`;
      if (calMode === 'shamsi') {
        const { jy: sy, jm: sm, jd: sd } = toJalaali(ws.getFullYear(), ws.getMonth() + 1, ws.getDate());
        const { jy: ey, jm: em, jd: ed } = toJalaali(we.getFullYear(), we.getMonth() + 1, we.getDate());
        if (sy === ey) return `${toPersianDigits(sd)} ${calMonths.shamsi[sm - 1]} – ${toPersianDigits(ed)} ${calMonths.shamsi[em - 1]} ${toPersianDigits(ey)}`;
        return `${toPersianDigits(sd)} ${calMonths.shamsi[sm - 1]} ${toPersianDigits(sy)} – ${toPersianDigits(ed)} ${calMonths.shamsi[em - 1]} ${toPersianDigits(ey)}`;
      }
      if (calMode === 'qamari') {
        const { year: hy, month: hm, day: hd } = gregorianToHijri(toYMD(ws));
        const { year: ey2, month: em2, day: ed2 } = gregorianToHijri(toYMD(we));
        if (hy === ey2) return `${toArabicDigits(hd)} ${calMonths.qamari[hm - 1]} – ${toArabicDigits(ed2)} ${calMonths.qamari[em2 - 1]} ${toArabicDigits(hy)}`;
        return `${toArabicDigits(hd)} ${calMonths.qamari[hm - 1]} ${toArabicDigits(hy)} – ${toArabicDigits(ed2)} ${calMonths.qamari[em2 - 1]} ${toArabicDigits(ey2)}`;
      }
      if (calMode === 'hebrew') {
        const { year: hy, month: hm, day: hd } = gregorianToHebrew(toYMD(ws));
        const { year: ey2, month: em2, day: ed2 } = gregorianToHebrew(toYMD(we));
        if (hy === ey2) return `${toHebrewDigits(hd)} ${calMonths.hebrew[hm - 1]} – ${toHebrewDigits(ed2)} ${calMonths.hebrew[em2 - 1]} ${toHebrewDigits(hy)}`;
        return `${toHebrewDigits(hd)} ${calMonths.hebrew[hm - 1]} ${toHebrewDigits(hy)} – ${toHebrewDigits(ed2)} ${calMonths.hebrew[em2 - 1]} ${toHebrewDigits(ey2)}`;
      }
      if (calMode === 'chinese') {
        const { year: cy, month: cm, day: cd } = gregorianToChinese(toYMD(ws));
        const { year: ey2, month: em2, day: ed2 } = gregorianToChinese(toYMD(we));
        if (cy === ey2) return `${calMonths.chinese[cm - 1]} ${toChineseDigits(cd)} – ${calMonths.chinese[em2 - 1]} ${toChineseDigits(ed2)}, ${toChineseDigits(cy)}`;
        return `${calMonths.chinese[cm - 1]} ${toChineseDigits(cd)}, ${toChineseDigits(cy)} – ${calMonths.chinese[em2 - 1]} ${toChineseDigits(ed2)}, ${toChineseDigits(ey2)}`;
      }
      if (calMode === 'saka') {
        const { year: sy, month: sm, day: sd } = gregorianToSaka(toYMD(ws));
        const { year: ey2, month: em2, day: ed2 } = gregorianToSaka(toYMD(we));
        if (sy === ey2) return `${toSakaDigits(sd)} ${calMonths.saka[sm - 1]} – ${toSakaDigits(ed2)} ${calMonths.saka[em2 - 1]} ${toSakaDigits(sy)}`;
        return `${toSakaDigits(sd)} ${calMonths.saka[sm - 1]} ${toSakaDigits(sy)} – ${toSakaDigits(ed2)} ${calMonths.saka[em2 - 1]} ${toSakaDigits(ey2)}`;
      }
      if (calMode === 'ethiopian') {
        const { year: ey, month: em, day: ed } = gregorianToEthiopian(toYMD(ws));
        const { year: ey2, month: em2, day: ed2 } = gregorianToEthiopian(toYMD(we));
        if (ey === ey2) return `${toEthiopianDigits(ed)} ${calMonths.ethiopian[em - 1]} – ${toEthiopianDigits(ed2)} ${calMonths.ethiopian[em2 - 1]} ${toEthiopianDigits(ey)}`;
        return `${toEthiopianDigits(ed)} ${calMonths.ethiopian[em - 1]} ${toEthiopianDigits(ey)} – ${toEthiopianDigits(ed2)} ${calMonths.ethiopian[em2 - 1]} ${toEthiopianDigits(ey2)}`;
      }
      return `${monthsShort[ws.getMonth()]} ${ws.getDate()} – ${monthsShort[we.getMonth()]} ${we.getDate()}, ${we.getFullYear()}`;
    }
    // month view
    if (calMode === 'miladi') return `${monthsLong[cursor.getMonth()]} ${cursor.getFullYear()}`;
    if (calMode === 'shamsi') {
      const { jy, jm } = toJalaali(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
      return `${calMonths.shamsi[jm - 1]} ${toPersianDigits(jy)}`;
    }
    if (calMode === 'qamari') {
      const { year: hy, month: hm } = gregorianToHijri(toYMD(cursor));
      return `${calMonths.qamari[hm - 1]} ${toArabicDigits(hy)}`;
    }
    if (calMode === 'hebrew') {
      const { year: hy, month: hm } = gregorianToHebrew(toYMD(cursor));
      return `${calMonths.hebrew[hm - 1]} ${toHebrewDigits(hy)}`;
    }
    if (calMode === 'chinese') {
      const { year: cy, month: cm } = gregorianToChinese(toYMD(cursor));
      return `${calMonths.chinese[cm - 1]} ${toChineseDigits(cy)}`;
    }
    if (calMode === 'saka') {
      const { year: sy, month: sm } = gregorianToSaka(toYMD(cursor));
      return `${calMonths.saka[sm - 1]} ${toSakaDigits(sy)}`;
    }
    // ethiopian month view
    const { year: ey, month: em } = gregorianToEthiopian(toYMD(cursor));
    return `${calMonths.ethiopian[em - 1]} ${toEthiopianDigits(ey)}`;
  }

  /** Returns the week number (formatted in the primary calendar's digit system) for the current cursor week. */
  function primaryWeekNumber(): string {
    const ws = weekStart(cursor, calMode);
    if (calMode === 'shamsi') {
      const { jy, jm, jd } = toJalaali(ws.getFullYear(), ws.getMonth() + 1, ws.getDate());
      return toPersianDigits(jalaliWeekNumber(jy, jm, jd));
    }
    if (calMode === 'qamari') {
      const { year: hy, month: hm, day: hd } = gregorianToHijri(toYMD(ws));
      return toArabicDigits(hijriWeekNumber(hy, hm, hd));
    }
    if (calMode === 'hebrew') {
      const { year: hy, month: hm, day: hd } = gregorianToHebrew(toYMD(ws));
      return toHebrewDigits(hebrewWeekNumber(hy, hm, hd));
    }
    if (calMode === 'chinese') {
      const { year: cy, month: cm, day: cd } = gregorianToChinese(toYMD(ws));
      return toChineseDigits(chineseWeekNumber(cy, cm, cd));
    }
    if (calMode === 'saka') {
      const { year: sy, month: sm, day: sd } = gregorianToSaka(toYMD(ws));
      return toSakaDigits(sakaWeekNumber(sy, sm, sd));
    }
    if (calMode === 'ethiopian') {
      const { year: ey, month: em, day: ed } = gregorianToEthiopian(toYMD(ws));
      return toEthiopianDigits(ethiopianWeekNumber(ey, em, ed));
    }
    // miladi
    return String(isoWeekNumber(ws));
  }

  // subLabels: one entry per enabled secondary/tertiary calendar (in order)
  const subLabels: string[] = [
    ...(secondaryCalendar && secondaryCalendar !== calMode
      ? [calRangeLabel(secondaryCalendar, cursor, view, calMode, monthsShort, daysLong)]
      : []),
    ...(tertiaryCalendar && tertiaryCalendar !== calMode
      ? [calRangeLabel(tertiaryCalendar, cursor, view, calMode, monthsShort, daysLong)]
      : []),
  ];

  const calendarToday = t('settings.calendarToday');
  const calendarPrev  = t('settings.calendarPrev');
  const calendarNext  = t('settings.calendarNext');
  const viewLabels: Record<View, string> = {
    month: t('settings.calendarMonth'),
    week:  t('settings.calendarWeek'),
    day:   t('settings.calendarDay'),
  };

  const isWidgetRtl = calMode === 'shamsi' || calMode === 'qamari' || calMode === 'hebrew';

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4" dir={isWidgetRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900 leading-tight">{primaryTitle()}</h2>
            {view === 'week' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500 shrink-0">
                {calMode === 'shamsi'
                  ? `ه${primaryWeekNumber()}`
                  : calMode === 'qamari'
                    ? `أ${primaryWeekNumber()}`
                    : calMode === 'hebrew'
                      ? `ש${primaryWeekNumber()}`
                      : calMode === 'chinese'
                        ? `第${primaryWeekNumber()}周`
                        : calMode === 'saka'
                          ? `स${primaryWeekNumber()}`
                          : calMode === 'ethiopian'
                            ? `ሳ${primaryWeekNumber()}`
                            : `W${primaryWeekNumber()}`}
              </span>
            )}
          </div>
          {subLabels.map((lbl, i) => (
            <p key={i} className="text-xs text-gray-400 mt-0.5 leading-tight">{lbl}</p>
          ))}
        </div>
        <div className={`flex items-center gap-2 shrink-0 ${isWidgetRtl ? 'flex-row-reverse' : ''}`}>
          {/* Single pill: ‹ | Today | Month | Week | Day | › */}
          <div className="flex items-center border border-gray-200 rounded-lg">

            {/* Prev */}
            <button onClick={() => navigate(-1)} aria-label={calendarPrev}
              className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-100 transition-colors text-sm rounded-l-lg border-r border-gray-200">
              ‹
            </button>

            {/* Today */}
            <div className="relative group">
              <button onClick={() => setCursor(today())} aria-label={calendarToday}
                className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors border-r border-gray-200">
                <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <rect x="2" y="3" width="14" height="13" rx="2"/>
                  <line x1="2" y1="7" x2="16" y2="7"/>
                  <line x1="6" y1="1.5" x2="6" y2="4.5"/>
                  <line x1="12" y1="1.5" x2="12" y2="4.5"/>
                  <circle cx="9" cy="12" r="1.5" fill="currentColor" stroke="none"/>
                </svg>
              </button>
              <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap rounded bg-gray-800 px-2 py-0.5 text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity z-50">
                {calendarToday}
              </span>
            </div>

            {/* Month */}
            <div className="relative group">
              <button onClick={() => setView('month')} aria-label={viewLabels.month}
                className={`p-1.5 transition-colors border-r border-gray-200 ${view === 'month' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-blue-600'}`}>
                <svg viewBox="0 0 18 18" fill="currentColor" className="w-4 h-4">
                  <rect x="2" y="2" width="4" height="4" rx="0.5"/>
                  <rect x="7" y="2" width="4" height="4" rx="0.5"/>
                  <rect x="12" y="2" width="4" height="4" rx="0.5"/>
                  <rect x="2" y="7" width="4" height="4" rx="0.5"/>
                  <rect x="7" y="7" width="4" height="4" rx="0.5"/>
                  <rect x="12" y="7" width="4" height="4" rx="0.5"/>
                  <rect x="2" y="12" width="4" height="4" rx="0.5"/>
                  <rect x="7" y="12" width="4" height="4" rx="0.5"/>
                  <rect x="12" y="12" width="4" height="4" rx="0.5"/>
                </svg>
              </button>
              <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap rounded bg-gray-800 px-2 py-0.5 text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity z-50">
                {viewLabels.month}
              </span>
            </div>

            {/* Week */}
            <div className="relative group">
              <button onClick={() => setView('week')} aria-label={viewLabels.week}
                className={`p-1.5 transition-colors border-r border-gray-200 ${view === 'week' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-blue-600'}`}>
                <svg viewBox="0 0 18 18" fill="currentColor" className="w-4 h-4">
                  <rect x="2" y="3" width="14" height="2.5" rx="1"/>
                  <rect x="2" y="7.75" width="14" height="2.5" rx="1"/>
                  <rect x="2" y="12.5" width="14" height="2.5" rx="1"/>
                </svg>
              </button>
              <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap rounded bg-gray-800 px-2 py-0.5 text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity z-50">
                {viewLabels.week}
              </span>
            </div>

            {/* Day */}
            <div className="relative group">
              <button onClick={() => setView('day')} aria-label={viewLabels.day}
                className={`p-1.5 transition-colors border-r border-gray-200 ${view === 'day' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-blue-600'}`}>
                <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <rect x="5" y="2" width="8" height="14" rx="1.5"/>
                </svg>
              </button>
              <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap rounded bg-gray-800 px-2 py-0.5 text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity z-50">
                {viewLabels.day}
              </span>
            </div>

            {/* Next */}
            <button onClick={() => navigate(1)} aria-label={calendarNext}
              className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-100 transition-colors text-sm rounded-r-lg">
              ›
            </button>

          </div>
        </div>
      </div>

      {/* Body */}
      {view === 'month' && <MonthGrid cursor={cursor} calMode={calMode} secondaryCal={secondaryCalendar} tertiaryCal={tertiaryCalendar} lang={lang} events={events} holidayNames={holidayNames} weekendSet={weekendSet}
        onDayClick={d => { setCursor(d); setView('day'); }}
        onWeekClick={d => { setCursor(d); setView('week'); }}
      />}
      {view === 'week' && <WeekPanel cursor={cursor} calMode={calMode} secondaryCal={secondaryCalendar} tertiaryCal={tertiaryCalendar} lang={lang} events={events} holidayNames={holidayNames} weekendSet={weekendSet}
        onDayClick={d => { setCursor(d); setView('day'); }}
      />}
      {view === 'day' && <DayPanel cursor={cursor} calMode={calMode} lang={lang} events={events} holidayNames={holidayNames} weekendSet={weekendSet} />}
    </div>
  );
}
