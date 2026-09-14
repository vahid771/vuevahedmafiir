import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useCalendar } from '../context/CalendarContext';
import { useAuth } from '../context/AuthContext';
import type { CalendarType } from '../api/preferences';
import {
  getGoogleDriveStatus,
  disconnectGoogleDrive,
  getGoogleConnectUrl,
} from '../api/google';

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
  const { token } = useAuth();
  const location = useLocation();

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google Drive state
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveLoading, setDriveLoading] = useState(true);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveSuccessBanner, setDriveSuccessBanner] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    // Show success banner if redirected back from OAuth
    const params = new URLSearchParams(location.search);
    if (params.get('drive') === 'connected') {
      setDriveSuccessBanner(true);
    }
  }, [location.search]);

  useEffect(() => {
    if (!token) return;
    getGoogleDriveStatus(token)
      .then(s => setDriveConnected(s.connected))
      .catch(() => setDriveError('Failed to load Drive status'))
      .finally(() => setDriveLoading(false));
  }, [token]);

  async function handleCalendarSelect(value: CalendarType) {
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

  function handleConnect() {
    if (!token) return;
    window.location.href = getGoogleConnectUrl(token);
  }

  async function handleDisconnect() {
    if (!token) return;
    setDisconnecting(true);
    setDriveError(null);
    try {
      await disconnectGoogleDrive(token);
      setDriveConnected(false);
      setDriveSuccessBanner(false);
    } catch {
      setDriveError('Failed to disconnect. Please try again.');
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Settings</h1>

      {/* Calendar System */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Calendar System</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Choose how dates are displayed and entered throughout the app.
            </p>
          </div>
          {saving && <span className="text-xs text-gray-400">Saving…</span>}
          {saved && !saving && <span className="text-xs text-green-600 font-medium">✓ Saved</span>}
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
              onClick={() => handleCalendarSelect(opt.value)}
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

      {/* Google Drive */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Google Drive</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Connect your Google account to save uploaded documents directly to your Drive in a
            folder called <span className="font-medium text-gray-700">"Personal Life Dashboard"</span>.
          </p>
        </div>

        {driveSuccessBanner && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded text-sm flex justify-between">
            <span>Google Drive connected successfully.</span>
            <button onClick={() => setDriveSuccessBanner(false)} className="ml-4 font-bold">×</button>
          </div>
        )}

        {driveError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm flex justify-between">
            <span>{driveError}</span>
            <button onClick={() => setDriveError(null)} className="ml-4 font-bold">×</button>
          </div>
        )}

        {driveLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : driveConnected ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Connected
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-sm px-4 py-2 rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 hover:border-gray-400 transition-colors"
          >
            <svg viewBox="0 0 87.3 78" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
              <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
              <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
              <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
              <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
              <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
              <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 27h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
            </svg>
            Connect Google Drive
          </button>
        )}
      </div>
    </div>
  );
}
