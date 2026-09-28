import { useMemo, useState, useEffect, useRef } from 'react';
import { getTodayInCalendar } from '../../utils/calendarDate';
import { useCalendar } from '../../context/CalendarContext';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import type { CalendarType } from '../../api/preferences';

// ISO 3166-1 alpha-2 codes for all supported countries
const COUNTRY_CODES: string[] = [
  'AF','DZ','AR','AU','AT','BE','BR','CA','CL','CN','CO','HR','CZ','DK',
  'EG','FI','FR','DE','GR','HU','IN','ID','IR','IQ','IE','IL','IT','JP',
  'JO','KZ','KW','MY','MX','MA','NL','NZ','NG','NO','OM','PK','PE','PH',
  'PL','PT','QA','RO','RU','SA','RS','SG','ZA','KR','ES','SE','CH','TW',
  'TH','TR','UA','AE','GB','US','UZ','VN',
];

/**
 * Returns country display names in the active UI language, sorted alphabetically.
 * Uses Intl.DisplayNames; falls back to the ISO code if unavailable.
 */
export function useCountryList(): { code: string; name: string }[] {
  const { lang } = useLanguage();
  return useMemo(() => {
    let dn: Intl.DisplayNames | null = null;
    try { dn = new Intl.DisplayNames([lang], { type: 'region' }); } catch { /* fallback */ }
    return COUNTRY_CODES
      .map(code => ({ code, name: dn?.of(code) ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [lang]);
}

/** Returns the display name for a single country code in the active UI language. */
export function useCountryName(code: string | null | undefined): string | null {
  const { lang } = useLanguage();
  return useMemo(() => {
    if (!code) return null;
    try {
      return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code;
    } catch {
      return code;
    }
  }, [code, lang]);
}

export default function CalendarSettingsPage() {
  const {
    calendar, setCalendar,
    secondaryCalendar, setSecondaryCalendar,
    tertiaryCalendar, setTertiaryCalendar,
  } = useCalendar();
  const { t } = useTranslation();

  const CALENDAR_OPTIONS: { value: CalendarType; labelKey: string; symbolKey: string; infoKey: string }[] = [
    { value: 'miladi',    labelKey: 'settings.miladiLabel',    symbolKey: 'settings.miladiSymbol',    infoKey: 'settings.miladiInfo' },
    { value: 'shamsi',    labelKey: 'settings.shamsiLabel',    symbolKey: 'settings.shamsiSymbol',    infoKey: 'settings.shamsiInfo' },
    { value: 'qamari',   labelKey: 'settings.qamariLabel',    symbolKey: 'settings.qamariSymbol',    infoKey: 'settings.qamariInfo' },
    { value: 'hebrew',   labelKey: 'settings.hebrewLabel',    symbolKey: 'settings.hebrewSymbol',    infoKey: 'settings.hebrewInfo' },
    { value: 'chinese',  labelKey: 'settings.chineseLabel',   symbolKey: 'settings.chineseSymbol',   infoKey: 'settings.chineseInfo' },
    { value: 'saka',     labelKey: 'settings.sakaLabel',      symbolKey: 'settings.sakaSymbol',      infoKey: 'settings.sakaInfo' },
    { value: 'ethiopian',labelKey: 'settings.ethiopianLabel', symbolKey: 'settings.ethiopianSymbol', infoKey: 'settings.ethiopianInfo' },
  ];

  // Pre-compute today's date in every calendar system (memoised — stable for a given day)
  const todayStrings = useRef<Partial<Record<CalendarType, string>>>({});
  useEffect(() => {
    for (const opt of CALENDAR_OPTIONS) {
      todayStrings.current[opt.value] = getTodayInCalendar(opt.value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Also compute synchronously on first render so SSR / first paint is not blank
  if (Object.keys(todayStrings.current).length === 0) {
    for (const opt of CALENDAR_OPTIONS) {
      todayStrings.current[opt.value] = getTodayInCalendar(opt.value);
    }
  }

  const ALL_CALS: CalendarType[] = ['miladi', 'shamsi', 'qamari', 'hebrew', 'chinese', 'saka', 'ethiopian'];

  const CAL_LABEL: Record<CalendarType, string> = {
    miladi:    t('settings.miladiLabel'),
    shamsi:    t('settings.shamsiLabel'),
    qamari:    t('settings.qamariLabel'),
    hebrew:    t('settings.hebrewLabel'),
    chinese:   t('settings.chineseLabel'),
    saka:      t('settings.sakaLabel'),
    ethiopian: t('settings.ethiopianLabel'),
  };

  const nonPrimary = ALL_CALS.filter(c => c !== calendar);
  const tertiaryCandidates = secondaryCalendar
    ? ALL_CALS.filter(c => c !== calendar && c !== secondaryCalendar)
    : [];

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Calendar System */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{t('settings.calendarSystem')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('settings.calendarSystemDesc')}</p>
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

        <div className="grid grid-cols-2 gap-3">
          {CALENDAR_OPTIONS.map(opt => {
            const isSelected = calendar === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={saving}
                onClick={() => handleCalendarSelect(opt.value)}
                className={[
                  'relative text-left p-4 rounded-xl border-2 transition-all disabled:opacity-50',
                  isSelected
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 shadow-sm'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800',
                ].join(' ')}
              >
                {/* Checkmark badge */}
                {isSelected && (
                  <span className="absolute top-2.5 right-2.5">
                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}

                {/* Symbol */}
                <div className="text-2xl mb-2 leading-none" aria-hidden="true">
                  {t(opt.symbolKey)}
                </div>

                {/* Name */}
                <div className={`text-sm font-semibold leading-tight ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-gray-800 dark:text-gray-100'}`}>
                  {t(opt.labelKey)}
                </div>

                {/* Today's date in this calendar */}
                <div className={`mt-1 text-xs font-mono tabular-nums ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                  {todayStrings.current[opt.value]}
                </div>

                {/* Info line */}
                <div className="mt-1.5 text-xs text-gray-400 dark:text-gray-500 leading-tight">
                  {t(opt.infoKey)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Secondary / Tertiary Calendar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{t('settings.subCalendarTitle')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('settings.subCalendarDesc')}</p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.secondaryCalendar')}</label>
          <select
            value={secondaryCalendar ?? ''}
            onChange={e => setSecondaryCalendar((e.target.value as CalendarType) || null)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">{t('settings.subCalendarNone')}</option>
            {nonPrimary.map(c => (
              <option key={c} value={c}>{CAL_LABEL[c]}</option>
            ))}
          </select>
        </div>

        {secondaryCalendar && (
          <div className="space-y-1 pt-3 border-t border-gray-100 dark:border-gray-700">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.tertiaryCalendar')}</label>
            <select
              value={tertiaryCalendar ?? ''}
              onChange={e => setTertiaryCalendar((e.target.value as CalendarType) || null)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">{t('settings.subCalendarNone')}</option>
              {tertiaryCandidates.map(c => (
                <option key={c} value={c}>{CAL_LABEL[c]}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
