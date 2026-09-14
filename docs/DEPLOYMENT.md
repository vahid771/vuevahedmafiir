# Deployment Guide

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite (TypeScript) |
| Backend | Express (TypeScript) |
| Database | Turso (libSQL / SQLite) |
| Hosting | Vercel (static frontend + serverless API) |

---

## Architecture on Vercel

Vercel serves **two things** from this monorepo:

1. **Static frontend** — built from `packages/client/` → output at `packages/client/dist/`
2. **Serverless API** — `api/index.js` handles all `/api/*` requests

The Express app is **not** deployed as a long-running server. Instead, it is bundled into
a self-contained file by `esbuild` and run as a Vercel serverless function on every request.

```
/api/index.js       ← Vercel serverless entry point
/api/app.js         ← esbuild bundle of packages/server/src/app.ts (ALL deps inlined)
/api/db.js          ← esbuild bundle of packages/server/src/db.ts  (ALL deps inlined)
```

> **Critical:** `api/app.js` and `api/db.js` must be fully self-contained bundles with
> **no external dependencies**. Vercel's Node File Tracer cannot resolve packages from the
> workspace `node_modules` when bundling `api/`. The esbuild step inlines everything.

---

## Environment Variables

Set these in the Vercel dashboard under **Settings → Environment Variables** for the
**Production** (and optionally Preview) environment:

| Variable | Where to get it |
|---|---|
| `TURSO_DATABASE_URL` | Turso dashboard → your database → Connect |
| `TURSO_AUTH_TOKEN` | Turso dashboard → your database → Connect |
| `JWT_SECRET` | Any long random string (e.g. `openssl rand -hex 32`) |
| `GROQ_API_KEY` | console.groq.com |
| `UPLOADS_DIR` | Set to `/tmp/uploads` (Vercel only allows writes to `/tmp`) |

For **local development**, these vars live in `.env` (gitignored) at the project root.
`.env.development.local` (also gitignored) can override them — it is loaded second with
`override: true` in `packages/server/src/index.ts`.

---

## Build Process

The root `package.json` `build` script runs three steps in order:

```
npm run build --workspace=packages/server
  → tsc: compiles packages/server/src/ → packages/server/dist/

npx esbuild packages/server/src/app.ts packages/server/src/db.ts \
  --bundle --platform=node --target=node18 --outdir=api --format=cjs
  → produces api/app.js and api/db.js (fully self-contained, ~2MB each)

npm run build --workspace=packages/client
  → tsc + vite build → packages/client/dist/
```

`vercel.json` sets `"buildCommand": "npm run build"` which triggers all three steps.

---

## How to Deploy

### Production deploy

```bash
vercel --prod
```

This builds, uploads, and aliases to `www.vahedmafi.ir`.

### Preview deploy (for testing before going live)

```bash
vercel
```

---

## Routing (vercel.json)

```json
{ "source": "/api/:path*", "destination": "/api/index" }   ← all API calls → serverless fn
{ "source": "/(.*)",        "destination": "/index.html"  }   ← SPA catch-all
```

---

## Local Development

```bash
npm run dev
```

Starts both `packages/server` (nodemon, port 3001) and `packages/client` (Vite, port 5173)
concurrently. The Vite dev server proxies `/api/*` → `http://localhost:3001`.

---

## Database Migrations

Migrations run automatically on every **cold start** of the serverless function (`api/index.js`
calls `runMigrations()` before the first request). All `CREATE TABLE IF NOT EXISTS` and
`CREATE INDEX IF NOT EXISTS` — fully idempotent. No migration tool needed.

---

## Key Gotchas

- **`api/app.js` and `api/db.js` are generated files** — never edit them manually. They are
  regenerated on every build by the esbuild step. They are committed to git only so that
  local builds don't need to run the full build before deploying.

- **File uploads** (`/api/documents/upload`) write to `/tmp/uploads` on Vercel. Files are
  ephemeral — they are lost when the function container is recycled. For persistent document
  storage, replace the local `multer` disk storage with an object store (e.g. S3/R2).

- **`bcrypt` → `bcryptjs`** — the original `bcrypt` package uses a native C++ addon that
  cannot be compiled for Vercel's Linux sandbox from a Windows build machine. `bcryptjs` is
  a pure-JS drop-in replacement.

- **`better-sqlite3` removed** — replaced with `@libsql/client` (Turso). The old local
  SQLite file at `./data/dashboard.db` is no longer used in any environment.
