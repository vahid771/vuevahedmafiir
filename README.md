# Personal Life Dashboard

A self-hostable, full-stack personal organizer. One app for tasks, bills, subscriptions, documents, reminders, habits, and important dates — with an on-demand AI weekly summary powered by GPT-4o-mini.

## Features

- **Tasks** — Create, prioritize, and track tasks with due dates
- **Bills & Subscriptions** — Track one-off bills and recurring subscriptions; highlight upcoming due dates
- **Reminders** — Time-stamped reminders with overdue detection
- **Habits** — Daily/weekly habit tracking with a weekly grid and streak counter
- **Important Dates** — Birthdays, anniversaries, and other yearly events with a 30-day lookahead
- **Documents** — Upload and tag files (PDF, images, etc.) up to 50 MB
- **AI Summary** — On-demand "Summarize my week" button that asks GPT-4o-mini what needs your attention
- **Multi-user** — JWT authentication; each user's data is fully isolated

## Prerequisites

- **Node.js 18+** and **npm 8+**
- An **OpenAI API key** (for the AI summary feature)

## Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd personal-life-dashboard
```

### 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3001                          # Server port
JWT_SECRET=change_this_to_a_long_random_string
OPENAI_API_KEY=sk-...              # Your OpenAI API key
DATABASE_PATH=./data/dashboard.db  # SQLite database path
UPLOADS_DIR=./uploads              # Directory for uploaded files
```

> **Tip:** Generate a strong JWT secret with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### 3. Install dependencies

```bash
npm install
```

This installs all workspace dependencies for both `packages/server` and `packages/client`.

### 4. Run in development mode

```bash
npm run dev
```

This starts both the server and the client concurrently:
- **Server**: `http://localhost:3001` (or your configured `PORT`)
- **Client**: `http://localhost:5173` (Vite dev server, proxies `/api` to the server)

Open `http://localhost:5173` in your browser, register an account, and start using the dashboard.

## Project Structure

```
packages/
  server/
    src/
      index.ts          # Express entry point, mounts all routers
      db.ts             # SQLite connection + schema migrations
      middleware/
        authenticate.ts # JWT verification middleware
      auth/router.ts    # POST /api/auth/register, /api/auth/login
      tasks/router.ts
      bills/router.ts   # Bills + subscriptions
      reminders/router.ts
      habits/router.ts  # Includes log/unlog + streak
      dates/router.ts
      documents/router.ts
      ai/router.ts      # POST /api/ai/summary
  client/
    src/
      App.tsx           # Routes
      context/AuthContext.tsx
      layouts/AppLayout.tsx
      components/Sidebar.tsx
      pages/            # One page per module
      api/              # Typed fetch helpers per module
.env.example
package.json            # Root npm workspace
```

## API Overview

All routes under `/api/*` (except `/api/auth/*`) require an `Authorization: Bearer <token>` header.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, receive JWT |
| GET/POST/PATCH/DELETE | `/api/tasks` | Tasks CRUD |
| GET/POST/PATCH/DELETE | `/api/bills` | Bills CRUD |
| GET/POST/PATCH/DELETE | `/api/subscriptions` | Subscriptions CRUD |
| GET/POST/PATCH/DELETE | `/api/reminders` | Reminders CRUD |
| GET/POST/PATCH/DELETE | `/api/habits` | Habits CRUD |
| POST/DELETE | `/api/habits/:id/log` | Log/unlog habit for today |
| GET/POST/PATCH/DELETE | `/api/dates` | Important dates CRUD |
| GET | `/api/documents` | List documents |
| POST | `/api/documents/upload` | Upload a file (multipart) |
| GET | `/api/documents/:id/download` | Download a file |
| DELETE | `/api/documents/:id` | Delete a document |
| POST | `/api/ai/summary` | Generate AI weekly summary |

## Production Build

```bash
# Build server
cd packages/server && npx tsc

# Build client
cd packages/client && npx vite build
```

Serve the client `dist/` with a static file server or configure Express to serve it.

## Notes

- The SQLite database and uploads directory are created automatically on first run
- All user data is row-level isolated by `user_id`
- The AI summary feature requires a valid `OPENAI_API_KEY`; the rest of the app works without it
