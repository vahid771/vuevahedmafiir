# Timezone & Live Clock Plan

## Overview

Add timezone support to the app in two parts:

1. **Timezone preference** — store a `timezone` field per user (IANA string, e.g. `"Asia/Tehran"`). In the Location Settings page, when a country is selected, auto-suggest the primary timezone for that country; the user can override it with a searchable dropdown of all IANA zones. No new server routes needed — timezone is stored as a new column in `user_preferences` via the existing `PATCH /api/preferences` endpoint.

2. **Live Clock widget** — a new card on the Dashboard that shows the current time and date in the user's saved timezone (or browser local time as fallback), ticking every second. Displays time formatted for the active UI language and calendar system.

**Key constraints:**
- No new npm packages needed. `Intl.DateTimeFormat` with `timeZone` option handles all formatting natively.
- Timezone data (IANA → country mapping, country → primary timezone) is a static client-side lookup — no server changes except for the DB column migration and the `PATCH` field.
- The widget must be purely client-side with a `setInterval` tick — no server polling.

---

## Sub-Tasks

---

### Sub-Task 1 — DB migration: add `timezone` column to `user_preferences`

**Intent**
Persist the user's chosen IANA timezone string alongside other preferences so it survives page reloads and is available server-side for future use (e.g. AI summary date formatting).

**Expected Outcomes**
- `user_preferences` gains a nullable `timezone TEXT` column after migration.
- Existing rows get `NULL` (no default forced — `NULL` means "use browser local").
- `runMigrations()` is idempotent so re-deploying doesn't error.

**Todo List**
1. Open `packages/server/src/db.ts`.
2. Add a `runSafe` entry: `ALTER TABLE user_preferences ADD COLUMN timezone TEXT`.

**Relevant Context**
- Migration pattern: `packages/server/src/db.ts` — inline `runSafe()` array, idempotent via swallowed "duplicate column" error.

**Status**: [ ] pending

---

### Sub-Task 2 — Expose `timezone` in the preferences API

**Intent**
Read and write `timezone` through the existing `GET /api/preferences` and `PATCH /api/preferences` endpoints without adding new routes.

**Expected Outcomes**
- `GET /api/preferences` response includes `timezone: string | null`.
- `PATCH /api/preferences` accepts an optional `timezone` field; validates it is a non-empty string or `null`; updates the column.
- `UserPreferences` TypeScript interface on the client gains `timezone: string | null`.
- `updatePreferences` client function accepts `timezone?: string | null`.

**Todo List**
1. Open `packages/server/src/preferences/router.ts`.
2. Add `timezone` to `PreferencesRow` type.
3. In `PATCH /`: destructure `timezone` from `req.body`; validate it is `typeof string` or `null`; add an `UPDATE` branch for it matching the existing pattern.
4. Open `packages/client/src/api/preferences.ts`.
5. Add `timezone: string | null` to `UserPreferences` interface.
6. Add `timezone?: string | null` to the `updatePreferences` data parameter.
7. Run `npx tsc --noEmit` from both `packages/server` and `packages/client`.

**Relevant Context**
- `packages/server/src/preferences/router.ts` — `PATCH /` handler; follow the exact pattern used for `country`.
- `packages/client/src/api/preferences.ts` — `UserPreferences` interface and `updatePreferences` function.

**Status**: [ ] pending

---

### Sub-Task 3 — Add timezone to `CalendarContext`

**Intent**
Make `timezone` available app-wide through the existing context, just like `country` and `calendar` are today.

**Expected Outcomes**
- `CalendarContextValue` gains `timezone: string | null` and `setTimezone: (tz: string | null) => Promise<void>`.
- On load, `timezone` is read from `getPreferences` response and stored in context state.
- `setTimezone` calls `updatePreferences({ timezone })` and updates local state.

**Todo List**
1. Open `packages/client/src/context/CalendarContext.tsx`.
2. Add `timezone` and `setTimezone` to `CalendarContextValue` interface.
3. Add `const [timezone, setTimezoneState] = useState<string | null>(null)`.
4. In the `getPreferences` effect, set `setTimezoneState(prefs.timezone ?? null)`.
5. Add `async function setTimezone(tz: string | null)` — mirrors the `setCountry` pattern.
6. Include `timezone` and `setTimezone` in the `CalendarContext.Provider` value.
7. Run `npx tsc --noEmit` from `packages/client`.

**Relevant Context**
- `packages/client/src/context/CalendarContext.tsx` — all existing state follows the same pattern (`calendar`, `country`, `secondaryCalendar`).

**Status**: [ ] pending

---

### Sub-Task 4 — Build timezone utils: country → IANA zone lookup

**Intent**
Provide a static lookup from ISO alpha-2 country code to its primary IANA timezone, and a sorted list of all IANA timezones available in the browser's `Intl` engine for the timezone picker dropdown.

**Expected Outcomes**
- New file `packages/client/src/utils/timezones.ts` exports:
  - `COUNTRY_PRIMARY_TZ: Record<string, string>` — maps ~200 country codes to their most common IANA zone (e.g. `IR → "Asia/Tehran"`, `US → "America/New_York"`, `DE → "Europe/Berlin"`).
  - `getAllTimezones(): string[]` — returns `Intl.supportedValuesOf('timeZone')` sorted alphabetically (with a try/catch fallback to a hardcoded list of ~50 common zones for older browsers).
  - `getTimezoneOffset(tz: string): string` — returns a formatted UTC offset string like `"UTC+3:30"` for display in the dropdown.
  - `guessTimezoneForCountry(countryCode: string): string | null` — returns `COUNTRY_PRIMARY_TZ[countryCode] ?? null`.

**Todo List**
1. Create `packages/client/src/utils/timezones.ts`.
2. Define `COUNTRY_PRIMARY_TZ` covering at minimum the same countries in `COUNTRY_TO_CONTINENT` plus the common ones.
3. Implement `getAllTimezones()` using `Intl.supportedValuesOf('timeZone')`.
4. Implement `getTimezoneOffset(tz)` using `Intl.DateTimeFormat` with `timeZoneName: 'shortOffset'`.
5. Implement `guessTimezoneForCountry(code)`.
6. Run `npx tsc --noEmit`.

**Relevant Context**
- No npm package needed — native `Intl` API covers everything.
- `packages/client/src/utils/continents.ts` for reference on how static lookup tables are structured in this codebase.

**Status**: [ ] pending

---

### Sub-Task 5 — Add timezone selector to LocationSettingsPage

**Intent**
After a country is selected, automatically suggest its primary timezone and show a searchable timezone picker. The user can accept the suggestion or pick any IANA zone manually.

**Expected Outcomes**
- In `LocationSettingsPage`, after a country is chosen, `guessTimezoneForCountry(country)` auto-sets the timezone if none is saved yet (or if the country just changed).
- A timezone dropdown/combobox appears below the country badge showing all IANA zones with their UTC offset. The currently saved timezone is pre-selected.
- Changing the timezone immediately calls `setTimezone(tz)` to persist it.
- If `country` is cleared, timezone is also cleared.
- A "Use browser time" button resets timezone to `null`.

**Todo List**
1. Open `packages/client/src/pages/settings/LocationSettingsPage.tsx`.
2. Import `useCalendar` (already imported), and add `{ timezone, setTimezone }` from it.
3. Import `guessTimezoneForCountry`, `getAllTimezones`, `getTimezoneOffset` from `timezones.ts`.
4. Add a `useEffect` that when `country` changes and `timezone` is null, calls `setTimezone(guessTimezoneForCountry(country))`.
5. Render a `<select>` of `getAllTimezones()` below the `SelectedCountryBadge`, with each option showing `"${tz} (${getTimezoneOffset(tz)})"`. Pre-select `timezone ?? ''`. On change, call `setTimezone(value || null)`.
6. Render a "Use browser time" small button that calls `setTimezone(null)`.
7. Run `npx tsc --noEmit`.

**Relevant Context**
- `packages/client/src/pages/settings/LocationSettingsPage.tsx` — already imports `useCalendar` and `useLanguage`.
- Sub-Task 3 must be complete before this (provides `timezone` and `setTimezone` from context).
- Sub-Task 4 must be complete before this (provides the utils).

**Status**: [ ] pending

---

### Sub-Task 6 — Build the `LiveClockWidget` component

**Intent**
A self-contained dashboard card that shows a live ticking clock in the user's saved timezone, formatted for their active language and calendar system.

**Expected Outcomes**
- New file `packages/client/src/components/LiveClockWidget.tsx`.
- Displays current time in `HH:MM:SS` format using `Intl.DateTimeFormat` with the saved `timezone` (or browser local if `null`).
- Displays current date formatted for the active calendar system (reuses existing date formatting logic from `utils/jalali.ts`, `utils/hijri.ts`, etc. — or `Intl.DateTimeFormat` for Gregorian).
- Shows the timezone name and UTC offset below the time.
- Shows the country flag (using `FlagImg`) if a country is set.
- Ticks every second via `setInterval` in a `useEffect`.
- Cleans up the interval on unmount.
- Shows a skeleton while the first tick hasn't fired yet.

**Todo List**
1. Create `packages/client/src/components/LiveClockWidget.tsx`.
2. Accept no props — read `timezone`, `country`, `calendar`, `lang` from context.
3. Use `useState<Date>` initialised to `new Date()`, updated every second by `setInterval`.
4. Format time: `new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: tz })`.
5. Format date: use the same calendar-aware date formatting already used in `CalendarWidget` and `HolidaysSettingsPanel` — convert the current date to the active calendar system and display it.
6. Display the timezone label: use `Intl.DateTimeFormat` with `timeZoneName: 'long'` to get the full zone name, and `getTimezoneOffset(tz)` for the offset badge.
7. Layout: card with a large time display (`tabular-nums` for non-jumping digits), date below it, timezone info at the bottom, flag + country name at the top-right.
8. Run `npx tsc --noEmit`.

**Relevant Context**
- `packages/client/src/components/CalendarWidget.tsx` — see how it reads `calendar`, `lang`, `country` from context and formats dates.
- `packages/client/src/components/ui/Skeleton.tsx` — use for the pre-tick loading state.
- `packages/client/src/utils/jalali.ts`, `hijri.ts` etc — reuse date formatters.
- `packages/client/src/utils/timezones.ts` — `getTimezoneOffset` for Sub-Task 4.

**Status**: [ ] pending

---

### Sub-Task 7 — Add `LiveClockWidget` to the Dashboard

**Intent**
Place the live clock widget on the Dashboard page so users see it immediately after login.

**Expected Outcomes**
- `LiveClockWidget` appears in the right column of the Dashboard (next to the `CalendarWidget`), above or below it.
- If no timezone is set (new user, no country selected), the widget still shows browser local time with a note "Set your location in Settings for an accurate timezone".
- No other dashboard content is changed.

**Todo List**
1. Open `packages/client/src/pages/DashboardPage.tsx`.
2. Import `LiveClockWidget`.
3. In the right column (currently only `<CalendarWidget />`), add `<LiveClockWidget />` above `<CalendarWidget />`.
4. Run `npx tsc --noEmit`.

**Relevant Context**
- `packages/client/src/pages/DashboardPage.tsx` lines 377–381 — the right column with `<CalendarWidget />`.

**Status**: [ ] pending

---

## Notes for Implementation

- Sub-tasks must be done in order: 1 → 2 → 3 → 4 → 5 → 6 → 7.
- `Intl.supportedValuesOf('timeZone')` is available in all modern browsers. The fallback in Sub-Task 4 only needs to cover browsers that lack it (pre-2022 Safari) — a short hardcoded list of ~30 common zones suffices.
- The `tabular-nums` Tailwind utility (`font-variant-numeric: tabular-nums`) prevents the clock digits from shifting width as they change — critical for a clean ticking display.
- Timezone offset calculation: `new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date())` gives a part with `type === 'timeZoneName'` containing `"GMT+3:30"` — strip `"GMT"` prefix to get `"UTC+3:30"`.
- The widget should use `useEffect` with an empty dependency array for the interval setup, and read `timezone` from context inside the tick callback (via a ref if needed to avoid stale closure).
