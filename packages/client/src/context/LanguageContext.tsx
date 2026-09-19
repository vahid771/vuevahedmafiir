import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getPreferences, updatePreferences, LanguageType } from '../api/preferences';
import i18n from '../i18n';

interface LanguageContextValue {
  lang: LanguageType;
  setLang: (l: LanguageType) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const LS_LANG_KEY = 'app_lang';

function readStoredLang(): LanguageType {
  try {
    const v = localStorage.getItem(LS_LANG_KEY);
    if (v === 'fa' || v === 'en') return v;
  } catch { /* ignore */ }
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [lang, setLangState] = useState<LanguageType>(readStoredLang);

  // Apply stored language immediately on mount (before server responds)
  useEffect(() => {
    applyLang(readStoredLang());
  }, []);

  useEffect(() => {
    if (!token) return;
    getPreferences(token)
      .then(prefs => applyLang(prefs.language ?? 'en'))
      .catch(() => {/* keep default */});
  }, [token]);

  function applyLang(l: LanguageType) {
    setLangState(l);
    i18n.changeLanguage(l);
    document.documentElement.dir = l === 'fa' ? 'rtl' : 'ltr';
    document.documentElement.lang = l;
    try { localStorage.setItem(LS_LANG_KEY, l); } catch { /* ignore */ }
  }

  async function setLang(l: LanguageType) {
    // Apply locally immediately so the UI responds even if the server call fails
    applyLang(l);
    if (!token) return;
    try {
      await updatePreferences(token, { language: l });
    } catch {
      // Non-fatal: language change is applied in-memory; will revert to server value on next load
    }
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
