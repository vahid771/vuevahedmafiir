# Google Drive Integration Plan

## Top-Level Overview

Replace the current local file storage in the Documents module with direct Google Drive storage. Users will authenticate via Google OAuth2 from the Settings page ("Connect Google Drive" button). Once connected, all document uploads go straight to a fixed folder ("Personal Life Dashboard") in the user's Drive. Downloads and deletes also operate against Drive. No local filesystem is used after this change.

**Scope:**
- New server-side OAuth2 flow (auth initiation, callback, token storage)
- New Google Drive service module (create folder, upload file, download file, delete file)
- Update documents router to use Drive instead of multer/disk
- Persist Google OAuth tokens per user in the database
- New Settings UI section: Connect / Disconnect Google Drive
- Update documents API client to pass through Drive-based operations unchanged (no client-side changes needed beyond Settings)

**Non-goals:**
- Syncing existing locally stored documents to Drive
- Choosing a custom folder name per user
- Browsing the user's entire Drive

---

## Sub-Tasks

---

### Sub-Task 1 — Store Google OAuth tokens in the database

**Intent:**
Add a `google_tokens` table to persist each user's Google OAuth access token, refresh token, and expiry. This is the persistence layer that all other sub-tasks depend on.

**Expected Outcomes:**
- A migration adds `google_tokens` table with columns: `user_id` (FK → users), `access_token`, `refresh_token`, `expiry` (ISO timestamp), `drive_folder_id` (the Drive folder ID created on first connect).
- `runMigrations()` in `db.ts` includes the new table DDL.

**Todo List:**
1. In `packages/server/src/db.ts`, append a `CREATE TABLE IF NOT EXISTS google_tokens (...)` statement to `runMigrations()`.
   - Columns: `id` INTEGER PK AUTOINCREMENT, `user_id` INTEGER UNIQUE FK → users, `access_token` TEXT, `refresh_token` TEXT, `expiry` TEXT, `drive_folder_id` TEXT, `created_at` TEXT DEFAULT datetime('now'), `updated_at` TEXT DEFAULT datetime('now').
2. Add a unique index on `user_id`.

**Relevant Context:**
- [`packages/server/src/db.ts`](packages/server/src/db.ts) — all migrations live in `runMigrations()`.

**Status:** [x] done

---

### Sub-Task 2 — Google Drive service module

**Intent:**
Encapsulate all Google API interactions in a reusable service. This avoids scattering googleapis calls across the router and keeps the Drive logic testable in isolation.

**Expected Outcomes:**
- New file `packages/server/src/google/drive.service.ts` exporting:
  - `getOAuthClient()` — returns a configured `google.auth.OAuth2` client (uses env vars `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`).
  - `getAuthUrl()` — returns the consent-screen URL with scopes `drive.file` and `drive.metadata.readonly`.
  - `exchangeCode(code)` — exchanges auth code for tokens, returns `{ access_token, refresh_token, expiry }`.
  - `getAuthedClient(tokens)` — returns a client with credentials set and auto-refresh.
  - `getOrCreateFolder(auth, folderName)` — queries Drive for a folder named `"Personal Life Dashboard"` in root, creates it if missing, returns the folder ID.
  - `uploadFile(auth, folderId, originalname, mimetype, buffer)` — uploads a file into the folder, returns the Drive file ID and web-view link.
  - `downloadFile(auth, driveFileId)` — returns a readable stream for the file.
  - `deleteFile(auth, driveFileId)` — permanently deletes a file from Drive.
- New dependency `googleapis` added to `packages/server/package.json`.

**Todo List:**
1. Add `googleapis` to server dependencies (`npm install googleapis --workspace=packages/server`).
2. Create `packages/server/src/google/` directory and `drive.service.ts`.
3. Implement each exported function as described above.
4. Add env vars `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` to `.env.example`.

**Relevant Context:**
- [`packages/server/src/documents/router.ts`](packages/server/src/documents/router.ts) — consumer of this service.
- [`packages/server/src/app.ts`](packages/server/src/app.ts) — where the new router will be mounted.

**Status:** [x] done

---

### Sub-Task 3 — Google OAuth server router

**Intent:**
Add two server endpoints that handle the OAuth2 connect flow: initiation (redirect to Google) and callback (exchange code, save tokens, redirect back to the app).

**Expected Outcomes:**
- New file `packages/server/src/google/router.ts` with:
  - `GET /api/google/connect` — requires `authenticateToken`; redirects the browser to Google's OAuth consent screen. Embeds user ID in the OAuth `state` parameter (signed/encoded) to match the callback to the right user.
  - `GET /api/google/callback` — verifies state, exchanges code via `drive.service`, calls `getOrCreateFolder` to get/create the Drive folder, upserts the tokens + folder ID into `google_tokens`, then redirects the browser to the client-side settings route (`/settings?drive=connected`).
  - `DELETE /api/google/disconnect` — requires `authenticateToken`; deletes the row from `google_tokens` for this user.
  - `GET /api/google/status` — requires `authenticateToken`; returns `{ connected: boolean }`.
- Router mounted at `/api/google` in `app.ts`.

**Todo List:**
1. Create `packages/server/src/google/router.ts`.
2. Implement `GET /api/google/connect` — build OAuth URL with user ID encoded in `state`, return a redirect.
3. Implement `GET /api/google/callback` — decode state, exchange code, upsert tokens, redirect to `/settings?drive=connected`.
4. Implement `DELETE /api/google/disconnect` — delete row from `google_tokens`.
5. Implement `GET /api/google/status` — query `google_tokens` by user ID, return `{ connected: true/false }`.
6. Mount in `packages/server/src/app.ts`.

**Relevant Context:**
- [`packages/server/src/auth/router.ts`](packages/server/src/auth/router.ts) — existing auth pattern (JWT, db calls).
- [`packages/server/src/middleware/authenticate.ts`](packages/server/src/middleware/authenticate.ts) — reuse `authenticateToken`.
- [`packages/server/src/db.ts`](packages/server/src/db.ts) — use `db.execute` for upserts.

**Status:** [x] done

---

### Sub-Task 4 — Rewrite the documents router to use Google Drive

**Intent:**
Remove multer/disk storage and replace it with Drive-backed upload, download, and delete. The `documents` database table is retained for metadata (title, tags, Drive file ID, etc.) — it no longer stores a local `filename`, it now stores a `drive_file_id`.

**Expected Outcomes:**
- `packages/server/src/documents/router.ts` updated:
  - `POST /api/documents/upload` — uses `multer.memoryStorage()` (buffer only, no disk), checks the user has a connected Drive account, calls `uploadFile()` from the Drive service, saves `drive_file_id` and `drive_view_link` to the `documents` table instead of `filename`.
  - `GET /api/documents/:id/download` — fetches `drive_file_id` from DB, calls `downloadFile()` and pipes the stream to the response.
  - `DELETE /api/documents/:id` — deletes from Drive via `deleteFile()`, then deletes the DB row.
  - `GET /api/documents` — unchanged (reads from DB).
- `documents` table schema extended (a migration) to add `drive_file_id TEXT` and `drive_view_link TEXT`; `filename` column kept but nullable to avoid breaking existing rows.
- `UPLOADS_DIR` environment variable and disk storage are no longer used by this module.

**Todo List:**
1. Add migration to `db.ts` to add `drive_file_id` and `drive_view_link` columns to `documents` table.
2. Rewrite upload handler to use `multer.memoryStorage()`, call `drive.service.uploadFile()`, save Drive IDs.
3. Rewrite download handler to look up `drive_file_id` and pipe Drive stream to response.
4. Update delete handler to call `drive.service.deleteFile()` before removing the DB row.
5. Remove all disk-path logic and `fs` imports.

**Relevant Context:**
- [`packages/server/src/documents/router.ts`](packages/server/src/documents/router.ts) — file to rewrite.
- Sub-Task 2 (drive.service.ts) must be complete first.
- Sub-Task 3 (token lookup) — fetch user tokens from `google_tokens` table inside the router.

**Status:** [x] done

---

### Sub-Task 5 — Client: Google Drive section in Settings

**Intent:**
Add a "Google Drive" card to the Settings page showing whether the user is connected, a "Connect" button (that navigates to the server-side OAuth start URL), and a "Disconnect" button. Also surface a toast/banner when the OAuth callback redirects back with `?drive=connected`.

**Expected Outcomes:**
- `packages/client/src/api/` gets a new `google.ts` module with:
  - `getGoogleDriveStatus(token)` → `{ connected: boolean }`.
  - `disconnectGoogleDrive(token)` → calls `DELETE /api/google/disconnect`.
  - `getGoogleConnectUrl()` → returns the full URL to `GET /api/google/connect` (client-side the browser navigates there directly with the auth token in the URL, OR the user is redirected via the server; see design note below).
- `packages/client/src/pages/SettingsPage.tsx` updated with a new "Google Drive" card that:
  - Fetches `/api/google/status` on mount.
  - Shows "Connected ✓" + "Disconnect" button when connected.
  - Shows "Connect Google Drive" button when not connected; clicking it does a full-page navigate to `/api/google/connect` with the JWT token as a `?token=` query param (server reads it to authenticate the connect request instead of Authorization header, since this is a browser redirect not a fetch).
  - Shows a success banner if `?drive=connected` is in the query string on mount.

> **Design note:** Because `GET /api/google/connect` is a browser redirect (not a fetch), the JWT cannot be sent as an Authorization header. The server `GET /api/google/connect` endpoint must accept a `?token=` query parameter as an alternative to the header for this one endpoint only.

**Todo List:**
1. Create `packages/client/src/api/google.ts` with `getGoogleDriveStatus`, `disconnectGoogleDrive`, `getGoogleConnectUrl`.
2. Update `packages/client/src/pages/SettingsPage.tsx`:
   - Add state for `driveConnected` and `driveLoading`.
   - Fetch status on mount.
   - Render the Google Drive card (connected state, connect button, disconnect button).
   - Read `?drive=connected` from URL on mount and show a success banner.
3. Update `GET /api/google/connect` on the server to also accept `?token=` query parameter for authentication (in addition to Authorization header).

**Relevant Context:**
- [`packages/client/src/pages/SettingsPage.tsx`](packages/client/src/pages/SettingsPage.tsx) — file to update.
- [`packages/client/src/api/documents.ts`](packages/client/src/api/documents.ts) — pattern to follow for the new API module.
- [`packages/client/src/context/AuthContext.tsx`](packages/client/src/context/AuthContext.tsx) — token is in `useAuth().token`.

**Status:** [x] done

---

### Sub-Task 6 — Configuration: env vars and .env.example

**Intent:**
Ensure all new environment variables are documented and the project is deployable without hidden config requirements.

**Expected Outcomes:**
- `.env.example` includes:
  ```
  GOOGLE_CLIENT_ID=your-google-client-id
  GOOGLE_CLIENT_SECRET=your-google-client-secret
  GOOGLE_REDIRECT_URI=http://localhost:3001/api/google/callback
  ```
- `packages/server/src/app.ts` or `index.ts` validates that these three vars are present at startup (throws if missing, consistent with existing TURSO_DATABASE_URL guard in `db.ts`).

**Todo List:**
1. Update `.env.example` to add the three Google env vars with placeholder values.
2. In `packages/server/src/google/drive.service.ts` (created in Sub-Task 2), throw a startup error if any of the three vars is missing — same pattern as `db.ts`.

**Relevant Context:**
- [`.env.example`](.env.example) — file to update.
- [`packages/server/src/db.ts`](packages/server/src/db.ts) — see how `TURSO_DATABASE_URL` is guarded with `if (!url) throw new Error(...)`.

**Status:** [x] done

---

## Implementation Order

```
Sub-Task 1 (DB migration)
  → Sub-Task 2 (Drive service)
    → Sub-Task 3 (OAuth router)
    → Sub-Task 4 (Documents router rewrite)
  → Sub-Task 5 (Settings UI)
Sub-Task 6 (Env vars) — can be done alongside Sub-Task 2
```

---

## Environment Configuration Guide

### How `GOOGLE_REDIRECT_URI` works

Google OAuth requires you to register **exact redirect URIs** in your Google Cloud Console project. The server reads `GOOGLE_REDIRECT_URI` at runtime and passes it both when building the consent URL and when exchanging the code — these two values must match exactly, or Google will reject the exchange.

### Step-by-step: Google Cloud Console setup

1. Go to [https://console.cloud.google.com/](https://console.cloud.google.com/) → **APIs & Services → Credentials**.
2. Create an **OAuth 2.0 Client ID** of type **Web application**.
3. Under **Authorized redirect URIs**, add **both** of the following:
   - `http://localhost:3001/api/google/callback` — for local dev
   - `https://<your-vercel-project>.vercel.app/api/google/callback` — for production
4. Copy the **Client ID** and **Client Secret**.

### Local development (`.env.development.local`)

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/google/callback
```

The project already has a `.env.development.local` file at the root. Add these three vars there.

### Production (Vercel dashboard)

In **Vercel → Project → Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | same client ID |
| `GOOGLE_CLIENT_SECRET` | same client secret |
| `GOOGLE_REDIRECT_URI` | `https://<your-vercel-project>.vercel.app/api/google/callback` |

Vercel injects these into the serverless function at runtime. No code change needed — only the env value differs between environments.

### OAuth scopes requested

The integration requests only the minimum scope:
- `https://www.googleapis.com/auth/drive.file` — create and manage files **created by this app only** (cannot read any other files in the user's Drive)

### Token refresh

`googleapis` handles token refresh automatically when `refresh_token` is set on the OAuth2 client. The server always calls `getAuthedClient(tokens)` before each Drive operation, which sets both tokens. Google silently refreshes the access token when it expires — no manual refresh logic is needed.
