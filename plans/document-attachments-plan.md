# Document Attachments Plan

## Top-Level Overview

Add the ability to attach Google Drive documents (from the existing Documents library) to **tasks, important dates, bills, subscriptions, loans, habits, and reminders**. Users can attach existing documents or upload new ones directly from within any entity's edit form. Attachments are a many-to-many link — one document can be attached to many entities; no file duplication occurs in Drive. Detaching removes only the link; the document stays in the library and Drive. Deleting an entity removes its attachment links but keeps the documents.

**Scope:**
- New `document_attachments` join table (entity type discriminator + entity ID + document ID)
- New server endpoints to list, add, and remove attachment links
- Server-side delete cleanup for all 7 entity types
- Client `api/attachments.ts` module
- Reusable `AttachmentsSection` component (search/autocomplete for existing docs, upload-and-attach inline form, Google Drive connection guard)
- Wire into every edit form: TaskForm, DateForm, BillForm, SubscriptionForm, LoanForm, HabitForm, ReminderForm
- Pass `entityId` (the record's `id`) and `token` down to `AttachmentsSection`; hidden in create mode (no ID yet)

**Non-goals:**
- Showing attachments outside the edit modal (e.g., on list/card views)
- Browsing the full Google Drive from within the form
- Renaming or moving Drive files from the attachment UI
- Attaching documents in create mode (entity ID not yet known)

---

## Sub-Tasks

---

### Sub-Task 1 — DB: `document_attachments` join table

**Intent:**
Create the persistence layer that links documents to any entity. A single join table with an `entity_type` discriminator column covers all entity types without schema duplication.

**Expected Outcomes:**
- A new migration in `db.ts` adds `document_attachments`:
  - `id` INTEGER PK AUTOINCREMENT
  - `document_id` INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE
  - `entity_type` TEXT NOT NULL CHECK(`entity_type` IN ('task','date','bill','subscription','loan','habit','reminder'))
  - `entity_id` INTEGER NOT NULL
  - `created_at` TEXT DEFAULT datetime('now')
  - UNIQUE constraint on (`document_id`, `entity_type`, `entity_id`) — prevents duplicate links
- Document deletion auto-cascades attachment rows (FK ON DELETE CASCADE).
- Entity deletion cleans up attachment rows in the server router (entity_id is untyped, no DB-level cascade from entity side).

**Todo List:**
1. In `packages/server/src/db.ts`, append `CREATE TABLE IF NOT EXISTS document_attachments (...)` inside `runMigrations()`.
2. Add `CREATE UNIQUE INDEX IF NOT EXISTS` on (`document_id`, `entity_type`, `entity_id`).

**Relevant Context:**
- [`packages/server/src/db.ts`](packages/server/src/db.ts) — all migrations in `runMigrations()`. Pattern: `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`.
- Existing tables: `tasks`, `important_dates`, `documents`, `bills`, `subscriptions`, `loans`, `habits`, `reminders`.

**Status:** [x] done

---

### Sub-Task 2 — Server: attachments router + entity delete cleanup

**Intent:**
Expose REST endpoints to manage attachment links, and ensure every entity delete handler cleans up its links so orphaned rows never accumulate.

**Expected Outcomes:**
- New file `packages/server/src/attachments/router.ts` with:
  - `GET /api/attachments?entity_type=X&entity_id=N` — returns attached documents (joins `document_attachments` ↔ `documents`; returns `id`, `title`, `filename`, `mimetype`, `drive_file_id`, `drive_view_link`). Requires `authenticateToken`; verifies entity ownership.
  - `POST /api/attachments` — body: `{ entity_type, entity_id, document_id }` — INSERT OR IGNORE. Verifies ownership of both the entity and the document.
  - `DELETE /api/attachments` — body: `{ entity_type, entity_id, document_id }` — DELETE row. Verifies ownership.
- Router mounted at `/api/attachments` in `app.ts`.
- Every entity delete handler updated to run `DELETE FROM document_attachments WHERE entity_type=? AND entity_id=?` before deleting the entity row:
  - `packages/server/src/tasks/router.ts` — `DELETE /api/tasks/:id`
  - `packages/server/src/dates/router.ts` — `DELETE /api/dates/:id`
  - `packages/server/src/bills/router.ts` — all three (bill, subscription, loan deletes)
  - `packages/server/src/habits/router.ts` — `DELETE /api/habits/:id`
  - `packages/server/src/reminders/router.ts` — `DELETE /api/reminders/:id`

**Todo List:**
1. Create `packages/server/src/attachments/router.ts`.
2. Implement `GET /api/attachments` — join query returning document metadata array.
3. Implement `POST /api/attachments` — validate entity + document ownership; INSERT OR IGNORE.
4. Implement `DELETE /api/attachments` — validate ownership; DELETE row.
5. Mount router in `packages/server/src/app.ts`.
6. Add attachment cleanup (`DELETE FROM document_attachments ...`) to delete handlers in: `tasks/router.ts`, `dates/router.ts`, `bills/router.ts` (bills + subscriptions + loans), `habits/router.ts`, `reminders/router.ts`.

**Relevant Context:**
- [`packages/server/src/middleware/authenticate.ts`](packages/server/src/middleware/authenticate.ts) — `authenticateToken` middleware.
- [`packages/server/src/tasks/router.ts`](packages/server/src/tasks/router.ts) — see existing DELETE handler ownership check pattern.
- [`packages/server/src/app.ts`](packages/server/src/app.ts) — router mounting location.

**Status:** [x] done

---

### Sub-Task 3 — Client: `api/attachments.ts` module

**Intent:**
Add a typed API client module that wraps the three attachment endpoints, consistent with all existing API modules.

**Expected Outcomes:**
- New file `packages/client/src/api/attachments.ts` exporting:
  - `EntityType` type: `'task' | 'date' | 'bill' | 'subscription' | 'loan' | 'habit' | 'reminder'`
  - `AttachedDocument` interface: `{ id: number; title: string; filename: string; mimetype: string; drive_file_id: string | null; drive_view_link: string | null }`
  - `getAttachments(token, entityType, entityId)` → `Promise<AttachedDocument[]>`
  - `addAttachment(token, entityType, entityId, documentId)` → `Promise<void>`
  - `removeAttachment(token, entityType, entityId, documentId)` → `Promise<void>`

**Todo List:**
1. Create `packages/client/src/api/attachments.ts` following the pattern in `packages/client/src/api/documents.ts`.
2. Export `EntityType`, `AttachedDocument`, and the three functions.

**Relevant Context:**
- [`packages/client/src/api/documents.ts`](packages/client/src/api/documents.ts) — pattern for API module structure (fetch wrapper, base URL, error handling).
- [`packages/client/src/api/tasks.ts`](packages/client/src/api/tasks.ts) — token-in-header pattern.

**Status:** [x] done

---

### Sub-Task 4 — Client: `AttachmentsSection` shared component

**Intent:**
Build a reusable React component that renders the full attachment UI inside any edit form. It handles: listing current attachments, attaching existing documents (search/autocomplete), uploading a new document and immediately attaching it, and guarding against missing Google Drive connection.

**Expected Outcomes:**
- New file `packages/client/src/components/attachments/AttachmentsSection.tsx`:
  - **Props:** `entityType: EntityType`, `entityId: number`, `token: string`
  - **On mount:** fetches attached documents via `getAttachments()` AND fetches all user documents via `getDocuments()` AND fetches Drive connection status via `getGoogleDriveStatus()`.
  - **Attached documents list:** For each item shows:
    - File type icon (reuse icon logic from `DocumentsPage.tsx`)
    - Document title
    - "Open in Drive" link (`drive_view_link`; hidden if null)
    - "Detach" button → calls `removeAttachment()`, removes from local state
  - **"Attach existing" section:**
    - A search/autocomplete input that filters the full document list (excludes already-attached docs); matching items shown as a dropdown
    - Selecting an item and clicking "Attach" calls `addAttachment()` and updates local state
  - **"Upload & attach" section:**
    - If Drive is **not connected**: shows a warning banner — "Connect Google Drive in Settings to upload documents."
    - If Drive **is connected**: shows an inline form with a title input and a file picker; on submit calls the existing `POST /api/documents/upload` (reuse `uploadDocument()` from `documents.ts`), then calls `addAttachment()` with the returned document ID; updates local state
  - Shows loading spinners on fetch and per-item action buttons
  - Shows error messages inline on failure

**Todo List:**
1. Create `packages/client/src/components/attachments/` directory and `AttachmentsSection.tsx`.
2. Implement data fetching (attached docs, all docs, Drive status) on mount.
3. Implement attached docs list with icon, title, "Open in Drive", "Detach".
4. Implement search/autocomplete for "Attach existing" (filter unattached docs by title substring).
5. Implement "Upload & attach" inline form with Drive connection guard.
6. Handle loading states and inline error messages.

**Relevant Context:**
- [`packages/client/src/pages/DocumentsPage.tsx`](packages/client/src/pages/DocumentsPage.tsx) — source of file-type icon logic and upload pattern.
- [`packages/client/src/api/documents.ts`](packages/client/src/api/documents.ts) — `uploadDocument()`, `getDocuments()`.
- [`packages/client/src/api/google.ts`](packages/client/src/api/google.ts) — `getGoogleDriveStatus()`.
- [`packages/client/src/api/attachments.ts`](packages/client/src/api/attachments.ts) — created in Sub-Task 3.

**Status:** [x] done

---

### Sub-Task 5 — Client: wire `AttachmentsSection` into all edit forms

**Intent:**
Integrate the component into the edit form of every supported entity. Because none of the existing form components use `useAuth()` internally, the token must be obtained from the parent page/container and passed as a prop. The component renders only in edit mode (when an entity ID is known).

**Expected Outcomes:**
The `AttachmentsSection` is rendered at the bottom of the edit form for each of the following, only when `entityId` is defined (edit mode, not create):
- `TaskForm.tsx` — `entityType="task"`, `entityId={initial.id}`
- `DateForm.tsx` — `entityType="date"`, `entityId={initial.id}`
- `BillForm.tsx` — `entityType="bill"`, `entityId={initial.id}`
- `SubscriptionForm.tsx` — `entityType="subscription"`, `entityId={initial.id}`
- `LoanForm.tsx` — `entityType="loan"`, `entityId={initial.id}`
- `HabitForm.tsx` — `entityType="habit"`, `entityId={editId}` (already has `editId` prop)
- `ReminderForm.tsx` — `entityType="reminder"`, `entityId={initial.id}`

**Token delivery strategy:** Each form currently does NOT use `useAuth()`. Two options:
1. Add a `token` prop to each form and pass it from the parent page.
2. Call `useAuth()` directly inside each form component.

Option 2 (call `useAuth()` inside the form) is simpler — avoids prop-drilling changes in 7 parent pages.

**Todo List:**
1. In each of the 7 form components, import `useAuth` from `AuthContext` and `AttachmentsSection`.
2. Call `const { token } = useAuth()` at the top of each form component.
3. At the bottom of the form JSX (before the save/cancel buttons or after), conditionally render:
   ```
   {entityId && <AttachmentsSection entityType="..." entityId={entityId} token={token} />}
   ```
   Where `entityId` is `initial?.id` (or `editId` for HabitForm).
4. For `HabitForm`, the existing `editId: number | null` prop already distinguishes edit vs create — use that directly.

**Relevant Context:**
- [`packages/client/src/components/tasks/TaskForm.tsx`](packages/client/src/components/tasks/TaskForm.tsx)
- [`packages/client/src/components/dates/DateForm.tsx`](packages/client/src/components/dates/DateForm.tsx)
- [`packages/client/src/components/bills/BillForm.tsx`](packages/client/src/components/bills/BillForm.tsx)
- [`packages/client/src/components/bills/SubscriptionForm.tsx`](packages/client/src/components/bills/SubscriptionForm.tsx)
- [`packages/client/src/components/bills/LoanForm.tsx`](packages/client/src/components/bills/LoanForm.tsx)
- [`packages/client/src/components/habits/HabitForm.tsx`](packages/client/src/components/habits/HabitForm.tsx)
- [`packages/client/src/components/reminders/ReminderForm.tsx`](packages/client/src/components/reminders/ReminderForm.tsx)
- [`packages/client/src/context/AuthContext.tsx`](packages/client/src/context/AuthContext.tsx) — `useAuth()` hook.
- Sub-Task 4 must be complete first.

**Status:** [x] done

---

## Implementation Order

```
Sub-Task 1 — DB migration
  → Sub-Task 2 — Server attachments router + entity delete cleanup
    → Sub-Task 3 — Client API module
      → Sub-Task 4 — AttachmentsSection component
        → Sub-Task 5 — Wire into all 7 edit forms
```

---

## Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| DB structure | Single `document_attachments` table with `entity_type` discriminator | Covers all 7 entity types without schema duplication |
| File duplication on attach | None — shared link only | One document entry, many links; no extra Drive storage |
| Attach in create vs edit | Edit mode only | Need an entity ID to create the link |
| Delete cascade | Document deletion cascades to links via FK; entity deletion cleans up manually in router | `entity_id` is untyped — no DB-level FK cascade from entity side |
| "Attach existing" UX | Search/autocomplete filtering document title | Better UX than a long dropdown for users with many documents |
| Drive connection guard | Warning banner shown in "Upload & attach" section when Drive not connected | Upload will fail without Drive; attaching existing docs still works |
| Token in forms | Call `useAuth()` inside each form component | Simpler than prop-drilling token through 7 parent pages |
| Drive-less documents | "Open in Drive" link hidden if `drive_view_link` is null | Graceful fallback for documents uploaded before Drive was connected |
