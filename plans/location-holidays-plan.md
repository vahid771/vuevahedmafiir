# Location & Holidays Plan

## Top-Level Overview

Let users declare their country (via a browser geolocation prompt or a manual country picker) and show that country's **official public holidays** and **weekend days** throughout the app — most visibly in the `CalendarWidget` on the Dashboard.

The location preference is stored server-side alongside the existing `calendar` / `language` columns in `user_preferences`. Holiday data is fetched from the free, open **Nager.Date** public API (`https://date.nager.at/api/v3`), which returns public holidays by country code and year. Weekends are derived purely from the country's ISO week data (no external API needed).

All logic is calendar-system-aware: when the user's primary calendar is **Shamsi (Jalali)**, the CalendarWidget already renders Jalali grids — holiday markers are converted to the correct cell coordinates automatically, since the widget always works from a Gregorian `cursor` `Date` object internally.

---

## Architecture Summary

```
User visits Settings
  → clicks "Detect location" OR picks country from dropdown
  → PATCH /api/preferences { country: "IR" }
  → CalendarContext (or new LocationContext) stores countryCode

On CalendarWidget render:
  → useHolidays(countryCode, year) hook
      → fetches from Nager.Date API (client-side, cached in memory by year)
      → returns Holiday[] = { date: "YYYY-MM-DD", localName: string, type: string }
  → useWeekends(countryCode)
      → returns number[] of weekend day indices (0=Sun … 6=Sat)
      → e.g. IR → [5, 6] (Fri, Sat), US → [0, 6] (Sun, Sat), typical EU → [0, 6]

CalendarWidget cell render:
  → if date is in Holiday[] → show red dot + tooltip on hover
  → if date's weekday is in weekends → style cell in muted red/pink background
```

No server-side holiday fetching is needed — the Nager.Date API is public and does not require authentication. The server only stores and returns the `country` preference.

---

## Sub-Tasks

---

### Sub-Task 1 — Server: add `country` column to `user_preferences`

**Intent**  
Persist the user's chosen country code alongside the existing calendar/language preferences.

**Expected Outcomes**
- `user_preferences` table gains a `country TEXT DEFAULT NULL` column.
- `GET /api/preferences` returns `country` in the response.
- `PATCH /api/preferences` accepts `{ country: string | null }` (ISO 3166-1 alpha-2, e.g. `"IR"`, `"US"`, `"DE"`); validates it is either `null` or a 2-letter uppercase string.

**Todo List**
1. In `packages/server/src/db.ts`, add to the `alterStatements` array:
   ```ts
   'ALTER TABLE user_preferences ADD COLUMN country TEXT DEFAULT NULL',
   ```
2. In `packages/server/src/preferences/router.ts`:
   - Add `country` to the `PreferencesRow` type (as `string | null`).
   - Update `getOrCreatePreferences` insert to include `country: null`.
   - In the `PATCH /` handler, accept `country` from `req.body`; validate it is `null` or a 2-char string matching `/^[A-Z]{2}$/`; update the column similarly to `calendar` and `language`.

**Relevant Context**
- Migration pattern: [`packages/server/src/db.ts`](packages/server/src/db.ts) lines 160–210 — `alterStatements` array, each statement wrapped in try/catch for idempotency.
- Preferences router: [`packages/server/src/preferences/router.ts`](packages/server/src/preferences/router.ts) — follow the same pattern for `calendar` and `language` updates.

**Status** — `[x] done`

---

### Sub-Task 2 — Client: `country` in `UserPreferences` type + API

**Intent**  
Extend the client-side preferences type and `updatePreferences` call to include the country field.

**Expected Outcomes**
- `UserPreferences` interface gains `country: string | null`.
- `updatePreferences` accepts `country?: string | null` in its `data` argument.

**Todo List**
1. In `packages/client/src/api/preferences.ts`:
   - Add `country: string | null` to the `UserPreferences` interface.
   - Add `country?: string | null` to the `data` parameter type of `updatePreferences`.

**Relevant Context**
- [`packages/client/src/api/preferences.ts`](packages/client/src/api/preferences.ts) — straightforward type extension.

**Status** — `[x] done`

---

### Sub-Task 3 — Client: expose `country` / `setCountry` from `CalendarContext`

**Intent**  
Reuse the existing `CalendarContext` (rather than creating a new context) to also carry the country preference. This avoids a new provider layer and keeps all user preferences in one place.

**Expected Outcomes**
- `CalendarContext` value interface gains `country: string | null` and `setCountry: (c: string | null) => Promise<void>`.
- `CalendarProvider` reads `country` from the preferences fetch on mount and exposes it.
- `setCountry` calls `updatePreferences(token, { country })` then updates local state.

**Todo List**
1. In `packages/client/src/context/CalendarContext.tsx`:
   - Add `country: string | null` and `setCountry` to the `CalendarContextValue` interface.
   - Add a `country` state variable (default `null`).
   - In the `useEffect` that fetches preferences, also set `country` from `prefs.country`.
   - Implement `setCountry(c)` similarly to `setCalendar`.
2. Export the updated `useCalendar()` — no other files need changing just for this sub-task.

**Relevant Context**
- [`packages/client/src/context/CalendarContext.tsx`](packages/client/src/context/CalendarContext.tsx)

**Status** — `[x] done`

---

### Sub-Task 4 — Client: `useHolidays` hook + weekend util

**Intent**  
Create the data layer for holidays and weekends. This is pure client-side logic — no server involvement beyond the country code.

**Expected Outcomes**
- `packages/client/src/hooks/useHolidays.ts` exports:
  - `useHolidays(countryCode: string | null, year: number): Holiday[]`  
    Fetches `https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}` when `countryCode` is non-null. Results are cached in a module-level `Map<string, Holiday[]>` keyed by `"CC-YYYY"` to avoid re-fetching on month navigation.  
    Returns `[]` while loading or if `countryCode` is null.
  - `Holiday` type: `{ date: string; localName: string; name: string; types: string[] }`
- `packages/client/src/utils/weekends.ts` exports:
  - `getWeekendDays(countryCode: string | null): number[]`  
    Returns an array of `Date.getDay()` indices that are weekend days for the given country.  
    Hard-coded lookup for the most common cases; falls back to `[0, 6]` (Sun/Sat) for unknown codes.  
    Key entries:
    - `IR`, `AF`: `[4, 5]` (Thu, Fri — traditional Iranian/Afghan weekend)  
      *(Note: Iran officially moved to Fri+Sat in 2024; include `IR: [5, 6]`)*
    - `SA`, `AE`, `QA`, `KW`, `BH`, `OM`: `[5, 6]` (Fri, Sat)
    - `IL`: `[5, 6]` (Fri, Sat)
    - Most of the rest of the world (EU, US, CA, AU, etc.): `[0, 6]` (Sun, Sat)

**Todo List**
1. Create `packages/client/src/hooks/useHolidays.ts`:
   - Define `Holiday` type.
   - Module-level `Map<string, Holiday[]>` cache.
   - `useHolidays` hook: `useEffect` on `[countryCode, year]` — skip if null; check cache first; fetch from Nager.Date; store in cache and set state.
2. Create `packages/client/src/utils/weekends.ts`:
   - Hard-coded `WEEKEND_MAP: Record<string, number[]>`.
   - `getWeekendDays(countryCode)` function with fallback.

**Relevant Context**
- Nager.Date API: `GET https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}` — free, no auth, returns JSON array.
- CalendarWidget uses Gregorian `Date` objects internally, so holiday `date` strings (`YYYY-MM-DD`) map directly to cells regardless of which calendar system is displayed.

**Status** — `[x] done`

---

### Sub-Task 5 — Client: Settings page — country picker + geolocation

**Intent**  
Add a "Location" section to the Settings page so users can (a) click a button to auto-detect their country via browser geolocation + reverse geocoding, or (b) manually select from a country dropdown.

**Expected Outcomes**
- A new **"Location & Holidays"** card section appears in `SettingsPage.tsx` between the "Calendar System" and "Google Drive" sections.
- The section contains:
  - A "Detect my location" button — calls `navigator.geolocation.getCurrentPosition`, then reverse-geocodes via `https://nominatim.openstreetmap.org/reverse?lat=…&lon=…&format=json` (free, no auth) to extract `address.country_code` (2-letter lowercase → uppercase).
  - A `<select>` dropdown listing ~50 common countries (ISO 3166-1 alpha-2 + display name), pre-selected to the currently saved country.
  - A "Clear" link to set country back to `null` (disabling holiday display).
  - Persists the selection immediately via `setCountry(...)` from `useCalendar()`.
- The section is shown even if no country is set yet (defaults to placeholder "Not set").
- i18n keys are added to both `en.json` and `fa.json`.

**Todo List**
1. In `packages/client/src/pages/SettingsPage.tsx`:
   - Add `const { country, setCountry } = useCalendar()` alongside existing destructuring.
   - Add `locationSaving`, `locationError` local state.
   - Implement `handleDetectLocation()` — calls `navigator.geolocation.getCurrentPosition`, on success fetches Nominatim reverse geocode, extracts `address.country_code.toUpperCase()`, calls `setCountry(code)`.
   - Implement `handleCountrySelect(code: string)` — calls `setCountry(code)` directly.
   - Insert the new "Location & Holidays" `<div>` card between the Calendar System card and the Google Drive card.
   - The dropdown `<select>` is populated from a small constant `COUNTRY_LIST: { code: string; name: string }[]` defined at the top of the file (approximately 50 entries covering all continents).
2. Add i18n keys to `packages/client/src/i18n/en.json` under `"settings"`:
   ```json
   "locationHolidays": "Location & Holidays",
   "locationHolidaysDesc": "Set your country to highlight public holidays and weekends on the calendar.",
   "detectLocation": "Detect my location",
   "detecting": "Detecting…",
   "countryNotSet": "Not set (no holidays shown)",
   "clearLocation": "Clear",
   "locationSaved": "Location saved",
   "locationFailed": "Could not detect location. Please select manually.",
   "selectCountry": "Select country…"
   ```
3. Add matching keys to `packages/client/src/i18n/fa.json` under `"settings"`.

**Relevant Context**
- [`packages/client/src/pages/SettingsPage.tsx`](packages/client/src/pages/SettingsPage.tsx)
- [`packages/client/src/i18n/en.json`](packages/client/src/i18n/en.json)
- Nominatim API: free, no auth, request header `User-Agent` required (set to app name).
- Keep the COUNTRY_LIST inline — no external country-list package needed.

**Status** — `[x] done`

---

### Sub-Task 6 — Client: wire holidays + weekends into `CalendarWidget`

**Intent**  
Make the `CalendarWidget` visually mark public holidays (red dot + tooltip on hover) and weekend cells (muted background tint) using the data from Sub-Tasks 4 and 5.

**Expected Outcomes**
- `CalendarWidget` calls `useHolidays(country, year)` and `getWeekendDays(country)`.
- **Month view**: weekend cells get a light `bg-red-50` background; holiday cells get a small red dot indicator below the day number and show the holiday name in a tooltip on hover.
- **Week view**: same weekend column tint and holiday dot in the day header.
- **Day view**: if the current day is a holiday, show the holiday name below the date header; if it's a weekend, tint the day header.
- When `country` is `null`, no holiday or weekend styling is applied (widget looks exactly as before).
- Year changes (navigating across Dec→Jan boundary) trigger a new `useHolidays` fetch for the new year automatically; the cache ensures no duplicate fetches.

**Todo List**
1. In `packages/client/src/components/CalendarWidget.tsx`:
   - Import `useHolidays` and `getWeekendDays`.
   - Add `const { country } = useCalendar()`.
   - Derive current year from `cursor` state; call `useHolidays(country, cursorYear)` — also call for `cursorYear + 1` when December is showing (for month spans near year boundary).
   - Call `getWeekendDays(country)` to get weekend day indices.
   - Build a `Set<string>` of holiday date strings and a `Map<string, string>` of `date → localName` for O(1) lookup per cell.
   - In `MonthGrid`: apply `bg-red-50` to cells whose `getDay()` is in weekends; add a `<span className="w-1 h-1 rounded-full bg-red-400 mx-auto mt-0.5 block" title={holidayName}>` below the day number for holidays.
   - In `WeekPanel`: apply same tint to weekend columns; add holiday dot to day header.
   - In `DayPanel`: show holiday name as a small subtitle under the date header if applicable; tint the header for weekends.

**Relevant Context**
- [`packages/client/src/components/CalendarWidget.tsx`](packages/client/src/components/CalendarWidget.tsx) — existing month/week/day view code.
- The `cursor` is a Gregorian `Date` — holiday `date` strings from Nager.Date are also Gregorian `YYYY-MM-DD`, so comparison is direct regardless of whether the widget renders Shamsi or Miladi labels.

**Status** — `[x] done`

---

## Implementation Order

```
Sub-Task 1 (Server: add country column)
    → Sub-Task 2 (Client: UserPreferences type)
        → Sub-Task 3 (CalendarContext: country/setCountry)
            ↓                        ↓
    Sub-Task 4 (hooks/utils)   Sub-Task 5 (Settings page picker)
            ↓
    Sub-Task 6 (CalendarWidget integration)
```

Sub-Tasks 4 and 5 can be developed in parallel once Sub-Task 3 is done.

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Nager.Date for holidays | Free, no API key, 100+ countries, well-maintained, JSON REST. |
| Client-side fetch + cache | Avoids adding a server proxy; holiday data is public and small (~30 entries/year). |
| Nominatim for reverse geocoding | Free, no auth, widely used, returns ISO country code directly. |
| Country stored in `user_preferences` | Reuses existing preferences infrastructure; one PATCH call covers everything. |
| Extend `CalendarContext` (not new context) | Keeps the provider tree flat; country is a preference alongside calendar. |
| Weekends hard-coded | Weekend days don't change often; avoids an extra API call; easy to maintain. |
| Holiday markers as dots with tooltip | Minimal visual footprint — doesn't disrupt the existing grid layout. |

---

## Non-Goals

- No timezone-aware holiday shifting (holidays are treated as full-day events on their declared date).
- No custom/user-defined holidays.
- No holiday display outside the `CalendarWidget` (other pages like `ImportantDatesPage` are out of scope).
- No server-side caching of holiday data (client cache is sufficient).
- No automatic geolocation on first load — the user must explicitly consent via the Settings button.
