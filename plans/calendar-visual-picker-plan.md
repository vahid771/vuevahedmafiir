# Calendar Visual Picker Plan

## Overview

Replace the current vertical button list in `CalendarSettingsPage` with a **2-column visual card grid**. Each card shows a unique calendar symbol, the calendar name, today's date live-converted to that system, and a 1-line description. Selection state (blue border + checkmark) is preserved. No backend changes needed.

---

## Sub-Tasks

---

### Sub-Task 1 — Add a `getTodayString(cal)` helper

**Intent**  
Provide a single function that takes a `CalendarType` and returns today's date formatted as a short string in that calendar system. This centralises all conversion calls so the card component stays clean.

**Expected Outcomes**  
- A new exported function `getTodayInCalendar(cal: CalendarType): string` in `packages/client/src/utils/calendarDate.ts`
- Calling it for each of the 7 calendar types returns a non-empty human-readable date string
- Uses existing util files: `jalali.ts`, `hijri.ts`, `hebrew.ts`, `chinese.ts`, `saka.ts`, `ethiopian.ts`

**Todo List**  
- [ ] Create `packages/client/src/utils/calendarDate.ts`
- [ ] Import existing formatters from each util file (grep each file for the exported format/date function)
- [ ] Implement `getTodayInCalendar(cal)` with a switch on `CalendarType`:
  - `miladi` → `Intl.DateTimeFormat` with month/day/year (e.g. "Jan 5, 2025")
  - `shamsi` → use jalali formatter from `jalali.ts`
  - `qamari` → use hijri formatter from `hijri.ts`
  - `hebrew` → use hebrew formatter from `hebrew.ts`
  - `chinese` → use chinese formatter from `chinese.ts`
  - `saka` → use saka formatter from `saka.ts`
  - `ethiopian` → use ethiopian formatter from `ethiopian.ts`
- [ ] Run `npx tsc --noEmit` to verify no type errors

**Relevant Context**  
- `packages/client/src/utils/jalali.ts` — exports Shamsi date formatting  
- `packages/client/src/utils/hijri.ts` — exports Hijri date formatting  
- `packages/client/src/utils/hebrew.ts` — exports Hebrew date formatting  
- `packages/client/src/utils/chinese.ts` — exports Chinese date formatting  
- `packages/client/src/utils/saka.ts` — exports Saka date formatting  
- `packages/client/src/utils/ethiopian.ts` — exports Ethiopian date formatting  
- `packages/client/src/api/preferences.ts` — `CalendarType` definition

**Status:** [ ] pending

---

### Sub-Task 2 — Enrich i18n with calendar symbol and extended description

**Intent**  
Add a short Unicode symbol and a richer one-line description for each calendar to the i18n files. These will be displayed on the visual cards without changing existing label/desc keys.

**Expected Outcomes**  
- `en.json` has new keys `settings.{cal}Symbol` and `settings.{cal}Info` for all 7 calendars
- `fa.json` has matching keys (Farsi translations)
- All other i18n files (`ar`, `zh`, `hi`, `es`, `fr`, `de`, `pt`, `ru`, `tr`, `id`) get the same keys — can use English as fallback for now

**Todo List**  
- [ ] Add to `en.json` under `settings`:
  - `miladiSymbol`: "📅"  `miladiInfo`: "Used worldwide · ~365 days/year · 12 months"
  - `shamsiSymbol`: "☀️"  `shamsiInfo`: "Used in Iran & Afghanistan · solar · 12 months"
  - `qamariSymbol`: "🌙"  `qamariInfo`: "Used in Islamic countries · lunar · 354–355 days/year"
  - `hebrewSymbol`: "✡️"  `hebrewInfo`: "Used in Israel · lunisolar · 13-month leap years"
  - `chineseSymbol`: "🐉"  `chineseInfo`: "Used in East Asia · lunisolar · tied to zodiac cycle"
  - `sakaSymbol`: "🪷"   `sakaInfo`: "India's national calendar · solar · starts ~March 22"
  - `ethiopianSymbol`: "⭐"  `ethiopianInfo`: "Used in Ethiopia & Eritrea · 13 months · ~7 years behind Gregorian"
- [ ] Mirror the same keys in `fa.json` with Farsi text
- [ ] Add the keys (English text as fallback) to all other locale files

**Relevant Context**  
- `packages/client/src/i18n/en.json` — existing `miladiLabel`, `miladiDesc`, etc.  
- `packages/client/src/i18n/fa.json` — Farsi translations  
- Other locale files in `packages/client/src/i18n/`

**Status:** [ ] pending

---

### Sub-Task 3 — Replace calendar selection UI with visual card grid

**Intent**  
Swap the vertical `<button>` list in `CalendarSettingsPage` for a 2-column CSS grid of richer visual cards. Each card shows the symbol, name, today's live-converted date, and the info line. Selection state is preserved (blue border + checkmark badge).

**Expected Outcomes**  
- The calendar selector renders as a `grid grid-cols-2 gap-3` layout
- Each card has: symbol (large, top-left), calendar name (bold), today's date in that system (mono, accent colour), info line (small, muted)
- Selected card: `border-blue-600 bg-blue-50 dark:bg-blue-900/20`, checkmark in top-right
- Unselected card: `border-gray-200 dark:border-gray-600 hover:border-gray-300`
- Secondary/Tertiary dropdowns section unchanged
- `npx tsc --noEmit` passes

**Todo List**  
- [ ] Import `getTodayInCalendar` from `utils/calendarDate.ts`
- [ ] Replace the `<div className="space-y-3">` list in `CalendarSettingsPage` with `<div className="grid grid-cols-2 gap-3">`
- [ ] Each card is a `<button>` with:
  - Top row: symbol (text-2xl) + checkmark icon (top-right, only when selected)
  - Calendar name (`text-sm font-semibold`)
  - Today's date (`text-xs font-mono` in blue-600/blue-400 when selected, gray-500 otherwise)
  - Info line (`text-xs text-gray-400`)
- [ ] Keep `disabled={saving}`, `onClick={handleCalendarSelect}` wiring unchanged
- [ ] Run `npx tsc --noEmit`

**Relevant Context**  
- `packages/client/src/pages/settings/CalendarSettingsPage.tsx` — full file read above  
- `packages/client/src/utils/calendarDate.ts` — created in Sub-Task 1  
- Pattern reference: `LanguageSettingsPage.tsx` uses `grid grid-cols-2 sm:grid-cols-3 gap-2` with similar card styling

**Status:** [ ] pending

---

## Files Touched

| File | Change |
|---|---|
| `packages/client/src/utils/calendarDate.ts` | NEW — `getTodayInCalendar()` helper |
| `packages/client/src/pages/settings/CalendarSettingsPage.tsx` | Replace list with 2-col card grid |
| `packages/client/src/i18n/en.json` | Add `{cal}Symbol` + `{cal}Info` keys |
| `packages/client/src/i18n/fa.json` | Farsi translations for new keys |
| `packages/client/src/i18n/ar.json` + 8 other locales | English fallback for new keys |
