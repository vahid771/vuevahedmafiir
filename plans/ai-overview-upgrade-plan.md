# AI Overview Upgrade Plan

## Top-Level Overview

Upgrade the AI weekly overview (summary) system so that it is fully aware of the user's
language, calendar system, date format, and location — and caches summaries per
(language + calendar) pair rather than per language alone.

**Scope:**
1. Cache key: change from `(user_id, summary_lang)` to `(user_id, summary_lang, summary_calendar)`.
2. Date formatting: already done for Shamsi; pass calendar context for all other systems.
3. Full multilingual system prompts: extend from fa/en to all 12 supported languages.
4. Location / holidays: fetch the user's country and upcoming holidays from DB and inject
   into the prompt so the AI can mention local public holidays in the summary.
5. Client: update cache key, API call, and the cache-load effect to include `calendar`.

**Non-goals:**
- Native-script date formatting server-side for Qamari, Hebrew, Chinese, Saka, Ethiopian
  (ISO dates are kept; the AI is told the calendar system only).
- Currency localisation beyond the existing IRR/ریال logic.
- Changes to the edit, history, or restore flows (they key off language only — no change needed).

---

## Sub-Tasks

---

### Sub-Task 1 — DB migration: add `summary_calendar` column

**Status:** `[x] done`

**Intent:**
The cache tables `ai_summaries_lang` and `ai_summary_history` currently use `summary_lang`
as part of their unique key. We need to add a `summary_calendar` column and change the
unique constraint so `(user_id, summary_lang, summary_calendar)` is the new key.

**Expected Outcomes:**
- `ai_summaries_lang` has a `summary_calendar TEXT NOT NULL DEFAULT 'miladi'` column.
- `ai_summary_history` has a `summary_calendar TEXT NOT NULL DEFAULT 'miladi'` column.
- The unique index on `ai_summaries_lang(user_id, summary_lang)` is replaced by
  `UNIQUE(user_id, summary_lang, summary_calendar)`.
- Existing rows are not dropped; they receive the default `'miladi'` value.

**Todo List:**
1. In `packages/server/src/db.ts`, add two new `ALTER TABLE` migration statements to the
   `alterStatements` array (idempotent, ignored on re-run):
   - `ALTER TABLE ai_summaries_lang ADD COLUMN summary_calendar TEXT NOT NULL DEFAULT 'miladi'`
   - `ALTER TABLE ai_summary_history ADD COLUMN summary_calendar TEXT NOT NULL DEFAULT 'miladi'`
2. SQLite cannot drop and recreate a unique index in ALTER TABLE — instead add a new unique
   index `CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_summaries_lang_user_lang_cal ON
   ai_summaries_lang(user_id, summary_lang, summary_calendar)` (the old index remains and is
   harmless; the new ON CONFLICT target is the new composite key in the upsert).

**Relevant Context:**
- Migration pattern: `packages/server/src/db.ts` — `alterStatements` array, each entry
  wrapped in try/catch that ignores "duplicate column" errors.
- Existing unique index: `idx_ai_summaries_lang_user` on `(user_id, summary_lang)`.

---

### Sub-Task 2 — Server: update GET, POST, PATCH routes to use the new key

**Status:** `[x] done`

**Intent:**
All three summary routes must read and write `summary_calendar` alongside `summary_lang`
so each (lang + calendar) pair is an independent cache slot.

**Expected Outcomes:**
- `GET /api/ai/summary?lang=en&calendar=miladi` returns the row for that exact pair.
- `POST /api/ai/summary` stores under `(language, calendar)` as the composite key.
- `PATCH /api/ai/summary` accepts a `calendar` body field and updates the correct row.
- History queries filter by both `summary_lang` and `summary_calendar`.

**Todo List:**
1. **GET**: read `calendar` from `req.query` (default `'miladi'`); add `AND summary_calendar = ?`
   to both the main SELECT and the history SELECT.
2. **POST upsert**: change `ON CONFLICT(user_id, summary_lang)` to
   `ON CONFLICT(user_id, summary_lang, summary_calendar)` and include `summary_calendar` in
   INSERT columns/values; store `calendar` in `existingRow` lookup and history INSERT too.
3. **PATCH**: read `calendar` from `req.body` (default `'miladi'`); add `AND summary_calendar = ?`
   to SELECT, history INSERT, DELETE trim, and UPDATE statements.
4. Response payloads: add `summary_calendar` field to all three route responses.

**Relevant Context:**
- `packages/server/src/ai/router.ts` — all three route handlers.
- The upsert pattern is at the bottom of the POST handler (lines ~307–316 of the current file).

---

### Sub-Task 3 — Server: full multilingual system prompts + calendar context + location/holidays

**Status:** `[x] done`

**Intent:**
The prompt builder currently branches only on `isFarsi` / `isShamsi`. Expand it to:
- Write a system prompt in the user's native language for all 12 languages.
- Include a calendar context line in the user prompt that names the active calendar system.
- Fetch the user's country and any upcoming holidays (next 14 days) from the DB and append
  a `=== UPCOMING HOLIDAYS ===` section to the prompt.

**Expected Outcomes:**
- System prompt is in the correct language for `ar`, `zh`, `hi`, `es`, `fr`, `de`, `pt`,
  `ru`, `tr`, `id` — not just `en` / `fa`.
- The prompt includes a line like `Calendar system: Shamsi (Jalali) — week runs Sat–Fri`
  (or the equivalent in the user's language).
- If the user has a country set and holidays exist in the next 14 days, they appear in a
  `=== UPCOMING HOLIDAYS ===` section after LOAN PAYMENTS.
- Currency label is still `ریال`/`IRR` for now (no change to currency logic).

**Todo List:**
1. Add a `SYSTEM_PROMPTS` map in `packages/server/src/ai/router.ts` — one entry per language
   code. Each value is a string with the same structure as the existing FA/EN prompts
   (role description, brevity instruction, urgency instruction, JSON format instruction).
   The Shamsi date instruction is appended dynamically when `isShamsi` is true.
2. Add a `CALENDAR_CONTEXT_LINES` map — one entry per language code — describing the active
   calendar system's name and week boundary (e.g. "Sat–Fri" for Shamsi, "Mon–Sun" for all
   others). Used as a line at the top of the user-facing prompt.
3. Extend `gatherUserData` (or the route itself) to:
   - Read `country` from `user_preferences` for this user.
   - If country is non-null, query `user_holidays` for rows where `date BETWEEN today AND in14`
     and `hidden = 0` (respecting user overrides).
   - Return as `upcomingHolidays: { date: string; name: string }[]`.
4. In the prompt builder, append the `=== UPCOMING HOLIDAYS ===` section using the returned
   holidays; format dates with `fmtDate()` (Shamsi if applicable, ISO otherwise).
5. Replace the `isFarsi ? … : …` system-prompt branch with a lookup into `SYSTEM_PROMPTS`
   keyed by `language`, falling back to `'en'`.

**Relevant Context:**
- `packages/server/src/ai/router.ts` — prompt builder from line 91 onwards; system prompt
  from line 219 onwards.
- `packages/server/src/ai/service.ts` — `gatherUserData` return type (`AiContext`).
- `packages/server/src/db.ts` — `user_preferences` table (has `country`);
  `user_holidays` table (columns: `date`, `name`, `hidden`, `is_custom`, `country`, `year`).
- Habit name selection already keys off `isFarsi`; extend to a general language-to-name
  lookup (add `name_ar`, or keep fallback `name_en ?? name` for non-fa/ar languages).

---

### Sub-Task 4 — Client: update API, cache key, and dashboard effect

**Status:** `[x] done`

**Intent:**
The client must pass `calendar` on every summary API call, load/save the localStorage
cache under a key that includes both lang and calendar, and re-fetch when either changes.

**Expected Outcomes:**
- `getCachedSummary(token, lang, calendar)` sends `?lang=en&calendar=miladi`.
- `getSummary(token, lang, calendar)` already sends `calendar` in the POST body — no change
  needed there, but response now includes `summary_calendar`.
- `updateSummary(token, lang, calendar, text)` sends `calendar` in the PATCH body.
- localStorage key changes from `ai_summary_cache_${lang}` to
  `ai_summary_cache_${lang}_${calendar}`.
- The `useEffect` in `DashboardPage` that reloads on `[token, lang]` also reruns on
  `calendar` change.
- `SummaryResult` and `SummaryHistoryEntry` types gain an optional `summaryCalendar` field.

**Todo List:**
1. `packages/client/src/api/ai.ts`:
   - `getCachedSummary`: add `calendar = 'miladi'` param; append `&calendar=${calendar}` to
     the query string.
   - `updateSummary`: add `calendar = 'miladi'` param; include in JSON body.
   - `SummaryResult`: add `summaryCalendar?: string`.
2. `packages/client/src/pages/DashboardPage.tsx`:
   - Change `lsKey` to `ai_summary_cache_${lang}_${calendar}`.
   - Add `calendar` to the dependency array of the summary reload `useEffect`.
   - Pass `calendar` to `getCachedSummary` and `updateSummary` calls.
   - The existing `handleSummarize` already passes `calendar` to `getSummary` — no change.

**Relevant Context:**
- `packages/client/src/api/ai.ts` — all three exported functions.
- `packages/client/src/pages/DashboardPage.tsx` — `lsKey`, `useEffect` at line 84,
  `handleSummarize` at line 129, `handleEditSave` at line 162.
- `useCalendar()` is already imported and destructured on line 58 — `calendar` is available.
