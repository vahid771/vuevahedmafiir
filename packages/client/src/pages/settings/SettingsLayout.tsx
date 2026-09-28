import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function SettingsLayout() {
  const { t } = useTranslation();

  const tabs = [
    { to: '/settings/calendar', label: t('settings.tabCalendar') },
    { to: '/settings/language', label: t('settings.tabLanguage') },
    { to: '/settings/location', label: t('settings.tabLocation', { defaultValue: 'Location' }) },
    { to: '/settings/holidays', label: t('settings.tabHolidays') },
    { to: '/settings/integrations', label: t('settings.tabIntegrations') },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
        {t('settings.title')}
      </h1>

      <nav className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6">
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
