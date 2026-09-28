import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useCalendar } from '../context/CalendarContext';
import { useLanguage } from '../context/LanguageContext';
import {
  getHolidays,
  upsertHoliday,
  deleteHolidayOverride,
  getWeekends,
  saveWeekends,
  resetWeekends,
  importHolidays,
  translateHolidays,
  type Holiday,
} from '../api/holidays';
import type { CalendarType } from '../api/preferences';
import { invalidateHolidayCache, invalidateAllHolidayCacheForCountry, getHolidayDisplayName, cacheHolidayTranslation } from '../hooks/useHolidays';
import { invalidateWeekendsCache } from '../hooks/useWeekends';
import { toJalaliDisplay, toPersianDigits } from '../utils/jalali';
import { toHijriDisplay, toArabicDigits, hijriToGregorian, gregorianToHijri } from '../utils/hijri';
import { gregorianToHebrew, hebrewToGregorian, toHebrewDigits, HEBREW_MONTHS } from '../utils/hebrew';
import { gregorianToChinese, chineseToGregorian, toChineseDigits, CHINESE_MONTHS } from '../utils/chinese';
import { gregorianToSaka, sakaToGregorian, sakaDaysInMonth, toSakaDigits, SAKA_MONTHS } from '../utils/saka';
import { gregorianToEthiopian, ethiopianToGregorian, ethiopianDaysInMonth, toEthiopianDigits, ETHIOPIAN_MONTHS } from '../utils/ethiopian';
import DateInput from './DateInput';
import { toJalaali, toGregorian } from 'jalaali-js';

// ---------------------------------------------------------------------------
// Per-calendar year helpers
// ---------------------------------------------------------------------------

/** Simple Jalali leap year check (33-year cycle). */
function isJalaliLeap(jy: number): boolean {
  const rem = ((jy - (jy > 0 ? 474 : 473)) % 2820 + 474 + 38) * 682;
  return (rem % 2816) < 682;
}

interface CalYearRange {
  /** Gregorian years to fetch (1 or 2 distinct values) */
  gy1: number;
  gy2: number;
  /** ISO date boundaries for filtering results to this calendar year */
  startDate: string;
  endDate: string;
}

/**
 * Returns helpers for working with years in any calendar system.
 * currentYear()        → current year in that calendar
 * toGregorianRange(y)  → { gy1, gy2, startDate, endDate }
 * formatYear(y)        → display string with the calendar's digit system
 */
function calYearHelpers(cal: CalendarType) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  switch (cal) {
    case 'shamsi': {
      const currentYear = () => {
        const { jy } = toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
        return jy;
      };
      const toGregorianRange = (jy: number): CalYearRange => {
        const { gy: gy1 } = toGregorian(jy, 1, 1);
        const lastDay = isJalaliLeap(jy) ? 30 : 29;
        const { gy: gy2 } = toGregorian(jy, 12, lastDay);
        const { gm: sm, gd: sd } = toGregorian(jy, 1, 1);
        const { gm: em, gd: ed } = toGregorian(jy, 12, lastDay);
        const startDate = `${gy1}-${String(sm).padStart(2, '0')}-${String(sd).padStart(2, '0')}`;
        const endDate   = `${gy2 === gy1 ? gy1 : gy2}-${String(em).padStart(2, '0')}-${String(ed).padStart(2, '0')}`;
        return { gy1, gy2: gy2 === gy1 ? gy1 + 1 : gy2, startDate, endDate };
      };
      return { currentYear, toGregorianRange, formatYear: (y: number) => toPersianDigits(y) };
    }

    case 'qamari': {
      const currentYear = () => gregorianToHijri(todayStr).year;
      const toGregorianRange = (hy: number): CalYearRange => {
        const startDate = hijriToGregorian(hy, 1, 1);
        const endDate   = hijriToGregorian(hy, 12, 29); // Hijri months are 29 or 30; 29 is always safe
        const gy1 = Number(startDate.slice(0, 4));
        const gy2 = Number(endDate.slice(0, 4));
        return { gy1, gy2: gy2 === gy1 ? gy1 + 1 : gy2, startDate, endDate };
      };
      return { currentYear, toGregorianRange, formatYear: (y: number) => toArabicDigits(y) };
    }

    case 'hebrew': {
      const currentYear = () => gregorianToHebrew(todayStr).year;
      const toGregorianRange = (hy: number): CalYearRange => {
        const startDate = hebrewToGregorian(hy, 1, 1);
        // Hebrew leap year has 13 months; non-leap has 12. Both end with Elul (29 days).
        // Detect leap: (7*hY + 1) % 19 < 7
        const isLeap = ((7 * hy + 1) % 19) < 7;
        const endDate = hebrewToGregorian(hy, isLeap ? 13 : 12, 29);
        const gy1 = Number(startDate.slice(0, 4));
        const gy2 = Number(endDate.slice(0, 4));
        return { gy1, gy2: gy2 === gy1 ? gy1 + 1 : gy2, startDate, endDate };
      };
      return { currentYear, toGregorianRange, formatYear: (y: number) => toHebrewDigits(y) };
    }

    case 'chinese': {
      const currentYear = () => gregorianToChinese(todayStr).year;
      const toGregorianRange = (cy: number): CalYearRange => {
        const startDate = chineseToGregorian(cy, 1, 1);
        // Chinese year ends at month 12, day 29 (safe — month 12 is always 29 or 30)
        const endDate = chineseToGregorian(cy, 12, 29);
        const gy1 = Number(startDate.slice(0, 4));
        const gy2 = Number(endDate.slice(0, 4));
        return { gy1, gy2, startDate, endDate };
      };
      return { currentYear, toGregorianRange, formatYear: (y: number) => toChineseDigits(y) };
    }

    case 'saka': {
      const currentYear = () => gregorianToSaka(todayStr).year;
      const toGregorianRange = (sy: number): CalYearRange => {
        const startDate = sakaToGregorian(sy, 1, 1);
        const lastDay   = sakaDaysInMonth(sy, 12); // Phalguna: always 30
        const endDate   = sakaToGregorian(sy, 12, lastDay);
        const gy1 = Number(startDate.slice(0, 4));
        const gy2 = Number(endDate.slice(0, 4));
        return { gy1, gy2, startDate, endDate };
      };
      return { currentYear, toGregorianRange, formatYear: (y: number) => toSakaDigits(y) };
    }

    case 'ethiopian': {
      const currentYear = () => gregorianToEthiopian(todayStr).year;
      const toGregorianRange = (ey: number): CalYearRange => {
        const startDate = ethiopianToGregorian(ey, 1, 1);
        const lastDay   = ethiopianDaysInMonth(ey, 13); // Pagumē: 5 or 6
        const endDate   = ethiopianToGregorian(ey, 13, lastDay);
        const gy1 = Number(startDate.slice(0, 4));
        const gy2 = Number(endDate.slice(0, 4));
        return { gy1, gy2: gy2 === gy1 ? gy1 + 1 : gy2, startDate, endDate };
      };
      return { currentYear, toGregorianRange, formatYear: (y: number) => toEthiopianDigits(y) };
    }

    default: { // miladi
      const currentYear = () => today.getFullYear();
      const toGregorianRange = (gy: number): CalYearRange => ({
        gy1: gy, gy2: gy,
        startDate: `${gy}-01-01`,
        endDate:   `${gy}-12-31`,
      });
      return { currentYear, toGregorianRange, formatYear: (y: number) => String(y) };
    }
  }
}

// ---------------------------------------------------------------------------
// Date formatting — calendar-aware
// ---------------------------------------------------------------------------

function formatDate(dateStr: string, calMode: CalendarType, lang: string): string {
  if (!dateStr) return '';
  if (calMode === 'shamsi') return toJalaliDisplay(dateStr);
  if (calMode === 'qamari') return toHijriDisplay(dateStr);
  if (calMode === 'hebrew') {
    const { year, month, day } = gregorianToHebrew(dateStr);
    const monthName = HEBREW_MONTHS[month - 1] ?? String(month);
    return `${day} ${monthName} ${year}`;
  }
  if (calMode === 'chinese') {
    const { year, month, day } = gregorianToChinese(dateStr);
    const monthName = CHINESE_MONTHS[month - 1] ?? String(month);
    return `${monthName} ${day}, ${year}`;
  }
  if (calMode === 'saka') {
    const { year, month, day } = gregorianToSaka(dateStr);
    const monthName = SAKA_MONTHS[month - 1] ?? String(month);
    return `${toSakaDigits(day)} ${monthName} ${toSakaDigits(year)}`;
  }
  if (calMode === 'ethiopian') {
    const { year, month, day } = gregorianToEthiopian(dateStr);
    const monthName = ETHIOPIAN_MONTHS[month - 1] ?? String(month);
    return `${day} ${monthName} ${year}`;
  }
  // miladi (Gregorian) — use active UI locale
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(lang, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Sort holidays in primary calendar order
// ---------------------------------------------------------------------------

function sortByCalendar(holidays: Holiday[], calMode: CalendarType): Holiday[] {
  if (calMode === 'shamsi') {
    return [...holidays].sort((a, b) => {
      const [ay, am, ad] = a.date.split('-').map(Number);
      const [by, bm, bd] = b.date.split('-').map(Number);
      const ja = toJalaali(ay, am, ad);
      const jb = toJalaali(by, bm, bd);
      if (ja.jy !== jb.jy) return ja.jy - jb.jy;
      if (ja.jm !== jb.jm) return ja.jm - jb.jm;
      return ja.jd - jb.jd;
    });
  }
  // For all other calendars the ISO date string sorts correctly
  return [...holidays].sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EditForm {
  date: string;
  nameFa: string;   // Persian name
  name: string;     // English name
  isCustom: boolean;
}

const EMPTY_FORM: EditForm = { date: '', nameFa: '', name: '', isCustom: false };

interface Props {
  token: string;
}

export default function HolidaysSettingsPanel({ token }: Props) {
  const { t } = useTranslation();
  const { country, calendar } = useCalendar();
  const { lang } = useLanguage();

  // ── Year helpers (calendar-aware) ───────────────────────────────────────────
  const yearHelpers = calYearHelpers(calendar);

  // selectedYear is always in the PRIMARY calendar's year space
  // (e.g. 1404 for shamsi, 1446 for qamari, 5785 for hebrew, 4722 for chinese …)
  const [selectedYear, setSelectedYear] = useState(() => yearHelpers.currentYear());

  // When the calendar system switches, reset to the new calendar's current year
  useEffect(() => {
    setSelectedYear(calYearHelpers(calendar).currentYear());
  }, [calendar]);

  // Options: current year −1 … +3  (5 entries) in the primary calendar's year space
  const baseYear = yearHelpers.currentYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => baseYear - 1 + i);

  // ── Holidays state ──────────────────────────────────────────────────────────
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [holidayError, setHolidayError] = useState<string | null>(null);

  // ── Weekends state ──────────────────────────────────────────────────────────
  const [weekendDays, setWeekendDays] = useState<number[]>([]);
  const [weekendsCustom, setWeekendsCustom] = useState(false);
  const [savingWeekends, setSavingWeekends] = useState(false);
  const [weekendSaved, setWeekendSaved] = useState(false);

  // ── Import state ────────────────────────────────────────────────────────────
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number } | null>(null);
  const [importError, setImportError] = useState('');

  // ── Translate state ─────────────────────────────────────────────────────────
  const [translating, setTranslating] = useState(false);
  const [translateResult, setTranslateResult] = useState<{ count: number } | null>(null);
  const [translateError, setTranslateError] = useState('');

  // ── Edit / add form ─────────────────────────────────────────────────────────
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Load holidays ───────────────────────────────────────────────────────────
  // For each calendar: derive which Gregorian years to fetch, filter to the
  // exact calendar-year date range, deduplicate, and sort in calendar order.
  const loadHolidays = useCallback(async () => {
    if (!country) { setHolidays([]); return; }
    setLoadingHolidays(true);
    setHolidayError(null);
    try {
      const { gy1, gy2, startDate, endDate } = calYearHelpers(calendar).toGregorianRange(selectedYear);

      const fetches = gy1 === gy2
        ? [getHolidays(token, country, gy1)]
        : [getHolidays(token, country, gy1), getHolidays(token, country, gy2)];

      const combined = (await Promise.all(fetches)).flat();

      // Filter to the calendar year's date range
      const filtered = combined.filter(h => h.date >= startDate && h.date <= endDate);

      // Deduplicate by date (guard against overlap in adjacent-year fetches)
      const seen = new Set<string>();
      const deduped = filtered.filter(h => {
        if (seen.has(h.date)) return false;
        seen.add(h.date);
        return true;
      });

      setHolidays(sortByCalendar(deduped, calendar));
    } catch {
      setHolidayError(t('common.error'));
    } finally {
      setLoadingHolidays(false);
    }
  }, [country, selectedYear, calendar, token, t]);

  useEffect(() => { loadHolidays(); }, [loadHolidays]);

  // ── Load weekends ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!country) return;
    getWeekends(token, country)
      .then(d => { setWeekendDays(d.weekendDays); setWeekendsCustom(d.isCustom); })
      .catch(() => {});
  }, [country, token]);

  // ── Weekend toggle ──────────────────────────────────────────────────────────
  async function handleWeekendToggle(dayIndex: number) {
    if (!country) return;
    const next = weekendDays.includes(dayIndex)
      ? weekendDays.filter(d => d !== dayIndex)
      : [...weekendDays, dayIndex].sort((a, b) => a - b);
    setWeekendDays(next);
    setSavingWeekends(true);
    try {
      await saveWeekends(token, country, next);
      invalidateWeekendsCache(country);
      setWeekendsCustom(true);
      setWeekendSaved(true);
      setTimeout(() => setWeekendSaved(false), 1500);
    } catch {
      getWeekends(token, country).then(d => setWeekendDays(d.weekendDays)).catch(() => {});
    } finally {
      setSavingWeekends(false);
    }
  }

  async function handleResetWeekends() {
    if (!country) return;
    setSavingWeekends(true);
    try {
      const d = await resetWeekends(token, country);
      setWeekendDays(d.weekendDays);
      setWeekendsCustom(false);
      invalidateWeekendsCache(country);
    } catch {
      /* ignore */
    } finally {
      setSavingWeekends(false);
    }
  }

  // ── Toggle holiday visibility ───────────────────────────────────────────────
  async function handleToggleHidden(h: Holiday) {
    if (!country) return;
    // Derive which Gregorian year to pass for the DB row
    const [gy] = h.date.split('-').map(Number);
    try {
      await upsertHoliday(token, country, gy, h.date, h.localName, h.name, h.nameFa, !h.hidden, h.isCustom);
      // Invalidate all Gregorian years that this calendar year spans
      const { gy1, gy2 } = calYearHelpers(calendar).toGregorianRange(selectedYear);
      invalidateHolidayCache(country, gy1);
      if (gy2 !== gy1) invalidateHolidayCache(country, gy2);
      setHolidays(prev => prev.map(x => x.date === h.date ? { ...x, hidden: !h.hidden } : x));
    } catch {
      setHolidayError(t('common.error'));
    }
  }

  // ── Open edit form ──────────────────────────────────────────────────────────
  function openEdit(h: Holiday) {
    setEditingDate(h.date);
    setForm({ date: h.date, nameFa: h.nameFa, name: h.name, isCustom: h.isCustom });
    setFormError(null);
  }

  function openAdd() {
    setEditingDate('__new__');
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function closeForm() {
    setEditingDate(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  // ── Save form ───────────────────────────────────────────────────────────────
  async function handleSaveForm() {
    // At least one name is required; if language is fa, nameFa is primary
    const primaryName = lang === 'fa' ? form.nameFa.trim() : form.name.trim();
    if (!country || !form.date || !primaryName) {
      setFormError(t('common.required'));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
      setFormError(t('settings.holidayDate') + ' invalid');
      return;
    }
    setFormSaving(true);
    setFormError(null);
    try {
      const isCustom = editingDate === '__new__' ? true : form.isCustom;
      const existingHidden = holidays.find(h => h.date === form.date)?.hidden ?? false;
      const [gy] = form.date.split('-').map(Number);
      // For custom holidays: if one field is blank, mirror the other
      const savedNameFa = form.nameFa.trim() || form.name.trim();
      const savedName   = form.name.trim()   || form.nameFa.trim();
      // localName = Persian name for IR, English name otherwise
      const savedLocalName = country === 'IR' ? savedNameFa : savedName;
      await upsertHoliday(token, country, gy, form.date, savedLocalName, savedName, savedNameFa, existingHidden, isCustom);
      // If the user typed a name for the active language, cache it so it shows immediately
      // in the holiday list without needing a page reload.
      const originalHoliday = holidays.find(h => h.date === form.date);
      if (originalHoliday && savedName && savedName !== originalHoliday.name) {
        // An English name edit: not a per-language cache but stored as the primary name
      } else if (savedName && lang !== 'en' && lang !== 'fa') {
        // User typed a translated name in the form.name field — cache it for this lang
        cacheHolidayTranslation(lang, savedName, savedName);
      }
      // Name was edited — server translation memory may now apply to all years, so
      // invalidate the entire country cache so all active useHolidays hooks re-fetch
      invalidateAllHolidayCacheForCountry(country);
      await loadHolidays();
      closeForm();
    } catch {
      setFormError(t('common.error'));
    } finally {
      setFormSaving(false);
    }
  }

  // ── Import official holidays ────────────────────────────────────────────────
  async function handleImport() {
    if (!country) return;
    setImporting(true);
    setImportError('');
    setImportResult(null);
    try {
      const { gy1 } = calYearHelpers(calendar).toGregorianRange(selectedYear);
      const result = await importHolidays(token, country, gy1);
      invalidateHolidayCache(country, gy1);
      await loadHolidays();
      setImportResult({ imported: result.imported });
      setTimeout(() => setImportResult(null), 3000);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  // ── Translate all holidays to current language ──────────────────────────────
  async function handleTranslate() {
    if (!country || holidays.length === 0 || lang === 'en') return;
    setTranslating(true);
    setTranslateError('');
    setTranslateResult(null);
    try {
      // Collect unique English names from the visible (non-hidden) holidays
      const names = [...new Set(holidays.filter(h => !h.hidden).map(h => h.name))];
      const translations = await translateHolidays(token, names, lang);
      // Cache each translation so getHolidayDisplayName picks it up immediately
      let count = 0;
      for (const [englishName, translated] of Object.entries(translations)) {
        if (translated && translated !== englishName) {
          cacheHolidayTranslation(lang, englishName, translated);
          count++;
        }
      }
      // For fa/ar also persist to the DB so the server translation memory is updated
      if (lang === 'fa' || lang === 'ar') {
        const { gy1, gy2 } = calYearHelpers(calendar).toGregorianRange(selectedYear);
        const gyears = gy1 === gy2 ? [gy1] : [gy1, gy2];
        for (const h of holidays) {
          const translated = translations[h.name];
          if (!translated || translated === h.name) continue;
          const [gy] = h.date.split('-').map(Number);
          if (!gyears.includes(gy)) continue;
          await upsertHoliday(token, country, gy, h.date, h.localName, h.name, translated, h.hidden, h.isCustom);
        }
        invalidateAllHolidayCacheForCountry(country);
        await loadHolidays();
      } else {
        // Force a re-render so cached translations are applied immediately
        setHolidays(prev => [...prev]);
      }
      setTranslateResult({ count });
      setTimeout(() => setTranslateResult(null), 3000);
    } catch (e) {
      setTranslateError(e instanceof Error ? e.message : 'Translation failed');
    } finally {
      setTranslating(false);
    }
  }

  // ── Delete override ─────────────────────────────────────────────────────────
  async function handleDeleteOverride(h: Holiday) {
    if (!country) return;
    const [gy] = h.date.split('-').map(Number);
    try {
      await deleteHolidayOverride(token, country, gy, h.date);
      // Deletion may remove a learned translation — invalidate all years
      invalidateAllHolidayCacheForCountry(country);
      await loadHolidays();
    } catch {
      setHolidayError(t('common.error'));
    }
  }

  if (!country) {
    return (
      <div className="text-sm text-gray-400 py-2">{t('settings.noHolidaysLoaded')}</div>
    );
  }

  // Derive short day names from the active i18n locale for all calendar types.
  // settings.days is [Sun, Mon, Tue, Wed, Thu, Fri, Sat] (index 0=Sun … 6=Sat).
  const i18nDays = t('settings.days', { returnObjects: true }) as string[];
  // Mon-first (miladi, saka, qamari)
  const monFirstI18n: { idx: number; label: string }[] = [
    { idx: 1, label: i18nDays[1] },
    { idx: 2, label: i18nDays[2] },
    { idx: 3, label: i18nDays[3] },
    { idx: 4, label: i18nDays[4] },
    { idx: 5, label: i18nDays[5] },
    { idx: 6, label: i18nDays[6] },
    { idx: 0, label: i18nDays[0] },
  ];
  // Sat-first (shamsi)
  const satFirstI18n: { idx: number; label: string }[] = [
    { idx: 6, label: i18nDays[6] },
    { idx: 0, label: i18nDays[0] },
    { idx: 1, label: i18nDays[1] },
    { idx: 2, label: i18nDays[2] },
    { idx: 3, label: i18nDays[3] },
    { idx: 4, label: i18nDays[4] },
    { idx: 5, label: i18nDays[5] },
  ];
  // Sun-first (hebrew, chinese, ethiopian)
  const sunFirstI18n: { idx: number; label: string }[] = [
    { idx: 0, label: i18nDays[0] },
    { idx: 1, label: i18nDays[1] },
    { idx: 2, label: i18nDays[2] },
    { idx: 3, label: i18nDays[3] },
    { idx: 4, label: i18nDays[4] },
    { idx: 5, label: i18nDays[5] },
    { idx: 6, label: i18nDays[6] },
  ];
  const dowList: { idx: number; label: string }[] =
    calendar === 'shamsi'    ? satFirstI18n :
    calendar === 'hebrew'    ? sunFirstI18n :
    calendar === 'chinese'   ? sunFirstI18n :
    calendar === 'ethiopian' ? sunFirstI18n :
    monFirstI18n; // miladi, saka, qamari

  return (
    <div className="space-y-6">

      {/* ── Weekend Days ───────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700">{t('settings.weekendsTitle')}</h3>
          {weekendsCustom && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
              {t('settings.weekendsCustomBadge')}
            </span>
          )}
          {weekendSaved && <span className="text-xs text-green-600 font-medium">✓</span>}
        </div>
        <p className="text-xs text-gray-400">{t('settings.weekendsDesc')}</p>

        {/* Day buttons in calendar-appropriate order */}
        <div className={`flex gap-1.5 flex-wrap ${savingWeekends ? 'opacity-60 pointer-events-none' : ''}`}>
          {dowList.map(({ idx, label }) => {
            const isWeekend = weekendDays.includes(idx);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleWeekendToggle(idx)}
                className={`w-10 h-10 rounded-lg text-sm font-medium border-2 transition-colors select-none
                  ${isWeekend
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {weekendsCustom && (
          <button
            type="button"
            onClick={handleResetWeekends}
            disabled={savingWeekends}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
          >
            {t('settings.weekendsReset')}
          </button>
        )}
      </div>

      {/* ── Holidays List ──────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">{t('settings.holidaysTitle')}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{t('settings.holidaysDesc')}</p>
          </div>
          {/* Year selector + Import + Translate buttons */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{yearHelpers.formatYear(y)}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || translating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {importing && (
                <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {importing ? 'Importing…' : 'Import'}
            </button>
            {/* Translate button */}
            <button
              type="button"
              onClick={handleTranslate}
              disabled={translating || importing || holidays.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 disabled:opacity-60 transition-colors"
              title="Translate holiday names to current language using AI"
            >
              {translating ? (
                <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              )}
              {translating ? 'Translating…' : 'Translate'}
            </button>
            {importResult && (
              <span className="text-xs text-green-600 font-medium">✓ {importResult.imported} imported</span>
            )}
            {translateResult && (
              <span className="text-xs text-green-600 font-medium">✓ {translateResult.count} translated</span>
            )}
          </div>
        </div>

        {importError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 flex justify-between">
            <span>{importError}</span>
            <button onClick={() => setImportError('')} className="font-bold ml-2">×</button>
          </div>
        )}
        {translateError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 flex justify-between">
            <span>{translateError}</span>
            <button onClick={() => setTranslateError('')} className="font-bold ml-2">×</button>
          </div>
        )}

        {holidayError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 flex justify-between">
            <span>{holidayError}</span>
            <button onClick={() => setHolidayError(null)} className="font-bold ml-2">×</button>
          </div>
        )}

        {loadingHolidays ? (
          <p className="text-sm text-gray-400">{t('settings.loadingHolidays')}</p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
            {holidays.length === 0 && (
              <p className="text-sm text-gray-400 px-4 py-3">{t('settings.noHolidaysLoaded')}</p>
            )}
            {holidays.map(h => (
              editingDate === h.date ? (
                /* ── Inline edit form for this row ── */
                <div key={h.date} className="px-4 py-3 bg-blue-50 border-l-4 border-blue-400 space-y-2">
                  {formError && <p className="text-xs text-red-600">{formError}</p>}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] text-gray-500 mb-0.5">{t('settings.holidayNameFa')}</label>
                      <input
                        type="text"
                        dir="rtl"
                        autoFocus
                        value={form.nameFa}
                        onChange={e => setForm(f => ({ ...f, nameFa: e.target.value }))}
                        placeholder={t('settings.holidayNameFa')}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] text-gray-500 mb-0.5">{t('settings.holidayName')}</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder={t('settings.holidayName')}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveForm}
                      disabled={formSaving}
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
                    >
                      {formSaving ? t('common.saving') : t('common.save')}
                    </button>
                    <button
                      type="button"
                      onClick={closeForm}
                      className="px-3 py-1 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-50"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Normal display row ── */
                <div
                  key={h.date}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                    ${h.hidden ? 'opacity-40 bg-gray-50' : 'bg-white hover:bg-gray-50'}`}
                >
                  {/* Date in active calendar system */}
                  <span className="shrink-0 text-xs text-gray-400 w-28 leading-tight">
                    {formatDate(h.date, calendar, lang)}
                  </span>

                  {/* Name — language-aware */}
                  <span className={`flex-1 truncate font-medium ${h.hidden ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {getHolidayDisplayName(h, lang)}
                  </span>

                  {/* Badges */}
                  <div className="flex items-center gap-1 shrink-0">
                    {h.isCustom && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
                        {t('settings.customBadge')}
                      </span>
                    )}
                    {h.hidden && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 font-medium">
                        {t('settings.hiddenBadge')}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(h)}
                      className="text-gray-400 hover:text-blue-600 transition-colors p-1 rounded"
                      title={t('common.edit')}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleHidden(h)}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors
                        ${h.hidden
                          ? 'border-green-300 text-green-600 hover:bg-green-50'
                          : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                    >
                      {h.hidden ? t('settings.showHoliday') : t('settings.hideHoliday')}
                    </button>
                    {/* Only show ✕ when there is actually an override row to remove:
                        – custom holidays: delete the entire entry
                        – hidden API holidays: delete the hidden override (restores to visible) */}
                    {(h.isCustom || h.hidden) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteOverride(h)}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded"
                        title={h.isCustom ? t('common.delete') : t('settings.deleteOverride')}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        {editingDate === null && (
          <button
            type="button"
            onClick={openAdd}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            {t('settings.addHoliday')}
          </button>
        )}
      </div>

      {/* ── Add new holiday form (only for new entries, edit is inline above) ── */}
      {editingDate === '__new__' && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">
            {t('settings.addHolidayTitle')}
          </h3>

          {formError && <p className="text-xs text-red-600">{formError}</p>}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('settings.holidayDate')}</label>
              <DateInput
                value={form.date}
                onChange={v => setForm(f => ({ ...f, date: v }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('settings.holidayNameFa')}</label>
              <input
                type="text"
                dir="rtl"
                value={form.nameFa}
                onChange={e => setForm(f => ({ ...f, nameFa: e.target.value }))}
                placeholder={t('settings.holidayNameFa')}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('settings.holidayName')}</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t('settings.holidayName')}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveForm}
              disabled={formSaving}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
            >
              {formSaving ? t('common.saving') : t('settings.saveHoliday')}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
