import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCalendar } from '../../context/CalendarContext';
import { useTranslation } from 'react-i18next';
import { useCountryList, useCountryName } from './CalendarSettingsPage';
import FlagImg from '../../components/FlagImg';


function SelectedCountryBadge({ code }: { code: string }) {
  const name = useCountryName(code) ?? code;
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
      <FlagImg code={code} className="w-6 h-[18px]" />
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{name}</span>
    </div>
  );
}

function CountrySelect({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (code: string) => void }) {
  const { t } = useTranslation();
  const countries = useCountryList();
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
    >
      <option value="">{t('settings.countryNotSet')}</option>
      {countries.map(c => (
        <option key={c.code} value={c.code}>{c.name}</option>
      ))}
    </select>
  );
}


export default function LocationSettingsPage() {
  const { country, setCountry } = useCalendar();
  const { t } = useTranslation();

  const [locationSaving, setLocationSaving] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationSaved, setLocationSaved] = useState(false);

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

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{t('settings.locationHolidays')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('settings.locationHolidaysDesc')}</p>
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
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 disabled:opacity-50 transition-colors"
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

          {/* Selected-country flag badge */}
          {country && <SelectedCountryBadge code={country} />}

          <CountrySelect
            value={country ?? ''}
            disabled={locationSaving}
            onChange={handleCountrySelect}
          />
        </div>

        {country && (
          <div className="pt-2">
            <Link
              to="/settings/holidays"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('settings.manageHolidays', { defaultValue: 'Manage holidays & weekends →' })}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
