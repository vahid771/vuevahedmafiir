# Multi-Calendar Support (Miladi & Shamsi) Plan

## Top-Level Overview

Add configurable dual-calendar support (Gregorian / Jalali-Shamsi) to the personal dashboard app. Users choose their preferred calendar system from a new `/settings` page. The preference is persisted server-side in a new `user_preferences` table and loaded on login. When **Shamsi** is selected:

- All date labels across the app (Tasks, Bills, Reminders, Important Dates) switch to Jalali with Persian/Arabic-Indic numerals and Persian month names (e.g. `۱۵ دی ۱۴۰۳`).
- Date inputs are replaced with a dedicated Persian/Jalali date picker UI; the selected value is converted to `YYYY-MM-DD` Gregorian before being sent to the server.
- `datetime-local` inputs (Reminders) show a Jalali date picker for the date portion + a time picker alongside.

When **Miladi (Gregorian)** is selected, the app behaves exactly as it does today.

All dates are stored as Gregorian `YYYY-MM-DD` (or ISO datetime) on the server — no change to the DB date columns.

---

## Sub-Tasks

---

### Sub-Task 1 — Server: `user_preferences` table + API endpoints

**Intent**  
Create the persistence layer for calendar preference (and any future user settings). Add DB migration, typed SQL queries, and two REST endpoints so the client can read/write calendar preference.

**Expected Outcomes**
- `user_preferences` table exists (migrated automatically on server start via the existing `db.ts` migration pattern).
- `GET /api/preferences` returns the preference row for the authenticated user (creates a default row on first access).
- `PATCH /api/preferences` accepts `{ calendar: "miladi" | "shamsi" }` and updates the row.

**Todo List**
1. In `packages/server/src/db.ts` add a migration block for:
   ```sql
   CREATE TABLE IF NOT EXISTS user_preferences (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id     INTEGER UNIQUE NOT NULL REFERENCES users(id),
     calendar    TEXT NOT NULL DEFAULT 'miladi',
     created_at  TEXT DEFAULT (datetime('now')),
     updated_at  TEXT DEFAULT (datetime('now'))
   );
   ```
2. Create `packages/server/src/preferences/router.ts` with:
   - `GET /` — select row for `req.user.id`; if no row exists, insert a default one and return it.
   - `PATCH /` — update `calendar` field, validate it is `"miladi"` or `"shamsi"`.
3. Register the new router in `packages/server/src/app.ts` at `/api/preferences`, guarded by the `authenticate` middleware (matching the pattern of all other routers).

**Relevant Context**
- Migration pattern: [`db.ts`](packages/server/src/db.ts) — look at how existing `CREATE TABLE IF NOT EXISTS` blocks are executed on startup.
- Auth middleware: [`authenticate.ts`](packages/server/src/middleware/authenticate.ts)
- Router pattern: [`packages/server/src/dates/router.ts`](packages/server/src/dates/router.ts) — copy the import/export/router structure.
- App registration: [`packages/server/src/app.ts`](packages/server/src/app.ts)

**Status** — `[x] done`

---

### Sub-Task 2 — Client: calendar preference API + CalendarContext

**Intent**  
Create a thin client API wrapper for the preferences endpoint and a React context (`CalendarContext`) that fetches the user's calendar preference on login, exposes `{ calendar, setCalendar }` to the whole app, and persists any changes via the API.

**Expected Outcomes**
- `packages/client/src/api/preferences.ts` exports `getPreferences()` and `updatePreferences()`.
- `packages/client/src/context/CalendarContext.tsx` provides `CalendarProvider` and `useCalendar()` hook.
- `CalendarProvider` fetches the preference once after login (when `token` is available) and re-exposes `calendar` + `setCalendar` (which calls the PATCH endpoint and updates local state).
- `CalendarProvider` is added to `App.tsx` wrapping all protected routes (inside `AuthProvider`).

**Expected Outcomes**
- `useCalendar()` returns `{ calendar: "miladi" | "shamsi", setCalendar: fn }` throughout the app.

**Todo List**
1. Create `packages/client/src/api/preferences.ts` with `getPreferences` and `updatePreferences` functions (following the pattern in `packages/client/src/api/dates.ts`).
2. Create `packages/client/src/context/CalendarContext.tsx`:
   - State: `calendar` (default `"miladi"`), loading flag.
   - On mount, when `token` is truthy, call `getPreferences()` and set state.
   - `setCalendar` calls `updatePreferences()` then updates local state.
3. In `packages/client/src/App.tsx`, wrap `AuthProvider`'s children with `CalendarProvider`.

**Relevant Context**
- API pattern: [`packages/client/src/api/dates.ts`](packages/client/src/api/dates.ts)
- Auth context pattern: [`packages/client/src/context/AuthContext.tsx`](packages/client/src/context/AuthContext.tsx)
- Token access: `useAuth()` hook — `CalendarContext` should import and use it.

**Status** — `[x] done`

---

### Sub-Task 3 — Client: Jalali conversion utilities

**Intent**  
Add a set of pure utility functions for Jalali conversion and formatting. These will be used by the date display and input components. Use the `date-fns-jalali` npm package (lightweight, works alongside `date-fns`, no extra build config) as the Jalali conversion engine.

**Expected Outcomes**
- `packages/client/src/utils/jalali.ts` exports:
  - `toJalaliDisplay(dateStr: string): string` — converts `YYYY-MM-DD` → Persian display string (e.g. `۱۵ دی ۱۴۰۳`).
  - `toJalaliDisplayTime(isoStr: string): string` — converts ISO datetime → Jalali date + time string (e.g. `۱۵ دی ۱۴۰۳، ساعت ۱۵:۳۰`).
  - `jalaliToGregorian(jY: number, jM: number, jD: number): string` — returns `YYYY-MM-DD` Gregorian string.
  - `gregorianToJalali(dateStr: string): { year: number; month: number; day: number }` — returns Jalali components for seeding the picker.
- `packages/client/src/utils/format.ts` updated: `formatDate` and `formatDateTime` accept an optional `calendar` parameter; when `"shamsi"`, they delegate to the Jalali utilities above.
- `date-fns-jalali` added to `packages/client/package.json` dependencies.

**Todo List**
1. Install `date-fns-jalali` in `packages/client` (add to `package.json` dependencies; note this for the agent to run `npm install`).
2. Create `packages/client/src/utils/jalali.ts` with the four exported functions listed above using `date-fns-jalali`'s `format`, `parse`, and Jalali locale.
3. Update `formatDate(dateStr, calendar?)` and `formatDateTime(str, calendar?)` in `packages/client/src/utils/format.ts` to branch on `calendar === "shamsi"`.

**Relevant Context**
- Existing format utilities: [`packages/client/src/utils/format.ts`](packages/client/src/utils/format.ts)
- `date-fns-jalali` package on npm: provides `format`, `parse`, `getYear`, `getMonth`, `getDate` for Jalali calendar — compatible with standard `date-fns` API.
- Persian month names: فروردین، اردیبهشت، خرداد، تیر، مرداد، شهریور، مهر، آبان، آذر، دی، بهمن، اسفند
- Persian-Indic numerals mapping: `0→۰ 1→۱ 2→۲ 3→۳ 4→۴ 5→۵ 6→۶ 7→۷ 8→۸ 9→۹`

**Status** — `[ ] pending`

---

### Sub-Task 4 — Client: Jalali date picker component

**Intent**  
Create a reusable `JalaliDatePicker` component (and `JalaliDateTimePicker` variant for `datetime-local` use cases) that wraps a Persian calendar UI, and a smart `DateInput` / `DateTimeInput` wrapper that automatically switches between the native HTML date input (Gregorian) and the Jalali picker based on the current calendar preference.

**Expected Outcomes**
- `packages/client/src/components/JalaliDatePicker.tsx` renders a Persian month/year grid with day selection; calls `onChange(gregorianDateStr)` when a day is selected.
- `packages/client/src/components/DateInput.tsx` — smart wrapper: reads `useCalendar()`; when Gregorian, renders `<input type="date" ...>`; when Shamsi, renders `JalaliDatePicker`.
- `packages/client/src/components/DateTimeInput.tsx` — same but for datetime (combines Jalali date picker + `<input type="time">`); used in RemindersPage.
- Both wrappers accept and emit values in `YYYY-MM-DD` (date) / ISO datetime string format so callers need no changes beyond replacing the raw `<input>` elements.

**Todo List**
1. Install the Persian datepicker library to use as base: use `react-persian-datepicker` or, if unavailable, build the grid purely with `date-fns-jalali` helpers. (Prefer a library if a mature, actively maintained one exists; otherwise build a lightweight inline grid.)
2. Create `packages/client/src/components/JalaliDatePicker.tsx` — calendar grid showing current Jalali month, prev/next month navigation, day selection.
3. Create `packages/client/src/components/DateInput.tsx` — smart switcher for `type="date"` inputs.
4. Create `packages/client/src/components/DateTimeInput.tsx` — smart switcher for `type="datetime-local"` inputs (Jalali date + time input).

**Relevant Context**
- Pages using `<input type="date">`: [`TasksPage.tsx`](packages/client/src/pages/TasksPage.tsx), [`BillsPage.tsx`](packages/client/src/pages/BillsPage.tsx), [`ImportantDatesPage.tsx`](packages/client/src/pages/ImportantDatesPage.tsx).
- Pages using `<input type="datetime-local">`: [`RemindersPage.tsx`](packages/client/src/pages/RemindersPage.tsx) (uses `reminderToForm()` timezone conversion helper — make sure `DateTimeInput` aligns with that).
- Tailwind CSS is available for styling — match existing card/input styles in the pages.

**Status** — `[x] done`

---

### Sub-Task 5 — Client: wire up calendar-aware display in all pages

**Intent**  
Update every page that displays or inputs a date to use the new `DateInput`/`DateTimeInput` components for inputs and pass the `calendar` preference to `formatDate`/`formatDateTime` calls for display.

**Expected Outcomes**
- All date labels in `TasksPage`, `BillsPage`, `RemindersPage`, and `ImportantDatesPage` render in the chosen calendar system.
- All date input fields in those pages use the smart `DateInput` or `DateTimeInput` wrapper.
- `DashboardPage` (if it renders any dates in the AI summary or quick cards) also respects the preference.
- Switching calendar in Settings instantly re-renders all displayed dates without a page reload.

**Todo List**
1. In `ImportantDatesPage.tsx`:
   - Replace `<input type="date">` with `<DateInput>`.
   - Update the inline `formatDate(dateStr)` calls to pass `calendar` (from `useCalendar()`).
   - Update the `daysUntil` and `daysLabel` display lines to use `formatDate` with `calendar`.
2. In `TasksPage.tsx`:
   - Replace `<input type="date">` with `<DateInput>`.
   - Update `formatDate(task.due_date)` calls to pass `calendar`.
3. In `BillsPage.tsx`:
   - Replace both `<input type="date">` elements (`due_date`, `next_billing_date`) with `<DateInput>`.
   - Update `formatDate(...)` display calls to pass `calendar`.
4. In `RemindersPage.tsx`:
   - Replace `<input type="datetime-local">` with `<DateTimeInput>`.
   - Update `formatDateTime(r.remind_at)` calls to pass `calendar`.
5. In each page, add `const { calendar } = useCalendar()` at the top.

**Relevant Context**
- `formatDate` and `formatDateTime` signatures will be updated in Sub-Task 3 to accept optional `calendar` param.
- `DateInput` / `DateTimeInput` are created in Sub-Task 4.
- `useCalendar()` is created in Sub-Task 2.

**Status** — `[x] done`

---

### Sub-Task 6 — Client: Settings page

**Intent**  
Create a `/settings` page where users can select their preferred calendar system. Add a Settings link to the Sidebar.

**Expected Outcomes**
- `packages/client/src/pages/SettingsPage.tsx` renders a calendar preference selector (radio buttons or toggle: Miladi / Shamsi).
- Selecting an option immediately calls `setCalendar(...)` from `useCalendar()`, persisting to the server.
- A visual confirmation (e.g. brief "Saved" indicator) is shown after saving.
- The Sidebar includes a "Settings" link (gear icon) at the bottom, pointing to `/settings`.
- `App.tsx` registers the `/settings` route as a protected route.

**Todo List**
1. Create `packages/client/src/pages/SettingsPage.tsx`:
   - Use `useCalendar()` to read current value and call `setCalendar`.
   - Two options: "میلادی (Gregorian)" and "شمسی (Jalali/Shamsi)".
   - Show a brief "Saved ✓" message on successful save.
   - Match the card/panel visual style of other pages.
2. In `packages/client/src/App.tsx`, add `<Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />`.
3. In `packages/client/src/components/Sidebar.tsx`, add a "Settings" nav item (gear icon from Heroicons, matching existing icon style) linking to `/settings`, positioned at the bottom of the nav list.

**Relevant Context**
- Sidebar nav pattern: [`packages/client/src/components/Sidebar.tsx`](packages/client/src/components/Sidebar.tsx)
- Route pattern: [`packages/client/src/App.tsx`](packages/client/src/App.tsx)
- Visual style reference: any existing page (e.g. `TasksPage.tsx`) for card styling.
- `setCalendar` from `CalendarContext` (Sub-Task 2) is the save mechanism — no separate "Save" button needed; update on selection change.

**Status** — `[x] done`

---

## Implementation Order

```
Sub-Task 1 (DB + API)
    → Sub-Task 2 (CalendarContext)
        → Sub-Task 3 (Jalali utils)
            → Sub-Task 4 (Picker component)
                → Sub-Task 5 (Wire up pages)
                    → Sub-Task 6 (Settings page)
```

Each sub-task builds on the previous. Sub-Tasks 3 and 4 can be developed in parallel after Sub-Task 2 is complete.

---

## Non-Goals

- No change to how dates are stored on the server (always Gregorian `YYYY-MM-DD`).
- No localization of UI labels beyond date values (button text, section headings remain in English).
- No right-to-left (RTL) layout changes — Shamsi date values are displayed inline within the existing LTR layout.
- No timezone conversion logic changes (existing Gregorian timezone handling is preserved).
