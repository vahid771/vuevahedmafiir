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
  type Holiday,
} from '../api/holidays';
import { invalidateHolidayCache, invalidateAllHolidayCacheForCountry, getHolidayDisplayName } from '../hooks/useHolidays';
import { invalidateWeekendsCache } from '../hooks/useWeekends';
import { toJalaliDisplay, toPersianDigits } from '../utils/jalali';
import DateInput from './DateInput';
import { toJalaali, toGregorian } from 'jalaali-js';

// ---------------------------------------------------------------------------
// Weekday display orders
// ---------------------------------------------------------------------------

// Gregorian: Mon-first (ISO week) — indices are Date.getDay() values
// [Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6, Sun=0]
const DOW_GREGORIAN: { idx: number; label: string }[] = [
  { idx: 1, label: 'Mon' },
  { idx: 2, label: 'Tue' },
  { idx: 3, label: 'Wed' },
  { idx: 4, label: 'Thu' },
  { idx: 5, label: 'Fri' },
  { idx: 6, label: 'Sat' },
  { idx: 0, label: 'Sun' },
];

// Shamsi: Sat-first (Iranian week starts Saturday)
// [Sat=6, Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5]
const DOW_SHAMSI: { idx: number; label: string }[] = [
  { idx: 6, label: 'ش' },
  { idx: 0, label: 'ی' },
  { idx: 1, label: 'د' },
  { idx: 2, label: 'س' },
  { idx: 3, label: 'چ' },
  { idx: 4, label: 'پ' },
  { idx: 5, label: 'ج' },
];

// ---------------------------------------------------------------------------
// Jalali year ↔ Gregorian year helpers
// ---------------------------------------------------------------------------

/**
 * Given a Jalali year jy, returns the two Gregorian years it spans.
 * Farvardin 1 falls in March of gy1; Esfand 29/30 falls in March of gy2.
 * e.g. jy=1404 → gy1=2025, gy2=2026
 */
function jalaliYearToGregorianYears(jy: number): { gy1: number; gy2: number } {
  const { gy: gy1 } = toGregorian(jy, 1, 1);
  const { gy: gy2 } = toGregorian(jy, 12, 29);
  return { gy1, gy2: gy2 === gy1 ? gy1 + 1 : gy2 };
}

/**
 * Returns the Gregorian date string (YYYY-MM-DD) for Farvardin 1 of jy.
 */
function jalaliYearStart(jy: number): string {
  const { gy, gm, gd } = toGregorian(jy, 1, 1);
  return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
}

/**
 * Returns the Gregorian date string (YYYY-MM-DD) for Esfand 29 (or 30 on leap) of jy.
 */
function jalaliYearEnd(jy: number): string {
  // Esfand has 29 days in regular years, 30 in Jalali leap years
  const lastDay = isJalaliLeap(jy) ? 30 : 29;
  const { gy, gm, gd } = toGregorian(jy, 12, lastDay);
  return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
}

/** Simple Jalali leap year check (33-year cycle). */
function isJalaliLeap(jy: number): boolean {
  const rem = ((jy - (jy > 0 ? 474 : 473)) % 2820 + 474 + 38) * 682;
  return (rem % 2816) < 682;
}

/**
 * Get the current Jalali year.
 */
function currentJalaliYear(): number {
  const now = new Date();
  const { jy } = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return jy;
}

// ---------------------------------------------------------------------------
// Date formatting helper
// ---------------------------------------------------------------------------

function formatDate(dateStr: string, shamsi: boolean): string {
  if (!dateStr) return '';
  if (shamsi) return toJalaliDisplay(dateStr);
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Sort holidays by Jalali date
// ---------------------------------------------------------------------------

function sortByJalali(holidays: Holiday[]): Holiday[] {
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
  const shamsi = calendar === 'shamsi';

  // ── Year selector ───────────────────────────────────────────────────────────
  // In Shamsi mode: selectedYear is a Jalali year (e.g. 1404)
  // In Gregorian mode: selectedYear is a Gregorian year (e.g. 2025)
  const [selectedYear, setSelectedYear] = useState(() =>
    shamsi ? currentJalaliYear() : new Date().getFullYear(),
  );

  // When calendar system switches, reset to current year in the new system
  useEffect(() => {
    setSelectedYear(shamsi ? currentJalaliYear() : new Date().getFullYear());
  }, [shamsi]);

  // Year options — 2 years back, current, 2 years forward
  const baseYear = shamsi ? currentJalaliYear() : new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => baseYear - 1 + i);

  function yearOptionLabel(y: number): string {
    return shamsi ? toPersianDigits(y) : String(y);
  }

  // ── Holidays state ──────────────────────────────────────────────────────────
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [holidayError, setHolidayError] = useState<string | null>(null);

  // ── Weekends state ──────────────────────────────────────────────────────────
  const [weekendDays, setWeekendDays] = useState<number[]>([]);
  const [weekendsCustom, setWeekendsCustom] = useState(false);
  const [savingWeekends, setSavingWeekends] = useState(false);
  const [weekendSaved, setWeekendSaved] = useState(false);

  // ── Edit / add form ─────────────────────────────────────────────────────────
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Load holidays ───────────────────────────────────────────────────────────
  // In Shamsi mode: fetch both Gregorian years the Jalali year spans, then filter
  // to dates within [Farvardin 1, Esfand 29] of the selected Jalali year.
  // In Gregorian mode: fetch one year.
  const loadHolidays = useCallback(async () => {
    if (!country) { setHolidays([]); return; }
    setLoadingHolidays(true);
    setHolidayError(null);
    try {
      let allHolidays: Holiday[];

      if (shamsi) {
        const jy = selectedYear;
        const { gy1, gy2 } = jalaliYearToGregorianYears(jy);
        const startDate = jalaliYearStart(jy);
        const endDate = jalaliYearEnd(jy);

        // Fetch both Gregorian years (may be the same if the Jalali year
        // happens to sit within one Gregorian year, which never actually occurs
        // but we guard for it)
        const fetches = gy1 === gy2
          ? [getHolidays(token, country, gy1)]
          : [getHolidays(token, country, gy1), getHolidays(token, country, gy2)];

        const results = await Promise.all(fetches);
        const combined = results.flat();

        // Filter to dates within the Jalali year [startDate, endDate]
        const filtered = combined.filter(h => h.date >= startDate && h.date <= endDate);

        // Deduplicate (same holiday can't appear twice across years, but guard anyway)
        const seen = new Set<string>();
        allHolidays = filtered.filter(h => {
          if (seen.has(h.date)) return false;
          seen.add(h.date);
          return true;
        });

        // Sort by Jalali calendar order (Farvardin → Esfand)
        allHolidays = sortByJalali(allHolidays);
      } else {
        allHolidays = await getHolidays(token, country, selectedYear);
        // Already sorted by date (Gregorian Jan→Dec) from the server
      }

      setHolidays(allHolidays);
    } catch {
      setHolidayError(t('common.error'));
    } finally {
      setLoadingHolidays(false);
    }
  }, [country, selectedYear, shamsi, token, t]);

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
      // Hide/show doesn't affect translations, so only invalidate the affected year
      if (shamsi) {
        const { gy1, gy2 } = jalaliYearToGregorianYears(selectedYear);
        invalidateHolidayCache(country, gy1);
        invalidateHolidayCache(country, gy2);
      } else {
        invalidateHolidayCache(country, selectedYear);
      }
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

  const dowList = shamsi ? DOW_SHAMSI : DOW_GREGORIAN;

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
          {/* Year selector */}
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{yearOptionLabel(y)}</option>
            ))}
          </select>
        </div>

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
                    {formatDate(h.date, shamsi)}
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
