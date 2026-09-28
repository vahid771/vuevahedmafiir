# Qamari Calendar + Arabic Language Plan

## Top-Level Overview

Add the **Islamic Hijri (Qamari)** calendar as a first-class primary calendar option alongside Miladi and Shamsi, and add **Arabic** as a full RTL UI language with its own `ar.json` translation file.

**Calendar** and **language** remain fully independent preferences — any combination is valid (e.g. Arabic UI + Gregorian calendar, or English UI + Qamari calendar).

Approach:
- Use the `intl-hijri` or `hijri-date` npm package for Hijri ↔ Gregorian conversion (astronomical/calculated calendar, same as used by most apps).
- Extend the `CalendarType` union from `"miladi" | "shamsi"` to `"miladi" | "shamsi" | "qamari"`.
- Extend the `LanguageType` union from `"en" | "fa"` to `"en" | "fa" | "ar"`.
- All Hijri date utilities go in a new `packages/client/src/utils/hijri.ts` module.
- `CalendarWidget` gains a third branch for Qamari month grids and secondary labels.
- `ar.json` is created by copying `fa.json` structure and translating all strings to Arabic.
- Arabic UI is RTL (same `dir="rtl"` handling as Farsi).

---

## Sub-Tasks

---

### Sub-Task 1 — Install Hijri library + create `utils/hijri.ts`

**Intent**
Add the Hijri conversion library and create a utility module analogous to `utils/jalali.ts` — all Qamari date math in one place.

**Expected Outcomes**
- `hijri-date` (or equivalent) installed in `packages/client`
- `packages/client/src/utils/hijri.ts` exports:
  - `HIJRI_MONTHS: string[]` — 12 Arabic month names (محرم … ذو الحجة)
  - `toArabicDigits(str: string | number): string` — Eastern Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩)
  - `toHijriDisplay(dateStr: string): string` — Gregorian YYYY-MM-DD → Arabic display string e.g. `١٥ رمضان ١٤٤٦`
  - `gregorianToHijri(dateStr: string): { year: number; month: number; day: number }`
  - `hijriToGregorian(hY: number, hM: number, hD: number): string` — returns YYYY-MM-DD
  - `hijriDaysInMonth(hY: number, hM: number): number` — 29 or 30
  - `hijriMonthRangeForGregorianMonth(gYear: number, gMonth: number): string` — secondary label for month view
  - `gregorianMonthRangeForHijriMonth(hYear: number, hMonth: number): string` — secondary label
  - `hijriWeekRange(start: Date, end: Date): string` — week range label in Arabic
  - `SHORT_AR_DAYS: string[]` — Mon–Sun short Arabic day names (Mon-start order)

**Todo List**
1. Check available Hijri npm packages; install the best one in `packages/client`
2. Create `packages/client/src/utils/hijri.ts` with all exports above
3. Verify TypeScript compiles clean

**Relevant Context**
- Pattern: `packages/client/src/utils/jalali.ts` — mirror its structure exactly
- `jalaali-js` is used for Jalali; use the chosen Hijri package analogously
- Hijri week: same Mon-start as Gregorian (ISO 8601) — Qamari doesn't redefine the week

---

### Sub-Task 2 — Extend `CalendarType` + server/client preferences

**Intent**
Add `"qamari"` as a valid calendar value throughout the type system, DB validation, and API.

**Expected Outcomes**
- `CalendarType` in `packages/client/src/api/preferences.ts` is `"miladi" | "shamsi" | "qamari"`
- Server `PATCH /api/preferences` accepts `"qamari"` without returning a 400
- `CalendarContext` state type updated; no logic change needed (it already stores whatever string the server returns)

**Todo List**
1. In `packages/client/src/api/preferences.ts`: extend `CalendarType` to include `"qamari"`
2. In `packages/server/src/preferences/router.ts`: add `"qamari"` to the calendar validation allowlist
3. Verify TypeScript compiles clean on both server and client

**Relevant Context**
- `packages/client/src/api/preferences.ts` — `CalendarType` definition
- `packages/server/src/preferences/router.ts` — validation check `if (!['miladi','shamsi'].includes(calendar))`

---

### Sub-Task 3 — Extend `LanguageType` + add `ar.json` + wire i18n

**Intent**
Add Arabic as a supported UI language — full RTL with its own translation file.

**Expected Outcomes**
- `LanguageType` in `packages/client/src/api/preferences.ts` is `"en" | "fa" | "ar"`
- `packages/client/src/i18n/ar.json` exists with all keys from `en.json` translated to Arabic
- `packages/client/src/i18n/index.ts` registers the `ar` resource
- `LanguageContext.applyLang` sets `dir="rtl"` for `ar` (same as `fa`)
- `LanguageContext.readStoredLang` accepts `"ar"` as a valid stored value
- Server `PATCH /api/preferences` accepts `"ar"` without returning 400

**Todo List**
1. In `packages/client/src/api/preferences.ts`: extend `LanguageType` to include `"ar"`
2. Create `packages/client/src/i18n/ar.json` — translate all strings from `en.json` to Arabic (MSA); keep same key structure
3. In `packages/client/src/i18n/index.ts`: import `ar.json` and add to `resources`, add `"ar"` to `supportedLngs`
4. In `packages/client/src/context/LanguageContext.tsx`:
   - `readStoredLang`: add `"ar"` to valid values
   - `applyLang`: set `dir="rtl"` when `l === 'fa' || l === 'ar'`
5. In `packages/server/src/preferences/router.ts`: add `"ar"` to the language validation allowlist
6. Verify TypeScript compiles clean

**Relevant Context**
- `packages/client/src/i18n/fa.json` — existing Persian translations to use as reference for structure
- `packages/client/src/i18n/index.ts` — i18next initialization
- `packages/client/src/context/LanguageContext.tsx` line 42 — RTL logic

---

### Sub-Task 4 — Add Qamari grid to `CalendarWidget` (month view)

**Intent**
Implement the Hijri month grid in `CalendarWidget` — the third branch alongside the existing Gregorian and Shamsi grids.

**Expected Outcomes**
- When `calendar === 'qamari'`, the month view renders a Hijri month grid:
  - Days 1–29/30 of the current Hijri month
  - Week starts Monday (same as Gregorian)
  - Day cells show Hijri day number in Arabic-Indic digits (primary) + Gregorian day number below (secondary)
  - `dir="rtl"` applied (Arabic is RTL)
  - Today highlight, holiday markers, weekend tinting all work as in the other views
- Secondary label under the header shows the Gregorian month range for the current Hijri month
- Primary title shows Hijri month name + year in Arabic

**Todo List**
1. In `CalendarWidget.tsx`, import utilities from `utils/hijri.ts`
2. Extend the `shamsi` boolean to a three-way `calMode: 'miladi' | 'shamsi' | 'qamari'`
3. In `MonthGrid`: add a third branch for `calMode === 'qamari'`:
   - Compute current Hijri month/year from `cursor` via `gregorianToHijri`
   - Compute `daysInMonth` via `hijriDaysInMonth`
   - Compute `firstDow` offset for Monday-start grid (same formula as Gregorian branch)
   - Render cells: Hijri day in Arabic-Indic digits; secondary = Gregorian day
   - Apply `dir="rtl"`
   - Week number column: use ISO week number (same as Gregorian)
4. In `primaryTitle()`: add qamari branch returning `HIJRI_MONTHS[hm-1] + " " + toArabicDigits(hy)`
5. In `secondaryLabel()`: add qamari branch calling `gregorianMonthRangeForHijriMonth`
6. In `weekStart()`: qamari uses the same Mon-start offset as Gregorian (no change needed)
7. Verify TypeScript compiles clean

**Relevant Context**
- `packages/client/src/components/CalendarWidget.tsx` — `MonthGrid` component, `primaryTitle()`, `secondaryLabel()`
- `packages/client/src/utils/jalali.ts` — Shamsi branch to mirror for Qamari
- `packages/client/src/hooks/useHolidays.ts` — holiday data is Gregorian dates, works unchanged

---

### Sub-Task 5 — Add Qamari to week and day views in `CalendarWidget`

**Intent**
Complete the Qamari calendar support in the week and day view panels.

**Expected Outcomes**
- **Week view**: day headers show Hijri day number (primary) + Gregorian day (secondary) when `calendar === 'qamari'`; day-name row uses `SHORT_AR_DAYS`; `dir="rtl"`
- **Day view**: primary date shows full Hijri date in Arabic; secondary label shows Gregorian equivalent
- Navigation (`navigate()`) works correctly for Qamari month boundaries: advancing to next Hijri month moves the cursor to the first day of that Hijri month in Gregorian

**Todo List**
1. In `WeekPanel`: extend day-name and label logic for `calMode === 'qamari'` — use `SHORT_AR_DAYS`, show Hijri day + Gregorian secondary
2. In `DayPanel`: extend primary date header for `calMode === 'qamari'` using `toHijriDisplay`; secondary shows Gregorian
3. In `navigate()` for month view: add qamari branch that advances the cursor by 1 Hijri month (convert cursor to Hijri, increment month, convert back to Gregorian)
4. In `viewLabels`: add Arabic month/week/day labels `{ month: 'شهر', week: 'أسبوع', day: 'يوم' }` for qamari
5. Verify TypeScript compiles clean

**Relevant Context**
- `packages/client/src/components/CalendarWidget.tsx` — `WeekPanel`, `DayPanel`, `navigate()`, `viewLabels`
- Shamsi navigation branch (lines ~675-684) is the pattern to mirror for Qamari

---

### Sub-Task 6 — Settings page: add Qamari option + Arabic language option

**Intent**
Expose the new calendar and language options in the Settings page UI.

**Expected Outcomes**
- Calendar system selector shows three options: Miladi (Gregorian) / Shamsi (Jalali) / Qamari (Hijri)
- Language selector shows three options: English / فارسی / العربية
- Both selectors use `t()` keys for their labels so they render correctly in all three languages
- i18n keys added to `en.json`, `fa.json`, and `ar.json` for the new option labels

**Todo List**
1. In `packages/client/src/pages/SettingsPage.tsx`: add `'qamari'` option to the calendar selector
2. Add `'ar'` option to the language selector
3. Add i18n keys to `en.json`: `settings.qamari`, `settings.arabic` (and any other needed labels)
4. Add matching keys to `fa.json` and `ar.json`
5. Verify TypeScript compiles clean

**Relevant Context**
- `packages/client/src/pages/SettingsPage.tsx` — existing calendar/language selector UI
- `packages/client/src/i18n/en.json` — existing `settings` section

---

## Implementation Order

```
Sub-Task 1  (hijri utils — no dependencies)
    ↓
Sub-Task 2  (CalendarType + server validation)
Sub-Task 3  (LanguageType + ar.json + i18n)  ← can run in parallel with Sub-Task 2
    ↓
Sub-Task 4  (CalendarWidget month view)
    ↓
Sub-Task 5  (CalendarWidget week + day views + navigation)
    ↓
Sub-Task 6  (Settings page UI)
```
