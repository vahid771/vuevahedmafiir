import { useState, useEffect, useRef } from 'react';
import { useCalendar } from '../context/CalendarContext';
import { CalendarType } from '../api/preferences';
import {
  PERSIAN_MONTHS, toPersianDigits, jalaliDaysInMonth, jalaliToGregorian, gregorianToJalali,
  toJalaliDisplay,
} from '../utils/jalali';
import {
  HIJRI_MONTHS, toArabicDigits, hijriDaysInMonth, hijriToGregorian, gregorianToHijri,
  toHijriDisplay,
} from '../utils/hijri';
import {
  HEBREW_MONTHS, hebrewDaysInMonth, hebrewToGregorian, gregorianToHebrew,
  toHebrewDisplay, toHebrewDigits,
} from '../utils/hebrew';
import {
  CHINESE_MONTHS, chineseDaysInMonth, chineseToGregorian, gregorianToChinese,
  toChineseDisplay, toChineseDigits,
} from '../utils/chinese';
import {
  SAKA_MONTHS, sakaDaysInMonth, sakaToGregorian, gregorianToSaka,
  toSakaDisplay, toSakaDigits,
} from '../utils/saka';
import {
  ETHIOPIAN_MONTHS, ethiopianDaysInMonth, ethiopianToGregorian, gregorianToEthiopian,
  toEthiopianDisplay, toEthiopianDigits,
} from '../utils/ethiopian';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

interface CalendarDatePickerProps {
  /** Current value as YYYY-MM-DD Gregorian string, or '' */
  value: string;
  /** Called with a YYYY-MM-DD Gregorian string when a day is selected */
  onChange: (gregorianDate: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

/** Short Gregorian month names for miladi display */
const EN_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Week header labels per calendar (first entry = first column)
// Saturday-start (shamsi)
const WEEK_SAT = ['ش','ی','د','س','چ','پ','ج'];
// Sunday-start (hebrew, chinese, ethiopian)
const WEEK_SUN = ['Su','Mo','Tu','We','Th','Fr','Sa'];
// Sunday-start Hebrew
const WEEK_SUN_HE = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
// Monday-start (miladi, qamari, saka)
const WEEK_MON = ['Mo','Tu','We','Th','Fr','Sa','Su'];
// Monday-start Arabic
const WEEK_MON_AR = ['الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت','الأحد'];

// ---------------------------------------------------------------------------
// Helpers: today's date in various calendars
// ---------------------------------------------------------------------------

function todayGregorian(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Per-calendar logic helpers
// ---------------------------------------------------------------------------

interface CalendarState {
  year: number;
  month: number;
  day: number;
}

function getCalendarState(cal: CalendarType, gregorianDate: string): CalendarState {
  if (!gregorianDate) {
    const today = todayGregorian();
    return getCalendarState(cal, today);
  }
  switch (cal) {
    case 'shamsi': { const { year, month, day } = gregorianToJalali(gregorianDate); return { year, month, day }; }
    case 'qamari': { const { year, month, day } = gregorianToHijri(gregorianDate); return { year, month, day }; }
    case 'hebrew': { const { year, month, day } = gregorianToHebrew(gregorianDate); return { year, month, day }; }
    case 'chinese': { const { year, month, day } = gregorianToChinese(gregorianDate); return { year, month, day }; }
    case 'saka': { const { year, month, day } = gregorianToSaka(gregorianDate); return { year, month, day }; }
    case 'ethiopian': { const { year, month, day } = gregorianToEthiopian(gregorianDate); return { year, month, day }; }
    default: {
      const d = new Date(gregorianDate + 'T00:00:00');
      return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
    }
  }
}

function daysInMonth(cal: CalendarType, year: number, month: number): number {
  switch (cal) {
    case 'shamsi':   return jalaliDaysInMonth(year, month);
    case 'qamari':   return hijriDaysInMonth(year, month);
    case 'hebrew':   return hebrewDaysInMonth(year, month);
    case 'chinese':  return chineseDaysInMonth(year, month);
    case 'saka':     return sakaDaysInMonth(year, month);
    case 'ethiopian':return ethiopianDaysInMonth(year, month);
    default: return new Date(year, month, 0).getDate(); // JS: month is 1-based, day 0 = last of prev
  }
}

/** Convert cal y/m/1 to Gregorian to find weekday of the 1st */
function firstDayGregorian(cal: CalendarType, year: number, month: number): string {
  switch (cal) {
    case 'shamsi':   return jalaliToGregorian(year, month, 1);
    case 'qamari':   return hijriToGregorian(year, month, 1);
    case 'hebrew':   return hebrewToGregorian(year, month, 1);
    case 'chinese':  return chineseToGregorian(year, month, 1);
    case 'saka':     return sakaToGregorian(year, month, 1);
    case 'ethiopian':return ethiopianToGregorian(year, month, 1);
    default:
      return `${year}-${String(month).padStart(2, '0')}-01`;
  }
}

/** Convert cal y/m/d to Gregorian YYYY-MM-DD */
function calToGregorian(cal: CalendarType, year: number, month: number, day: number): string {
  switch (cal) {
    case 'shamsi':   return jalaliToGregorian(year, month, day);
    case 'qamari':   return hijriToGregorian(year, month, day);
    case 'hebrew':   return hebrewToGregorian(year, month, day);
    case 'chinese':  return chineseToGregorian(year, month, day);
    case 'saka':     return sakaToGregorian(year, month, day);
    case 'ethiopian':return ethiopianToGregorian(year, month, day);
    default: return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
}

/** Week start index in JS getDay() terms: 0=Sun,1=Mon,...,6=Sat */
function weekStartJsDay(cal: CalendarType): number {
  switch (cal) {
    case 'shamsi': return 6; // Saturday
    case 'hebrew':
    case 'chinese':
    case 'ethiopian': return 0; // Sunday
    default: return 1; // Monday (miladi, qamari, saka)
  }
}

/** Compute the offset (0-based blank cells) for the first day of the month */
function computeOffset(cal: CalendarType, year: number, month: number): number {
  const gregFirst = firstDayGregorian(cal, year, month);
  const d = new Date(gregFirst + 'T00:00:00');
  const jsDay = d.getDay(); // 0=Sun..6=Sat
  const startDay = weekStartJsDay(cal);
  return (jsDay - startDay + 7) % 7;
}

/** Format a single day number in the calendar's digit system */
function formatDay(cal: CalendarType, day: number): string {
  switch (cal) {
    case 'shamsi':   return toPersianDigits(day);
    case 'qamari':   return toArabicDigits(day);
    case 'hebrew':   return toHebrewDigits(day);
    case 'chinese':  return toChineseDigits(day);
    case 'saka':     return toSakaDigits(day);
    case 'ethiopian':return toEthiopianDigits(day);
    default:         return String(day);
  }
}

/** Month name for the header */
function monthName(cal: CalendarType, year: number, month: number): string {
  switch (cal) {
    case 'shamsi':   return PERSIAN_MONTHS[month - 1];
    case 'qamari':   return HIJRI_MONTHS[month - 1];
    case 'hebrew':   return HEBREW_MONTHS[month - 1];
    case 'chinese':  return CHINESE_MONTHS[month - 1];
    case 'saka':     return SAKA_MONTHS[month - 1];
    case 'ethiopian':return ETHIOPIAN_MONTHS[month - 1];
    default:         return `${EN_MONTHS[month - 1]} ${year}`;
  }
}

/** Year display string in calendar's digit system */
function yearDisplay(cal: CalendarType, year: number): string {
  switch (cal) {
    case 'shamsi':   return toPersianDigits(year);
    case 'qamari':   return toArabicDigits(year);
    case 'saka':     return toSakaDigits(year);
    default:         return String(year);
  }
}

/** Week header labels for each calendar */
function weekHeaders(cal: CalendarType): string[] {
  switch (cal) {
    case 'shamsi':   return WEEK_SAT;
    case 'qamari':   return WEEK_MON_AR;
    case 'hebrew':   return WEEK_SUN_HE;
    case 'chinese':
    case 'ethiopian':return WEEK_SUN;
    default:         return WEEK_MON; // miladi, saka
  }
}

/** RTL direction for popup */
function isRtl(cal: CalendarType): boolean {
  return cal === 'shamsi' || cal === 'qamari' || cal === 'hebrew';
}

/** Returns the number of months in a given year for a calendar */
function monthsInYear(cal: CalendarType, year: number): number {
  if (cal === 'ethiopian') return 13;
  if (cal === 'hebrew') return ((7 * year + 1) % 19) < 7 ? 13 : 12;
  return 12;
}

/** Navigate prev/next month, handling year boundaries */
function navigateMonth(
  cal: CalendarType,
  year: number,
  month: number,
  direction: -1 | 1
): { year: number; month: number } {
  let newMonth = month + direction;
  let newYear = year;
  if (newMonth < 1) {
    newYear--;
    newMonth = monthsInYear(cal, newYear);
  } else if (newMonth > monthsInYear(cal, newYear)) {
    newMonth = 1;
    newYear++;
  }
  return { year: newYear, month: newMonth };
}

/** Display text for the input button */
function displayText(cal: CalendarType, value: string): string {
  if (!value) return '';
  switch (cal) {
    case 'shamsi':    return toJalaliDisplay(value);
    case 'qamari':    return toHijriDisplay(value);
    case 'hebrew':    return toHebrewDisplay(value);
    case 'chinese':   return toChineseDisplay(value);
    case 'saka':      return toSakaDisplay(value);
    case 'ethiopian': return toEthiopianDisplay(value);
    default: {
      // miladi: "MMM D, YYYY"
      try {
        const d = new Date(value + 'T00:00:00');
        return `${EN_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
      } catch { return value; }
    }
  }
}

/** i18n labels for clear / today footer */
const LABELS: Record<CalendarType, { clear: string; today: string }> = {
  miladi:    { clear: 'Clear',     today: 'Today'  },
  shamsi:    { clear: 'پاک کردن', today: 'امروز'  },
  qamari:    { clear: 'مسح',      today: 'اليوم'  },
  hebrew:    { clear: 'נקה',      today: 'היום'   },
  chinese:   { clear: 'Clear',    today: 'Today'  },
  saka:      { clear: 'Clear',    today: 'Today'  },
  ethiopian: { clear: 'Clear',    today: 'Today'  },
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CalendarDatePicker({
  value,
  onChange,
  className = '',
  placeholder,
  disabled = false,
}: CalendarDatePickerProps) {
  const { calendar: cal } = useCalendar();

  const today = todayGregorian();
  const todayState = getCalendarState(cal, today);

  const initialState = value ? getCalendarState(cal, value) : todayState;
  const [viewYear, setViewYear] = useState(initialState.year);
  const [viewMonth, setViewMonth] = useState(initialState.month);
  const [open, setOpen] = useState(false);

  const selectedState = value ? getCalendarState(cal, value) : null;

  const popupRef = useRef<HTMLDivElement>(null);

  // Reset view when value or calendar changes
  useEffect(() => {
    const s = value ? getCalendarState(cal, value) : getCalendarState(cal, today);
    setViewYear(s.year);
    setViewMonth(s.month);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, cal]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  function prevMonth() {
    const { year, month } = navigateMonth(cal, viewYear, viewMonth, -1);
    setViewYear(year); setViewMonth(month);
  }
  function nextMonth() {
    const { year, month } = navigateMonth(cal, viewYear, viewMonth, 1);
    setViewYear(year); setViewMonth(month);
  }

  function selectDay(day: number) {
    const gregorian = calToGregorian(cal, viewYear, viewMonth, day);
    onChange(gregorian);
    setOpen(false);
  }

  function goToday() {
    setViewYear(todayState.year);
    setViewMonth(todayState.month);
    onChange(today);
    setOpen(false);
  }

  function isSelected(day: number): boolean {
    return !!selectedState &&
      selectedState.year === viewYear &&
      selectedState.month === viewMonth &&
      selectedState.day === day;
  }

  function isToday(day: number): boolean {
    return todayState.year === viewYear &&
      todayState.month === viewMonth &&
      todayState.day === day;
  }

  const dim = daysInMonth(cal, viewYear, viewMonth);
  const offset = computeOffset(cal, viewYear, viewMonth);

  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: dim }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const rtl = isRtl(cal);
  const headers = weekHeaders(cal);
  const text = displayText(cal, value);
  const labels = LABELS[cal];

  // For miladi, the header shows month name + year separately
  const headerTitle = cal === 'miladi'
    ? `${EN_MONTHS[viewMonth - 1]} ${viewYear}`
    : `${monthName(cal, viewYear, viewMonth)} ${yearDisplay(cal, viewYear)}`;

  return (
    <div ref={popupRef} className={`relative ${className}`} dir={rtl ? 'rtl' : 'ltr'}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ textAlign: rtl ? 'right' : 'left' }}
      >
        <span className={text ? 'text-gray-900' : 'text-gray-400'}>
          {text || placeholder || (rtl ? 'انتخاب تاریخ' : 'Select date')}
        </span>
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {/* Dropdown calendar */}
      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-72">
          {/* Header: prev / month-year / next */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={rtl ? nextMonth : prevMonth}
              className="p-1 rounded hover:bg-gray-100 text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-medium text-gray-800">{headerTitle}</span>
            <button type="button" onClick={rtl ? prevMonth : nextMonth}
              className="p-1 rounded hover:bg-gray-100 text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {headers.map((wd, i) => (
              <div key={i} className="text-center text-xs text-gray-400 font-medium py-1">{wd}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, idx) => {
              if (day === null) return <div key={`e-${idx}`} />;
              const selected = isSelected(day);
              const todayCell = isToday(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={[
                    'text-center text-sm rounded py-1 w-full transition-colors',
                    selected
                      ? 'bg-blue-600 text-white font-semibold'
                      : todayCell
                      ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
                      : 'text-gray-700 hover:bg-gray-100',
                  ].join(' ')}
                >
                  {formatDay(cal, day)}
                </button>
              );
            })}
          </div>

          {/* Footer: clear + today */}
          <div className="flex justify-between mt-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {labels.clear}
            </button>
            <button
              type="button"
              onClick={goToday}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {labels.today}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
