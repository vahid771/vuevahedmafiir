import { useState } from 'react';
import { useCalendar } from '../context/CalendarContext';
import type { CalendarType } from '../api/preferences';

const CALENDAR_OPTIONS: { value: CalendarType; label: string; description: string }[] = [
  {
    value: 'miladi',
    label: 'Miladi (Gregorian)',
    description: 'Standard international calendar. Dates shown like "Jan 5, 2025".',
  },
  {
    value: 'shamsi',
    label: 'Shamsi (Jalali / Persian)',
    description: 'Persian solar calendar. Dates shown like "۱۶ دی ۱۴۰۳".',
  },
];

export default function SettingsPage() {
  const { calendar, setCalendar } = useCalendar();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(value: CalendarType) {
    if (value === calendar) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await setCalendar(value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save preference. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Settings</h1>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Calendar System</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Choose how dates are displayed and entered throughout the app.
            </p>
          </div>
          {saving && (
            <span className="text-xs text-gray-400">Saving…</span>
          )}
          {saved && !saving && (
            <span className="text-xs text-green-600 font-medium">✓ Saved</span>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4 font-bold">×</button>
          </div>
        )}

        <div className="space-y-3">
          {CALENDAR_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              disabled={saving}
              onClick={() => handleSelect(opt.value)}
              className={[
                'w-full text-left px-4 py-3 rounded-lg border-2 transition-colors disabled:opacity-50',
                calendar === opt.value
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${calendar === opt.value ? 'text-blue-700' : 'text-gray-800'}`}>
                  {opt.label}
                </span>
                {calendar === opt.value && (
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
