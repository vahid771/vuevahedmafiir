import { useState, useEffect, useMemo } from 'react';
import { toJalaali, toGregorian, jalaaliMonthLength } from 'jalaali-js';
import { useCalendar } from '../context/CalendarContext';
import { useLanguage } from '../context/LanguageContext';
import { useHolidays, getHolidayDisplayName } from '../hooks/useHolidays';
import { useWeekends } from '../hooks/useWeekends';
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
import { getTasks, type Task } from '../api/tasks';
import { getReminders, type Reminder } from '../api/reminders';
import { getDates, type ImportantDate } from '../api/dates';
import { useAuth } from '../context/AuthContext';

type View = 'month' | 'week' | 'day';

const SHORT_EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_EN_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PERSIAN_SHORT_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']; // Sat→Fri

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

function weekStart(d: Date, shamsi: boolean): Date {
  const dow = d.getDay();
  const offset = shamsi ? (dow === 6 ? 0 : dow + 1) : dow;
  return addDays(d, -offset);
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

function MonthGrid({ cursor, shamsi, events, holidayNames, weekendSet, onDayClick, onWeekClick }: {
  cursor: Date;
  shamsi: boolean;
  events: CalEvent[];
  holidayNames: Map<string, string>;
  weekendSet: Set<number>;
  onDayClick: (d: Date) => void;
  onWeekClick: (d: Date) => void;
}) {
  const now = today();

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

  if (!shamsi) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
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
          {SHORT_EN_DAYS.map(d => (
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
                  const { jd } = toJalaali(year, month + 1, day);
                  const isWeekend = weekendSet.has(cellDate.getDay());
                  const holidayName = holidayNames.get(ymd);
                  return (
                    <div
                      key={ci}
                      onClick={() => onDayClick(cellDate)}
                      className={`min-h-[60px] p-0.5 rounded-lg border cursor-pointer
                        ${isToday
                          ? 'bg-blue-50 border-blue-300'
                          : holidayName
                            ? 'bg-red-50 border-red-300'
                            : isWeekend
                              ? 'bg-red-50 border-red-200'
                              : 'border-gray-100 hover:border-gray-300'}`}
                    >
                      <div className="flex flex-col items-center mb-0.5">
                        <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-medium
                          ${isToday ? 'bg-blue-600 text-white' : isWeekend ? 'text-red-600 hover:bg-red-100' : 'text-gray-700 hover:bg-gray-100'}`}>
                          {day}
                        </span>
                        <span className={`text-[9px] leading-none ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>
                          {toPersianDigits(jd)}
                        </span>
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
        {PERSIAN_SHORT_DAYS.map(d => (
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
                    className={`min-h-[60px] p-0.5 rounded-lg border cursor-pointer
                      ${isToday
                        ? 'bg-blue-50 border-blue-300'
                        : holidayName
                          ? 'bg-red-50 border-red-300'
                          : isWeekend
                            ? 'bg-red-50 border-red-200'
                            : 'border-gray-100 hover:border-gray-300'}`}
                  >
                    <div className="flex flex-col items-center mb-0.5">
                      <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-medium
                        ${isToday ? 'bg-blue-600 text-white' : isWeekend ? 'text-red-600 hover:bg-red-100' : 'text-gray-700 hover:bg-gray-100'}`}>
                        {toPersianDigits(jDay)}
                      </span>
                      <span className={`text-[9px] leading-none ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>
                        {gd}
                      </span>
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

function WeekPanel({ cursor, shamsi, events, holidayNames, weekendSet, onDayClick }: {
  cursor: Date;
  shamsi: boolean;
  events: CalEvent[];
  holidayNames: Map<string, string>;
  weekendSet: Set<number>;
  onDayClick: (d: Date) => void;
}) {
  const now = today();
  const ws = weekStart(cursor, shamsi);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const dayNames = shamsi ? PERSIAN_SHORT_DAYS : SHORT_EN_DAYS;

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
    <div className="select-none" dir={shamsi ? 'rtl' : 'ltr'}>
      {/* Day headers */}
      <div className="grid grid-cols-7 border border-gray-200 rounded-t-lg overflow-hidden">
        {days.map((d, i) => {
          const isToday = isSameDay(d, now);
          let label: string;
          let secondaryLabel: string;
          if (shamsi) {
            const { jd } = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
            label = toPersianDigits(jd);
            secondaryLabel = String(d.getDate());
          } else {
            label = String(d.getDate());
            const { jd } = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
            secondaryLabel = toPersianDigits(jd);
          }
          const nameIdx = shamsi
            ? (d.getDay() === 6 ? 0 : d.getDay() + 1)
            : d.getDay();
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
              <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium
                ${isToday ? 'bg-blue-600 text-white' : isWeekend ? 'text-red-600' : 'text-gray-700'}`}>
                {label}
              </span>
              <span className={`text-[9px] leading-none mt-0.5 ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>
                {secondaryLabel}
              </span>
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
            <span className="text-xs text-gray-400">{shamsi ? 'آخر هفته' : 'Weekend'}</span>
          </div>
        )}
        {holidayNames.size > 0 && (
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-xs text-gray-400">{shamsi ? 'تعطیل رسمی' : 'Holiday'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day view
// ---------------------------------------------------------------------------

function DayPanel({ cursor, shamsi, events, holidayNames, weekendSet }: {
  cursor: Date;
  shamsi: boolean;
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

  return (
    <div className="select-none" dir={shamsi ? 'rtl' : 'ltr'}>
      {/* Holiday / weekend banner */}
      {(holidayName || isWeekend) && (
        <div className={`mb-2 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5
          ${holidayName ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-red-50 text-red-400 border border-red-100'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
          {holidayName ?? (shamsi ? 'آخر هفته' : 'Weekend')}
        </div>
      )}
      {/* All-day events strip */}
      {allDayEvents.length > 0 && (
        <div className="mb-2 p-2 border border-gray-200 rounded-lg bg-gray-50">
          <div className="text-xs text-gray-400 mb-1 font-medium">{shamsi ? 'تمام روز' : 'All day'}</div>
          <div className="flex flex-wrap gap-1">
            {allDayEvents.map(ev => <EventPill key={ev.id} ev={ev} />)}
          </div>
        </div>
      )}

      {/* Hourly grid */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {hours.map(h => {
          const label = shamsi
            ? `${toPersianDigits(String(h).padStart(2, '0'))}:۰۰`
            : `${String(h).padStart(2, '0')}:00`;
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
            <span className="text-xs text-gray-400">{shamsi ? 'آخر هفته' : 'Weekend'}</span>
          </div>
        )}
        {holidayNames.size > 0 && (
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-xs text-gray-400">{shamsi ? 'تعطیل رسمی' : 'Holiday'}</span>
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
  const { calendar, country } = useCalendar();
  const { lang } = useLanguage();
  const { token } = useAuth();
  const shamsi = calendar === 'shamsi';
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
    if (!shamsi) {
      setCursor(c => { const d = new Date(c); d.setDate(1); d.setMonth(d.getMonth() + dir); return d; });
    } else {
      setCursor(c => {
        const { jy, jm } = toJalaali(c.getFullYear(), c.getMonth() + 1, c.getDate());
        let nm = jm + dir; let ny = jy;
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
      if (!shamsi) return cursor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      const { jy, jm, jd } = toJalaali(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
      const PERSIAN_DAYS_LONG = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'];
      return `${PERSIAN_DAYS_LONG[cursor.getDay()]}، ${toPersianDigits(jd)} ${PERSIAN_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
    }
    if (view === 'week') {
      const ws = weekStart(cursor, shamsi);
      const we = addDays(ws, 6);
      if (!shamsi) return `${SHORT_EN_MONTHS[ws.getMonth()]} ${ws.getDate()} – ${SHORT_EN_MONTHS[we.getMonth()]} ${we.getDate()}, ${we.getFullYear()}`;
      const { jy: sy, jm: sm, jd: sd } = toJalaali(ws.getFullYear(), ws.getMonth() + 1, ws.getDate());
      const { jy: ey, jm: em, jd: ed } = toJalaali(we.getFullYear(), we.getMonth() + 1, we.getDate());
      if (sy === ey) return `${toPersianDigits(sd)} ${PERSIAN_MONTHS[sm - 1]} – ${toPersianDigits(ed)} ${PERSIAN_MONTHS[em - 1]} ${toPersianDigits(ey)}`;
      return `${toPersianDigits(sd)} ${PERSIAN_MONTHS[sm - 1]} ${toPersianDigits(sy)} – ${toPersianDigits(ed)} ${PERSIAN_MONTHS[em - 1]} ${toPersianDigits(ey)}`;
    }
    if (!shamsi) return cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const { jy, jm } = toJalaali(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
    return `${PERSIAN_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
  }

  function secondaryLabel(): string {
    if (view === 'day') {
      if (shamsi) return cursor.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      return toJalaliDisplay(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`);
    }
    if (view === 'week') {
      const ws = weekStart(cursor, shamsi);
      const we = addDays(ws, 6);
      if (shamsi) return gregorianWeekRange(ws, we);
      return jalaliWeekRange(ws, we);
    }
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
    <div className="bg-white border border-gray-200 rounded-xl p-4" dir={shamsi ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900 leading-tight">{primaryTitle()}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{secondaryLabel()}</p>
        </div>
        <div className={`flex items-center gap-2 shrink-0 ${shamsi ? 'flex-row-reverse' : ''}`}>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => navigate(-1)} className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-100 transition-colors text-sm" aria-label="Previous">
              ‹
            </button>
            <button onClick={() => navigate(1)} className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-100 transition-colors border-l border-gray-200 text-sm" aria-label="Next">
              ›
            </button>
          </div>
          <button onClick={() => setCursor(today())} className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">
            {shamsi ? 'امروز' : 'Today'}
          </button>
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            {views.map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-r last:border-r-0 border-gray-200
                  ${view === v ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                {viewLabels[v]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      {view === 'month' && <MonthGrid cursor={cursor} shamsi={shamsi} events={events} holidayNames={holidayNames} weekendSet={weekendSet}
        onDayClick={d => { setCursor(d); setView('day'); }}
        onWeekClick={d => { setCursor(d); setView('week'); }}
      />}
      {view === 'week' && <WeekPanel cursor={cursor} shamsi={shamsi} events={events} holidayNames={holidayNames} weekendSet={weekendSet}
        onDayClick={d => { setCursor(d); setView('day'); }}
      />}
      {view === 'day' && <DayPanel cursor={cursor} shamsi={shamsi} events={events} holidayNames={holidayNames} weekendSet={weekendSet} />}
    </div>
  );
}
