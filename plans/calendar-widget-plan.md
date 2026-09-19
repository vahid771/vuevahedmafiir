# Calendar Widget Plan

## Top-Level Overview

Add a full, browsable calendar widget to the Dashboard page. It reads the user's preferred calendar from the existing `CalendarContext` (miladi or shamsi) and uses that as the **primary calendar** (driving all grid logic). The other system (miladi ↔ shamsi) is rendered as a **secondary label** showing the equivalent date range beneath each primary header.

Three views are supported — Monthly, Weekly, Daily — each switchable via a tab bar. Prev/Next navigation advances by the active view's unit (month / week / day). All state is local to the component (no persistence, no URL params).

No events are rendered on the grid (events are a future concern). The widget is embedded as a new section below the existing content in `DashboardPage`.

**Key constraint:** reuse all existing Jalali utilities in `utils/jalali.ts` — do not add new libraries.

---

## Sub-Tasks

---

### Sub-Task 1 — Add secondary-calendar range helpers to `utils/jalali.ts`

**Intent**
The secondary calendar label needs three types of formatted strings that don't yet exist:
1. The Jalali month range for a Gregorian month (e.g. "دی – بهمن ۱۴۰۳")
2. A compact Jalali date range for a week span (e.g. "۲ دی – ۸ دی ۱۴۰۳")
3. A full Jalali date label for a single day (already covered by `toJalaliDisplay`)

The mirror case (Gregorian range for a Shamsi primary) is also needed:
1. Gregorian month range for a Jalali month (e.g. "Jan – Feb 2025")
2. Gregorian date range for a week (e.g. "Dec 27 – Jan 2")
3. Full Gregorian date for a day (can be done inline)

**Expected Outcomes**
- `utils/jalali.ts` exports two new helper functions:
  - `jalaliMonthRangeForGregorianMonth(gYear, gMonth)` → `string` — first and last day of the Gregorian month converted to Jalali, return "MonthName [– MonthName] Year" (only show range if the Jalali month crosses a boundary)
  - `gregorianMonthRangeForJalaliMonth(jYear, jMonth)` → `string` — first and last day of the Jalali month converted to Gregorian, return short "Mon – Mon Year" (only different month names shown)
  - `jalaliWeekRange(startDate: Date, endDate: Date)` → `string` — formats "D MonthName – D MonthName Year"
  - `gregorianWeekRange(startDate: Date, endDate: Date)` → `string` — formats "Mon D – Mon D" (same year implied)

**Todo List**
1. Add `jalaliMonthRangeForGregorianMonth(gYear: number, gMonth: number): string` — convert day 1 and last day of that Gregorian month to Jalali, produce a readable Persian string
2. Add `gregorianMonthRangeForJalaliMonth(jYear: number, jMonth: number): string` — convert day 1 and last day of that Jalali month to Gregorian, produce a readable short English string
3. Add `jalaliWeekRange(start: Date, end: Date): string` — convert both endpoints to Jalali, format range string with Persian digits
4. Add `gregorianWeekRange(start: Date, end: Date): string` — format both endpoints as short English month+day

**Relevant Context**
- `packages/client/src/utils/jalali.ts` — add exports here
- Existing helpers: `toJalaali`, `toGregorian`, `jalaaliMonthLength`, `PERSIAN_MONTHS`, `toPersianDigits`
- For Gregorian last-day-of-month: `new Date(gYear, gMonth, 0).getDate()` (month is 1-based so pass `gMonth` directly)

**Status:** [x] done

---

### Sub-Task 2 — Build `CalendarWidget` component (month view + header)

**Intent**
Create the main calendar widget component at `packages/client/src/components/CalendarWidget.tsx`. This first pass implements the monthly view grid and the shared header (view-switcher, prev/next, primary title, secondary range label). Weekly and daily will be added in the next sub-task.

The monthly grid logic differs by primary calendar:
- **Miladi primary:** standard Gregorian month grid, week starts Sunday (0), weekday headers Su/Mo/Tu/We/Th/Fr/Sa
- **Shamsi primary:** Jalali month grid, week starts Saturday (6 in `getDay()`), weekday headers ش/ی/د/س/چ/پ/ج

**Expected Outcomes**
- `CalendarWidget` renders a white card with:
  - Header: primary month+year title | Prev/Next arrows | Month/Week/Day tabs
  - Secondary label row under primary title (styled smaller, muted)
  - Monthly grid: 7-column day grid with weekday headers, correct offset, today highlight, selected-month day cells in white, out-of-month cells greyed
- Exports as default from `CalendarWidget.tsx`

**Todo List**
1. Create `packages/client/src/components/CalendarWidget.tsx`
2. Add local state: `view: 'month' | 'week' | 'day'`, `cursor: Date` (starts as today)
3. Use `useCalendar()` to get `calendar` (primary); derive `secondary = calendar === 'miladi' ? 'shamsi' : 'miladi'`
4. Implement `navigatePrev()` / `navigateNext()` — advance cursor by 1 month (for month view), 1 week, or 1 day respectively, switching on `view`
5. Build header: left side = primary title + secondary range label; right side = prev/next + view tabs
6. Implement `MonthGrid` sub-component (internal):
   - Miladi: enumerate days of the Gregorian month, pad with blanks for week offset (Sunday start)
   - Shamsi: enumerate days of the current Jalali month (use `jalaliDaysInMonth`), pad for Saturday start
   - Highlight today in blue ring; style out-of-month pad cells as transparent
7. Secondary label calls the appropriate helper from Sub-Task 1 based on which is secondary

**Relevant Context**
- `packages/client/src/context/CalendarContext.tsx` — `useCalendar()` returns `{ calendar }`
- `packages/client/src/utils/jalali.ts` — `toJalaali`, `jalaliDaysInMonth`, `PERSIAN_MONTHS`, `toPersianDigits`, new range helpers from Sub-Task 1
- `packages/client/src/components/JalaliDatePicker.tsx` — reference for Jalali grid logic (Saturday offset, weekday header generation)
- Tailwind patterns: `bg-white border border-gray-200 rounded-xl`, `text-sm text-gray-500`, `bg-blue-600 text-white rounded-full`

**Status:** [x] done

---

### Sub-Task 3 — Add Weekly and Daily view panels to `CalendarWidget`

**Intent**
Extend `CalendarWidget` with the weekly and daily view renderers. These share the same header (already built), just swap out the body panel.

Weekly view:
- 7-column header row of day names + dates for the week containing `cursor`
- Body: a simple empty row beneath (no time slots in week view — events are future)
- Week start: Sunday for Miladi primary, Saturday for Shamsi primary
- Secondary label: week range string via helpers from Sub-Task 1

Daily view:
- Header shows primary full date (day name + day number + month + year)
- Secondary label shows the full equivalent date in the other system
- Body: 24 rows, each labeled with hour (00:00 → 23:00), empty cells

**Expected Outcomes**
- Selecting "Week" tab shows the 7-day column headers for the current week, navigatable ± 7 days
- Selecting "Day" tab shows 24 time-slot rows, navigatable ± 1 day
- Secondary range label updates correctly in all views
- RTL direction applied (`dir="rtl"`) when Shamsi is the primary calendar

**Todo List**
1. Add `WeekPanel` sub-component inside `CalendarWidget.tsx`:
   - Compute `weekStart` from cursor (rewind to Sunday/Saturday depending on calendar)
   - Render 7 columns: day name (short) + primary date number; highlight today's column
   - Secondary label uses `jalaliWeekRange` or `gregorianWeekRange` from Sub-Task 1
2. Add `DayPanel` sub-component inside `CalendarWidget.tsx`:
   - Render 24 time slot rows labeled 00:00 through 23:00
   - Header shows full primary date; secondary label shows full secondary date (use existing `toJalaliDisplay` or inline Gregorian format)
3. Hook up view switching in the shared render: `{view === 'month' && <MonthGrid .../>}` etc.
4. Apply `dir="rtl"` to the card root when `calendar === 'shamsi'`

**Relevant Context**
- Sub-Task 2 output: `CalendarWidget.tsx` with month view and shared header
- `packages/client/src/utils/jalali.ts` — new range helpers from Sub-Task 1
- For week start calculation when Miladi: `date.getDay()` where Sunday=0; for Shamsi week: Saturday=6, so offset = `(date.getDay() + 1) % 7`

**Status:** [x] done

---

### Sub-Task 4 — Embed `CalendarWidget` in `DashboardPage`

**Intent**
Mount the finished widget on the Dashboard. It should appear as a new card section below the existing AI Summary card and above the quick-link grid.

**Expected Outcomes**
- Dashboard renders `<CalendarWidget />` between the AI summary card and the shortcut grid
- Widget is responsive (full width on mobile, constrained on desktop by existing `max-w-2xl`)
- No existing Dashboard functionality is broken

**Todo List**
1. Import `CalendarWidget` in `packages/client/src/pages/DashboardPage.tsx`
2. Insert `<CalendarWidget />` between the AI summary `<div>` and the quick-link grid `<div className="mt-6 grid ...">`, wrapped in `<div className="mt-6">`

**Relevant Context**
- `packages/client/src/pages/DashboardPage.tsx` — insert after line 92 (closing `</div>` of the AI summary card)
- Existing container: `max-w-2xl mx-auto py-6 px-4`

**Status:** [x] done

---

## Implementation Notes

- All date math uses native `Date` objects + existing `jalaali-js` helpers — no new packages required
- The `cursor` state is a `Date` object (Gregorian always); Jalali display is derived at render time
- The secondary calendar label is purely cosmetic — it derives from the same `cursor` state
- When Shamsi is primary, all cell numbers and headers are rendered with `toPersianDigits()`
- RTL direction (`dir="rtl"`) is applied to the widget root when the primary calendar is Shamsi
