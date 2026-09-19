# AI Habit Suggestions on Habits Page

## Overview

Add a collapsible "Suggested Habits" section at the bottom of the Habits page. A "Get suggestions" button calls a new server endpoint (`POST /api/ai/habit-suggestions`) that uses the existing Groq integration to generate ~5 personalized habit recommendations based on the user's current habits. Each suggestion has a one-click "Add" button that immediately creates the habit.

---

## Sub-Tasks

### 1. Add `POST /api/ai/habit-suggestions` server endpoint

**Intent:** Create a new route in the existing AI router that takes the user's current habits as context and returns ~5 habit name suggestions as a JSON array.

**Expected Outcomes:**
- `POST /api/ai/habit-suggestions` is protected by `authenticateToken`
- Fetches the user's current habit names from the DB
- Builds a short prompt instructing the LLM to suggest habits the user doesn't already track
- Returns `{ suggestions: string[] }` (array of habit name strings, ~5 items)
- Reuses the same Groq client pattern already used in `POST /api/ai/summary`
- Returns 503 if `GROQ_API_KEY` is not set

**Todo List:**
1. In [`packages/server/src/ai/router.ts`](packages/server/src/ai/router.ts):
   - Import `db` from `'../db'`
   - Add `POST /habit-suggestions` route handler after the existing `/summary` route
   - Query `habits` table for `name` values belonging to the authenticated user
   - Build a prompt: list existing habit names, ask for 5 suggestions of new habits the user isn't already tracking, return as a JSON array of strings
   - Call Groq with a low `max_tokens` (e.g. 200) — only a short JSON array is needed
   - Parse the LLM response text as JSON; if parse fails, return a 502 with the raw error
   - Return `{ suggestions: string[] }`

**Relevant Context:**
- [`packages/server/src/ai/router.ts`](packages/server/src/ai/router.ts) — existing Groq call pattern (lines 92–114)
- [`packages/server/src/db.ts`](packages/server/src/db.ts) — `db.execute` usage pattern

**Status:** [x] done

---

### 2. Add `getHabitSuggestions` to the client API

**Intent:** Add a single client-side API function that calls the new endpoint.

**Expected Outcomes:**
- `getHabitSuggestions(token): Promise<string[]>` exported from `packages/client/src/api/ai.ts`
- Calls `POST /api/ai/habit-suggestions`
- Returns the `suggestions` array from the response

**Todo List:**
1. In [`packages/client/src/api/ai.ts`](packages/client/src/api/ai.ts):
   - Add `getHabitSuggestions(token: string): Promise<string[]>` that POSTs to `/api/ai/habit-suggestions` and returns `data.suggestions`

**Relevant Context:**
- [`packages/client/src/api/ai.ts`](packages/client/src/api/ai.ts) — existing `getSummary` pattern to follow
- [`packages/client/src/api/base.ts`](packages/client/src/api/base.ts) — `apiUrl`, `authHeaders`

**Status:** [x] done

---

### 3. Add "Suggested Habits" collapsible section to HabitsPage

**Intent:** Render a collapsible section below the habit list with a "Get suggestions" button. When clicked it calls the API, shows a loading state, then displays each suggestion with an "Add" button. Clicking "Add" calls `createHabit` and refreshes the list.

**Expected Outcomes:**
- A collapsible "Suggested Habits" section appears below the habit list (always rendered, not just when habits exist)
- A "Get suggestions" button triggers the AI call; during loading it shows a spinner/disabled state
- Up to 5 suggestion strings are shown, each with an "Add" button
- Clicking "Add" on a suggestion calls `createHabit` with `{ name: suggestion, frequency: 'daily' }`, then reloads habits; the suggestion is removed from the list after being added
- Errors from the AI call are shown inline within the section (not replacing the global error)
- The section is collapsed by default; clicking the header toggles it open/closed
- Re-clicking "Get suggestions" replaces the current suggestions with a fresh set

**Todo List:**
1. In [`packages/client/src/pages/HabitsPage.tsx`](packages/client/src/pages/HabitsPage.tsx):
   - Import `getHabitSuggestions` from `'../api/ai'`
   - Add state: `suggestionsOpen` (boolean, default false), `suggestions` (string[]), `suggestionsLoading` (boolean), `suggestionsError` (string)
   - Add `handleGetSuggestions` async function: sets loading, calls `getHabitSuggestions`, sets suggestions or error
   - Add `handleAddSuggestion(name: string)` async function: calls `createHabit(token!, { name, frequency: 'daily' })`, removes the suggestion from state, calls `load()` to refresh
   - Render the collapsible section after the habits list (and after the empty-state block), structured as:
     - A clickable header row: "✨ Suggested Habits" with a chevron icon that toggles `suggestionsOpen`
     - When open: a "Get suggestions" button (disabled while loading); a loading indicator while fetching; an error message if failed; the list of suggestion chips each with an "Add" button

**Relevant Context:**
- [`packages/client/src/pages/HabitsPage.tsx`](packages/client/src/pages/HabitsPage.tsx) — full file (167 lines), existing patterns for loading/error state and `createHabit`
- [`packages/client/src/api/habits.ts`](packages/client/src/api/habits.ts) — `createHabit` signature

**Status:** [x] done
