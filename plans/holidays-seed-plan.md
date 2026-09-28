# Holidays Seed Plan

## Overview

Introduce a shared `holidays_seed` table that stores official public holidays per country+year, fetched once and reused across all users. The existing `user_holidays` table becomes a pure per-user overrides layer. Any authenticated user can trigger a seed import from the Settings UI.

**Primary data source**: `date-holidays` npm package (v3.36.1, already installed) — used for all countries, fully offline, no external API required. Calendarific and Nager.Date remain as enrichment fallbacks if a country is not covered by `date-holidays`.

**Key design principle**: the GET /api/holidays response shape and the client-side `useHolidays` hook do not change. The only difference is where the base holidays come from — the new shared table instead of a live API call.

---

## Sub-Tasks

---

### Sub-Task 1 — Add `holidays_seed` DB table via migration

**Intent**  
Create the shared `holidays_seed` table that stores canonical official holidays, fetched once per country+year, shared across all users.

**Expected Outcomes**  
- A `holidays_seed` table exists in the DB after the next server startup.
- The schema enforces uniqueness on `(country, year, date)` so duplicate imports are safe (idempotent upsert).
- A `source` column records where each row came from (`date-holidays`, `calendarific`, `nager`, or `manual`).
- An index on `(country, year)` supports fast lookups by the GET holidays route.

**Todo List**  
1. Open `packages/server/src/db.ts`.
2. Add a `runSafe` call (matching the existing migration pattern) that creates `holidays_seed`:
   ```
   id          INTEGER PRIMARY KEY AUTOINCREMENT
   country     TEXT    NOT NULL
   year        INTEGER NOT NULL
   date        TEXT    NOT NULL   -- YYYY-MM-DD Gregorian
   local_name  TEXT    NOT NULL
   name        TEXT    NOT NULL   -- English name
   name_fa     TEXT               -- Persian / translated name
   types       TEXT               -- JSON array e.g. '["Public"]'
   source      TEXT    NOT NULL DEFAULT 'date-holidays'
   created_at  TEXT    DEFAULT (datetime('now'))
   UNIQUE(country, year, date)
   ```
3. Add a `CREATE INDEX IF NOT EXISTS idx_holidays_seed_country_year ON holidays_seed(country, year)` migration.

**Relevant Context**  
- Migration pattern: `packages/server/src/db.ts` — inline `runSafe()` calls, idempotent, no versioning table.
- DB client: `@libsql/client`, `db.execute({ sql, args })`.

**Status**: [x] done

---

### Sub-Task 2 — Build the `fetchAllSources` function and `POST /api/holidays/import` endpoint

**Intent**  
Add a server route that a user can call to fetch official holidays for a given country+year and upsert them into `holidays_seed`. Uses `date-holidays` as the primary source; falls back to Calendarific then Nager.Date for countries not covered.

**Expected Outcomes**  
- `POST /api/holidays/import` with body `{ country: "DE", year: 2025 }` fetches holidays and upserts all rows into `holidays_seed`.
- Returns `{ imported: number, country, year }` — count of rows upserted.
- If a seed for that country+year already exists, re-importing is safe (idempotent upsert updates `source` and names).
- `date-holidays` covers a country: use it as the only source (no external HTTP call).
- `date-holidays` does not cover a country: fall back to Calendarific → Nager.Date (same cascade already used in the GET route).
- The existing `resolveNameFa` and `PERSIAN_NAMES` translation logic is reused for populating `name_fa`.

**Todo List**  
1. In `packages/server/src/holidays/router.ts`, extract the existing `fetchDateHolidaysIR` logic into a generic `fetchDateHolidays(country, year)` function — remove the IR-only guard.
2. Add the `fetchAllSources(country, year)` function:
   - Try `fetchDateHolidays(country, year)` first.
   - If it returns 0 results, try `fetchCalendarific` then `fetchNager` as fallbacks.
   - Deduplicate by date; apply `resolveNameFa` to populate `name_fa`.
   - Return an array of seed rows with a `source` field.
3. Add `router.post('/import', async (req, res) => { ... })` — must be registered before `router.get('/')` to avoid route shadowing:
   - Validate `country` (2-letter ISO) and `year` (1900–2100).
   - Call `fetchAllSources(country, year)`.
   - Upsert all rows into `holidays_seed` using `INSERT OR REPLACE` (SQLite) or `ON CONFLICT DO UPDATE`.
   - Return `{ imported: rows.length, country, year }`.

**Relevant Context**  
- `packages/server/src/holidays/router.ts` — `fetchDateHolidaysIR` (line 348), `fetchCalendarific` (line 322), `fetchNager` (line 367), `resolveNameFa` (line 313), `PERSIAN_NAMES` (line 91).
- Route ordering matters: `/import` POST must be declared before `/:date` PUT/DELETE; existing GET `/weekends` is already guarded for this reason.

**Status**: [x] done

---

### Sub-Task 3 — Update the GET /api/holidays route to read from `holidays_seed`

**Intent**  
Change the base data source for the holidays GET route from live external API calls to the `holidays_seed` table. If no seed exists yet for the requested country+year, fall back to the live API chain (preserving backwards compatibility). User overrides from `user_holidays` are still merged on top — no change to that logic.

**Expected Outcomes**  
- When a seed exists for the requested `(country, year)`: serve directly from `holidays_seed` + `user_holidays` overrides. Zero external HTTP calls.
- When no seed exists: fall back to the existing live Calendarific → Nager → date-holidays chain (same behaviour as today).
- The response shape (array of `Holiday` objects) is identical to today — no client changes needed.
- The `resolveWithMemory` translation logic still applies: user-learned `name_fa` corrections from `user_holidays` patch the seed names.

**Todo List**  
1. In `packages/server/src/holidays/router.ts`, in the `GET /` handler, before the existing API fetch block:
   - Query `SELECT * FROM holidays_seed WHERE country = ? AND year = ?`.
   - If rows returned, build the `apiHolidays` array from those rows (mapping columns to the `Holiday` shape).
   - Skip the Calendarific / Nager / date-holidays fetch entirely.
   - If zero rows returned, proceed with the existing live fetch (no change to fallback logic).
2. Remove the now-redundant special-case `if (country === 'IR')` date-holidays merge block — IR will now go through the same `fetchDateHolidays` path in the import endpoint instead.

**Relevant Context**  
- `packages/server/src/holidays/router.ts` GET route (line 386) — the fetch cascade (lines 426–453) is what gets replaced.
- `user_holidays` merge and `resolveWithMemory` logic (lines 481–519) stays exactly the same.

**Status**: [x] done

---

### Sub-Task 4 — Add `importHolidays` API call on the client

**Intent**  
Expose the new `POST /api/holidays/import` endpoint to the client via a typed API function.

**Expected Outcomes**  
- `importHolidays(token, country, year)` function exists in `packages/client/src/api/holidays.ts`.
- Returns `{ imported: number, country: string, year: number }`.
- Throws on non-OK response.

**Todo List**  
1. Open `packages/client/src/api/holidays.ts`.
2. Add and export `importHolidays(token: string, country: string, year: number)`:
   - POST to `/api/holidays/import` with `{ country, year }` in the body.
   - Return the parsed JSON response.

**Relevant Context**  
- `packages/client/src/api/holidays.ts` — existing `getHolidays`, `upsertHoliday`, `deleteHolidayOverride` functions follow the same `apiUrl` + `authHeaders` + `fetch` pattern.

**Status**: [x] done

---

### Sub-Task 5 — Add "Import Official Holidays" UI to HolidaysSettingsPanel

**Intent**  
Let any authenticated user trigger the seed import for the currently-selected country+year from the Holidays settings panel. After import, the holiday list refreshes to show the newly seeded data.

**Expected Outcomes**  
- A button "Import Official Holidays" appears in the HolidaysSettingsPanel header area (near the year selector).
- While importing: button shows a loading spinner and is disabled; text changes to "Importing…".
- On success: the holiday list refreshes (invalidates the client-side in-memory cache for that country+year via `invalidateHolidayCache`), and a brief success message appears.
- On error: an error message appears inline.
- The button is present whether or not a seed already exists (re-import is safe).

**Todo List**  
1. Open `packages/client/src/components/HolidaysSettingsPanel.tsx`.
2. Add `importing` and `importError` state variables.
3. Add `handleImport()` async function:
   - Calls `importHolidays(token, country, year)`.
   - On success: calls `invalidateHolidayCache(country, year)` to force a re-fetch of the holiday list.
   - Sets success feedback (e.g., a transient "Imported N holidays" message).
   - On error: sets `importError`.
4. Add the button to the panel header row (alongside the year selector):
   - Disabled + spinner while `importing`.
   - Shows count badge on success (auto-clears after 3 seconds).

**Relevant Context**  
- `packages/client/src/components/HolidaysSettingsPanel.tsx` — existing header area, `useHolidays` hook, `invalidateHolidayCache` import from `../hooks/useHolidays`.
- `packages/client/src/api/holidays.ts` — `importHolidays` added in Sub-Task 4.
- `invalidateHolidayCache(countryCode, year)` is already exported from `useHolidays.ts` and used elsewhere in the panel.

**Status**: [x] done

---

## Notes for Implementation

- All five sub-tasks must be completed in order — each builds on the previous.
- Sub-Task 3 specifically removes the `country === 'IR'` special case for `date-holidays`; after Sub-Task 2 introduces the generic `fetchDateHolidays`, the IR special case becomes redundant.
- The client cache (`Map<string, Holiday[]>` in `useHolidays.ts`) is keyed by `CC-YYYY`. The `invalidateHolidayCache` call in Sub-Task 5 clears that entry and wakes all subscribers — no other client changes are needed.
- No changes to the `Holiday` TypeScript interface, the `useHolidays` hook signature, or the `GET /api/holidays` response shape — fully backwards compatible.
