# Refactoring Plan — Cleanup & Deduplication

## Overview

Cleanup pass over `packages/server/src/` and `packages/client/src/`. No new dependencies,
no architecture changes, no security hardening. Goal: remove duplication, consolidate helpers,
fix inconsistencies in naming and patterns.

---

## Sub-Task 1 — Server: Extract shared DB helpers

**Status:** [x] done

**Intent**
Five routers repeat the same two patterns on every mutating route:
1. Ownership check — `SELECT id FROM <table> WHERE id = ? AND user_id = ?` + 404 guard
2. INSERT then SELECT back — two round-trips every time a record is created

Extracting these to a small `packages/server/src/utils/db.ts` helpers file removes ~50
lines of copy-paste and makes every router slimmer.

**Expected Outcomes**
- `packages/server/src/utils/db.ts` exists with `assertOwnership` and `fetchById` helpers
- All routers import and use these helpers instead of inline repetition

**Todo List**
1. Create `packages/server/src/utils/db.ts`
2. Add `assertOwnership(table, id, userId): Promise<void>` — executes the ownership SELECT,
   throws a typed `NotFoundError` (or returns boolean) if not found
3. Add `fetchById<T>(table, id): Promise<T>` — SELECT * WHERE id = ?
4. Update `tasks/router.ts` to use both helpers
5. Update `bills/router.ts` (bills section) to use both helpers
6. Update `bills/router.ts` (subscriptions section) to use both helpers
7. Update `reminders/router.ts` to use both helpers
8. Update `habits/router.ts` to use both helpers
9. Update `dates/router.ts` to use both helpers
10. Update `documents/router.ts` to use `fetchById`
11. Verify TypeScript build passes: `npm run build --workspace=packages/server`

**Relevant Context**
- Pattern appears in every PATCH and DELETE handler across all routers
- `db` is imported from `../db` in every router — helpers file should import it there too
- `InValue` from `@libsql/client` is the correct type for query args

---

## Sub-Task 2 — Server: Consolidate duplicate type declarations

**Status:** [x] done

**Intent**
The Express `Request.user` augmentation is declared in two places:
- `packages/server/src/types/express.d.ts`
- `packages/server/src/middleware/authenticate.ts`

The one in `authenticate.ts` is redundant and should be removed.

**Expected Outcomes**
- `authenticate.ts` no longer declares the global Express namespace
- `types/express.d.ts` is the single source of truth
- Build still passes

**Todo List**
1. Remove the `declare global { namespace Express { ... } }` block from `authenticate.ts`
2. Verify `types/express.d.ts` already has the full declaration (it does)
3. Verify TypeScript build passes

**Relevant Context**
- `packages/server/src/types/express.d.ts` lines 3-9
- `packages/server/src/middleware/authenticate.ts` lines 4-10

---

## Sub-Task 3 — Server: Standardise PATCH update builder

**Status:** [x] done

**Intent**
Six PATCH handlers build `fields[]` and `values[]` arrays with identical boilerplate:
```
const fields: string[] = [];
const values: InValue[] = [];
if (x !== undefined) { fields.push('x = ?'); values.push(x ?? null); }
...
if (!fields.length) { res.status(400)... }
values.push(id, userId);
await db.execute(...)
```
Extract a `buildPatch` helper to `utils/db.ts`.

**Expected Outcomes**
- `buildPatch(updates: Record<string, InValue | undefined>): { fields: string[]; values: InValue[] }` added to `utils/db.ts`
- All six PATCH handlers use the helper, shedding ~10 lines each
- Build passes

**Todo List**
1. Add `buildPatch` function to `packages/server/src/utils/db.ts`
   - Accepts a plain object mapping column name → value (undefined entries skipped)
   - Returns `{ fields, values }` — caller still pushes `id, userId` and executes
2. Update `tasks/router.ts` PATCH handler
3. Update `bills/router.ts` bills PATCH handler
4. Update `bills/router.ts` subscriptions PATCH handler
5. Update `reminders/router.ts` PATCH handler
6. Update `habits/router.ts` PATCH handler
7. Update `dates/router.ts` PATCH handler
8. Verify TypeScript build passes

**Relevant Context**
- All PATCH handlers push `id, userId` after the field values — keep this pattern
- `values.push(id, userId)` before `.execute()` stays in each router

---

## Sub-Task 4 — Client: Consolidate auth header helpers

**Status:** [x] done

**Intent**
The auth header helper is defined 6 times under different names:
- `h(token)` in `reminders.ts`, `habits.ts`, `dates.ts`, `ai.ts`
- `authHeaders(token)` in `tasks.ts`, `bills.ts`
- `authHeader(token)` (singular) in `documents.ts`

Move a single canonical `authHeaders(token)` to `packages/client/src/api/base.ts`
and import it everywhere.

**Expected Outcomes**
- `base.ts` exports `authHeaders(token: string): HeadersInit`
- All 7 API files import it from `./base` instead of defining their own copy
- No behaviour change

**Todo List**
1. Add `authHeaders` export to `packages/client/src/api/base.ts`
2. Update `tasks.ts` — remove local definition, import from `./base`
3. Update `bills.ts` — remove local definition, import from `./base`
4. Update `reminders.ts` — remove `h`, import `authHeaders` from `./base`, rename usages
5. Update `habits.ts` — same as reminders
6. Update `dates.ts` — same as reminders
7. Update `documents.ts` — remove `authHeader`, import `authHeaders`, rename usages
8. Update `ai.ts` — remove `h`, import `authHeaders`, rename usages
9. Verify client TypeScript build passes: `npm run build --workspace=packages/client`

**Relevant Context**
- `packages/client/src/api/base.ts` already exports `apiUrl` — add alongside it
- All 7 files import from `./base` already for `apiUrl`

---

## Sub-Task 5 — Client: Extract shared date/formatting utilities

**Status:** [x] done

**Intent**
Date formatting logic (`formatDate`, `formatDateTime`) is copy-pasted across page components.
Extract to a single `packages/client/src/utils/format.ts` module.

**Expected Outcomes**
- `packages/client/src/utils/format.ts` exports `formatDate` and `formatDateTime`
- All pages that had inline versions import from this module
- No behaviour change

**Todo List**
1. Read current implementations in `TasksPage.tsx`, `BillsPage.tsx`, `RemindersPage.tsx`
   to confirm they are identical (or reconcile differences)
2. Create `packages/client/src/utils/format.ts` with the canonical versions
3. Update `TasksPage.tsx` — remove local `formatDate`, import from `../utils/format`
4. Update `BillsPage.tsx` — same
5. Update `RemindersPage.tsx` — remove local `formatDateTime`, import from `../utils/format`
6. Check remaining pages for any other inline date formatting and consolidate
7. Verify client build passes

**Relevant Context**
- Pages are in `packages/client/src/pages/`
- Only import from `../utils/format` — keep the import path consistent

---

## Sub-Task 6 — Cleanup: Remove generated files from source, fix .gitignore

**Status:** [x] done

**Intent**
`api/app.js`, `api/db.js` are generated by the esbuild build step — they should not be
committed to git. Currently they are tracked and are large (~2 MB each). The `api/index.js`
and `api/ping.js` are hand-written and should stay.

**Expected Outcomes**
- `api/app.js` and `api/db.js` added to `.gitignore`
- Files removed from git tracking (`git rm --cached`)
- `docs/` in `.gitignore` is reviewed — docs should be tracked
- `packages/server/dist/` confirmed to be gitignored

**Todo List**
1. Add `api/app.js` and `api/db.js` to `.gitignore`
2. Run `git rm --cached api/app.js api/db.js`
3. Confirm `packages/server/dist/` is already gitignored (check current `.gitignore`)
4. Confirm `packages/client/dist/` is already gitignored
5. Verify `vercel.json` build command still generates them before deployment

**Relevant Context**
- `api/index.js` and `api/ping.js` are hand-written — keep tracked
- Build command in `package.json` regenerates `app.js` and `db.js` on every build

---
