import { useState } from 'react';
import { toJalaali, toGregorian, jalaaliMonthLength } from 'jalaali-js';
import { useCalendar } from '../context/CalendarContext';
import {
  PERSIAN_MONTHS,
  toPersianDigits,
  jalaliDaysInMonth,
  jalaliMonthRangeForGregorianMonth,
  gregorianMonthRangeForJalaliMonth,
  jalaliWeekRange,
  gregorianWeekRange,
  toJalaliDisplay,
} from '../utils/jalali';

type View = 'month' | 'week' | 'day';

const SHORT_EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_EN_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PERSIAN_SHORT_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']; // Sat→Fri

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

/** Advance a Date by N whole days */
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/**
 * Returns the start of the week containing `d`.
 * Miladi: Sunday (getDay()===0)
 * Shamsi: Saturday (getDay()===6)
 */
function weekStart(d: Date, shamsi: boolean): Date {
  const dow = d.getDay(); // 0=Sun … 6=Sat
  const offset = shamsi
    ? (dow === 6 ? 0 : dow + 1) // distance back to Saturday
    : dow;                       // distance back to Sunday
  return addDays(d, -offset);
}

// ---------------------------------------------------------------------------
// Month view
// ---------------------------------------------------------------------------

function MonthGrid({ cursor, shamsi }: { cursor: Date; shamsi: boolean }) {
  const now = today();

  if (!shamsi) {
    // ── Miladi month grid ──────────────────────────────────────────────────
    const year = cursor.getFullYear();
    const month = cursor.getMonth(); // 0-based
    const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (number | null)[] = [
      ...Array(firstDow).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    // pad to full weeks
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div className="select-none">
        {/* weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {SHORT_EN_DAYS.map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
          ))}
        </div>
        {/* day cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const cellDate = new Date(year, month, day);
            const isToday = isSameDay(cellDate, now);
            const { jd } = toJalaali(year, month + 1, day);
            return (
              <div key={i} className="flex flex-col items-center justify-center py-1 gap-0.5">
                <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm
                  ${isToday ? 'bg-blue-600 text-white font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}>
                  {day}
                </span>
                <span className={`text-[10px] leading-none ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>
                  {toPersianDigits(jd)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Shamsi month grid ────────────────────────────────────────────────────
  const { jy, jm } = toJalaali(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
  const daysInJMonth = jalaliDaysInMonth(jy, jm);

  // First day of this Jalali month → its Gregorian date → getDay()
  const { gy: fy, gm: fm, gd: fd } = toGregorian(jy, jm, 1);
  const firstDow = new Date(fy, fm - 1, fd).getDay(); // 0=Sun … 6=Sat
  // Shamsi week starts Saturday (6). Offset = how many blank cells before day 1.
  const offset = firstDow === 6 ? 0 : (firstDow + 1) % 7;

  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInJMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // Today in Jalali
  const { jy: ty, jm: tm, jd: td } = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const todayIsInMonth = ty === jy && tm === jm;

  return (
    <div className="select-none" dir="rtl">
      {/* weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {PERSIAN_SHORT_DAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>
      {/* day cells */}
      <div className="grid grid-cols-7">
        {cells.map((jDay, i) => {
          if (jDay === null) return <div key={i} />;
          const isToday = todayIsInMonth && td === jDay;
          // Compute the corresponding Gregorian day number
          const { gd } = toGregorian(jy, jm, jDay);
          return (
            <div key={i} className="flex flex-col items-center justify-center py-1 gap-0.5">
              <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm
                ${isToday ? 'bg-blue-600 text-white font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}>
                {toPersianDigits(jDay)}
              </span>
              <span className={`text-[10px] leading-none ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>
                {gd}
              </span>
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

function WeekPanel({ cursor, shamsi }: { cursor: Date; shamsi: boolean }) {
  const now = today();
  const ws = weekStart(cursor, shamsi);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));

  const dayNames = shamsi ? PERSIAN_SHORT_DAYS : SHORT_EN_DAYS;

  return (
    <div className="select-none" dir={shamsi ? 'rtl' : 'ltr'}>
      <div className="grid grid-cols-7 border border-gray-200 rounded-lg overflow-hidden">
        {days.map((d, i) => {
          const isToday = isSameDay(d, now);
          let label: string;
          if (shamsi) {
            const { jd } = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
            label = toPersianDigits(jd);
          } else {
            label = String(d.getDate());
          }
          // Weekday index for Shamsi: Sat=0, Sun=1, … Fri=6
          const nameIdx = shamsi
            ? (d.getDay() === 6 ? 0 : d.getDay() + 1)
            : d.getDay();

          return (
            <div key={i} className={`flex flex-col items-center py-3 border-r last:border-r-0 border-gray-200
              ${isToday ? 'bg-blue-50' : 'bg-white'}`}>
              <span className="text-xs text-gray-400 mb-1">{dayNames[nameIdx]}</span>
              <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium
                ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700'}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
      {/* empty body placeholder */}
      <div className="mt-2 border border-gray-100 rounded-lg h-24 bg-gray-50 flex items-center justify-center">
        <span className="text-xs text-gray-300">{shamsi ? 'رویدادی وجود ندارد' : 'No events'}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day view
// ---------------------------------------------------------------------------

function DayPanel({ cursor, shamsi }: { cursor: Date; shamsi: boolean }) {
  const now = today();
  const isToday = isSameDay(cursor, now);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="select-none" dir={shamsi ? 'rtl' : 'ltr'}>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {hours.map(h => {
          const label = shamsi
            ? `${toPersianDigits(String(h).padStart(2, '0'))}:۰۰`
            : `${String(h).padStart(2, '0')}:00`;
          return (
            <div key={h} className={`flex items-center border-b last:border-b-0 border-gray-100
              ${h === new Date().getHours() && isToday ? 'bg-blue-50' : ''}`}>
              <span className="w-14 shrink-0 text-xs text-gray-400 px-3 py-2 border-r border-gray-100">
                {label}
              </span>
              <div className="flex-1 py-2 px-2 min-h-[28px]" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main CalendarWidget
// ---------------------------------------------------------------------------

export default function CalendarWidget() {
  const { calendar } = useCalendar();
  const shamsi = calendar === 'shamsi';
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState<Date>(today);

  // ── Navigation ───────────────────────────────────────────────────────────
  function navigate(dir: 1 | -1) {
    if (view === 'day') {
      setCursor(c => addDays(c, dir));
      return;
    }
    if (view === 'week') {
      setCursor(c => addDays(c, dir * 7));
      return;
    }
    // month
    if (!shamsi) {
      setCursor(c => {
        const d = new Date(c);
        d.setDate(1);
        d.setMonth(d.getMonth() + dir);
        return d;
      });
    } else {
      setCursor(c => {
        const { jy, jm } = toJalaali(c.getFullYear(), c.getMonth() + 1, c.getDate());
        let nm = jm + dir;
        let ny = jy;
        if (nm < 1) { nm = 12; ny--; }
        if (nm > 12) { nm = 1; ny++; }
        const safeDays = jalaaliMonthLength(ny, nm);
        const { gy, gm: gmonth, gd } = toGregorian(ny, nm, Math.min(1, safeDays));
        return new Date(gy, gmonth - 1, gd);
      });
    }
  }

  // ── Primary title ────────────────────────────────────────────────────────
  function primaryTitle(): string {
    if (view === 'day') {
      if (!shamsi) {
        return cursor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      }
      const { jy, jm, jd } = toJalaali(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
      const PERSIAN_DAYS_LONG = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'];
      return `${PERSIAN_DAYS_LONG[cursor.getDay()]}، ${toPersianDigits(jd)} ${PERSIAN_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
    }
    if (view === 'week') {
      const ws = weekStart(cursor, shamsi);
      const we = addDays(ws, 6);
      if (!shamsi) {
        return `${SHORT_EN_MONTHS[ws.getMonth()]} ${ws.getDate()} – ${SHORT_EN_MONTHS[we.getMonth()]} ${we.getDate()}, ${we.getFullYear()}`;
      }
      const { jy: sy, jm: sm, jd: sd } = toJalaali(ws.getFullYear(), ws.getMonth() + 1, ws.getDate());
      const { jy: ey, jm: em, jd: ed } = toJalaali(we.getFullYear(), we.getMonth() + 1, we.getDate());
      if (sy === ey) {
        return `${toPersianDigits(sd)} ${PERSIAN_MONTHS[sm - 1]} – ${toPersianDigits(ed)} ${PERSIAN_MONTHS[em - 1]} ${toPersianDigits(ey)}`;
      }
      return `${toPersianDigits(sd)} ${PERSIAN_MONTHS[sm - 1]} ${toPersianDigits(sy)} – ${toPersianDigits(ed)} ${PERSIAN_MONTHS[em - 1]} ${toPersianDigits(ey)}`;
    }
    // month
    if (!shamsi) {
      return cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    const { jy, jm } = toJalaali(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
    return `${PERSIAN_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
  }

  // ── Secondary label ──────────────────────────────────────────────────────
  function secondaryLabel(): string {
    if (view === 'day') {
      if (shamsi) {
        // secondary is miladi
        return cursor.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      }
      return toJalaliDisplay(
        `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      );
    }
    if (view === 'week') {
      const ws = weekStart(cursor, shamsi);
      const we = addDays(ws, 6);
      if (shamsi) return gregorianWeekRange(ws, we);
      return jalaliWeekRange(ws, we);
    }
    // month
    if (shamsi) {
      const { jy, jm } = toJalaali(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
      return gregorianMonthRangeForJalaliMonth(jy, jm);
    }
    return jalaliMonthRangeForGregorianMonth(cursor.getFullYear(), cursor.getMonth() + 1);
  }

  const views: View[] = ['month', 'week', 'day'];
  const viewLabels: Record<View, string> = shamsi
    ? { month: 'ماه', week: 'هفته', day: 'روز' }
    : { month: 'Month', week: 'Week', day: 'Day' };

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-4"
      dir={shamsi ? 'rtl' : 'ltr'}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-2 mb-4 flex-wrap">
        {/* Left: titles */}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900 leading-tight">{primaryTitle()}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{secondaryLabel()}</p>
        </div>

        {/* Right: controls */}
        <div className={`flex items-center gap-2 shrink-0 ${shamsi ? 'flex-row-reverse' : ''}`}>
          {/* Prev / Next */}
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => navigate(-1)}
              className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-100 transition-colors text-sm"
              aria-label="Previous"
            >
              {shamsi ? '›' : '‹'}
            </button>
            <button
              onClick={() => navigate(1)}
              className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-100 transition-colors border-l border-gray-200 text-sm"
              aria-label="Next"
            >
              {shamsi ? '‹' : '›'}
            </button>
          </div>

          {/* Today button */}
          <button
            onClick={() => setCursor(today())}
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {shamsi ? 'امروز' : 'Today'}
          </button>

          {/* View switcher */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            {views.map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-r last:border-r-0 border-gray-200
                  ${view === v ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {viewLabels[v]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      {view === 'month' && <MonthGrid cursor={cursor} shamsi={shamsi} />}
      {view === 'week' && <WeekPanel cursor={cursor} shamsi={shamsi} />}
      {view === 'day' && <DayPanel cursor={cursor} shamsi={shamsi} />}
    </div>
  );
}
