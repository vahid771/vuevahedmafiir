import { useState } from 'react';
import {
  PERSIAN_MONTHS,
  toPersianDigits,
  jalaliDaysInMonth,
  jalaliToGregorian,
  gregorianToJalali,
} from '../utils/jalali';

interface JalaliDatePickerProps {
  /** Current value as YYYY-MM-DD gregorian string, or '' */
  value: string;
  /** Called with a YYYY-MM-DD gregorian string when a day is selected */
  onChange: (gregorianDate: string) => void;
  className?: string;
}

/** Returns today's Jalali date components */
function todayJalali() {
  const now = new Date();
  return gregorianToJalali(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  );
}

/** The weekday header row in Shamsi — starts Saturday (شنبه) */
const WEEK_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

/** Returns the Jalali weekday index (0=Saturday) for day 1 of jY/jM */
function firstDayOfMonth(jY: number, jM: number): number {
  const greg = jalaliToGregorian(jY, jM, 1);
  const d = new Date(greg + 'T00:00:00');
  // JS getDay(): 0=Sun,1=Mon,...,6=Sat → map to Shamsi: 0=Sat,1=Sun,...,6=Fri
  const jsDay = d.getDay(); // 0-6
  return (jsDay + 1) % 7; // Sat=0, Sun=1, Mon=2, Tue=3, Wed=4, Thu=5, Fri=6
}

export default function JalaliDatePicker({ value, onChange, className = '' }: JalaliDatePickerProps) {
  const today = todayJalali();

  const initial = value
    ? gregorianToJalali(value)
    : today;

  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);
  const [open, setOpen] = useState(false);

  const selectedJalali = value ? gregorianToJalali(value) : null;

  const daysInMonth = jalaliDaysInMonth(viewYear, viewMonth);
  const startOffset = firstDayOfMonth(viewYear, viewMonth);

  function prevMonth() {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function selectDay(day: number) {
    const gregorian = jalaliToGregorian(viewYear, viewMonth, day);
    onChange(gregorian);
    setOpen(false);
  }

  function isSelected(day: number) {
    return selectedJalali &&
      selectedJalali.year === viewYear &&
      selectedJalali.month === viewMonth &&
      selectedJalali.day === day;
  }

  function isToday(day: number) {
    return today.year === viewYear && today.month === viewMonth && today.day === day;
  }

  const displayValue = value
    ? (() => {
        const { year, month, day } = gregorianToJalali(value);
        return `${toPersianDigits(year)}/${toPersianDigits(String(month).padStart(2, '0'))}/${toPersianDigits(String(day).padStart(2, '0'))}`;
      })()
    : '';

  // Build grid cells: empty cells for offset + day cells
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className={`relative ${className}`} dir="rtl">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white flex items-center justify-between"
      >
        <span className={displayValue ? 'text-gray-900' : 'text-gray-400'}>
          {displayValue || 'انتخاب تاریخ'}
        </span>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {/* Dropdown calendar */}
      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-72">
          {/* Header: prev/month-year/next */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-medium text-gray-800">
              {PERSIAN_MONTHS[viewMonth - 1]} {toPersianDigits(viewYear)}
            </span>
            <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEK_DAYS.map(wd => (
              <div key={wd} className="text-center text-xs text-gray-400 font-medium py-1">{wd}</div>
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
                  {toPersianDigits(day)}
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
              پاک کردن
            </button>
            <button
              type="button"
              onClick={() => {
                setViewYear(today.year);
                setViewMonth(today.month);
                selectDay(today.day);
              }}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              امروز
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
