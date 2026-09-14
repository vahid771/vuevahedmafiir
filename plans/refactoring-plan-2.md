# Refactoring Plan 2 — Service Layer & Component Extraction

## Overview

Second refactoring pass across `packages/server/src/` and `packages/client/src/`.
No new dependencies, no architecture changes, no behaviour changes.

**Goals:**
1. **Server** — Introduce a thin service layer that pulls business logic out of route handlers (streak calculation, next-occurrence computation, AI data gathering).
2. **Server** — Centralize server-side date math that is duplicated across route files.
3. **Client** — Centralize client-side date math utilities (week boundaries, month ranges) that are duplicated across pages.
4. **Client** — Extract inline form JSX from large page components into focused form components.

---

## Sub-Task 1 — Server: Centralize date math utilities

**Status:** [x] done

**Intent**
`dates/router.ts` and `ai/router.ts` both contain a `nextOccurrence` helper that computes
the next yearly occurrence of a date. `habits/router.ts` contains a `getWeekBounds()` helper
that is also duplicated on the client side. Centralizing these into
`packages/server/src/utils/dates.ts` removes duplication and makes the logic testable
independently of HTTP handlers.

**Expected Outcomes**
- `packages/server/src/utils/dates.ts` exists and exports:
  - `nextOccurrence(dateStr: string): string` — returns next yearly recurrence as ISO date string
  - `getWeekBounds(date?: Date): { start: string; end: string }` — returns the Monday–Sunday boundaries for the given date (default: today)
- `dates/router.ts` imports `nextOccurrence` from `../utils/dates` instead of defining it inline
- `ai/router.ts` imports `nextOccurrence` from `../utils/dates` instead of defining it inline
- `habits/router.ts` imports `getWeekBounds` from `../utils/dates` instead of defining it inline
- TypeScript build passes

**Todo List**
1. Read `packages/server/src/dates/router.ts` lines 1–25 to capture the exact `nextOccurrence` implementation
2. Read `packages/server/src/ai/router.ts` lines 65–85 to confirm the duplicate
3. Read `packages/server/src/habits/router.ts` lines 1–60 to capture `getWeekBounds`
4. Create `packages/server/src/utils/dates.ts` with both exported functions
5. Update `dates/router.ts` — remove inline definition, import from `../utils/dates`
6. Update `ai/router.ts` — remove inline definition, import from `../utils/dates`
7. Update `habits/router.ts` — remove inline definition, import from `../utils/dates`
8. Verify TypeScript build passes: `npm run build --workspace=packages/server`

**Relevant Context**
- `packages/server/src/dates/router.ts` — `nextOccurrence` is a top-level function defined before the router
- `packages/server/src/ai/router.ts` — identical logic around lines 65–80
- `packages/server/src/habits/router.ts` — `getWeekBounds` uses `new Date()` and Monday-as-start-of-week logic
- Keep the function signatures exactly as they are — only move, do not modify logic

---

## Sub-Task 2 — Server: Extract habit streak calculation to a service

**Status:** [x] done

**Intent**
`habits/router.ts` contains an inline streak-calculation block (~30 lines) directly inside
the GET `/api/habits` route handler. This business logic belongs in a dedicated service file
so it can be reasoned about and tested independently of the route.

**Expected Outcomes**
- `packages/server/src/habits/service.ts` exists and exports:
  - `calculateStreaks(habits: Habit[], logs: HabitLog[]): HabitWithStreak[]` — accepts raw DB rows, returns the same shape currently returned by the GET handler
- `habits/router.ts` GET handler calls `calculateStreaks` instead of containing the logic inline
- The GET route handler is reduced to: fetch habits, fetch logs, call service, respond
- TypeScript build passes

**Todo List**
1. Read `packages/server/src/habits/router.ts` fully to understand the streak logic and the types involved
2. Create `packages/server/src/habits/service.ts` with the `calculateStreaks` function (move logic verbatim, adjust imports)
3. Update `habits/router.ts` GET handler to import and call `calculateStreaks`
4. Verify TypeScript build passes

**Relevant Context**
- The streak logic reads `logged_date` from `habit_logs` and computes consecutive-day streaks
- Types for `Habit` and `HabitLog` are currently inlined in the router — define them in `service.ts` and re-export or import them in the router
- `db` stays in the router — the service function receives plain data, not the database client

---

## Sub-Task 3 — Server: Extract AI data-gathering into a service

**Status:** [x] done

**Intent**
`ai/router.ts` is ~160 lines, of which ~120 are direct database queries gathering data from
every module's table (tasks, bills, subscriptions, reminders, habits, important dates). This
tightly couples the AI feature to every other module's schema. Extracting the data-gathering
into `packages/server/src/ai/service.ts` makes the route handler thin and the data-gathering
logic independently readable.

**Expected Outcomes**
- `packages/server/src/ai/service.ts` exists and exports:
  - `gatherUserData(userId: string): Promise<AiContext>` — runs all DB queries and returns a structured data object
  - `AiContext` type — typed shape of all gathered data
- `ai/router.ts` route handler calls `gatherUserData(userId)` and passes the result to the prompt-building logic
- The route handler is reduced to: authenticate → gather data → build prompt → call AI → respond
- TypeScript build passes

**Todo List**
1. Read `packages/server/src/ai/router.ts` fully to understand all DB queries and the prompt structure
2. Create `packages/server/src/ai/service.ts`:
   - Define `AiContext` type with all the fields currently assembled inline
   - Move all DB queries into `gatherUserData(userId)`
   - Import `nextOccurrence` from `../utils/dates` (already refactored in Sub-Task 1)
3. Update `ai/router.ts`:
   - Import `gatherUserData` from `./service`
   - Replace the inline query block with a single `const data = await gatherUserData(userId)`
   - Keep prompt construction and AI call in the route handler
4. Verify TypeScript build passes

**Relevant Context**
- `packages/server/src/ai/router.ts` — the route handler starts at the exported `router` definition
- `db` should be imported in `service.ts` (same pattern as the existing router) — `import { db } from '../db'`
- `nextOccurrence` will already be in `../utils/dates` after Sub-Task 1 completes
- Do not move the prompt string or OpenAI/Groq call — only move the DB query block

---

## Sub-Task 4 — Client: Centralize week/month range utilities

**Status:** [x] done

**Intent**
Week-boundary and month-range helper functions (e.g. `getWeekBounds`, `gregorianWeekRange`,
`jalaliWeekRange`, `gregorianMonthRangeForJalaliMonth`, `jalaliMonthRangeForGregorianMonth`)
are used across `HabitsPage.tsx`, `DashboardPage.tsx`, and `CalendarWidget.tsx`, but are
currently only exported from `packages/client/src/utils/jalali.ts`. Any Gregorian-only
date-math that is duplicated inline in page components should be consolidated in a single
`packages/client/src/utils/dates.ts` file (distinct from the Jalali-specific utilities).

**Expected Outcomes**
- `packages/client/src/utils/dates.ts` exists and exports any Gregorian date math helpers currently defined inline in page components (e.g., a `getWeekBounds` helper returning `{ start: string; end: string }`)
- `HabitsPage.tsx` and `DashboardPage.tsx` import shared helpers instead of defining them inline
- `jalali.ts` keeps Jalali-specific functions; `dates.ts` keeps Gregorian-specific ones
- Client TypeScript build passes

**Todo List**
1. Read `packages/client/src/pages/HabitsPage.tsx` to find any inline date math
2. Read `packages/client/src/pages/DashboardPage.tsx` to find any inline date math
3. Read `packages/client/src/utils/jalali.ts` to confirm what is already exported
4. Create `packages/client/src/utils/dates.ts` with any Gregorian-only helpers not already in `jalali.ts`
5. Update `HabitsPage.tsx` to import from `../utils/dates` (or `../utils/jalali`) instead of defining inline
6. Update `DashboardPage.tsx` similarly
7. Verify client TypeScript build passes: `npm run build --workspace=packages/client`

**Relevant Context**
- `packages/client/src/utils/jalali.ts` already exports `jalaliWeekRange` and `gregorianWeekRange` — check these before creating duplicates
- Keep the split clean: Jalali logic stays in `jalali.ts`, pure Gregorian math goes in `dates.ts`

---

## Sub-Task 5 — Client: Extract TaskForm component

**Status:** [x] done

**Intent**
`TasksPage.tsx` contains the add/edit task form JSX inline inside the page component.
This mixes data-fetching, state management, and form presentation in one large file.
Extracting the form to `packages/client/src/components/tasks/TaskForm.tsx` makes each
file focused and easier to read.

**Expected Outcomes**
- `packages/client/src/components/tasks/TaskForm.tsx` exists, receives props for initial values, onSubmit, and onCancel, and renders the task form fields (title, due date, priority)
- `TasksPage.tsx` renders `<TaskForm>` where the inline form JSX was
- Visual output is identical, no behaviour change
- Client build passes

**Todo List**
1. Read `packages/client/src/pages/TasksPage.tsx` fully to understand the form state, fields, and submission logic
2. Decide on the component's prop interface (controlled form: pass `onSubmit(data)` + optional `initialValues`)
3. Create `packages/client/src/components/tasks/TaskForm.tsx`
4. Update `TasksPage.tsx` to import and use `TaskForm`
5. Verify client TypeScript build passes

**Relevant Context**
- `packages/client/src/pages/TasksPage.tsx` — look for `<form` elements and form state variables
- The `CalendarContext` may be needed inside the form for the date input — the form component can call `useCalendar()` directly
- Follow the same Tailwind class patterns used in the rest of the UI

---

## Sub-Task 6 — Client: Extract BillForm and SubscriptionForm components

**Status:** [x] done

**Intent**
`BillsPage.tsx` manages both bills and subscriptions, each with its own inline form.
Extracting these to `BillForm.tsx` and `SubscriptionForm.tsx` follows the same pattern
established in Sub-Task 5.

**Expected Outcomes**
- `packages/client/src/components/bills/BillForm.tsx` exists
- `packages/client/src/components/bills/SubscriptionForm.tsx` exists
- `BillsPage.tsx` uses both form components; no inline form JSX remains in the page
- Visual output is identical
- Client build passes

**Todo List**
1. Read `packages/client/src/pages/BillsPage.tsx` fully to understand both forms
2. Create `packages/client/src/components/bills/BillForm.tsx`
3. Create `packages/client/src/components/bills/SubscriptionForm.tsx`
4. Update `BillsPage.tsx` to use both components
5. Verify client TypeScript build passes

**Relevant Context**
- Bills have: name, amount, due_date, recurrence (once/monthly/yearly), paid
- Subscriptions have: name, amount, billing_cycle, next_billing_date, active
- Both forms are currently in the same page file

---

## Sub-Task 7 — Client: Extract ReminderForm, HabitForm, and DateForm components

**Status:** [x] done

**Intent**
Same extraction pattern applied to the remaining three pages that have inline forms.

**Expected Outcomes**
- `packages/client/src/components/reminders/ReminderForm.tsx` exists
- `packages/client/src/components/habits/HabitForm.tsx` exists
- `packages/client/src/components/dates/DateForm.tsx` exists
- The three page files use these components; no inline form JSX remains
- Visual output is identical
- Client build passes

**Todo List**
1. Read `RemindersPage.tsx`, `HabitsPage.tsx`, `ImportantDatesPage.tsx` to understand each form
2. Create `ReminderForm.tsx` — fields: title, remind_at (datetime)
3. Create `HabitForm.tsx` — fields: name, frequency, target_days
4. Create `DateForm.tsx` — fields: title, date, recurs_yearly, notes
5. Update the three page files to use the new form components
6. Verify client TypeScript build passes

**Relevant Context**
- `HabitForm.tsx` likely needs `target_days` as a multi-select (days of week) — replicate the existing UI logic exactly
- `DateForm.tsx` uses a `DateInput` component — import from `../../components/DateInput`
- `ReminderForm.tsx` uses `DateTimeInput` — import from `../../components/DateTimeInput`
