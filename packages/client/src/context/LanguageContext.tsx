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

const VALID_LANGS: LanguageType[] = ['en','fa','ar','zh','hi','es','fr','de','pt','ru','tr','id'];

function readStoredLang(): LanguageType {
  try {
    const v = localStorage.getItem(LS_LANG_KEY);
    if (v && VALID_LANGS.includes(v as LanguageType)) return v as LanguageType;
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
      .then(prefs => {
        const serverLang = prefs.language ?? 'en';
        const localLang = readStoredLang();
        if (serverLang !== localLang) {
          // localStorage has a more recent value (e.g. saved while server rejected it).
          // Apply local preference and push it to the server to sync.
          applyLang(localLang);
          updatePreferences(token, { language: localLang }).catch(() => {});
        } else {
          applyLang(serverLang);
        }
      })
      .catch(() => {/* keep default */});
  }, [token]);

  function applyLang(l: LanguageType) {
    setLangState(l);
    i18n.changeLanguage(l);
    document.documentElement.dir = (l === 'fa' || l === 'ar') ? 'rtl' : 'ltr';
    document.documentElement.lang = l;
    try { localStorage.setItem(LS_LANG_KEY, l); } catch { /* ignore */ }
    // For RTL-only prefs, patch text-align via attribute too
    document.documentElement.setAttribute('data-lang', l);
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
