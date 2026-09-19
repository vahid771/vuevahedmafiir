import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface NavItem {
  to: string;
  labelKey: string;
  icon: JSX.Element;
}

const navItems: NavItem[] = [
  {
    to: '/dashboard',
    labelKey: 'nav.dashboard',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    to: '/tasks',
    labelKey: 'nav.tasks',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    to: '/bills',
    labelKey: 'nav.bills',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    to: '/reminders',
    labelKey: 'nav.reminders',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    to: '/habits',
    labelKey: 'nav.habits',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    to: '/dates',
    labelKey: 'nav.dates',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    to: '/documents',
    labelKey: 'nav.documents',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
];

const settingsItem: NavItem = {
  to: '/settings',
  labelKey: 'nav.settings',
  icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ collapsed, mobileOpen, onClose }: SidebarProps) {
  const { t } = useTranslation();
  // On mobile: fixed overlay, slide in/out via translate
  // On md+: relative, always visible, width toggled by collapsed prop
  const navLinkClass = (isActive: boolean) =>
    `flex items-center gap-3 px-3 py-2 mx-2 rounded-md text-sm font-medium transition-colors ${
      isActive ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
    } ${collapsed ? 'md:justify-center md:px-0' : ''}`;

  return (
    <nav
      className={[
        'flex flex-col h-full bg-gray-900 dark:bg-gray-950 text-gray-300 transition-transform duration-200',
        // Mobile: fixed drawer, slides in from left
        'fixed inset-y-0 left-0 z-40 w-64',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        // Desktop: relative, no translate, width from collapsed state
        `md:relative md:inset-auto md:z-auto md:translate-x-0`,
        collapsed ? 'md:w-14' : 'md:w-56',
      ].join(' ')}
    >
      <div className={`flex items-center h-14 px-3 border-b border-gray-700 dark:border-gray-800 ${collapsed ? 'md:justify-center' : ''}`}>
        {/* Always show full title in mobile drawer; respect collapsed on desktop */}
        <span className={`text-white font-semibold text-sm tracking-wide truncate ${collapsed ? 'md:hidden' : ''}`}>
          {t('layout.appName')}
        </span>
        {collapsed && (
          <span className="hidden md:block text-white font-bold text-base">{t('layout.appShort')}</span>
        )}
      </div>
      <ul className="flex-1 py-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => navLinkClass(isActive)}
              title={collapsed ? t(item.labelKey) : undefined}
            >
              {item.icon}
              <span className={`truncate ${collapsed ? 'md:hidden' : ''}`}>{t(item.labelKey)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="py-3 border-t border-gray-700">
        <NavLink
          to={settingsItem.to}
          onClick={onClose}
          className={({ isActive }) => navLinkClass(isActive)}
          title={collapsed ? t(settingsItem.labelKey) : undefined}
        >
          {settingsItem.icon}
          <span className={`truncate ${collapsed ? 'md:hidden' : ''}`}>{t(settingsItem.labelKey)}</span>
        </NavLink>
      </div>
    </nav>
  );
}
