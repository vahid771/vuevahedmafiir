# Codebase Refactor Plan

## Overview

A broad structural refactor covering all identified duplication and quality issues across the client and server. The goal is to eliminate repeated code, close type-safety gaps, align the attachment flow with the sync queue, fix i18n coverage, and make charts layout-agnostic. Each sub-task is independently reviewable.

---

## Sub-Task 1 — Client API Resource Factory

**Status:** `[ ] pending`

**Intent**  
Replace the ~50 lines of repeated `fetch / authHeaders / apiUrl / error-throw` boilerplate in every API module with a single `createResource(basePath)` factory that generates typed `getAll`, `getById`, `create`, `update`, `remove` functions. Each existing API module keeps its named exports but delegates to the factory.

**Expected Outcomes**
- `packages/client/src/api/base.ts` exports a `createResource<T, C = Partial<T>>(basePath: string)` factory.
- `api/tasks.ts`, `api/bills.ts`, `api/habits.ts`, `api/reminders.ts`, `api/dates.ts` each call the factory and re-export the generated functions. Custom endpoints (Google sync, log/unlog, etc.) remain as hand-written functions above or below the factory call.
- Total fetch/error boilerplate in those files drops by ~70%.

**Todo List**
1. Add `createResource<T, C>` to `packages/client/src/api/base.ts` with `getAll`, `getById`, `create`, `update`, `remove` methods, each accepting a `token` as first arg.
2. Refactor `api/tasks.ts` to use the factory for standard CRUD; keep sync/toggle helpers.
3. Refactor `api/bills.ts`, `api/habits.ts`, `api/reminders.ts`, `api/dates.ts` the same way.
4. Verify TypeScript compiles cleanly (`npm run build --workspace=packages/server`).

**Relevant Context**
- `packages/client/src/api/base.ts` — `apiUrl`, `authHeaders`
- `packages/client/src/api/tasks.ts`, `bills.ts`, `habits.ts`, `reminders.ts`, `dates.ts`
- All existing callers in pages must still compile without change (factory output matches current signatures).

---

## Sub-Task 2 — Fix Document Type & Attachment Optimistic UI

**Status:** `[ ] pending`

**Intent**  
Close the type gap where the `Document` interface is missing `drive_file_id` / `drive_view_link`, and fix `AttachmentsSection` so that the optimistic AttachedDocument after attach/upload carries the real drive link instead of `null`. This makes the "Open in Drive" link appear immediately after upload without a page reload.

**Expected Outcomes**
- `packages/client/src/api/documents.ts` `Document` interface includes `drive_file_id: string | null` and `drive_view_link: string | null`.
- `AttachmentsSection.handleAttach` builds the optimistic `AttachedDocument` using `selectedDoc.drive_file_id` and `selectedDoc.drive_view_link`.
- `AttachmentsSection.handleUpload` builds the optimistic `AttachedDocument` using the `drive_file_id` / `drive_view_link` returned by `uploadDocument`.
- "Open in Drive" link appears on newly attached/uploaded docs without reload.

**Todo List**
1. Add `drive_file_id` and `drive_view_link` to the `Document` interface in `api/documents.ts`.
2. In `AttachmentsSection.handleAttach`, copy `drive_file_id` and `drive_view_link` from `selectedDoc` into the optimistic object.
3. In `AttachmentsSection.handleUpload`, copy `drive_file_id` and `drive_view_link` from the `newDoc` returned by `uploadDocument` into the optimistic object.

**Relevant Context**
- `packages/client/src/api/documents.ts` — `Document` interface (lines 1-10)
- `packages/client/src/api/attachments.ts` — `AttachedDocument` interface
- `packages/client/src/components/attachments/AttachmentsSection.tsx` — `handleAttach` (line 82), `handleUpload` (line 105)
- Server returns both fields: `packages/server/src/documents/router.ts` DocumentRow type (line 51)

---

## Sub-Task 3 — Wire AttachmentsSection to Sync Queue

**Status:** `[ ] pending`

**Intent**  
`AttachmentsSection` currently uploads documents with no sync-queue notification, while every other write operation in the app shows progress/result in the `SyncQueuePanel`. This sub-task adds `useSyncQueue` to `AttachmentsSection` so upload operations appear in the panel.

**Expected Outcomes**
- `AttachmentsSection` calls `useSyncQueue` and wraps `handleUpload`'s API calls in `addJob` with the `sync.uploadItem` label key.
- The `SyncQueuePanel` shows a pending/done/failed row when an attachment is uploaded.
- Attach-existing (no upload) is a fast local operation and does NOT need a sync job.

**Todo List**
1. Import `useSyncQueue` in `AttachmentsSection.tsx`.
2. Wrap the `uploadDocument` + `addAttachment` calls inside `handleUpload` in `addJob({ key: 'sync.uploadItem', vars: { name: uploadTitle } }, ...)`.
3. Confirm error state is still set on failure (the `catch` inside `addJob` callback should set `error`).

**Relevant Context**
- `packages/client/src/components/attachments/AttachmentsSection.tsx` — `handleUpload` (line 105)
- `packages/client/src/context/SyncQueueContext.tsx` — `addJob` API
- `packages/client/src/i18n/en.json` — `sync.uploadItem` key already exists (line 437)

---

## Sub-Task 4 — Fix i18n Gaps

**Status:** `[ ] pending`

**Intent**  
Two hardcoded English strings bypass the i18n system: the upload title placeholder in `AttachmentsSection` and two error messages in `DocumentsPage`. This sub-task adds the missing keys and replaces the hardcoded strings.

**Expected Outcomes**
- `AttachmentsSection` title input uses `t('attachments.uploadTitle')`.
- `DocumentsPage` upload/delete failure messages use `t('documents.failedUpload')` and `t('documents.failedDelete')` (both keys already exist in `en.json`).
- All 12 locale files get the new `attachments.uploadTitle` key.

**Todo List**
1. Add `"uploadTitle": "Document title"` to the `attachments` block of all 12 locale files (`en`, `ar`, `de`, `es`, `fa`, `fr`, `hi`, `id`, `pt`, `ru`, `tr`, `zh`).
2. Replace `placeholder="Document title"` in `AttachmentsSection.tsx` (line 252) with `placeholder={t('attachments.uploadTitle')}`.
3. In `DocumentsPage.tsx` replace the two hardcoded `'Failed to upload/delete document'` strings with the existing `t('documents.failedUpload')` and `t('documents.failedDelete')` keys.

**Relevant Context**
- `packages/client/src/components/attachments/AttachmentsSection.tsx` line 252
- `packages/client/src/pages/DocumentsPage.tsx` lines 110, 125
- `packages/client/src/i18n/en.json` — `attachments` block (line 477), `documents` block (line 261)

---

## Sub-Task 5 — Shared Form Utilities

**Status:** `[ ] pending`

**Intent**  
The `handleCancel` dirty-check and the save/cancel button row are byte-for-byte identical across all 7 form components. Extract them into a shared `useFormGuard` hook and a `FormActions` component so future forms get the behaviour for free.

**Expected Outcomes**
- `packages/client/src/hooks/useFormGuard.ts` exports `useFormGuard<T>(form, initial, onCancel)` returning a `handleCancel` function that performs the dirty-check confirm.
- `packages/client/src/components/ui/FormActions.tsx` renders the standard cancel/save button row and accepts `onCancel`, `onSave`, `saving`, `disabled` props.
- All 7 form components use `useFormGuard` and `<FormActions>` — removing the duplicated blocks.
- Behaviour is identical to current.

**Todo List**
1. Create `packages/client/src/hooks/useFormGuard.ts` — generic hook using `JSON.stringify` diff and `window.confirm(t('common.unsavedChanges'))`.
2. Create `packages/client/src/components/ui/FormActions.tsx` — renders cancel + save buttons with consistent styling.
3. Replace the inline `handleCancel` and button rows in `TaskForm`, `BillForm`, `SubscriptionForm`, `LoanForm`, `HabitForm`, `ReminderForm`, `DateForm`.
4. TypeScript build must pass.

**Relevant Context**
- `packages/client/src/hooks/` — existing hooks for naming conventions
- `packages/client/src/components/ui/` — existing shared UI components
- All 7 form files in `packages/client/src/components/`
- `packages/client/src/i18n/en.json` — `common.unsavedChanges` (added in previous session)

---

## Sub-Task 6 — Chart Layout Agnosticism

**Status:** `[ ] pending`

**Intent**  
`TasksCharts`, `HabitsCharts`, and `BillsCharts`/`LoansCharts` hardcode a `sm:grid-cols-2` layout inside themselves. When placed in the narrow 360px sticky column (added in the previous session), the `sm` breakpoint kicks in at 640px and produces a 2-column grid inside a 360px container, causing visual breakage. Charts should be layout-agnostic — the page decides the column grid, the chart component renders a single column flow.

**Expected Outcomes**
- `TasksCharts` renders its two chart cards stacked vertically (no internal `sm:grid-cols-2`). The page's side column already places them in a dedicated area.
- `HabitsCharts` does the same.
- `BillsCharts` and `LoansCharts` in `PaymentsCharts.tsx` also render stacked.
- On mobile the visual result is unchanged (was already 1-column). On desktop the charts now fill the 360px column cleanly in a single column.
- Internal top-margin (`mt-6`) is removed from chart components since the page wrapper controls spacing.

**Todo List**
1. In `TasksCharts.tsx` change the outer `div` from `className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4"` to `className="space-y-4"`.
2. In `HabitsCharts.tsx` apply the same change.
3. In `PaymentsCharts.tsx` remove the `mt-4` / `mt-6` wrappers (already handled by the page sticky `div`).
4. Verify mobile layout is unaffected (charts stack vertically as before).

**Relevant Context**
- `packages/client/src/components/charts/TasksCharts.tsx` line 35
- `packages/client/src/components/charts/HabitsCharts.tsx` — outer wrapper
- `packages/client/src/components/charts/PaymentsCharts.tsx` — `BillsCharts` and `LoansCharts` wrappers
- `packages/client/src/pages/TasksPage.tsx`, `BillsPage.tsx`, `HabitsPage.tsx` — sticky column wrappers already provide `mt-6 lg:mt-0`

---

## Sub-Task 7 — Page-Level State Hook

**Status:** `[ ] pending`

**Intent**  
Every page duplicates the same `loading / error / saving` state trio plus the async load-with-error-catch pattern. Extract a `useAsyncState` hook that encapsulates this trio and provides a `run(fn)` executor that sets loading, catches errors, and always clears loading. This removes ~20 lines of repeated boilerplate per page.

**Expected Outcomes**
- `packages/client/src/hooks/useAsyncState.ts` exports `useAsyncState<T>()` returning `{ data, loading, error, setError, run }`.
- `run(fn)` sets `loading = true`, awaits `fn()`, sets result data, catches to `error`, and always sets `loading = false`.
- All 5 data-fetching pages (`TasksPage` sub-components, `BillsPage` sub-sections, `HabitsPage`, `RemindersPage`, `ImportantDatesPage`) use the hook for their primary data load.
- `DocumentsPage` uses it for the `load()` function.

**Todo List**
1. Create `packages/client/src/hooks/useAsyncState.ts`.
2. Refactor `HabitsPage` load pattern first as a pilot.
3. Refactor `RemindersPage`, `ImportantDatesPage`, `DocumentsPage`.
4. Refactor `BillsPage` sub-sections (`BillsSection`, `SubscriptionsSection`, `LoansSection`).
5. Refactor `TasksPage` sub-components (`TaskList`, `AllTasksView`).
6. TypeScript build must pass with no regressions.

**Relevant Context**
- `packages/client/src/hooks/useAsyncState.ts` — new file
- All page files in `packages/client/src/pages/`
- The hook must NOT replace `addJob` sync-queue flows — only the plain load/save state patterns

---

## Sub-Task 8 — Server Router CRUD Factory

**Status:** `[ ] pending`

**Intent**  
All five domain routers (`tasks`, `bills`, `habits`, `reminders`, `dates`) share the same structure: `router.use(authenticateToken)`, ownership check, GET all, POST create, PATCH update, DELETE remove. Create a `createCrudRouter(config)` factory that generates this scaffolding from a config object, with optional override hooks for domain-specific logic (Google sync, validation, computed fields).

**Expected Outcomes**
- `packages/server/src/utils/crudRouter.ts` exports `createCrudRouter<T>(config)`.
- Config accepts: `table`, `ownerField`, `allowedCreateFields`, `allowedUpdateFields`, `onBeforeCreate?`, `onAfterCreate?`, `onBeforeUpdate?`, `onAfterUpdate?`, `onBeforeDelete?`.
- Each of the 5 domain routers is replaced with a call to `createCrudRouter` plus domain-specific additions (Google sync endpoints, custom validation, non-fatal integrations).
- Server TypeScript compiles cleanly.
- All existing API behaviour is preserved (same routes, same response shapes).

**Todo List**
1. Create `packages/server/src/utils/crudRouter.ts` with `createCrudRouter`.
2. Refactor `habits/router.ts` first (simplest domain — no Google integration on CRUD routes).
3. Refactor `dates/router.ts` and `reminders/router.ts` (Google Calendar integration goes in `onAfterCreate` / `onAfterUpdate` hooks).
4. Refactor `bills/router.ts` (covers bills, subscriptions, loans sub-routers).
5. Refactor `tasks/router.ts` (most complex — Google Tasks + Calendar hooks).
6. Run `npm run build --workspace=packages/server` to confirm no regressions.

**Relevant Context**
- `packages/server/src/utils/db.ts` — `fetchById` helper
- `packages/server/src/middleware/authenticate.ts` — `authenticateToken`
- `packages/server/src/tasks/router.ts`, `bills/router.ts`, `habits/router.ts`, `reminders/router.ts`, `dates/router.ts`
- Ownership pattern: `SELECT id FROM {table} WHERE id = ? AND user_id = ?`

---

## Execution Order

Sub-tasks are ordered to minimise merge conflicts and maximise early wins:

```
1 → API factory (client, no UI changes)
2 → Document type + optimistic fix (small, high-value)
3 → Attachments sync queue (depends on 2 for drive_view_link)
4 → i18n gaps (trivial, independent)
5 → Form utilities (UI refactor, independent)
6 → Chart layout (independent, visual)
7 → Page state hook (widest client change — do after 3/5 to avoid conflicts)
8 → Server CRUD factory (server-only, independent, widest server change)
```
