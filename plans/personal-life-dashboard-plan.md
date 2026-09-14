# Personal Life Dashboard — Plan

## Top-Level Overview

Build a full-stack, self-hostable Personal Life Dashboard as a monorepo with:

- **Frontend**: React + TypeScript (Vite), single-page app with sidebar navigation between modules, styled with **Tailwind CSS**
- **Backend**: Node.js + Express + TypeScript, REST API, SQLite via `better-sqlite3`
- **Auth**: JWT-based authentication (open registration, multi-user) for multi-device self-hosting
- **Modules**: Tasks, Bills/Subscriptions, Reminders, Habits, Important Dates, Documents (file upload + metadata, **50 MB max**)
- **AI Summary**: On-demand "Summarize my week" button calling OpenAI GPT-4o-mini to summarize items needing attention

The monorepo will have `packages/server` and `packages/client` directories sharing a root `package.json` (npm workspaces). All data is stored locally in SQLite; file uploads are stored on the server filesystem.

---

## Sub-Tasks

---

### Sub-Task 1 — Monorepo Scaffold & Shared Config

**Intent**: Establish the monorepo skeleton so all subsequent sub-tasks have a consistent foundation to build on. This avoids structural refactors later.

**Expected Outcomes**:
- Root `package.json` with npm workspaces pointing to `packages/server` and `packages/client`
- `packages/server`: Express + TypeScript project with `tsconfig.json`, `nodemon`, and `better-sqlite3`
- `packages/client`: Vite + React + TypeScript project bootstrapped and runnable
- Both packages have separate `dev` scripts; root `dev` script runs both concurrently
- `.env.example` at root documenting all required environment variables
- `.gitignore` covering `node_modules`, `dist`, `.env`, SQLite DB file, and uploads folder

**Todo List**:
1. Create root `package.json` with `workspaces: ["packages/server", "packages/client"]` and a `dev` script using `concurrently`
2. Scaffold `packages/server`: `package.json`, `tsconfig.json`, `src/index.ts` (bare Express server on configurable port)
3. Scaffold `packages/client`: run `npm create vite` equivalent manually (Vite + React + TS template files)
4. Add `.env.example` with `PORT`, `JWT_SECRET`, `OPENAI_API_KEY`, `DATABASE_PATH`, `UPLOADS_DIR`
5. Install and configure **Tailwind CSS** in `packages/client` (via `tailwindcss`, `postcss`, `autoprefixer`)
6. Add `.gitignore`
7. Verify `npm install` from root resolves both workspaces

**Relevant Context**:
- No existing files; start fresh in workspace root
- Use `better-sqlite3` (synchronous, zero-config) for the server
- Use `concurrently` at root to run both `dev` scripts in parallel

**Status**: [x] done

---

### Sub-Task 2 — Database Schema & Migrations

**Intent**: Define and create all SQLite tables up front so every subsequent module sub-task has a stable data layer to code against.

**Expected Outcomes**:
- A single `db.ts` module in `packages/server/src` that opens the SQLite connection and runs migrations on startup
- Tables created: `users`, `tasks`, `bills`, `subscriptions`, `reminders`, `habits`, `habit_logs`, `important_dates`, `documents`
- Each table has appropriate columns, constraints, and indexes
- The migration runs idempotently (`CREATE TABLE IF NOT EXISTS`)

**Todo List**:
1. Install `better-sqlite3` and `@types/better-sqlite3` in `packages/server`
2. Create `packages/server/src/db.ts` that opens/creates the SQLite file from `DATABASE_PATH` env var
3. Write `CREATE TABLE IF NOT EXISTS` statements for all tables:
   - `users`: id, email, password_hash, created_at
   - `tasks`: id, user_id, title, description, due_date, priority (low/medium/high), status (open/done), created_at
   - `bills`: id, user_id, name, amount, due_date, recurrence (once/monthly/yearly), paid, created_at
   - `subscriptions`: id, user_id, name, amount, billing_cycle, next_billing_date, active, created_at
   - `reminders`: id, user_id, title, remind_at (datetime), notes, done, created_at
   - `habits`: id, user_id, name, frequency (daily/weekly), target_days (JSON array for weekly), created_at
   - `habit_logs`: id, habit_id, user_id, logged_date, created_at
   - `important_dates`: id, user_id, title, date, recurs_yearly, notes, created_at
   - `documents`: id, user_id, title, filename, mimetype, size, tags (JSON), uploaded_at
4. Export `db` instance from `db.ts` and call the migration function in `src/index.ts` on startup

**Relevant Context**:
- `DATABASE_PATH` from `.env` (e.g. `./data/dashboard.db`)
- All tables include `user_id` for row-level isolation per authenticated user
- `habit_logs.logged_date` is a DATE string (YYYY-MM-DD) — unique per habit+date

**Status**: [x] done

---

### Sub-Task 3 — Auth (Register / Login / JWT Middleware)

**Intent**: Implement JWT-based authentication so all API routes can be user-scoped. This must exist before any module routes are built.

**Expected Outcomes**:
- `POST /api/auth/register` — creates a user (email + password), returns JWT
- `POST /api/auth/login` — validates credentials, returns JWT
- `authenticateToken` middleware that reads `Authorization: Bearer <token>` and attaches `req.user` (id, email)
- Passwords hashed with `bcrypt`
- All subsequent module routes will be protected by this middleware

**Todo List**:
1. Install `jsonwebtoken`, `bcrypt`, and their `@types/*` in `packages/server`
2. Create `packages/server/src/auth/router.ts` with `register` and `login` route handlers
3. Create `packages/server/src/middleware/authenticate.ts` exporting `authenticateToken` middleware
4. Register the auth router in `src/index.ts` under `/api/auth`
5. Create `packages/client/src/api/auth.ts` with `login()` and `register()` fetch helpers
6. Create a minimal login/register page in the client (`LoginPage.tsx`) that stores the JWT in `localStorage`
7. Create a React context (`AuthContext.tsx`) that provides the token and a `logout` function
8. Add a route guard — unauthenticated users are redirected to `/login`

**Relevant Context**:
- `JWT_SECRET` from `.env`
- Token expiry: 30 days (long-lived for self-hosting convenience)
- Client uses `localStorage` for token persistence (acceptable for self-hosted)

**Status**: [x] done

---

### Sub-Task 4 — Shell: Dashboard Layout & Sidebar Navigation

**Intent**: Build the persistent SPA shell — sidebar, top bar, and page routing — so every module sub-task drops into an existing, consistent layout.

**Expected Outcomes**:
- Sidebar with icons and labels for each module: Dashboard (home), Tasks, Bills & Subscriptions, Reminders, Habits, Important Dates, Documents
- Active route is highlighted in the sidebar
- Top bar shows the app name and a logout button
- A `/dashboard` home route shows a placeholder for the AI Summary card
- Module routes render inside the main content area; each shows a placeholder until implemented
- Fully responsive: sidebar collapses to icons on small screens (or a hamburger menu)

**Todo List**:
1. Install `react-router-dom` in `packages/client`
2. Create `packages/client/src/layouts/AppLayout.tsx` with sidebar + main content slot
3. Create `packages/client/src/components/Sidebar.tsx` listing all nav links
4. Define routes in `packages/client/src/App.tsx`: `/login`, `/dashboard`, `/tasks`, `/bills`, `/reminders`, `/habits`, `/dates`, `/documents`
5. Create placeholder page components for each module route
6. Style the sidebar and top bar using Tailwind utility classes; add active-link highlighting via `NavLink`

**Relevant Context**:
- Tailwind CSS is the chosen styling approach (configured in Sub-Task 1)
- `AuthContext` from Sub-Task 3 provides the `logout` action used in the top bar

**Status**: [x] done

---

### Sub-Task 5 — Tasks Module

**Intent**: Implement the full CRUD for personal tasks with due dates, priorities, and status toggling.

**Expected Outcomes**:
- `GET /api/tasks` — returns user's tasks (filterable by status)
- `POST /api/tasks` — creates a task
- `PATCH /api/tasks/:id` — updates any field (including toggling `done`)
- `DELETE /api/tasks/:id` — deletes a task
- `TasksPage.tsx` lists tasks grouped by status, supports add/edit via inline form or modal, and has a "Mark done" toggle

**Todo List**:
1. Create `packages/server/src/tasks/router.ts` with all four route handlers, protected by `authenticateToken`
2. Register tasks router in `src/index.ts` under `/api/tasks`
3. Create `packages/client/src/api/tasks.ts` with typed fetch helpers
4. Build `packages/client/src/pages/TasksPage.tsx`:
   - List tasks (open first, then done)
   - "Add task" button opens an inline form (title, description, due date, priority)
   - Each task row has edit and delete actions
   - Checkbox or button to toggle status

**Relevant Context**:
- `tasks` table from Sub-Task 2
- All queries must filter by `user_id = req.user.id`
- Priority values: `low | medium | high`; status values: `open | done`

**Status**: [x] done

---

### Sub-Task 6 — Bills & Subscriptions Module

**Intent**: Track one-off bills (with due dates) and recurring subscriptions (with next billing date), allowing users to mark bills as paid.

**Expected Outcomes**:
- CRUD routes for `/api/bills` and `/api/subscriptions`
- `BillsPage.tsx` shows two tabs or sections: Bills and Subscriptions
- Bills show name, amount, due date, paid status (toggleable)
- Subscriptions show name, amount, billing cycle, next billing date, active status (toggleable)

**Todo List**:
1. Create `packages/server/src/bills/router.ts` for both bills and subscriptions routes
2. Register under `/api/bills` and `/api/subscriptions` in `src/index.ts`
3. Create `packages/client/src/api/bills.ts` and `packages/client/src/api/subscriptions.ts`
4. Build `packages/client/src/pages/BillsPage.tsx` with two sections:
   - Bills: add/edit/delete, toggle paid
   - Subscriptions: add/edit/delete, toggle active
5. Highlight upcoming bills due within 7 days

**Relevant Context**:
- `bills` and `subscriptions` tables from Sub-Task 2
- `recurrence` field on bills: `once | monthly | yearly`
- `billing_cycle` on subscriptions: `monthly | yearly | weekly`

**Status**: [x] done

---

### Sub-Task 7 — Reminders Module

**Intent**: Let users create time-stamped reminders with notes; show past-due reminders prominently.

**Expected Outcomes**:
- CRUD routes for `/api/reminders`
- `RemindersPage.tsx` lists upcoming reminders sorted by `remind_at`, overdue reminders highlighted in red
- Users can mark a reminder as done

**Todo List**:
1. Create `packages/server/src/reminders/router.ts` (GET, POST, PATCH, DELETE)
2. Register under `/api/reminders`
3. Create `packages/client/src/api/reminders.ts`
4. Build `packages/client/src/pages/RemindersPage.tsx`:
   - Sorted list by `remind_at`
   - Overdue (past current time, not done) highlighted
   - Add/edit form: title, datetime, notes
   - "Mark done" toggle

**Relevant Context**:
- `reminders` table from Sub-Task 2
- `remind_at` stored as ISO 8601 string in SQLite

**Status**: [x] done

---

### Sub-Task 8 — Habits Module

**Intent**: Allow users to define habits with a daily or weekly frequency and log completions; show streaks and weekly progress.

**Expected Outcomes**:
- CRUD routes for `/api/habits`; `POST /api/habits/:id/log` to log today's completion; `DELETE /api/habits/:id/log/:date` to unlog
- `HabitsPage.tsx` shows each habit with a weekly mini-calendar (Mon–Sun) showing which days were logged
- Current streak displayed per habit

**Todo List**:
1. Create `packages/server/src/habits/router.ts`:
   - `GET /api/habits` — list habits with logs for the current week
   - `POST /api/habits` — create habit
   - `PATCH /api/habits/:id` — update habit
   - `DELETE /api/habits/:id` — delete habit (cascade delete logs)
   - `POST /api/habits/:id/log` — log today (insert into `habit_logs`, ignore if already logged)
   - `DELETE /api/habits/:id/log/:date` — remove a log entry
2. Register under `/api/habits`
3. Create `packages/client/src/api/habits.ts`
4. Build `packages/client/src/pages/HabitsPage.tsx`:
   - Weekly grid (current week Mon–Sun) per habit
   - Toggle logged state for each day cell
   - Show current streak (consecutive days with a log, counting back from today)
   - Add/edit/delete habit

**Relevant Context**:
- `habits` and `habit_logs` tables from Sub-Task 2
- `logged_date` is a `YYYY-MM-DD` string; enforce uniqueness with a UNIQUE constraint on `(habit_id, logged_date)`
- Streak calculation: query all logs for the habit ordered by date DESC, count consecutive days

**Status**: [x] done

---

### Sub-Task 9 — Important Dates Module

**Intent**: Store birthdays, anniversaries, and other significant dates. Yearly-recurring dates should surface upcoming occurrences.

**Expected Outcomes**:
- CRUD routes for `/api/dates`
- `ImportantDatesPage.tsx` lists all dates sorted by next occurrence; upcoming (within 30 days) are highlighted
- Yearly-recurring dates compute the next occurrence relative to today

**Todo List**:
1. Create `packages/server/src/dates/router.ts` (GET, POST, PATCH, DELETE)
2. `GET /api/dates` should return each date with a computed `next_occurrence` field (server-side)
3. Register under `/api/dates`
4. Create `packages/client/src/api/dates.ts`
5. Build `packages/client/src/pages/ImportantDatesPage.tsx`:
   - Sorted by `next_occurrence`
   - Highlight dates within the next 30 days
   - "Upcoming" badge for items within 7 days
   - Add/edit form: title, date, recurs_yearly toggle, notes

**Relevant Context**:
- `important_dates` table from Sub-Task 2
- `next_occurrence` computation: if `recurs_yearly`, advance the year until the date is >= today

**Status**: [x] done

---

### Sub-Task 10 — Documents Module

**Intent**: Allow users to upload files (PDF, images, etc.) with a title and tags; stored on the server filesystem with metadata in SQLite.

**Expected Outcomes**:
- `POST /api/documents/upload` — accepts multipart form data, saves file to `UPLOADS_DIR`, stores metadata in DB
- `GET /api/documents` — lists user's documents (metadata only, filterable by tag)
- `GET /api/documents/:id/download` — streams the file back
- `DELETE /api/documents/:id` — removes metadata + file from disk
- `DocumentsPage.tsx` shows a searchable/filterable grid of documents with upload button and download/delete actions

**Todo List**:
1. Install `multer` in `packages/server`
2. Create `packages/server/src/documents/router.ts` with upload, list, download, delete handlers
3. Configure `multer` to store files under `UPLOADS_DIR` with unique filenames (e.g. UUID + original extension)
4. Register under `/api/documents`
5. Create `packages/client/src/api/documents.ts`
6. Build `packages/client/src/pages/DocumentsPage.tsx`:
   - Grid/list of documents showing title, type icon, size, tags, upload date
   - Upload button opens a file picker + title/tags form
   - Download and delete actions per document
   - Tag filter bar at the top

**Relevant Context**:
- `documents` table from Sub-Task 2
- `tags` stored as JSON array in SQLite (e.g. `["tax", "2024"]`)
- `UPLOADS_DIR` from `.env` (e.g. `./uploads`)
- Enforce per-user ownership check on download and delete
- `multer` configured with a **50 MB** file size limit (`limits: { fileSize: 50 * 1024 * 1024 }`)

**Status**: [x] done

---

### Sub-Task 11 — AI "What Needs My Attention" Summary

**Intent**: Implement the on-demand AI summary that collects data from all modules and asks GPT-4o-mini to produce a concise, prioritized briefing for the week.

**Expected Outcomes**:
- `POST /api/ai/summary` — gathers data from all modules for the authenticated user, builds a prompt, calls OpenAI, returns the summary text
- `DashboardPage.tsx` (the `/dashboard` home route) has a "Summarize my week" button that calls this endpoint and renders the response in a card
- Loading state shown while awaiting OpenAI response
- Summary includes: overdue tasks, upcoming bills/due dates, pending reminders, habit completion rate this week, dates within 30 days

**Todo List**:
1. Install `openai` npm package in `packages/server`
2. Create `packages/server/src/ai/router.ts`:
   - Query all relevant data for the user from all tables
   - Build a structured plaintext prompt summarizing current state
   - Call `openai.chat.completions.create` with `gpt-4o-mini`
   - Return `{ summary: string }` to the client
3. Register under `/api/ai`
4. Create `packages/client/src/api/ai.ts` with a `getSummary()` fetch helper
5. Build `packages/client/src/pages/DashboardPage.tsx`:
   - Hero card at top with "Summarize my week" button
   - Below the button: renders the returned summary text (support markdown via a simple renderer)
   - Loading spinner while waiting
   - Error state if API call fails

**Relevant Context**:
- `OPENAI_API_KEY` from `.env`
- The prompt should include today's date and frame the request as "what needs my attention this week"
- Data gathered: tasks where `status='open'`, bills with `due_date` within 14 days and `paid=0`, subscriptions with `next_billing_date` within 14 days, reminders where `done=0` and `remind_at <= now + 7 days`, habits + this week's logs, important dates within 30 days

**Status**: [x] done

---

### Sub-Task 12 — Polish, Error Handling & README

**Intent**: Add consistent API error handling, client-side error/loading states, and a README that explains how to set up and run the project.

**Expected Outcomes**:
- Server has a global error-handling middleware that returns `{ error: string }` JSON with appropriate status codes
- Client shows toast/inline error messages on API failures
- `README.md` at the repo root with: prerequisites, environment variable setup, `npm install`, `npm run dev`, and a short feature overview

**Todo List**:
1. Add a global Express error handler in `packages/server/src/index.ts` (last middleware)
2. Add 404 handler for unknown API routes
3. Ensure all route handlers use `try/catch` and `next(err)`
4. Add a simple client-side `useToast` hook or error boundary for API errors
5. Write `README.md`: prerequisites (Node 18+, npm 8+), clone instructions, `.env` setup, `npm install`, `npm run dev`, port info
6. Add `engines` field to root `package.json` specifying `node >= 18`

**Relevant Context**:
- No external toast library required — a simple fixed-position alert div component is sufficient
- The README should be the entry point for self-hosters

**Status**: [x] done

---

## Architecture Overview

```
packages/
  server/
    src/
      index.ts          # Express app entry, runs DB migration
      db.ts             # SQLite connection + schema migration
      middleware/
        authenticate.ts # JWT verification middleware
      auth/router.ts
      tasks/router.ts
      bills/router.ts
      reminders/router.ts
      habits/router.ts
      dates/router.ts
      documents/router.ts
      ai/router.ts
  client/
    src/
      App.tsx           # Route definitions
      AuthContext.tsx
      layouts/
        AppLayout.tsx   # Sidebar + main area
      components/
        Sidebar.tsx
      pages/
        LoginPage.tsx
        DashboardPage.tsx
        TasksPage.tsx
        BillsPage.tsx
        RemindersPage.tsx
        HabitsPage.tsx
        ImportantDatesPage.tsx
        DocumentsPage.tsx
      api/              # Typed fetch helpers per module
.env.example
README.md
package.json           # Root workspace
```
