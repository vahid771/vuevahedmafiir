# Kanban Board with Customizable Status Columns per Task Tab

## Top-Level Overview

Each task group tab (except "All") will support a fully customizable set of status columns (Kanban board). Users can add, rename, reorder, and delete columns. Tasks will be assignable to a column via drag-and-drop. A view toggle (list / board) per tab lets users switch between the existing list view and the new Kanban board. The "All" tab keeps its current list + charts view unchanged.

### Scope
- **In scope**: `task_columns` table and migration, column CRUD API, `column_id` on tasks, board view component with `@dnd-kit/core`, view toggle (list/board) per tab, i18n keys, default columns seeded when a group is created.
- **Out of scope**: Google Tasks / Calendar sync for column data (columns are local-only), drag-to-reorder tasks within a column (only cross-column drag needed), changes to the "All" tab.

---

## Sub-Tasks

---

### Sub-Task 1 — Database: `task_columns` table + `column_id` on tasks

**Intent**  
Introduce the `task_columns` table and link tasks to columns via `column_id`. Use the project's additive migration pattern (appending SQL strings to the `runMigrations` array in `packages/server/src/db.ts`).

**Expected Outcomes**
- `task_columns` table exists with columns: `id`, `user_id`, `task_group_id`, `name`, `color`, `sort_order`, `created_at`.
- `tasks` table has a nullable `column_id` column referencing `task_columns(id) ON DELETE SET NULL`.
- An index exists on `task_columns(task_group_id)`.
- Existing tasks are unaffected (column_id is NULL until assigned).

**Todo List**
1. Open `packages/server/src/db.ts`.
2. At the end of the migrations array (after the last existing entry before the closing `]`), append:
   - `CREATE TABLE IF NOT EXISTS task_columns` with columns: `id INTEGER PRIMARY KEY AUTOINCREMENT`, `user_id INTEGER NOT NULL REFERENCES users(id)`, `task_group_id INTEGER NOT NULL REFERENCES task_groups(id) ON DELETE CASCADE`, `name TEXT NOT NULL`, `color TEXT NOT NULL DEFAULT '#6366f1'`, `sort_order INTEGER DEFAULT 0`, `created_at TEXT DEFAULT (datetime('now'))`.
   - `CREATE INDEX IF NOT EXISTS idx_task_columns_group ON task_columns(task_group_id)`.
   - `ALTER TABLE tasks ADD COLUMN column_id INTEGER REFERENCES task_columns(id) ON DELETE SET NULL`.

**Relevant Context**
- Migration array: `packages/server/src/db.ts` lines 39–306 — all entries are SQL strings appended to the array; ALTERs are no-ops on new installs.
- Pattern: `ALTER TABLE tasks ADD COLUMN google_task_id TEXT` at line 167 is an example of an additive column migration.

**Status** — `[ ] pending`

---

### Sub-Task 2 — Server: Task Columns API router

**Intent**  
Expose CRUD endpoints for `task_columns` so the client can manage columns per group. Also seed default columns when a new task group is created.

**Expected Outcomes**
- `GET /api/task-columns?group_id=N` — returns columns for that group ordered by `sort_order`.
- `POST /api/task-columns` — creates a column `{ task_group_id, name, color?, sort_order? }`.
- `PATCH /api/task-columns/:id` — updates `name`, `color`, and/or `sort_order`.
- `DELETE /api/task-columns/:id` — deletes the column; tasks with that `column_id` have it set to NULL automatically via FK.
- `PATCH /api/task-columns/reorder` — accepts `[{ id, sort_order }]` array and batch-updates sort_order.
- When a new task group is created (`POST /api/task-groups`), three default columns are seeded: "To Do" (sort_order 0, color `#6366f1`), "In Progress" (sort_order 1, color `#f59e0b`), "Done" (sort_order 2, color `#22c55e`).
- Router is mounted in `packages/server/src/app.ts`.

**Todo List**
1. Create `packages/server/src/tasks/columns.router.ts` with the five endpoints above, all protected by `authenticateToken`.
2. In `GET`, query `task_columns WHERE task_group_id = ? AND user_id = ?` ordered by `sort_order ASC`.
3. In `POST`, validate `task_group_id` and `name` are present; assert the group belongs to `req.user.id` before inserting.
4. In `PATCH /:id`, use the existing `buildPatch` utility.
5. In `DELETE /:id`, assert ownership then delete — FK cascade handles task NULLing automatically.
6. In `PATCH /reorder`, accept `{ columns: [{id, sort_order}] }` body; run individual UPDATE statements inside a transaction (use `db.batch`).
7. In `packages/server/src/tasks/groups.router.ts` `POST /` handler, after the group is inserted and its `id` retrieved, insert the three default columns.
8. Mount `columnsRouter` in `packages/server/src/app.ts` at `/api/task-columns`.

**Relevant Context**
- `packages/server/src/tasks/groups.router.ts` lines 40–90 — group creation handler to extend with column seeding.
- `packages/server/src/app.ts` lines 54–55 — where task routers are mounted.
- `packages/server/src/utils/db.ts` — `assertOwnership`, `buildPatch`, `fetchById` utilities.
- `packages/server/src/middleware/authenticate.ts` — `authenticateToken` middleware pattern.

**Status** — `[ ] pending`

---

### Sub-Task 3 — Server: Extend tasks router to support `column_id`

**Intent**  
Allow `column_id` to be passed when creating or updating a task, and include it in task responses.

**Expected Outcomes**
- `POST /api/tasks` accepts optional `column_id` in request body and stores it.
- `PATCH /api/tasks/:id` accepts optional `column_id` and updates it.
- `GET /api/tasks` returns `column_id` in each task row (it's already a column on the table, so SELECT * will include it automatically once added).
- Moving a task to a different column is done via `PATCH /api/tasks/:id` with `{ column_id: N }`.

**Todo List**
1. In `packages/server/src/tasks/router.ts` `POST /` handler (line ~80), destructure `column_id` from `req.body` and include it in the `INSERT` statement.
2. In the `PATCH /:id` handler (line ~162), add `column_id` to the `buildPatch` fields it accepts.
3. No change needed to `GET /` — `SELECT *` already returns all columns including `column_id` once the migration runs.

**Relevant Context**
- `packages/server/src/tasks/router.ts` lines 80–200 — POST and PATCH handlers.
- `packages/server/src/utils/db.ts` `buildPatch` — dynamically builds SET clauses from allowed fields.

**Status** — `[ ] pending`

---

### Sub-Task 4 — Client: Task Columns API client

**Intent**  
Create the client-side API module for `task_columns`, mirroring the pattern used by `taskGroups.ts`.

**Expected Outcomes**
- `packages/client/src/api/taskColumns.ts` exports: `TaskColumn` interface, `getTaskColumns`, `createTaskColumn`, `updateTaskColumn`, `deleteTaskColumn`, `reorderTaskColumns`.
- `Task` interface in `packages/client/src/api/tasks.ts` gains optional `column_id?: number | null`.
- `CreateTaskData` and `UpdateTaskData` gain optional `column_id?: number | null`.

**Todo List**
1. Create `packages/client/src/api/taskColumns.ts`:
   - `TaskColumn` interface: `{ id, user_id, task_group_id, name, color, sort_order, created_at }`.
   - `getTaskColumns(token, groupId)` — GET `/api/task-columns?group_id=N`.
   - `createTaskColumn(token, data)` — POST `/api/task-columns`.
   - `updateTaskColumn(token, id, data)` — PATCH `/api/task-columns/:id`.
   - `deleteTaskColumn(token, id)` — DELETE `/api/task-columns/:id`.
   - `reorderTaskColumns(token, columns)` — PATCH `/api/task-columns/reorder`.
2. In `packages/client/src/api/tasks.ts`, add `column_id?: number | null` to `Task`, `CreateTaskData`, `UpdateTaskData`.

**Relevant Context**
- `packages/client/src/api/taskGroups.ts` — identical pattern to follow.
- `packages/client/src/api/base.ts` — `apiUrl` and `authHeaders` helpers.

**Status** — `[ ] pending`

---

### Sub-Task 5 — Client: Install `@dnd-kit/core` and `@dnd-kit/sortable`

**Intent**  
Add the drag-and-drop library to the client package so it can be used in the Kanban board component.

**Expected Outcomes**
- `@dnd-kit/core` and `@dnd-kit/sortable` are listed in `packages/client/package.json` dependencies.
- The packages are installed and resolvable.

**Todo List**
1. From the workspace root (or `packages/client`), run: `npm install @dnd-kit/core @dnd-kit/sortable --workspace=packages/client`.

**Relevant Context**
- `packages/client/package.json` — existing dependencies list.
- `@dnd-kit/core` handles drag sensors and context; `@dnd-kit/sortable` handles sortable lists within columns.

**Status** — `[ ] pending`

---

### Sub-Task 6 — Client: `KanbanBoard` component

**Intent**  
Create a `KanbanBoard` React component that renders the columns for a task group as horizontal Kanban lanes. Tasks are rendered as draggable cards and can be moved between columns. Column management (add / rename / reorder / delete) is handled inline within the board.

**Expected Outcomes**
- `packages/client/src/components/tasks/KanbanBoard.tsx` exists and is functional.
- Each column shows its name and color accent, a count of tasks, and an "+ Add Task" button.
- Tasks render as cards (title, priority badge, due date, attachment count). Clicking a card opens the inline edit form.
- Dragging a card to another column calls `updateTask(token, id, { column_id: targetColumnId })` to persist the change.
- Column header shows edit (rename) and delete buttons on hover. A "+ Add Column" button appears to the right of all columns.
- Renaming a column calls `updateTaskColumn`; deleting calls `deleteTaskColumn` (tasks in that column have `column_id` NULLed by the FK, and are then auto-reassigned to the first column on next board load).
- Columns can be reordered via drag-and-drop on the column headers using `@dnd-kit/sortable`; calls `reorderTaskColumns` on drop.
- Tasks with `column_id = null` are automatically assigned to the first column (by `sort_order`) on board mount — no "Uncategorized" lane is shown.
- The component receives: `groupId`, `gTasksConnected`, `gcalConnected` props (same as `TaskList`).

**Todo List**
1. Create `packages/client/src/components/tasks/KanbanBoard.tsx`.
2. On mount, fetch columns via `getTaskColumns` and tasks via `getTasks({ group_id })`.
3. Use `DndContext` from `@dnd-kit/core` wrapping the entire board. Use `useSortable` from `@dnd-kit/sortable` for column reordering.
4. Each column is a vertical lane: header with color bar + name + task count + action icons; scrollable task card list; "Add Task" button at the bottom.
5. Task card component: title, priority badge (reuse `PRIORITY_BADGE` constant), due date, attachment count indicator.
6. On drag end: if column changed, call `updateTask` to update `column_id` and optimistically update local state.
7. On column reorder drag end: call `reorderTaskColumns` and update local columns state.
8. "Add Task" within a column pre-fills `column_id` for the new task.
9. On mount (after both columns and tasks are loaded), find any tasks where `column_id` is null and the group has at least one column. For each such task, call `updateTask(token, id, { column_id: firstColumn.id })` and update local state. Run these in parallel (Promise.all) but do not block the render.
10. Respect the existing Framer Motion animation patterns for task cards appearing.
11. Export `KanbanBoard` as default from the file.

**Relevant Context**
- `packages/client/src/pages/TasksPage.tsx` `TaskRow` component (lines 57–142) — reuse `PRIORITY_BADGE` and `TaskRow` display logic.
- `packages/client/src/components/tasks/TaskForm.tsx` — reuse for inline add/edit within board.
- `packages/client/src/hooks/useAsyncState.ts` — use the same data-fetching pattern.
- `packages/client/src/context/SyncQueueContext.tsx` — wrap mutations in `addJob` when sync is active.
- Tailwind CSS for styling. Keep column cards consistent with the existing white card / gray border design.

**Status** — `[ ] pending`

---

### Sub-Task 7 — Client: View toggle and integration in `TasksPage`

**Intent**  
Add a list/board toggle button to each group tab and wire it up so clicking "Board" renders `KanbanBoard` and clicking "List" renders the existing `TaskList`.

**Expected Outcomes**
- A view toggle (list icon / board icon) appears in the top-right area of the tab content area for non-"All" tabs.
- The active view preference is persisted per group ID in `localStorage` so it survives navigation (key: `taskView_<groupId>`).
- `KanbanBoard` is rendered when board view is active; `TaskList` is rendered when list view is active.
- The "All" tab is unaffected.

**Todo List**
1. In `packages/client/src/pages/TasksPage.tsx`, add state: `viewMode: 'list' | 'board'` initialized from `localStorage.getItem('taskView_' + activeGroupId)` defaulting to `'list'`.
2. When `activeGroupId` changes, re-read `localStorage` to initialize the correct view for that group.
3. Add a toggle UI (two icon buttons: list lines icon / kanban columns icon) placed to the right of "+ Add Task" in the tab content area.
4. Toggling writes to `localStorage` and updates `viewMode` state.
5. In the tab content area (line ~564 of `TasksPage.tsx`), when `activeTab.id !== 'all'` and `viewMode === 'board'`, render `<KanbanBoard>` instead of `<TaskList>`.
6. Import `KanbanBoard` from `../components/tasks/KanbanBoard`.
7. Pass the same `gTasksConnected` and `gcalConnected` props to both views.

**Relevant Context**
- `packages/client/src/pages/TasksPage.tsx` lines 563–576 — tab content rendering switch.
- The toggle should use simple inline SVG icons (list and grid/columns icons) consistent with the rest of the file.

**Status** — `[ ] pending`

---

### Sub-Task 8 — Client: i18n translation keys

**Intent**  
Add all new user-facing strings for column management and board view to the English translation file, and add the same keys (with English fallback values) to all other language files.

**Expected Outcomes**
- `packages/client/src/i18n/en.json` has new keys under `tasks` for column-related UI strings.
- All other language JSON files (`de`, `fr`, `es`, `ar`, `hi`, `id`, `pt`, `tr`, `fa`, `zh`, `ru`) have the same keys (English values are acceptable as fallbacks).

**New keys to add under `tasks`**:
```
tasks.boardView           = "Board"
tasks.listView            = "List"
tasks.addColumn           = "Add column"
tasks.columnName          = "Column name"
tasks.renameColumn        = "Rename column"
tasks.deleteColumn        = "Delete column"
tasks.deleteColumnConfirm = "Delete this column? Tasks will be moved to the first column."
tasks.noTasksInColumn     = "No tasks"
tasks.addTaskToColumn     = "+ Add Task"
```

**Todo List**
1. Open `packages/client/src/i18n/en.json` and add the keys above under the `"tasks"` object (after the existing `"deleteGroupConfirm"` key area).
2. Open each of the other 11 language files in `packages/client/src/i18n/` and add the same keys with English values (translators can update later).

**Relevant Context**
- `packages/client/src/i18n/en.json` lines 72–101 — existing tasks keys.
- Language files: `de.json`, `fr.json`, `es.json`, `ar.json`, `hi.json`, `id.json`, `pt.json`, `tr.json`, `fa.json`, `zh.json`, `ru.json` — all in `packages/client/src/i18n/`.

**Status** — `[ ] pending`

---

## Architecture Diagram

```
task_groups (existing)
  └── task_columns  (NEW: many per group)
        └── tasks.column_id FK  (NEW: tasks assigned to a column)

API Layer (new):
  GET  /api/task-columns?group_id=N
  POST /api/task-columns
  PATCH /api/task-columns/:id
  PATCH /api/task-columns/reorder
  DELETE /api/task-columns/:id

Client:
  TasksPage
    └── [group tab active]
          ├── view toggle: list | board
          ├── [list mode] → TaskList (existing, unchanged)
          └── [board mode] → KanbanBoard (new)
                ├── Column 1 (To Do)  ← draggable cards
                ├── Column 2 (In Progress)
                ├── Column N (custom)
                └── [+ Add Column]
```

## Implementation Order

Sub-tasks should be completed in order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.  
Sub-tasks 1–4 are back-end and API client changes that the board component depends on.  
Sub-task 5 (package install) must complete before Sub-task 6 (board component).  
Sub-tasks 7 and 8 are independent of each other and can be done in either order after 6.
