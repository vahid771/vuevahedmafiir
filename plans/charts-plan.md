# Charts & Statistics Plan

## Overview

Add statistical visualisations across the dashboard and relevant feature pages using **Recharts** (React-native, zero-config, tree-shakeable, TypeScript-ready). No new backend endpoints are needed — charts are derived from data that pages already fetch. Charts are placed **below** existing content as collapsible or always-visible stat panels.

Chart library choice: **Recharts** (`recharts` npm package). Reasons:
- SVG-based, works with Tailwind, no canvas polyfills needed
- Already used widely with React 18
- `ResponsiveContainer` handles RTL/LTR layout automatically

---

## Sub-Tasks

---

### Sub-Task 1 — Install Recharts

**Intent:** Add `recharts` to the client package so all subsequent sub-tasks can import from it.

**Expected Outcomes:**
- `recharts` appears in `packages/client/package.json` dependencies
- TypeScript can resolve `recharts` types (bundled with the package)

**Todo List:**
1. Run `npm install recharts` inside `packages/client`
2. Verify `packages/client/package.json` shows the dependency
3. Run `npx tsc --noEmit` to confirm no type errors

**Relevant Context:**
- `packages/client/package.json`

**Status:** [x] done

---

### Sub-Task 2 — Shared chart utilities & theme

**Intent:** Create a single `packages/client/src/components/charts/chartTheme.ts` file that exports a consistent colour palette, tooltip style, and a reusable `<ChartCard>` wrapper component so all charts look uniform.

**Expected Outcomes:**
- `chartTheme.ts` exports `CHART_COLORS` array and `tooltipStyle` object
- `ChartCard.tsx` renders a titled, bordered card that wraps any chart

**Todo List:**
1. Create `packages/client/src/components/charts/chartTheme.ts` with:
   - `CHART_COLORS`: 6 hex colours drawn from the Tailwind config palette (indigo, green, amber, red, purple, teal)
   - `tooltipStyle`: object for Recharts `<Tooltip contentStyle={…}/>`
2. Create `packages/client/src/components/charts/ChartCard.tsx` — a card wrapper accepting `title` and `children` props, with optional `collapsible` behaviour
3. Run `npx tsc --noEmit`

**Relevant Context:**
- `packages/client/tailwind.config.js` — primary colour is indigo (`#6366f1`), surface `#f7f8fa`
- `packages/client/src/pages/DashboardPage.tsx` — existing card style: `bg-white border border-gray-200 rounded-xl p-6`

**Status:** [x] done

---

### Sub-Task 3 — Tasks page charts

**Intent:** Show a **Pie chart** (open vs done) and a **Bar chart** (tasks by priority) inside `TasksPage`.

**Expected Outcomes:**
- Below the task list a stats panel appears showing:
  1. Pie: Open / Done split
  2. Bar: count of tasks per priority level (low / medium / high), open tasks only
- Both charts are derived from the already-loaded `tasks` state — no extra fetch

**Todo List:**
1. In `TasksPage.tsx` compute derived stats from the `tasks` array:
   - `openCount`, `doneCount`
   - `priorityCounts`: `{ low, medium, high }` for open tasks only
2. Add `<TasksCharts>` component (inline or separate file) using:
   - `<PieChart>` with two slices: open (blue) / done (green)
   - `<BarChart>` with three bars coloured by priority badge colours
3. Wrap in `<ChartCard>` from Sub-Task 2
4. Run `npx tsc --noEmit`

**Relevant Context:**
- `packages/client/src/pages/TasksPage.tsx`
- `packages/client/src/api/tasks.ts` — `Task` has `status: 'open'|'done'`, `priority: 'low'|'medium'|'high'`
- Priority badge colours: low=green, medium=yellow, high=red

**Status:** [x] done

---

### Sub-Task 4 — Habits page charts

**Intent:** Show a **Bar chart** of weekly completion rate per habit (% of days done this week) and a **Radar chart** of each habit's current streak.

**Expected Outcomes:**
- Below the habit grid, a stats panel shows:
  1. Bar chart: each habit's completion % this week (logs_this_week.length / days_so_far * 100)
  2. Radar chart: each habit's `current_streak` value as a radar axis (useful when ≥ 3 habits)
- Falls back gracefully (no chart rendered) when 0 or 1 habits exist

**Todo List:**
1. Compute `weekCompletion` and `streaks` from the loaded `habits` array (already has `logs_this_week` and `current_streak`)
2. Add `<HabitsCharts>` (inline or separate) with:
   - `<BarChart>` for weekly % per habit — bars coloured by completion level (red <50%, amber 50–79%, green ≥80%)
   - `<RadarChart>` for streaks — only rendered when `habits.length >= 3`
3. Wrap in `<ChartCard>`
4. Run `npx tsc --noEmit`

**Relevant Context:**
- `packages/client/src/pages/HabitsPage.tsx`
- `packages/client/src/api/habits.ts` — `Habit` has `logs_this_week: string[]`, `current_streak: number`, `frequency`

**Status:** [x] done

---

### Sub-Task 5 — Payments (Bills) page charts

**Intent:** Show a **Pie chart** (paid vs unpaid bills by amount) and a **Bar chart** of loan repayment progress on the BillsPage.

**Expected Outcomes:**
- Bills tab: Pie chart showing total paid amount vs total unpaid amount
- Loans tab: Horizontal Bar chart showing remaining vs paid amount per loan with a progress indicator
- Charts are derived from already-loaded state in each section

**Todo List:**
1. Add a `<BillsCharts>` component showing:
   - `<PieChart>` from total of `bill.amount` split by `paid` flag
2. Add a `<LoansCharts>` component showing:
   - Horizontal `<BarChart>` with two stacked bars per loan: paid portion (blue) and remaining (gray)
3. Place `<BillsCharts>` at the bottom of `BillsSection` and `<LoansCharts>` at the bottom of `LoansSection`
4. Run `npx tsc --noEmit`

**Relevant Context:**
- `packages/client/src/pages/BillsPage.tsx`
- `packages/client/src/api/bills.ts` — `Bill` has `amount`, `paid`; `Loan` has `total_amount`, `remaining_amount`, `name`

**Status:** [x] done

---

### Sub-Task 6 — Dashboard overview charts

**Intent:** Add a compact **multi-stat panel** on `DashboardPage` showing mini charts that give a quick snapshot across all domains, replacing the current plain navigation cards.

**Expected Outcomes:**
- Dashboard fetches tasks, bills, habits, and loans on mount (lightweight parallel fetches)
- The navigation card grid is replaced with richer stat cards that each contain:
  - Tasks card: open/done counts + tiny Pie donut
  - Habits card: average weekly completion % + thin progress bar
  - Payments card: unpaid bills count + unpaid total amount
  - A combined `<BarChart>` showing upcoming bills + loan payments by due date (next 14 days timeline)

**Todo List:**
1. In `DashboardPage.tsx` add parallel fetches (using `Promise.all`) for tasks, bills, habits, loans on mount — store in local state, skip if any fetch fails (non-fatal)
2. Replace the plain `<a>` card grid with `<DashboardStatCards>` (new component or inline) that renders 4 stat cards with mini charts
3. Keep navigation links on each card (`href` prop still present)
4. Add an "Upcoming payments" `<BarChart>` below the stat cards showing bills + loans by due date in the next 14 days
5. Run `npx tsc --noEmit`

**Relevant Context:**
- `packages/client/src/pages/DashboardPage.tsx` — currently uses plain `<a>` grid at the bottom
- `packages/client/src/api/tasks.ts`, `bills.ts`, `habits.ts`

**Status:** [x] done

---

### Sub-Task 7 — i18n keys for chart labels

**Intent:** All chart axis labels, tooltips, and card titles go through i18n so they render correctly in Persian too.

**Expected Outcomes:**
- `en.json` and `fa.json` each have a new `"charts"` namespace with keys for all labels used in sub-tasks 3–6
- No hardcoded English strings in any chart component

**Todo List:**
1. Add `"charts"` section to `packages/client/src/i18n/en.json`
2. Add matching `"charts"` section to `packages/client/src/i18n/fa.json` with Persian translations
3. Update all chart components from sub-tasks 3–6 to use `t('charts.*')` keys
4. Run `npx tsc --noEmit`

**Relevant Context:**
- `packages/client/src/i18n/en.json`
- `packages/client/src/i18n/fa.json`

**Status:** [x] done

---

## Implementation Order

```
1 → 2 → 3 → 4 → 5 → 6 → 7
```

Sub-tasks 3–6 can be reviewed one at a time after 1 and 2 are done. Sub-task 7 should be done last to sweep all new string literals.
