# Remove Google Tasks Picker Flow

## Overview

The Google Tasks integration has a "picker" UI that was designed to let users choose which Google task list to link after OAuth. This flow is **unreachable** in the current codebase — the OAuth callback redirects to `/tasks`, not to `/settings?gtasks=pick`. The bidirectional sync already handles group-to-list linking automatically via `task_groups.google_list_id`. The `task_list_id` column in `google_tasks_tokens` is a legacy fallback and is no longer needed.

**Goal:** Remove the picker UI, its state, the `select-list` endpoint, the `task_list_id` column and all references to it across client and server.

---

## Sub-Tasks

### 1. Remove picker UI and state from SettingsPage

**Intent:** Strip out the unreachable picker flow and the "connected group name" display from the Settings page client component.

**Expected Outcomes:**
- No `pickerLists`, `pickerSelected`, `pickerSaving` state variables
- No `handlePickerConfirm` function
- The `?gtasks=pick` URL param handling in the `useEffect` is removed
- The `pickerLists ? (...)` branch of the JSX is removed
- The connected status no longer shows `· {tasksTaskListTitle}` (just shows "Connected")
- `tasksTaskListTitle` state and its setter are removed
- Imports of `selectGoogleTaskList` and `GoogleTaskList` from `../api/googleTasks` are removed

**Todo List:**
1. In [`SettingsPage.tsx`](packages/client/src/pages/SettingsPage.tsx):
   - Remove `pickerLists`, `pickerSelected`, `pickerSaving` state
   - Remove `tasksTaskListTitle` state (and its setter)
   - Remove `setTasksTaskListId` setter usage (keep `setTasksTaskListId` unused check → just remove the whole `[, setTasksTaskListId]` destructure if `taskListId` is no longer needed)
   - Remove `handlePickerConfirm` function
   - Remove `?gtasks=pick` handling block from the URL-params `useEffect`
   - Remove the `pickerLists ? (...)` JSX branch
   - Remove `· {tasksTaskListTitle}` from the connected status display
   - Remove `selectGoogleTaskList` and `GoogleTaskList` from the import of `../api/googleTasks`
   - In `handleTasksDisconnect`: remove `setTasksTaskListTitle(null)` and `setTasksTaskListId(null)` calls
   - In the `getGoogleTasksStatus` effect: remove `setTasksTaskListId` and `setTasksTaskListTitle` calls

**Relevant Context:**
- [`packages/client/src/pages/SettingsPage.tsx`](packages/client/src/pages/SettingsPage.tsx) — lines 60–71 (state), 83–97 (useEffect picker), 116–126 (status effect), 189–203 (disconnect handler), 206–223 (handlePickerConfirm), 366–411 (picker JSX), 418–423 (title display)
- [`packages/client/src/api/googleTasks.ts`](packages/client/src/api/googleTasks.ts) — `selectGoogleTaskList`, `GoogleTaskList`, `GoogleTasksStatus`

**Status:** [x] done

---

### 2. Remove `selectGoogleTaskList` from the client API

**Intent:** Remove the `selectGoogleTaskList` function and update `GoogleTasksStatus` since `taskListTitle` is no longer shown.

**Expected Outcomes:**
- `selectGoogleTaskList` function deleted from `googleTasks.ts`
- `GoogleTaskList` interface deleted (no longer used by client)
- `GoogleTasksStatus` interface has `taskListId` and `taskListTitle` fields removed (or the whole interface simplified to just `{ connected: boolean }`)

**Todo List:**
1. In [`packages/client/src/api/googleTasks.ts`](packages/client/src/api/googleTasks.ts):
   - Delete `GoogleTaskList` interface
   - Delete `selectGoogleTaskList` function
   - Remove `taskListId` and `taskListTitle` from `GoogleTasksStatus` (simplify to `{ connected: boolean }`)
   - Remove `getGoogleTaskLists` function (also unused by client after this change)

**Relevant Context:**
- [`packages/client/src/api/googleTasks.ts`](packages/client/src/api/googleTasks.ts) — lines 6–42

**Status:** [x] done

---

### 3. Remove `select-list` endpoint and `task_list_id` references from server

**Intent:** Remove the now-unused `POST /select-list` route and all server-side reads/writes of `task_list_id` from `google_tasks_tokens`.

**Expected Outcomes:**
- `POST /api/google-tasks/select-list` route removed
- `GET /api/google-tasks/status` no longer fetches or returns `taskListId` / `taskListTitle`
- `POST /api/google-tasks/sync` no longer reads `task_list_id` (sync is now always a full bidirectional sync via `performFullSync`)
- `getGoogleTasksConnection` in `tasks/router.ts` removes the `task_list_id` fallback branch
- `groups.router.ts` no longer updates `google_tasks_tokens.task_list_id` when setting a default group

**Todo List:**
1. In [`packages/server/src/google/tasks.router.ts`](packages/server/src/google/tasks.router.ts):
   - Delete the `POST /select-list` route handler (lines 235–251)
   - Simplify `GET /status` to only return `{ connected: true/false }` — remove `task_list_id` from SELECT, remove `taskListId`/`taskListTitle` logic
   - Simplify `POST /sync` to call `performFullSync` instead of the targeted single-list sync (or remove the `task_list_id` check and use `performFullSync`)
2. In [`packages/server/src/tasks/router.ts`](packages/server/src/tasks/router.ts):
   - Remove the `task_list_id` fallback in `getGoogleTasksConnection` (lines 55–57)
   - Remove `task_list_id` from the SELECT in that function
3. In [`packages/server/src/tasks/groups.router.ts`](packages/server/src/tasks/groups.router.ts):
   - Remove the block that updates `google_tasks_tokens SET task_list_id` when setting a default group (lines 136–145)

**Relevant Context:**
- [`packages/server/src/google/tasks.router.ts`](packages/server/src/google/tasks.router.ts) — lines 235–251 (select-list), 253–285 (status), 318–373 (sync)
- [`packages/server/src/tasks/router.ts`](packages/server/src/tasks/router.ts) — lines 29–58
- [`packages/server/src/tasks/groups.router.ts`](packages/server/src/tasks/groups.router.ts) — lines 136–145

**Status:** [x] done

---

### 4. Remove `task_list_id` column from DB schema and `GoogleTasksStatus` server type

**Intent:** Remove the `task_list_id` column definition from the `CREATE TABLE` statement in `db.ts` so new databases are created without it. (Existing databases will retain the column harmlessly — no migration needed since SQLite ignores extra columns in SELECT * results.)

**Expected Outcomes:**
- `task_list_id TEXT` line removed from `google_tasks_tokens` CREATE TABLE in `db.ts`

**Todo List:**
1. In [`packages/server/src/db.ts`](packages/server/src/db.ts) line 137: remove the `task_list_id TEXT,` line

**Relevant Context:**
- [`packages/server/src/db.ts`](packages/server/src/db.ts) — line 137

**Status:** [x] done
