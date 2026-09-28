# Calendar Expansion Plan

## Overview

Expand the app to support all 7 major national calendar systems (adding Hebrew, Chinese/Lunisolar, Indian Saka, and Ethiopian Ge'ez to the existing Gregorian, Jalali, and Hijri), restructure Settings into sub-routes, improve secondary/tertiary calendar range banners in the CalendarWidget, and replace all existing date pickers with a unified multi-calendar date picker used across all forms.

### Calendar Systems Summary
| ID | Name | Type | Region |
|---|---|---|---|
| `miladi` | Gregorian | Solar | Global |
| `shamsi` | Jalali / Persian | Solar | Iran, Afghanistan |
| `qamari` | Hijri / Islamic | Lunar | Muslim world |
| `hebrew` | Hebrew / Jewish | Lunisolar | Israel, diaspora |
| `chinese` | Chinese / Lunisolar | Lunisolar | China, East Asia |
| `saka` | Indian (Saka) | Lunisolar | India |
| `ethiopian` | Ethiopian (Ge'ez) | Solar | Ethiopia, Eritrea |

### Scope
- **Client:** New calendar utilities, expanded CalendarType, expanded CalendarWidget, new unified DatePicker, split Settings into sub-pages, i18n additions.
- **Server:** Extended validation for new CalendarType values.
- **No new backend routes** — all calendar math is pure client-side.

---

## Sub-Tasks

---

### Sub-Task 1 — Calendar Math Utilities for 4 New Systems

**Intent:** Implement pure TypeScript conversion utilities for the 4 new calendar systems, following the same pattern as `jalali.ts` and `hijri.ts`. Each utility exposes: month names, digit formatters, to/from Gregorian converters, days-in-month, month-range label helpers, and week-range label helpers.

**Expected Outcomes:**
- `packages/client/src/utils/hebrew.ts` — Hebrew calendar math (lunisolar; Jewish Year 5785+)
- `packages/client/src/utils/chinese.ts` — Chinese lunisolar calendar math (year/month/day, intercalary month awareness)
- `packages/client/src/utils/saka.ts` — Indian Saka calendar math (solar; Chaitra 1 = ~Mar 22)
- `packages/client/src/utils/ethiopian.ts` — Ethiopian Ge'ez calendar math (solar; 13 months, ~7-8 years behind Gregorian)
- Each file exports an identical surface API shape to `hijri.ts` / `jalali.ts`
- Unit-level inline tests or comments verifying key conversions (e.g. 2025-03-22 = Chaitra 1, 1947 Saka)

**Todo List:**
1. Implement `packages/client/src/utils/hebrew.ts`:
   - Use the Maimonides/Gauss algorithm for Gregorian ↔ Hebrew conversion
   - Export: `HEBREW_MONTHS`, `toHebrewDisplay()`, `gregorianToHebrew()`, `hebrewToGregorian()`, `hebrewDaysInMonth()`, `hebrewMonthRangeForGregorianMonth()`, `gregorianMonthRangeForHebrewMonth()`, `hebrewWeekRange()`
2. Implement `packages/client/src/utils/chinese.ts`:
   - Use a table-driven or algorithmic approach for Chinese lunisolar ↔ Gregorian
   - Handle intercalary (leap) months in display labels
   - Export: `CHINESE_MONTHS`, `toChinseseDisplay()`, `gregorianToChinese()`, `chineseToGregorian()`, `chineseDaysInMonth()`, `chineseMonthRangeForGregorianMonth()`, `gregorianMonthRangeForChineseMonth()`, `chineseWeekRange()`
3. Implement `packages/client/src/utils/saka.ts`:
   - Saka solar calendar: year = Gregorian year − 78 (approximately); Chaitra 1 = Mar 22 (non-leap) / Mar 21 (leap)
   - Export same surface API shape with `SAKA_MONTHS`, etc.
4. Implement `packages/client/src/utils/ethiopian.ts`:
   - Ethiopian solar calendar: 12 months of 30 days + Pagumē (5 or 6 days); year offset ~7 years 8 months behind Gregorian
   - Export same surface API shape with `ETHIOPIAN_MONTHS`, etc.

**Relevant Context:**
- Pattern to follow: [`jalali.ts`](packages/client/src/utils/jalali.ts), [`hijri.ts`](packages/client/src/utils/hijri.ts)
- All conversions are pure math — no npm library required (or use a well-known lightweight library where math is complex, e.g. `@hebcal/core` for Hebrew)
- All utilities should be pure functions (no side effects, no React imports)

**Status:** [x] done

---

### Sub-Task 2 — Extend CalendarType + Server Validation

**Intent:** Add the 4 new calendar system IDs to `CalendarType` across the full stack — client type definition, server validation, and database (no schema change needed, just wider validation).

**Expected Outcomes:**
- `CalendarType` in `packages/client/src/api/preferences.ts` accepts all 7 values
- Server `VALID_CALS` array in `packages/server/src/preferences/router.ts` accepts all 7 values
- `CalendarContext` and all context consumers compile without error

**Todo List:**
1. In [`packages/client/src/api/preferences.ts`](packages/client/src/api/preferences.ts), extend `CalendarType` to `'miladi' | 'shamsi' | 'qamari' | 'hebrew' | 'chinese' | 'saka' | 'ethiopian'`
2. In [`packages/server/src/preferences/router.ts`](packages/server/src/preferences/router.ts), extend `VALID_CALS` to include all 7 IDs
3. Verify [`packages/client/src/context/CalendarContext.tsx`](packages/client/src/context/CalendarContext.tsx) compiles — no changes needed beyond the type change
4. In [`packages/client/src/pages/SettingsPage.tsx`](packages/client/src/pages/SettingsPage.tsx), add the 4 new entries to `CALENDAR_OPTIONS` (pointing to i18n keys that will be added in Sub-Task 4)

**Relevant Context:**
- [`CalendarType`](packages/client/src/api/preferences.ts) currently: `'miladi' | 'shamsi' | 'qamari'`
- Server validation: [`packages/server/src/preferences/router.ts`](packages/server/src/preferences/router.ts) line ~54: `const VALID_CALS = ['miladi', 'shamsi', 'qamari']`
- DB column is a TEXT field with no CHECK constraint, so no migration needed

**Status:** [x] done

---

### Sub-Task 3 — CalendarWidget: New Calendar Grids + Range Banners

**Intent:** Add month/week/day rendering for the 4 new calendar systems in `CalendarWidget.tsx`, and improve the secondary/tertiary calendar range banners to cover all 7 systems (currently only Gregorian, Jalali, Hijri are handled in `secondaryLabel()`).

**Expected Outcomes:**
- Month view renders correctly for Hebrew, Chinese, Saka, and Ethiopian primary calendars
- Week view day-name row is correct for each new calendar
- Day view title is correct for each new calendar
- Navigation (prev/next month) works correctly for all 4 new systems
- `secondaryLabel()` returns a month-range or week-range banner string for all 7 calendar systems
- `tertiaryLabel()` (if not yet extracted) mirrors `secondaryLabel()` for the tertiary calendar

**Todo List:**
1. Import the 4 new utility modules at the top of [`CalendarWidget.tsx`](packages/client/src/components/CalendarWidget.tsx)
2. Add a `HebrewMonthGrid` component (following the `QamariMonthGrid` pattern):
   - Convert cursor date to Hebrew via `gregorianToHebrew()`
   - Build day grid with correct week-start (Sunday for Hebrew)
   - Display Hebrew digits / letters via `toHebrewDisplay()`
   - Show secondary Gregorian day number below
3. Add `ChineseMonthGrid`, `SakaMonthGrid`, `EthiopianMonthGrid` components similarly
4. Extend the `calDayNumber()` / day number overlay logic in month grid cells for all 7 calendars
5. Extend `WeekPanel` day-name row to handle new calendar IDs
6. Extend `DayPanel` title to handle new calendar IDs
7. Extend `navigate()` to handle month navigation for Hebrew, Chinese, Saka, Ethiopian
8. Extend `primaryTitle()` to return correct localized title for all 7 calendars
9. Extend `secondaryLabel()` (and tertiary equivalent) to call the new `*MonthRangeForGregorianMonth()` / `*WeekRange()` helpers for all 7 systems

**Relevant Context:**
- [`CalendarWidget.tsx`](packages/client/src/components/CalendarWidget.tsx) is ~940 lines; new calendar branches follow the existing `qamari` branch pattern
- `secondaryLabel()` is around line 852-886 — currently handles miladi/shamsi/qamari only
- `navigate()` for Qamari is around line 815-823 — model for lunisolar month navigation
- Week-start convention: Sunday (Hebrew, Chinese), Monday (Gregorian, Hijri, Saka, Ethiopian), Saturday (Shamsi)

**Status:** [x] done

---

### Sub-Task 4 — i18n: Translations for 4 New Calendars

**Intent:** Add all translation keys needed for the 4 new calendar systems (labels, descriptions, month names in each language) to all 3 translation files.

**Expected Outcomes:**
- [`en.json`](packages/client/src/i18n/en.json), [`fa.json`](packages/client/src/i18n/fa.json), [`ar.json`](packages/client/src/i18n/ar.json) all have keys:
  - `settings.hebrewLabel`, `settings.hebrewDesc`
  - `settings.chineseLabel`, `settings.chineseDesc`
  - `settings.sakaLabel`, `settings.sakaDesc`
  - `settings.ethiopianLabel`, `settings.ethiopianDesc`
- No missing translation key warnings in the browser console

**Todo List:**
1. Add to [`en.json`](packages/client/src/i18n/en.json) under `settings`:
   - `hebrewLabel: "Hebrew (Jewish)"`, `hebrewDesc: "Lunisolar – used in Israel"`
   - `chineseLabel: "Chinese (Lunisolar)"`, `chineseDesc: "Traditional lunisolar – East Asia"`
   - `sakaLabel: "Indian (Saka)"`, `sakaDesc: "Indian national solar calendar"`
   - `ethiopianLabel: "Ethiopian (Ge'ez)"`, `ethiopianDesc: "13-month solar – Ethiopia & Eritrea"`
2. Add equivalent keys to [`fa.json`](packages/client/src/i18n/fa.json) in Persian
3. Add equivalent keys to [`ar.json`](packages/client/src/i18n/ar.json) in Arabic

**Relevant Context:**
- Existing pattern in [`en.json`](packages/client/src/i18n/en.json): `miladiLabel`, `miladiDesc`, `shamsiLabel`, `shamsiDesc`, `qamariLabel`, `qamariDesc`

**Status:** [x] done

---

### Sub-Task 5 — Settings: Split into Sub-Routes

**Intent:** Break the current monolithic [`SettingsPage.tsx`](packages/client/src/pages/SettingsPage.tsx) into three focused sub-pages accessible via sub-routes, each with a settings nav sidebar/tabs. The existing `/settings` route becomes a redirect to a default sub-page.

**Expected Outcomes:**
- `/settings/calendar` — Calendar system selection (primary + secondary + tertiary), country/location
- `/settings/language` — Language selection (EN / FA / AR)
- `/settings/holidays` — Holidays and weekends panel (existing `HolidaysSettingsPanel`)
- `/settings/integrations` — Google Drive, Google Calendar, Google Tasks connection management
- `/settings` redirects to `/settings/calendar`
- A shared `SettingsLayout` component renders the sub-nav tabs and an `<Outlet />` for sub-page content
- The sidebar/nav entry for "Settings" in `AppLayout` still links to `/settings`

**Todo List:**
1. Create `packages/client/src/pages/settings/SettingsLayout.tsx` — renders sub-nav tabs (Calendar, Language, Holidays) and `<Outlet />`
2. Create `packages/client/src/pages/settings/CalendarSettingsPage.tsx` — extract calendar system selection, secondary/tertiary dropdowns, country detection, and Google integrations from current `SettingsPage.tsx`
3. Create `packages/client/src/pages/settings/LanguageSettingsPage.tsx` — extract language selector
4. Create `packages/client/src/pages/settings/HolidaysSettingsPage.tsx` — extract holiday/weekends panel
5. Update [`App.tsx`](packages/client/src/App.tsx): replace the single `/settings` route with nested routes:
   ```
   /settings  → SettingsLayout (Outlet)
     /calendar → CalendarSettingsPage
     /language → LanguageSettingsPage
     /holidays → HolidaysSettingsPage
     index     → Navigate to /settings/calendar
   ```
6. Delete or hollow out old `SettingsPage.tsx` (or repurpose as the layout)
7. Ensure the sidebar link for Settings points to `/settings` (will redirect to `/settings/calendar`)

**Relevant Context:**
- [`App.tsx`](packages/client/src/App.tsx) — current single `/settings` route at line 49
- [`packages/client/src/pages/SettingsPage.tsx`](packages/client/src/pages/SettingsPage.tsx) — ~700 lines; sections are clearly delineated
- [`packages/client/src/layouts/AppLayout.tsx`](packages/client/src/layouts/AppLayout.tsx) — contains sidebar nav links
- Google integration state (Drive, Calendar, Tasks) is self-contained in SettingsPage; move entirely to `IntegrationsSettingsPage`
- `HolidaysSettingsPanel` is already a standalone component — just needs a page wrapper

**Status:** [x] done

---

### Sub-Task 6 — Unified Multi-Calendar DatePicker Component

**Intent:** Build a single `CalendarDatePicker` component that adapts to the user's active primary calendar system and allows picking a date in that calendar's grid, returning a Gregorian `YYYY-MM-DD` string. Replace all existing date input components in forms with it.

**Expected Outcomes:**
- `packages/client/src/components/CalendarDatePicker.tsx` — new component
- API mirrors `JalaliDatePicker`: `value: string` (Gregorian YYYY-MM-DD), `onChange: (gregorianDate: string) => void`, `className?: string`
- Renders a popup month grid in the active calendar system (from `CalendarContext`)
- Supports all 7 calendar systems
- Existing `JalaliDatePicker.tsx` usages replaced by `CalendarDatePicker` (which automatically uses Jalali when the user's calendar is Shamsi)
- All form date inputs (tasks, reminders, bills, important dates) use `CalendarDatePicker`

**Todo List:**
1. Create `packages/client/src/components/CalendarDatePicker.tsx`:
   - Read primary calendar from `CalendarContext`
   - Render a month grid using the appropriate calendar math
   - Support month-by-month navigation
   - On day click: convert selected calendar date to Gregorian and call `onChange`
   - Popup behavior: toggle on input click, close on outside click
   - Reuse month grid rendering logic (extract shared grid logic if CalendarWidget becomes very large)
2. Find all usages of `JalaliDatePicker` across form components and replace with `CalendarDatePicker`
3. Find all usages of native `<input type="date">` in form components (tasks, reminders, bills, important dates) and replace with `CalendarDatePicker`
4. Ensure the picker's display text shows the date in the active calendar format (not Gregorian ISO string)

**Relevant Context:**
- [`JalaliDatePicker.tsx`](packages/client/src/components/JalaliDatePicker.tsx) — existing Jalali picker; follow its popup/grid pattern
- [`CalendarContext.tsx`](packages/client/src/context/CalendarContext.tsx) — provides `calendar` (the active primary system)
- Calendar math for all 7 systems will be available after Sub-Task 1
- Forms that currently use date inputs: check `TasksPage`, `RemindersPage`, `BillsPage`, `ImportantDatesPage`, and their sub-components

**Status:** [x] done

---

## Implementation Order

```
Sub-Task 1 (utils)
    ↓
Sub-Task 2 (types + server)    Sub-Task 4 (i18n)
    ↓                               ↓
Sub-Task 3 (CalendarWidget)    Sub-Task 5 (Settings routes)
    ↓
Sub-Task 6 (DatePicker + form replacements)
```

Sub-Tasks 2 and 4 can be done in parallel.
Sub-Task 3 depends on Sub-Task 1 (utils) and Sub-Task 2 (types).
Sub-Task 5 depends on Sub-Task 4 (i18n keys) and Sub-Task 2 (CalendarType).
Sub-Task 6 depends on Sub-Task 1 (utils) and Sub-Task 3 (calendar grids, if reusing grid logic).

---

## Open Decisions

- **Google integrations tab**: Confirmed — Google Drive / Calendar / Tasks moves to its own `/settings/integrations` tab.
- **Chinese calendar library**: The Chinese lunisolar calendar is the most algorithmically complex. If pure math proves too large, a minimal table-driven approach covering years 1900–2100 is acceptable.
- **Hebrew week start**: Hebrew calendar traditionally starts Sunday; the picker will use Sunday as the first column.
