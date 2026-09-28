import { Link } from 'react-router-dom';
import { useCalendar } from '../../context/CalendarContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import HolidaysSettingsPanel from '../../components/HolidaysSettingsPanel';
import { useCountryName } from './CalendarSettingsPage';
import FlagImg from '../../components/FlagImg';

export default function HolidaysSettingsPage() {
  const { country } = useCalendar();
  const { token } = useAuth();
  const { t } = useTranslation();

  const countryName = useCountryName(country);

  return (
    <div className="space-y-4">
      {/* Location banner — links to Location tab */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {country
            ? <FlagImg code={country} className="w-5 h-[15px]" />
            : <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0-1.105.895-2 2-2s2 .895 2 2-.895 2-2 2-2-.895-2-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z" />
              </svg>
          }
          {countryName
            ? <span>{t('settings.currentCountry', { country: countryName })}</span>
            : <span className="italic text-gray-400">{t('settings.countryNotSet')}</span>}
        </div>
        <Link
          to="/settings/location"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap ml-4"
        >
          {countryName
            ? t('settings.changeLocation')
            : t('settings.setLocation')}
        </Link>
      </div>

      {/* Holidays panel */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        {country && token ? (
          <HolidaysSettingsPanel token={token} />
        ) : (
          <p className="text-sm text-gray-400 italic">
            {t('settings.setCountryFirst')}
          </p>
        )}
      </div>
    </div>
  );
}
