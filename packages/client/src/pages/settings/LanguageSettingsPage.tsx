import { useLanguage } from '../../context/LanguageContext';
import { useTranslation } from 'react-i18next';
import type { LanguageType } from '../../api/preferences';
import FlagImg from '../../components/FlagImg';

interface LangOption {
  code: LanguageType;
  /** ISO 3166-1 alpha-2 country code for the flag image */
  flagCode: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
}

const LANGUAGES: LangOption[] = [
  { code: 'en', flagCode: 'gb', nativeName: 'English',           dir: 'ltr' },
  { code: 'fa', flagCode: 'ir', nativeName: 'فارسی',            dir: 'rtl' },
  { code: 'ar', flagCode: 'sa', nativeName: 'العربية',          dir: 'rtl' },
  { code: 'zh', flagCode: 'cn', nativeName: '中文',             dir: 'ltr' },
  { code: 'hi', flagCode: 'in', nativeName: 'हिन्दी',          dir: 'ltr' },
  { code: 'es', flagCode: 'es', nativeName: 'Español',          dir: 'ltr' },
  { code: 'fr', flagCode: 'fr', nativeName: 'Français',         dir: 'ltr' },
  { code: 'de', flagCode: 'de', nativeName: 'Deutsch',          dir: 'ltr' },
  { code: 'pt', flagCode: 'br', nativeName: 'Português',        dir: 'ltr' },
  { code: 'ru', flagCode: 'ru', nativeName: 'Русский',          dir: 'ltr' },
  { code: 'tr', flagCode: 'tr', nativeName: 'Türkçe',           dir: 'ltr' },
  { code: 'id', flagCode: 'id', nativeName: 'Bahasa Indonesia', dir: 'ltr' },
];

export default function LanguageSettingsPage() {
  const { lang, setLang } = useLanguage();
  const { t } = useTranslation();

  async function handleLangChange(code: LanguageType) {
    try {
      await setLang(code);
    } catch {
      /* non-fatal */
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{t('settings.language')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('settings.languageDesc')}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {LANGUAGES.map(({ code, flagCode, nativeName, dir }) => {
            const active = lang === code;
            return (
              <button
                key={code}
                type="button"
                dir={dir}
                onClick={() => handleLangChange(code)}
                className={[
                  'flex items-center justify-center gap-2.5 px-3 py-2.5 rounded-lg border-2 text-sm font-semibold transition-colors',
                  active
                    ? 'border-blue-600 bg-blue-600 text-white dark:bg-blue-600 dark:border-blue-500'
                    : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800 font-medium',
                ].join(' ')}
              >
                <FlagImg code={flagCode} className="w-5 h-[15px]" />
                <span className="truncate">{nativeName}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
