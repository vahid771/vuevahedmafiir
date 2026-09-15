# Google Calendar Two-Way Sync — Plan

## Overview

Add two-way Google Calendar sync for Important Dates, Reminders, and Tasks.

- **Push (local → Google):** Every create/update/delete on Important Dates, Reminders, and Tasks (with due_date) is mirrored to Google Calendar immediately after the local DB write.
- **Pull (Google → local):** A manual "Sync from Google Calendar" button on each relevant page (Important Dates, Reminders, Tasks) triggers a full pull. Events are mapped by type: datetime events → Reminders, all-day events → Important Dates, titles starting with `[Task]` → Tasks. The sync endpoint always returns all three collections so each page can update its own state.
- **OAuth:** Uses the same `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` as Drive and Tasks. New redirect URI (`GOOGLE_CALENDAR_REDIRECT_URI`) and scope `https://www.googleapis.com/auth/calendar`. Primary calendar is used automatically (no picker).
- **Conflict resolution:** Google wins on pull (same as Tasks sync). Local write always succeeds regardless of Google API failures.
- All unknown Google Calendar events are imported (not just ones originally pushed from this app).

---

## Sub-Tasks

---

### Sub-Task 1 — DB Schema: new token table + event ID columns

**Intent:** Add the `google_calendar_tokens` table and `google_calendar_event_id` columns to `reminders`, `important_dates`, and `tasks`. This must run before any other sub-task.

**Expected Outcomes:**
- `google_calendar_tokens` table exists with columns: `id`, `user_id`, `access_token`, `refresh_token`, `expiry`, `calendar_id`, `created_at`, `updated_at`
- `reminders.google_calendar_event_id TEXT` column exists
- `important_dates.google_calendar_event_id TEXT` column exists
- `tasks.google_calendar_event_id TEXT` column exists

**Todo List:**
1. In `packages/server/src/db.ts`, add `CREATE TABLE IF NOT EXISTS google_calendar_tokens (...)` to the `executeMultiple` block (same pattern as `google_tasks_tokens`)
2. Add three new entries to the `alterStatements` array:
   - `ALTER TABLE reminders ADD COLUMN google_calendar_event_id TEXT`
   - `ALTER TABLE important_dates ADD COLUMN google_calendar_event_id TEXT`
   - `ALTER TABLE tasks ADD COLUMN google_calendar_event_id TEXT`

**Relevant Context:**
- `packages/server/src/db.ts` — `google_tasks_tokens` schema at lines 131–140 is the exact pattern to follow
- `alterStatements` array at line 146 — duplicate column errors are already caught and ignored (idempotent)

**Status:** [x] done

---

### Sub-Task 2 — Server: Google Calendar OAuth service

**Intent:** Create `packages/server/src/google/calendar.service.ts` that handles OAuth2 client creation, auth URL generation, token exchange, and all Google Calendar API calls needed (create, update, delete event, list events).

**Expected Outcomes:**
- File `packages/server/src/google/calendar.service.ts` exists and exports:
  - `getCalendarAuthUrl(state)` — generates consent URL with `https://www.googleapis.com/auth/calendar` scope
  - `exchangeCalendarCode(code)` — exchanges OAuth code for tokens
  - `getAuthedCalendarClient(tokens)` — returns an authenticated OAuth2 client
  - `getPrimaryCalendarId(auth)` — returns `"primary"` (hardcoded, no API call needed)
  - `createCalendarEvent(auth, calendarId, event)` — creates event, returns `{ id }`
  - `updateCalendarEvent(auth, calendarId, eventId, event)` — patches event
  - `deleteCalendarEvent(auth, calendarId, eventId)` — deletes event
  - `listCalendarEvents(auth, calendarId)` — lists all events (with `singleEvents: true`, no time filter)

**Event shape passed to create/update:**
```ts
{
  summary: string;        // title
  description?: string;  // notes
  start: { date: string } | { dateTime: string; timeZone: string };
  end:   { date: string } | { dateTime: string; timeZone: string };
}
```
- All-day: `start: { date: "YYYY-MM-DD" }`, `end: { date: "YYYY-MM-DD" }` (same date)
- Timed: `start: { dateTime: "ISO string", timeZone: "UTC" }`

**Relevant Context:**
- `packages/server/src/google/tasks.service.ts` — exact pattern to follow (OAuth client construction, `getAuthedTasksClient`, `listGoogleTasks`)
- `packages/server/src/google/drive.service.ts` — alternative pattern reference
- Env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI`

**Status:** [x] done

---

### Sub-Task 3 — Server: Google Calendar OAuth router

**Intent:** Create `packages/server/src/google/calendar.router.ts` with connect/callback/status/disconnect/sync endpoints. Register it in `app.ts` at `/api/google-calendar`.

**Expected Outcomes:**
- `GET /api/google-calendar/connect?token=<JWT>` — redirects to Google consent
- `GET /api/google-calendar/callback?code=X&state=Y` — saves tokens to `google_calendar_tokens`, redirects to `CLIENT_ORIGIN/settings?gcal=connected`
- `GET /api/google-calendar/status` — returns `{ connected: boolean }`
- `DELETE /api/google-calendar/disconnect` — deletes tokens, clears all `google_calendar_event_id` fields on user's reminders, important_dates, and tasks
- `POST /api/google-calendar/sync` — pulls all events from primary calendar, upserts locally using the mapping rules below; returns `{ reminders, dates, tasks }` (all three collections for the user)

**Pull mapping rules (sync endpoint):**
- Event has `start.dateTime` AND title starts with `[Task]` → strip `[Task] ` prefix, upsert into `tasks` (all-day event on the date portion, priority `medium`)
- Event has `start.dateTime` (and no `[Task]` prefix) → upsert into `reminders` (`remind_at = start.dateTime`, `notes = description`)
- Event has `start.date` (all-day, no `[Task]` prefix) → upsert into `important_dates` (`date = start.date`, `recurs_yearly = 0`)
- Upsert key: `google_calendar_event_id` — UPDATE if exists, INSERT otherwise

**Relevant Context:**
- `packages/server/src/google/tasks.router.ts` — full pattern for connect/callback/status/disconnect/sync (copy structure closely)
- `packages/server/src/app.ts` — register at line 51 after `google-tasks`
- `packages/server/src/db.ts` — table names and column names for upsert SQL

**Status:** [x] done

---

### Sub-Task 4 — Server: Push calendar events from Reminders, Important Dates, Tasks routers

**Intent:** After each local create/update/delete on Reminders, Important Dates, and Tasks, push the change to Google Calendar (non-fatal, same pattern as Tasks→Google Tasks push). Store the returned `google_calendar_event_id` on the local row.

**Expected Outcomes:**
- Creating a Reminder with Google Calendar connected creates a timed event on Google Calendar and saves `google_calendar_event_id`
- Editing a Reminder updates the Google Calendar event
- Deleting a Reminder deletes the Google Calendar event
- Same for Important Dates (all-day events) and Tasks with `due_date` (all-day, title prefixed with `[Task] `)
- Tasks without `due_date` are silently skipped (no calendar event)
- Google API failures are caught and logged but do not fail the local operation

**Helper needed:** A shared helper function `getGoogleCalendarConnection(userId)` (mirrors `getGoogleTasksConnection` in tasks router) — returns `{ auth, calendarId }` or `null`.

**Todo List:**
1. Add `getGoogleCalendarConnection(userId)` helper — query `google_calendar_tokens`, return `{ auth, calendarId: row.calendar_id ?? 'primary' }` or `null`
2. In `packages/server/src/reminders/router.ts` — add push after POST, PATCH, DELETE (same pattern as tasks router, use `createCalendarEvent` / `updateCalendarEvent` / `deleteCalendarEvent`)
3. In `packages/server/src/dates/router.ts` — same
4. In `packages/server/src/tasks/router.ts` — same, but skip if no `due_date`; prefix title with `[Task] `

**Relevant Context:**
- `packages/server/src/tasks/router.ts` — exact push pattern already implemented (lines 86–107 for create, 139–162 for update, 164–196 for delete)
- `packages/server/src/reminders/router.ts` and `packages/server/src/dates/router.ts` — these are the target files
- `getGoogleCalendarConnection` can be defined in `calendar.router.ts` and imported, or defined locally in each router — prefer a shared export from `calendar.service.ts`

**Status:** [x] done

---

### Sub-Task 5 — Client: Google Calendar API helper + Settings page section

**Intent:** Add a `packages/client/src/api/googleCalendar.ts` client module, add a Google Calendar section to the Settings page (connect/disconnect only), and add a "Sync from Google Calendar" button to each of the three relevant pages.

**Expected Outcomes:**
- `packages/client/src/api/googleCalendar.ts` exports:
  - `getGoogleCalendarConnectUrl(token)` — same pattern as `getGoogleTasksConnectUrl`
  - `getGoogleCalendarStatus(token)` — `GET /api/google-calendar/status`
  - `disconnectGoogleCalendar(token)` — `DELETE /api/google-calendar/disconnect`
  - `syncFromGoogleCalendar(token)` — `POST /api/google-calendar/sync`, returns `{ reminders, dates, tasks }`
- Settings page has a new "Google Calendar" section with connect button, connected state + disconnect button, and success banner for `?gcal=connected`
- `ImportantDatesPage` gets a "Sync from Google" button — calls sync, updates its dates from `result.dates`
- `RemindersPage` gets a "Sync from Google" button — calls sync, updates its reminders from `result.reminders`
- `TasksPage` already has a sync button pattern (Google Tasks) — add a second "Sync from Calendar" button that updates tasks from `result.tasks`

**Relevant Context:**
- `packages/client/src/api/googleTasks.ts` — exact pattern to copy for the API module
- `packages/client/src/pages/SettingsPage.tsx` — Google Tasks section (lines 293–403) is the exact UI pattern to replicate for the connect/disconnect UI; no task list picker needed
- `packages/client/src/pages/TasksPage.tsx` — existing "Sync from Google Tasks" button (lines 234–258) is the exact per-page sync button pattern to follow
- `packages/client/src/pages/ImportantDatesPage.tsx` and `packages/client/src/pages/RemindersPage.tsx` — add sync button to the header area of each

**Status:** [x] done

---

### Sub-Task 6 — Env var documentation

**Intent:** Document the new `GOOGLE_CALENDAR_REDIRECT_URI` env var in `.env.example`.

**Expected Outcomes:**
- `.env.example` has an entry for `GOOGLE_CALENDAR_REDIRECT_URI` with local and production values documented

**Relevant Context:**
- `.env.example` — follow the existing `GOOGLE_TASKS_REDIRECT_URI` and `GOOGLE_LOGIN_REDIRECT_URI` entries

**Status:** [x] done

---

## Notes for Implementation

- The `google_calendar_tokens.calendar_id` column stores `"primary"` (set in the callback after connecting). No calendar picker UI is needed.
- The `listCalendarEvents` call for sync should use `singleEvents: true` and a reasonable `timeMin` (e.g. 1 year ago) to avoid fetching all historical events.
- When pushing Tasks to calendar, prefix the Google Calendar event summary with `[Task] ` so the pull mapping can identify it on sync.
- `GOOGLE_CALENDAR_REDIRECT_URI` must be added to the Google Cloud Console OAuth client's authorized redirect URIs.
