import { useEffect, useState, useRef } from 'react';
import { useCalendar } from '../context/CalendarContext';
import { useTranslation } from 'react-i18next';
import FlagImg from './FlagImg';
import { getTimezoneOffset } from '../utils/timezones';

function formatTime(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function formatDate(date: Date, tz: string, locale = 'en'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export default function LiveClockWidget() {
  const { timezone, country } = useCalendar();
  const { i18n } = useTranslation();

  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const activeTz = timezone ?? browserTz;

  const [now, setNow] = useState(() => new Date());
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    function tick() {
      setNow(new Date());
      // Schedule next tick at the start of the next second
      const ms = 1000 - (Date.now() % 1000);
      frameRef.current = window.setTimeout(tick, ms);
    }
    tick();
    return () => {
      if (frameRef.current !== null) clearTimeout(frameRef.current);
    };
  }, []);

  const timeStr = formatTime(now, activeTz);
  const dateStr = formatDate(now, activeTz, i18n.language);
  const offsetStr = getTimezoneOffset(activeTz);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {/* Time */}
          <div
            className="text-4xl font-mono font-semibold tabular-nums tracking-tight text-gray-900 dark:text-gray-50 leading-none"
            aria-live="polite"
            aria-atomic="true"
          >
            {timeStr}
          </div>

          {/* Date */}
          <div className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 truncate">
            {dateStr}
          </div>

          {/* Timezone label */}
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300 truncate">
              {activeTz}
            </span>
            <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
              {offsetStr}
            </span>
            {!timezone && (
              <span className="text-xs text-gray-400 italic">browser</span>
            )}
          </div>
        </div>

        {/* Country flag */}
        {country && (
          <FlagImg code={country} className="w-9 h-[27px] rounded-sm shrink-0 mt-1" />
        )}
      </div>
    </div>
  );
}
