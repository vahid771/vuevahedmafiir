# Google Tasks Integration Plan

## Overview

Add a two-way Google Tasks integration to the personal life dashboard. Users can connect a dedicated Google Tasks account (separate OAuth from Drive), pick a task list, and thereafter:

- **Push**: every local task create/update/delete is mirrored to Google Tasks.
- **Pull**: a manual "Sync from Google" button on the Tasks page fetches all tasks from the chosen Google task list and overwrites local data (Google wins on conflict).

The integration reuses the existing `googleapis` package and the OAuth pattern already in place for Drive, but uses a distinct token table, a distinct set of scopes, and a dedicated router.

---

## Sub-Tasks

---

### 1 — DB migration: `google_tasks_tokens` table

**Intent**  
Store the OAuth tokens and the chosen task list ID for the Google Tasks connection, independently of the Drive `google_tokens` table.

**Expected Outcomes**  
- A new `google_tasks_tokens` table exists in the schema.
- The `tasks` table gains a `google_task_id` column to track the corresponding Google Tasks item.
- Migrations are idempotent (use `CREATE TABLE IF NOT EXISTS` + ALTER TABLE pattern from existing code).

**Todo List**  
1. Add `CREATE TABLE IF NOT EXISTS google_tasks_tokens` to `runMigrations()` in [`packages/server/src/db.ts`](packages/server/src/db.ts) with columns: `id`, `user_id` (UNIQUE FK → users), `access_token`, `refresh_token`, `expiry`, `task_list_id` (the chosen Google task list ID), `created_at`, `updated_at`.
2. Add an ALTER TABLE statement to `alterStatements[]` to add `google_task_id TEXT` to the `tasks` table (idempotent, ignore duplicate column error).

**Relevant Context**  
- [`packages/server/src/db.ts`](packages/server/src/db.ts) — `runMigrations()`, existing `google_tokens` table, existing `alterStatements` array pattern.

**Status** — `[x] done`

---

### 2 — Server: `google-tasks.service.ts`

**Intent**  
Create a service module that wraps the Google Tasks API (using the existing `googleapis` package), providing all the primitive operations needed by the router and tasks router.

**Expected Outcomes**  
- A new file [`packages/server/src/google/tasks.service.ts`](packages/server/src/google/tasks.service.ts) exports the following functions:
  - `getTasksAuthUrl(state)` — OAuth URL with `tasks` scope.
  - `exchangeTasksCode(code)` — exchange code for tokens.
  - `getAuthedTasksClient(tokens)` — returns an OAuth2Client (reuses `getOAuthClient` from `drive.service.ts`).
  - `listTaskLists(auth)` — returns `{ id, title }[]` of the user's task lists.
  - `createGoogleTask(auth, taskListId, task)` — creates a task and returns `{ id }`.
  - `updateGoogleTask(auth, taskListId, googleTaskId, task)` — updates title/notes/due/status.
  - `deleteGoogleTask(auth, taskListId, googleTaskId)` — deletes a task.
  - `listGoogleTasks(auth, taskListId)` — returns all non-hidden tasks from the list.

**Todo List**  
1. Create [`packages/server/src/google/tasks.service.ts`](packages/server/src/google/tasks.service.ts).
2. Use `google.tasks({ version: 'v1', auth })` from `googleapis`.
3. For `getTasksAuthUrl`, scope is `https://www.googleapis.com/auth/tasks`.
4. Reuse `getOAuthClient()` from `drive.service.ts` for all auth setup.
5. Map local priority/status to Google Tasks `status` (`needsAction` / `completed`).

**Relevant Context**  
- [`packages/server/src/google/drive.service.ts`](packages/server/src/google/drive.service.ts) — OAuth helpers to reuse.
- Google Tasks API v1 (already available via `googleapis` package).

**Status** — `[x] done`

---

### 3 — Server: `google-tasks` router (OAuth connect + task list picker + disconnect)

**Intent**  
Add a dedicated Express router for the Google Tasks OAuth connect flow. After the callback, instead of redirecting directly to settings, redirect to a task-list picker URL that lets the user choose which Google task list to sync with.

**Expected Outcomes**  
- New file [`packages/server/src/google/tasks.router.ts`](packages/server/src/google/tasks.router.ts).
- Routes:
  - `GET /api/google-tasks/connect` — redirect to OAuth consent (token in query param, same pattern as Drive).
  - `GET /api/google-tasks/callback` — exchange code → save tokens → fetch task lists → redirect to `{CLIENT_ORIGIN}/settings?gtasks=pick&lists=<json-encoded-list>`.
  - `GET /api/google-tasks/task-lists` — authenticated; returns `{ id, title }[]` (used if the UI needs to re-fetch lists).
  - `POST /api/google-tasks/select-list` — authenticated; saves `task_list_id` to `google_tasks_tokens`.
  - `GET /api/google-tasks/status` — authenticated; returns `{ connected: boolean, taskListId: string | null, taskListTitle: string | null }`.
  - `DELETE /api/google-tasks/disconnect` — authenticated; deletes row from `google_tasks_tokens`, sets `google_task_id = NULL` on all user tasks.
- Register the router in [`packages/server/src/app.ts`](packages/server/src/app.ts) at `/api/google-tasks`.

**Relevant Context**  
- [`packages/server/src/google/router.ts`](packages/server/src/google/router.ts) — Drive router pattern to follow exactly.
- [`packages/server/src/app.ts`](packages/server/src/app.ts) — where to register new router.

**Status** — `[x] done`

---

### 4 — Server: push local task changes to Google Tasks

**Intent**  
After every task create/update/delete in the existing tasks router, mirror the change to Google Tasks if the user has a connected and configured Google Tasks account.

**Expected Outcomes**  
- [`packages/server/src/tasks/router.ts`](packages/server/src/tasks/router.ts) is updated so that:
  - `POST /api/tasks` — after inserting locally, calls `createGoogleTask` and saves the returned Google task ID into `tasks.google_task_id`.
  - `PATCH /api/tasks/:id` — after updating locally, calls `updateGoogleTask` (if `google_task_id` is present).
  - `DELETE /api/tasks/:id` — before deleting locally, calls `deleteGoogleTask` (if `google_task_id` is present).
- All Google Tasks API calls are fire-and-forget wrapped in a try/catch so a Google API failure never blocks the local operation.
- A helper `getGoogleTasksTokensForUser(userId)` is extracted to a shared utility or inlined.

**Relevant Context**  
- [`packages/server/src/tasks/router.ts`](packages/server/src/tasks/router.ts).
- [`packages/server/src/google/tasks.service.ts`](packages/server/src/google/tasks.service.ts) — functions to call.
- [`packages/server/src/db.ts`](packages/server/src/db.ts) — `google_tasks_tokens` table added in Sub-Task 1.

**Status** — `[x] done`

---

### 5 — Server: manual pull/sync endpoint

**Intent**  
Add a `POST /api/google-tasks/sync` endpoint that fetches all tasks from the user's selected Google task list and upserts them into the local `tasks` table (Google wins on conflict).

**Expected Outcomes**  
- `POST /api/google-tasks/sync` added to the google-tasks router.
- For each Google task returned:
  - If a local task with matching `google_task_id` exists → update `title`, `description`, `due_date`, `status`.
  - If no matching local task → insert a new task with `google_task_id` set.
- Completed Google tasks (`status = 'completed'`) map to local `status = 'done'`; `needsAction` maps to `'open'`.
- Returns the refreshed full task list for the user after sync.

**Relevant Context**  
- [`packages/server/src/google/tasks.service.ts`](packages/server/src/google/tasks.service.ts) — `listGoogleTasks`.
- [`packages/server/src/tasks/router.ts`](packages/server/src/tasks/router.ts) — to understand the local tasks schema.
- [`packages/server/src/db.ts`](packages/server/src/db.ts) — `tasks` table structure.

**Status** — `[x] done`

---

### 6 — Client: Google Tasks API client

**Intent**  
Add client-side API functions for the new Google Tasks endpoints, following the existing pattern in `google.ts` and `tasks.ts`.

**Expected Outcomes**  
- New file [`packages/client/src/api/googleTasks.ts`](packages/client/src/api/googleTasks.ts) exports:
  - `getGoogleTasksConnectUrl(token)` — returns the redirect URL.
  - `getGoogleTasksStatus(token)` — calls `GET /api/google-tasks/status`.
  - `getGoogleTaskLists(token)` — calls `GET /api/google-tasks/task-lists`.
  - `selectGoogleTaskList(token, taskListId)` — calls `POST /api/google-tasks/select-list`.
  - `disconnectGoogleTasks(token)` — calls `DELETE /api/google-tasks/disconnect`.
  - `syncFromGoogleTasks(token)` — calls `POST /api/google-tasks/sync`, returns updated `Task[]`.

**Relevant Context**  
- [`packages/client/src/api/google.ts`](packages/client/src/api/google.ts) — pattern to follow.
- [`packages/client/src/api/base.ts`](packages/client/src/api/base.ts) — `apiUrl`, `authHeaders`.

**Status** — `[x] done`

---

### 7 — Client: Settings page — Google Tasks section

**Intent**  
Add a "Google Tasks" section to the Settings page, directly below the existing "Google Drive" section. Handles connect, task-list picker (shown when `?gtasks=pick` is in the URL), status display, and disconnect.

**Expected Outcomes**  
- [`packages/client/src/pages/SettingsPage.tsx`](packages/client/src/pages/SettingsPage.tsx) gains a new "Google Tasks" card below the Drive card.
- On page load, reads `?gtasks=pick&lists=<encoded>` from the URL; if present, shows an inline list picker (radio buttons + "Confirm" button).
- After `selectGoogleTaskList` is confirmed, shows connected state with the task list name.
- "Disconnect" button calls `disconnectGoogleTasks`.
- Mirrors the same loading/error/success banner UX pattern as the Drive section.

**Relevant Context**  
- [`packages/client/src/pages/SettingsPage.tsx`](packages/client/src/pages/SettingsPage.tsx) — existing Drive section for UI pattern reference.
- [`packages/client/src/api/googleTasks.ts`](packages/client/src/api/googleTasks.ts) — API functions.

**Status** — `[x] done`

---

### 8 — Client: Sync button on Tasks page

**Intent**  
Add a "Sync from Google" button on the Tasks page header that triggers the manual pull and refreshes the task list.

**Expected Outcomes**  
- [`packages/client/src/pages/TasksPage.tsx`](packages/client/src/pages/TasksPage.tsx) gains a "Sync" button in the header (only visible when Google Tasks is connected).
- Clicking it calls `syncFromGoogleTasks(token)`, replaces the `tasks` state with the returned list, and shows a brief success indicator.
- A syncing spinner state is shown during the call; errors are shown in the existing error banner.

**Relevant Context**  
- [`packages/client/src/pages/TasksPage.tsx`](packages/client/src/pages/TasksPage.tsx).
- [`packages/client/src/api/googleTasks.ts`](packages/client/src/api/googleTasks.ts) — `syncFromGoogleTasks`, `getGoogleTasksStatus`.

**Status** — `[x] done`

---

## Implementation Notes

- The `googleapis` package is already installed on the server — no new dependencies needed on the server side.
- The Google OAuth2 client ID/secret/redirect URI env vars are shared between Drive and Tasks, but the redirect URI will be different: add `GOOGLE_TASKS_REDIRECT_URI` to `.env.example`.
- All Google API calls in the tasks push flow (Sub-Task 4) must be fire-and-forget (wrapped in `try/catch`, errors only logged) so local task operations are never blocked.
- The task list picker data is passed through the redirect URL as a base64-encoded JSON string to avoid a second round-trip API call from the client.
