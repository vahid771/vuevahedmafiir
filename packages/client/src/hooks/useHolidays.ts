import { useState, useEffect } from 'react';
import { apiUrl, authHeaders } from '../api/base';

export interface Holiday {
  date: string;       // YYYY-MM-DD (Gregorian)
  localName: string;
  name: string;       // English name
  nameFa: string;     // Persian name (from server translation map)
  types: string[];
  hidden: boolean;
  isCustom: boolean;
}

// ---------------------------------------------------------------------------
// Script-detection helpers
// ---------------------------------------------------------------------------

function hasArabicScript(s: string): boolean { return /[\u0600-\u06FF]/.test(s); }
function hasCjkScript(s: string): boolean    { return /[\u4E00-\u9FFF\u3400-\u4DBF]/.test(s); }
function hasDevanagari(s: string): boolean   { return /[\u0900-\u097F]/.test(s); }
function hasCyrillic(s: string): boolean     { return /[\u0400-\u04FF]/.test(s); }
function hasHebrew(s: string): boolean       { return /[\u0590-\u05FF]/.test(s); }
function hasEthiopic(s: string): boolean     { return /[\u1200-\u137F]/.test(s); }
function hasDevanagariExt(s: string): boolean { return hasDevanagari(s); }

// ---------------------------------------------------------------------------
// Built-in translation table: English holiday name → translated name
// Covers the most common public holidays across all supported languages.
// ---------------------------------------------------------------------------
const HOLIDAY_TRANSLATIONS: Record<string, Partial<Record<string, string>>> = {
  "New Year's Day": {
    es: 'Año Nuevo', fr: "Jour de l'An", de: 'Neujahr', pt: 'Ano Novo',
    ru: 'Новый год', tr: 'Yılbaşı', id: 'Tahun Baru', zh: '元旦', hi: 'नव वर्ष',
  },
  'Christmas Day': {
    es: 'Navidad', fr: 'Noël', de: 'Weihnachten', pt: 'Natal',
    ru: 'Рождество', tr: 'Noel', id: 'Natal', zh: '圣诞节', hi: 'क्रिसमस',
  },
  'Good Friday': {
    es: 'Viernes Santo', fr: 'Vendredi Saint', de: 'Karfreitag', pt: 'Sexta-Feira Santa',
    ru: 'Страстная пятница', tr: 'İyi Cuma', id: "Jumat Agung", zh: '耶稣受难日', hi: 'गुड फ्राइडे',
  },
  'Easter Monday': {
    es: 'Lunes de Pascua', fr: 'Lundi de Pâques', de: 'Ostermontag', pt: 'Segunda-feira de Páscoa',
    ru: 'Пасхальный понедельник', tr: 'Paskalya Pazartesi', id: 'Senin Paskah', zh: '复活节星期一', hi: 'ईस्टर सोमवार',
  },
  'Labour Day': {
    es: 'Día del Trabajo', fr: 'Fête du Travail', de: 'Tag der Arbeit', pt: 'Dia do Trabalho',
    ru: 'День труда', tr: 'İşçi Bayramı', id: 'Hari Buruh', zh: '劳动节', hi: 'मजदूर दिवस',
  },
  'Labor Day': {
    es: 'Día del Trabajo', fr: 'Fête du Travail', de: 'Tag der Arbeit', pt: 'Dia do Trabalho',
    ru: 'День труда', tr: 'İşçi Bayramı', id: 'Hari Buruh', zh: '劳动节', hi: 'मजदूर दिवस',
  },
  'Independence Day': {
    es: 'Día de la Independencia', fr: "Jour de l'Indépendance", de: 'Unabhängigkeitstag', pt: 'Dia da Independência',
    ru: 'День независимости', tr: 'Bağımsızlık Günü', id: 'Hari Kemerdekaan', zh: '独立日', hi: 'स्वतंत्रता दिवस',
  },
  'National Day': {
    es: 'Día Nacional', fr: 'Fête Nationale', de: 'Nationalfeiertag', pt: 'Dia Nacional',
    ru: 'Национальный день', tr: 'Ulusal Gün', id: 'Hari Nasional', zh: '国庆节', hi: 'राष्ट्रीय दिवस',
  },
  'Eid al-Fitr': {
    es: 'Eid al-Fitr', fr: 'Aïd el-Fitr', de: 'Eid al-Fitr', pt: 'Eid al-Fitr',
    ru: 'Ид аль-Фитр', tr: 'Ramazan Bayramı', id: 'Idul Fitri', zh: '开斋节', hi: 'ईद उल-फितर',
  },
  'Eid al-Adha': {
    es: 'Eid al-Adha', fr: 'Aïd el-Adha', de: 'Eid al-Adha', pt: 'Eid al-Adha',
    ru: 'Ид аль-Адха', tr: 'Kurban Bayramı', id: 'Idul Adha', zh: '宰牲节', hi: 'ईद उल-अज़हा',
  },
  'Nowruz': {
    es: 'Nowruz', fr: 'Norouz', de: 'Nowruz', pt: 'Nowruz',
    ru: 'Навруз', tr: 'Nevruz', id: 'Nowruz', zh: '诺鲁孜节', hi: 'नवरोज़',
  },
  'Islamic New Year': {
    es: 'Año Nuevo Islámico', fr: 'Nouvel An Islamique', de: 'Islamisches Neujahr', pt: 'Ano Novo Islâmico',
    ru: 'Исламский Новый год', tr: 'İslam Yeni Yılı', id: 'Tahun Baru Islam', zh: '伊斯兰新年', hi: 'इस्लामी नव वर्ष',
  },
  "Prophet's Birthday": {
    es: 'Cumpleaños del Profeta', fr: 'Anniversaire du Prophète', de: 'Geburtstag des Propheten', pt: 'Aniversário do Profeta',
    ru: 'День рождения Пророка', tr: 'Mevlid Kandili', id: 'Maulid Nabi', zh: '圣纪', hi: 'ईद मिलाद उन नबी',
  },
  'Ashura': {
    es: 'Asura', fr: 'Achoura', de: 'Ashura', pt: 'Ashura',
    ru: 'Ашура', tr: 'Aşure Günü', id: 'Asyura', zh: '阿舒拉节', hi: 'आशूरा',
  },
  'Republic Day': {
    es: 'Día de la República', fr: 'Fête de la République', de: 'Tag der Republik', pt: 'Dia da República',
    ru: 'День Республики', tr: 'Cumhuriyet Bayramı', id: 'Hari Republik', zh: '共和国日', hi: 'गणतंत्र दिवस',
  },
  'Constitution Day': {
    es: 'Día de la Constitución', fr: 'Fête de la Constitution', de: 'Verfassungstag', pt: 'Dia da Constituição',
    ru: 'День Конституции', tr: 'Anayasa Günü', id: 'Hari Konstitusi', zh: '宪法日', hi: 'संविधान दिवस',
  },
  'Victory Day': {
    es: 'Día de la Victoria', fr: 'Jour de la Victoire', de: 'Tag des Sieges', pt: 'Dia da Vitória',
    ru: 'День Победы', tr: 'Zafer Bayramı', id: 'Hari Kemenangan', zh: '胜利日', hi: 'विजय दिवस',
  },
  "International Women's Day": {
    es: 'Día Internacional de la Mujer', fr: 'Journée internationale de la femme', de: 'Internationaler Frauentag', pt: 'Dia Internacional da Mulher',
    ru: 'Международный женский день', tr: 'Dünya Kadınlar Günü', id: 'Hari Perempuan Internasional', zh: '国际妇女节', hi: 'अंतर्राष्ट्रीय महिला दिवस',
  },
  "Children's Day": {
    es: 'Día del Niño', fr: "Fête des enfants", de: 'Kindertag', pt: 'Dia das Crianças',
    ru: 'День защиты детей', tr: 'Çocuk Bayramı', id: 'Hari Anak', zh: '儿童节', hi: 'बाल दिवस',
  },
  'Chinese New Year': {
    es: 'Año Nuevo Chino', fr: 'Nouvel An Chinois', de: 'Chinesisches Neujahr', pt: 'Ano Novo Chinês',
    ru: 'Китайский Новый год', tr: 'Çin Yeni Yılı', id: 'Tahun Baru Imlek', zh: '春节', hi: 'चीनी नव वर्ष',
  },
  'Assumption of Mary': {
    es: 'Asunción de la Virgen', fr: 'Assomption', de: 'Mariä Himmelfahrt', pt: 'Assunção de Nossa Senhora',
    ru: 'Успение Пресвятой Богородицы', tr: "Meryem Ana'nın Göğe Yükselişi", id: 'Kenaikan Bunda Maria', zh: '圣母升天节', hi: 'मरियम की मान्यता',
  },
  "All Saints' Day": {
    es: 'Día de Todos los Santos', fr: 'Toussaint', de: 'Allerheiligen', pt: 'Dia de Todos os Santos',
    ru: 'День всех святых', tr: 'Azizler Günü', id: 'Hari Semua Orang Kudus', zh: '万圣节', hi: 'सब संतों का दिन',
  },
  'Ascension Day': {
    es: 'Día de la Ascensión', fr: "Jeudi de l'Ascension", de: 'Christi Himmelfahrt', pt: 'Dia da Ascensão',
    ru: 'Вознесение Господне', tr: "İsa'nın Göğe Yükselişi", id: 'Kenaikan Yesus Kristus', zh: '耶稣升天节', hi: 'असेंशन दिवस',
  },
  'Whit Monday': {
    es: 'Lunes de Pentecostés', fr: 'Lundi de Pentecôte', de: 'Pfingstmontag', pt: 'Segunda-feira de Pentecostes',
    ru: 'День Святого Духа', tr: 'Pentekost Pazartesi', id: 'Senin Pentakosta', zh: '圣灵降临节星期一', hi: 'व्हिट सोमवार',
  },
};

// localStorage key prefix for cached translations
const LS_CACHE_KEY = 'holiday_trans_v1';

/** Load the translation cache from localStorage. Returns map: `lang:englishName → translated` */
function loadTranslationCache(): Map<string, string> {
  try {
    const raw = localStorage.getItem(LS_CACHE_KEY);
    if (raw) return new Map(JSON.parse(raw) as [string, string][]);
  } catch { /* ignore */ }
  return new Map();
}

/** Save the translation cache back to localStorage. */
function saveTranslationCache(cache: Map<string, string>): void {
  try {
    localStorage.setItem(LS_CACHE_KEY, JSON.stringify(Array.from(cache.entries())));
  } catch { /* ignore — storage quota */ }
}

// Module-level cache (loaded once)
let _transCache: Map<string, string> | null = null;
function getTransCache(): Map<string, string> {
  if (!_transCache) _transCache = loadTranslationCache();
  return _transCache;
}

/**
 * Returns the best available display name for a holiday given the active UI language.
 *
 * Resolution order:
 *  1. `nameFa` when lang === 'fa' (server-provided Persian)
 *  2. `localName` when it's already in the correct script for the target language
 *  3. Built-in HOLIDAY_TRANSLATIONS table for the English name → target language
 *  4. Cached user-learned translation from localStorage
 *  5. `name` (English) as final fallback
 */
export function getHolidayDisplayName(h: Holiday, lang: string): string {
  // Persian: always use nameFa (server already translates this)
  if (lang === 'fa') return h.nameFa || h.name;

  // Arabic: prefer localName if it's in Arabic script
  if (lang === 'ar') {
    if (hasArabicScript(h.localName)) return h.localName;
    if (hasArabicScript(h.nameFa))   return h.nameFa;   // nameFa is sometimes Arabic
  }

  // Chinese: prefer localName if it contains CJK characters
  if (lang === 'zh' && hasCjkScript(h.localName)) return h.localName;

  // Hindi: prefer localName if Devanagari
  if (lang === 'hi' && hasDevanagariExt(h.localName)) return h.localName;

  // Russian: prefer localName if Cyrillic
  if (lang === 'ru' && hasCyrillic(h.localName)) return h.localName;

  // Hebrew UI language: prefer localName if Hebrew script
  // (not in LanguageType but guard anyway)
  if (lang === 'he' && hasHebrew(h.localName)) return h.localName;

  // Ethiopic UI: prefer localName if Ethiopic
  if (lang === 'am' && hasEthiopic(h.localName)) return h.localName;

  // Built-in translation table
  const tableEntry = HOLIDAY_TRANSLATIONS[h.name];
  if (tableEntry?.[lang]) return tableEntry[lang]!;

  // Partial match: strip trailing suffixes like " Holiday", " Eve" and try again
  const stripped = h.name.replace(/\s+(Holiday|Eve|Day \d|Observed)$/, '').trim();
  if (stripped !== h.name) {
    const strippedEntry = HOLIDAY_TRANSLATIONS[stripped];
    if (strippedEntry?.[lang]) return strippedEntry[lang]!;
  }

  // Cached learned translation
  const cacheKey = `${lang}:${h.name}`;
  const cached = getTransCache().get(cacheKey);
  if (cached) return cached;

  // English fallback
  return h.name;
}

/**
 * Store a user-provided translation into the cache so it persists across sessions.
 * Call this when the user manually edits a holiday name in the UI.
 */
export function cacheHolidayTranslation(lang: string, englishName: string, translated: string): void {
  const cache = getTransCache();
  cache.set(`${lang}:${englishName}`, translated);
  saveTranslationCache(cache);
}

// Module-level cache keyed by "CC-YYYY"
const cache = new Map<string, Holiday[]>();

// Global version counter — incremented by invalidateHolidayCache so all active
// useHolidays instances re-run their effect even if their own key wasn't affected
// (needed because the server's translation-memory means editing one year updates others).
let cacheVersion = 0;
const versionListeners = new Set<() => void>();

function notifyVersionChange() {
  cacheVersion++;
  versionListeners.forEach(fn => fn());
}

/** Remove a specific country+year from the cache and wake all useHolidays subscribers. */
export function invalidateHolidayCache(countryCode: string, year: number): void {
  cache.delete(`${countryCode}-${year}`);
  notifyVersionChange();
}

/** Wipe the entire cache for a country (all years) and wake all subscribers. */
export function invalidateAllHolidayCacheForCountry(countryCode: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${countryCode}-`)) cache.delete(key);
  }
  notifyVersionChange();
}

/**
 * Fetches public holidays for a country+year from the server proxy endpoint.
 * Re-fetches whenever the cache is invalidated, even if deps haven't changed.
 */
export function useHolidays(countryCode: string | null, year: number, token: string | null): Holiday[] {
  const [holidays, setHolidays] = useState<Holiday[]>(() => {
    if (!countryCode) return [];
    return cache.get(`${countryCode}-${year}`) ?? [];
  });

  // Track the version seen by this instance so a version bump forces a re-fetch
  const [, setVersion] = useState(cacheVersion);

  useEffect(() => {
    // Subscribe to version changes so invalidation wakes this hook
    const onInvalidate = () => setVersion(v => v + 1);
    versionListeners.add(onInvalidate);
    return () => { versionListeners.delete(onInvalidate); };
  }, []);

  useEffect(() => {
    if (!countryCode || !token) {
      setHolidays([]);
      return;
    }

    const key = `${countryCode}-${year}`;
    if (cache.has(key)) {
      setHolidays(cache.get(key)!);
      return;
    }

    let cancelled = false;
    fetch(apiUrl(`/api/holidays?country=${countryCode}&year=${year}`), {
      headers: authHeaders(token),
    })
      .then(res => {
        if (!res.ok) return [] as Holiday[];
        return res.json() as Promise<Holiday[]>;
      })
      .then(data => {
        if (cancelled) return;
        cache.set(key, data);
        setHolidays(data);
      })
      .catch(() => {
        if (!cancelled) setHolidays([]);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode, year, token, cacheVersion]);

  return holidays;
}
