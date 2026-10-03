# Document Attachments v2 Plan

## Top-Level Overview

Extend the existing document attachments system (v1) with three new capabilities:

1. **Attachments preview in list views** — Task, Bill/Subscription/Loan, Reminder, and Important Date list items show a compact attachment count badge (or small icon strip) so users can see at a glance which items have documents attached.

2. **Attachments in create forms** — Allow attaching documents when creating a new task, bill, subscription, loan, reminder, or important date. Because the entity has no ID until it is saved, the form uses a two-step flow: save the entity first, then immediately show the attachment section (the modal stays open in "just created" state).

3. **Full i18n for AttachmentsSection** — Replace all hardcoded English strings in `AttachmentsSection.tsx` with `t()` calls, and add the translation keys to all 12 language files (`en`, `ar`, `de`, `es`, `fa`, `fr`, `hi`, `id`, `pt`, `ru`, `tr`, `zh`).

**Scope:**
- New `attachments` translation key namespace added to all 12 i18n JSON files
- `AttachmentsSection.tsx` fully i18n-ified
- `TasksPage.tsx`, `ImportantDatesPage.tsx`, `BillsPage.tsx`, `RemindersPage.tsx` — list item rows updated to fetch and show attachment counts/preview
- Create form two-step flow implemented for tasks, important dates, bills (bills + subscriptions + loans), and reminders
- A new lightweight client hook `useAttachmentCounts` to batch-fetch counts for a list of entities efficiently

**Non-goals:**
- Habits page list preview (habits don't have the same card pattern; deferred)
- Subscriptions/Loans get preview badges same as Bills (same page, same pattern)
- Clicking the attachment badge on a list item does NOT open a separate view — it opens the edit modal (existing behavior)
- No new server endpoints — the existing `GET /api/attachments?entity_type=X&entity_id=N` is used per item

---

## Sub-Tasks

---

### Sub-Task 1 — i18n: add `attachments` translation namespace to all 12 language files

**Intent:**
Define all UI strings needed by `AttachmentsSection` as a proper `attachments` namespace in the i18n system, covering all 12 languages. English is the source of truth; all other languages need accurate translations.

**Expected Outcomes:**
- Every `packages/client/src/i18n/*.json` file gains a top-level `"attachments"` key with these sub-keys:

```json
"attachments": {
  "title": "Attachments",
  "noAttachments": "No documents attached.",
  "openInDrive": "Open in Drive",
  "detach": "Detach",
  "attachExisting": "Attach existing document",
  "searchPlaceholder": "Search by title…",
  "noMatching": "No matching documents.",
  "attach": "Attach",
  "uploadAndAttach": "Upload & Attach",
  "driveNotConnected": "Connect Google Drive in Settings to upload documents.",
  "goToSettings": "Go to Settings",
  "uploading": "Uploading…",
  "attaching": "Attaching…",
  "failedLoad": "Failed to load attachments.",
  "failedDetach": "Failed to detach document.",
  "failedAttach": "Failed to attach document.",
  "failedUpload": "Failed to upload and attach document.",
  "count_one": "{{count}} attachment",
  "count_other": "{{count}} attachments"
}
```

- The `count_one` / `count_other` keys support i18next pluralization for the list view badges.
- All 12 language files get accurate (not machine-literal) translations.

**Todo List:**
1. Add the `attachments` block to `en.json` with the English strings above.
2. Add translated `attachments` blocks to all remaining 11 files (`ar`, `de`, `es`, `fa`, `fr`, `hi`, `id`, `pt`, `ru`, `tr`, `zh`). Use accurate translations for each language.

**Relevant Context:**
- [`packages/client/src/i18n/en.json`](packages/client/src/i18n/en.json) — source of truth; observe the pluralization pattern already used (e.g. `bills.billCount_one` / `bills.billCount_other`) and the key naming style.
- [`packages/client/src/i18n/ar.json`](packages/client/src/i18n/ar.json) — Arabic (RTL); needs accurate translations.
- All 12 files must have the same key set — no missing keys.

**Status:** [x] done

---

### Sub-Task 2 — Replace hardcoded strings in `AttachmentsSection.tsx` with `t()` calls

**Intent:**
Make `AttachmentsSection` use the i18n system so it renders correctly in all 12 languages. This is a pure find-and-replace of string literals with `t('attachments.KEY')` calls — no logic changes.

**Expected Outcomes:**
- `packages/client/src/components/attachments/AttachmentsSection.tsx` imports `useTranslation` and calls `const { t } = useTranslation()`.
- Every hardcoded UI string replaced with its `t('attachments.*')` equivalent:
  - `"Attachments"` → `t('attachments.title')`
  - `"Open in Drive"` → `t('attachments.openInDrive')`
  - `"No documents attached."` → `t('attachments.noAttachments')`
  - `"Attach existing document"` → `t('attachments.attachExisting')`
  - `"Search by title…"` → `t('attachments.searchPlaceholder')`
  - `"No matching documents."` → `t('attachments.noMatching')`
  - `"Attach"` button → `t('attachments.attach')`
  - `"Upload & Attach"` → `t('attachments.uploadAndAttach')`
  - `"Connect Google Drive in Settings…"` → `t('attachments.driveNotConnected')`
  - `"Go to Settings"` → `t('attachments.goToSettings')`
  - Error strings → `t('attachments.failedLoad')`, etc.
  - Uploading/Attaching inline states → `t('attachments.uploading')`, `t('attachments.attaching')`
- TypeScript check passes.

**Todo List:**
1. Read the current `AttachmentsSection.tsx` in full.
2. Add `useTranslation` import and call.
3. Replace every hardcoded string with the corresponding `t()` call.
4. Run `npx tsc --noEmit` from `packages/client`.

**Relevant Context:**
- [`packages/client/src/components/attachments/AttachmentsSection.tsx`](packages/client/src/components/attachments/AttachmentsSection.tsx) — file to update.
- [`packages/client/src/components/tasks/TaskForm.tsx`](packages/client/src/components/tasks/TaskForm.tsx) — reference for `useTranslation` usage pattern.
- Sub-Task 1 must be complete first (keys must exist before `t()` is called).

**Status:** [x] done

---

### Sub-Task 3 — Create-form two-step flow for tasks, dates, bills, and reminders

**Intent:**
Enable attaching documents during the create flow by adopting a two-step pattern: (1) the user fills in the form and clicks Save — the entity is created and its new ID is captured; (2) the modal remains open and transitions to "edit mode" showing the `AttachmentsSection`. The user can then attach documents and close the modal manually. This requires no new server endpoints.

**Expected Outcomes:**

**Pattern per page (tasks, important dates, bills/subscriptions/loans, reminders):**
- After a successful create API call, instead of immediately closing the modal, the page sets the newly created entity's ID as the `editId` for the open form — transitioning it to edit mode with `AttachmentsSection` now visible.
- A "Done" or "Close" button (or the existing Cancel) closes the modal. The save button text changes to `common.save` in edit mode and a "skip" affordance is visible ("Add attachments or close to finish").
- The form fields remain populated (read-only or still editable — editable is simpler) showing the just-created entity.

**Specific changes:**
- `TasksPage.tsx` — `handleCreate` currently closes the form after save; change to call `setEditingTask(newTask)` + `setEditId(newTask.id)` so the form transitions to edit mode.
- `ImportantDatesPage.tsx` — `handleSave` in create mode: after API returns new date, transition to edit mode with the returned ID.
- `BillsPage.tsx` — same pattern for bills, subscriptions, and loans (3 separate create flows on same page).
- `RemindersPage.tsx` — `handleSave` in create mode: after API returns new reminder, transition to edit mode.

**Todo List:**
1. Read `TasksPage.tsx` create handler and modal state management.
2. Update `TasksPage.tsx`: after create succeeds, keep modal open with `editId` set to the new entity's ID (form transitions to edit mode with AttachmentsSection visible).
3. Read `ImportantDatesPage.tsx` create handler.
4. Update `ImportantDatesPage.tsx` similarly.
5. Read `BillsPage.tsx` create handlers (bills, subscriptions, loans — 3 handlers).
6. Update `BillsPage.tsx` for all three entity types.
7. Read `RemindersPage.tsx` create handler.
8. Update `RemindersPage.tsx` similarly.
9. Run TypeScript check.

**Relevant Context:**
- [`packages/client/src/pages/TasksPage.tsx`](packages/client/src/pages/TasksPage.tsx) — lines around `handleCreate` / `showAddForm` state.
- [`packages/client/src/pages/ImportantDatesPage.tsx`](packages/client/src/pages/ImportantDatesPage.tsx)
- [`packages/client/src/pages/BillsPage.tsx`](packages/client/src/pages/BillsPage.tsx)
- [`packages/client/src/pages/RemindersPage.tsx`](packages/client/src/pages/RemindersPage.tsx)
- The `AttachmentsSection` already renders when `editId` is set — no component changes needed.

**Status:** [x] done

---

### Sub-Task 4 — Attachment count/preview in list item rows

**Intent:**
Show a compact attachment badge on each list item card in the Tasks, Important Dates, Bills, and Reminders pages. The badge shows the count of attached documents (e.g. "2 attachments"). Clicking the badge opens the edit modal (same as clicking the Edit button). This requires fetching attachment counts for all visible items.

**Approach — per-page fetch on load:**
When the page loads its entity list, it also fires a batch of `GET /api/attachments` requests for each entity to build a count map (`{ [entityId]: number }`). This reuses the existing endpoint. The count map is stored in a `useState` on the page. The badge is only shown if count > 0.

**Expected Outcomes:**
- Each of the 4 pages (`TasksPage`, `ImportantDatesPage`, `BillsPage`, `RemindersPage`) gains:
  - A `attachmentCounts` state: `Record<number, number>` initialized to `{}`.
  - After the entity list loads, fire parallel `getAttachments()` calls for each entity, build the count map, set state.
  - In the list item row component (TaskRow, DateRow/inline, BillRow, SubRow, LoanRow, ReminderRow), receive `attachmentCount: number` as a prop.
  - If `attachmentCount > 0`, render a small badge (e.g. 📎 `t('attachments.count', { count: N })`) near the title or at the end of the row. Clicking the badge calls `onEdit()` for that item.
- The badge uses the pluralized `attachments.count_one` / `attachments.count_other` i18n keys from Sub-Task 1.
- If the entity list is empty or counts are loading, no badge UI is shown (graceful).

**Todo List:**
1. In `TasksPage.tsx`:
   - Add `attachmentCounts: Record<number, number>` state.
   - After tasks load, fetch counts in parallel and set state.
   - Pass `attachmentCount={attachmentCounts[task.id] ?? 0}` to `TaskRow`.
   - Update `TaskRow` to accept and render the badge.
2. In `ImportantDatesPage.tsx`:
   - Same pattern for important dates (entity_type `'date'`).
   - Update the inline date row rendering to show the badge.
3. In `BillsPage.tsx`:
   - Three separate count maps (bills, subscriptions, loans) or one combined map with type prefix.
   - Pass counts to `BillRow`, `SubRow`, `LoanRow`.
   - Update each row component to render badge.
4. In `RemindersPage.tsx`:
   - Same pattern for reminders.
   - Update `ReminderRow` to render badge.
5. Run TypeScript check.

**Relevant Context:**
- [`packages/client/src/api/attachments.ts`](packages/client/src/api/attachments.ts) — `getAttachments()` used to fetch per-entity.
- [`packages/client/src/pages/TasksPage.tsx`](packages/client/src/pages/TasksPage.tsx) — TaskRow component defined inline; see how props are passed.
- [`packages/client/src/pages/BillsPage.tsx`](packages/client/src/pages/BillsPage.tsx) — BillRow, SubRow, LoanRow defined inline.
- Sub-Task 1 must be complete (for `attachments.count_one/other` keys).
- Sub-Task 2 should be complete (cohesive i18n state) but not a hard dependency.

**Status:** [x] done

---

## Implementation Order

```
Sub-Task 1 — i18n keys in all 12 language files
  → Sub-Task 2 — Replace hardcoded strings in AttachmentsSection
  → Sub-Task 3 — Two-step create flow (parallel with Sub-Task 2)
  → Sub-Task 4 — Attachment count badges in list views
```

Sub-Tasks 2 and 3 can be done in parallel after Sub-Task 1. Sub-Task 4 depends on Sub-Task 1 (for count keys) but not on 2 or 3.

---

## Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Create-mode attachment flow | Two-step: save first, modal transitions to edit mode | Entity ID not available until saved; avoids draft/temp-entity complexity |
| List-view attachment data fetching | Parallel per-entity `getAttachments()` calls on page load | No new server endpoint needed; counts derive from existing data |
| Badge interaction | Clicking badge opens edit modal | Users naturally expect to manage attachments in the edit form |
| Badge visibility | Only shown when count > 0 | Zero-count badges add noise without value |
| i18n pluralization | `count_one` / `count_other` pattern | Matches the existing pluralization convention in the codebase (`billCount_one/other`) |
| Habits page | Excluded from this plan | Different card pattern; lower priority |
