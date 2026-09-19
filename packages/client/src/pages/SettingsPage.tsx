import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useCalendar } from '../context/CalendarContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import type { CalendarType } from '../api/preferences';
import HolidaysSettingsPanel from '../components/HolidaysSettingsPanel';
import {
  getGoogleDriveStatus,
  disconnectGoogleDrive,
  getGoogleConnectUrl,
} from '../api/google';
import {
  getGoogleTasksStatus,
  getGoogleTasksConnectUrl,
  disconnectGoogleTasks,
} from '../api/googleTasks';
import {
  getGoogleCalendarStatus,
  getGoogleCalendarConnectUrl,
  disconnectGoogleCalendar,
} from '../api/googleCalendar';

const COUNTRY_LIST: { code: string; name: string }[] = [
  { code: 'AF', name: 'Afghanistan' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CA', name: 'Canada' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EG', name: 'Egypt' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GR', name: 'Greece' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JP', name: 'Japan' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MX', name: 'Mexico' },
  { code: 'MA', name: 'Morocco' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'NO', name: 'Norway' },
  { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'KR', name: 'South Korea' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TR', name: 'Turkey' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VN', name: 'Vietnam' },
];

export default function SettingsPage() {
  const { calendar, setCalendar, country, setCountry } = useCalendar();
  const { lang, setLang } = useLanguage();
  const { token } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  const CALENDAR_OPTIONS: { value: CalendarType; labelKey: string; descKey: string }[] = [
    { value: 'miladi', labelKey: 'settings.miladiLabel', descKey: 'settings.miladiDesc' },
    { value: 'shamsi', labelKey: 'settings.shamsiLabel', descKey: 'settings.shamsiDesc' },
  ];

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Location state
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationSaved, setLocationSaved] = useState(false);

  // Google Drive state
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveLoading, setDriveLoading] = useState(true);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveSuccessBanner, setDriveSuccessBanner] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Google Calendar state
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarSuccessBanner, setCalendarSuccessBanner] = useState(false);
  const [calendarDisconnecting, setCalendarDisconnecting] = useState(false);

  // Google Tasks state
  const [tasksConnected, setTasksConnected] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [tasksSuccessBanner, setTasksSuccessBanner] = useState(false);
  const [tasksDisconnecting, setTasksDisconnecting] = useState(false);

  useEffect(() => {
    // Show success banner if redirected back from Drive OAuth
    const params = new URLSearchParams(location.search);
    if (params.get('drive') === 'connected') {
      setDriveSuccessBanner(true);
    }
    // Show success banner if redirected back from Calendar OAuth
    if (params.get('gcal') === 'connected') {
      setCalendarSuccessBanner(true);
    }
  }, [location.search]);

  useEffect(() => {
    if (!token) return;
    getGoogleDriveStatus(token)
      .then(s => setDriveConnected(s.connected))
      .catch(() => setDriveError('Failed to load Drive status'))
      .finally(() => setDriveLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    getGoogleCalendarStatus(token)
      .then(s => setCalendarConnected(s.connected))
      .catch(() => setCalendarError('Failed to load Google Calendar status'))
      .finally(() => setCalendarLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    getGoogleTasksStatus(token)
      .then(s => setTasksConnected(s.connected))
      .catch(() => setTasksError('Failed to load Google Tasks status'))
      .finally(() => setTasksLoading(false));
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
      setError(t('settings.failedSave'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDetectLocation() {
    if (!navigator.geolocation) {
      setLocationError(t('settings.locationFailed'));
      return;
    }
    setLocationSaving(true);
    setLocationError(null);
    setLocationSaved(false);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'User-Agent': 'LifeDashboard/1.0' } }
          );
          if (!res.ok) throw new Error('Nominatim error');
          const data = await res.json();
          const code: string = (data.address?.country_code ?? '').toUpperCase();
          if (!code || code.length !== 2) throw new Error('No country code');
          await setCountry(code);
          setLocationSaved(true);
          setTimeout(() => setLocationSaved(false), 2000);
        } catch {
          setLocationError(t('settings.locationFailed'));
        } finally {
          setLocationSaving(false);
        }
      },
      () => {
        setLocationError(t('settings.locationFailed'));
        setLocationSaving(false);
      }
    );
  }

  async function handleCountrySelect(code: string) {
    setLocationSaving(true);
    setLocationError(null);
    setLocationSaved(false);
    try {
      await setCountry(code || null);
      setLocationSaved(true);
      setTimeout(() => setLocationSaved(false), 2000);
    } catch {
      setLocationError(t('settings.locationFailed'));
    } finally {
      setLocationSaving(false);
    }
  }

  async function handleClearLocation() {
    try {
      await setCountry(null);
      setLocationSaved(false);
    } catch {
      /* non-fatal */
    }
  }

  async function handleLangChange(l: 'en' | 'fa') {
    try {
      await setLang(l);
    } catch {
      /* non-fatal */
    }
  }

  function handleDriveConnect() {
    if (!token) return;
    window.location.href = getGoogleConnectUrl(token);
  }

  async function handleDriveDisconnect() {
    if (!token) return;
    setDisconnecting(true);
    setDriveError(null);
    try {
      await disconnectGoogleDrive(token);
      setDriveConnected(false);
      setDriveSuccessBanner(false);
    } catch {
      setDriveError(t('settings.failedDisconnect'));
    } finally {
      setDisconnecting(false);
    }
  }

  function handleCalendarConnect() {
    if (!token) return;
    window.location.href = getGoogleCalendarConnectUrl(token);
  }

  async function handleCalendarDisconnect() {
    if (!token) return;
    setCalendarDisconnecting(true);
    setCalendarError(null);
    try {
      await disconnectGoogleCalendar(token);
      setCalendarConnected(false);
      setCalendarSuccessBanner(false);
    } catch {
      setCalendarError(t('settings.failedDisconnect'));
    } finally {
      setCalendarDisconnecting(false);
    }
  }

  function handleTasksConnect() {
    if (!token) return;
    window.location.href = getGoogleTasksConnectUrl(token);
  }

  async function handleTasksDisconnect() {
    if (!token) return;
    setTasksDisconnecting(true);
    setTasksError(null);
    try {
      await disconnectGoogleTasks(token);
      setTasksConnected(false);
      setTasksSuccessBanner(false);
    } catch {
      setTasksError(t('settings.failedDisconnect'));
    } finally {
      setTasksDisconnecting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-4 py-4">
      <h1 className="text-2xl font-bold text-gray-800">{t('settings.title')}</h1>

      {/* Language */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">{t('settings.language')}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{t('settings.languageDesc')}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleLangChange('en')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
              lang === 'en' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'
            }`}
          >
            {t('settings.english')}
          </button>
          <button
            type="button"
            onClick={() => handleLangChange('fa')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
              lang === 'fa' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'
            }`}
          >
            {t('settings.persian')}
          </button>
        </div>
      </div>

      {/* Calendar System */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800">{t('settings.calendarSystem')}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {t('settings.calendarSystemDesc')}
            </p>
          </div>
          {saving && <span className="text-xs text-gray-400">{t('settings.saving')}</span>}
          {saved && !saving && <span className="text-xs text-green-600 font-medium">{t('settings.saved')}</span>}
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
                  {t(opt.labelKey)}
                </span>
                {calendar === opt.value && (
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{t(opt.descKey)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Location & Holidays */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800">{t('settings.locationHolidays')}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{t('settings.locationHolidaysDesc')}</p>
          </div>
          <div className="flex items-center gap-2">
            {locationSaving && <span className="text-xs text-gray-400">{t('settings.saving')}</span>}
            {locationSaved && !locationSaving && <span className="text-xs text-green-600 font-medium">{t('settings.locationSaved')}</span>}
          </div>
        </div>

        {locationError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm flex justify-between">
            <span>{locationError}</span>
            <button onClick={() => setLocationError(null)} className="ml-4 font-bold">×</button>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={locationSaving}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0-1.105.895-2 2-2s2 .895 2 2-.895 2-2 2-2-.895-2-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z" />
              </svg>
              {locationSaving ? t('settings.detecting') : t('settings.detectLocation')}
            </button>
            {country && (
              <button
                type="button"
                onClick={handleClearLocation}
                className="text-sm text-gray-400 hover:text-red-500 transition-colors"
              >
                {t('settings.clearLocation')}
              </button>
            )}
          </div>

          <div>
            <select
              value={country ?? ''}
              onChange={e => handleCountrySelect(e.target.value)}
              disabled={locationSaving}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            >
              <option value="">{t('settings.countryNotSet')}</option>
              {COUNTRY_LIST.map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Holidays & Weekends management — shown when a country is selected */}
        {country && token && (
          <div className="pt-4 border-t border-gray-100">
            <HolidaysSettingsPanel token={token} />
          </div>
        )}
      </div>

      {/* Google Drive */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">{t('settings.googleDrive')}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{t('settings.googleDriveDesc')}</p>
        </div>

        {driveSuccessBanner && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded text-sm flex justify-between">
            <span>{t('settings.driveConnected')}</span>
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
          <p className="text-sm text-gray-400">{t('settings.loading')}</p>
        ) : driveConnected ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {t('settings.connected')}
            </div>
            <button
              onClick={handleDriveDisconnect}
              disabled={disconnecting}
              className="text-sm px-4 py-2 rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {disconnecting ? t('settings.disconnecting') : t('settings.disconnect')}
            </button>
          </div>
        ) : (
          <button
            onClick={handleDriveConnect}
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
            {t('settings.connectGoogleDrive')}
          </button>
        )}
      </div>

      {/* Google Tasks */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">{t('settings.googleTasks')}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{t('settings.googleTasksDesc')}</p>
        </div>

        {tasksSuccessBanner && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded text-sm flex justify-between">
            <span>{t('settings.tasksConnected')}</span>
            <button onClick={() => setTasksSuccessBanner(false)} className="ml-4 font-bold">×</button>
          </div>
        )}

        {tasksError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm flex justify-between">
            <span>{tasksError}</span>
            <button onClick={() => setTasksError(null)} className="ml-4 font-bold">×</button>
          </div>
        )}

        {tasksLoading ? (
          <p className="text-sm text-gray-400">{t('settings.loading')}</p>
        ) : tasksConnected ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{t('settings.connected')}</span>
            </div>
            <button
              onClick={handleTasksDisconnect}
              disabled={tasksDisconnecting}
              className="text-sm px-4 py-2 rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {tasksDisconnecting ? t('settings.disconnecting') : t('settings.disconnect')}
            </button>
          </div>
        ) : (
          <button
            onClick={handleTasksConnect}
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
            {t('settings.connectGoogleTasks')}
          </button>
        )}
      </div>

      {/* Google Calendar */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">{t('settings.googleCalendar')}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{t('settings.googleCalendarDesc')}</p>
        </div>

        {calendarSuccessBanner && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded text-sm flex justify-between">
            <span>{t('settings.calendarConnected')}</span>
            <button onClick={() => setCalendarSuccessBanner(false)} className="ml-4 font-bold">×</button>
          </div>
        )}

        {calendarError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm flex justify-between">
            <span>{calendarError}</span>
            <button onClick={() => setCalendarError(null)} className="ml-4 font-bold">×</button>
          </div>
        )}

        {calendarLoading ? (
          <p className="text-sm text-gray-400">{t('settings.loading')}</p>
        ) : calendarConnected ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {t('settings.connected')}
            </div>
            <button
              onClick={handleCalendarDisconnect}
              disabled={calendarDisconnecting}
              className="text-sm px-4 py-2 rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {calendarDisconnecting ? t('settings.disconnecting') : t('settings.disconnect')}
            </button>
          </div>
        ) : (
          <button
            onClick={handleCalendarConnect}
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
            {t('settings.connectGoogleCalendar')}
          </button>
        )}
      </div>
    </div>
  );
}
