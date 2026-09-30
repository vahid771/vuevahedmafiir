# Remember Me / Persistent Login Plan

## Overview

Add opt-in persistent login via a "Remember me" checkbox on the login form
and a dedicated `/auth/remember` confirmation page for Google OAuth users.

- When the user opts **in**: token + user are stored in `localStorage` (current behaviour).
- When the user opts **out**: token + user are stored in `sessionStorage` (cleared on tab/browser close).
- Existing `localStorage` sessions are treated as "remembered" — no disruption.

The decision is passed through `AuthContext` as a `remember` flag on the `login()` call.
A small `sessionStorage` sentinel key (`dashboard_persist`) signals which storage
backend is active after a page reload, so `AuthContext` can read from the right store on init.

---

## Sub-Tasks

---

### Sub-Task 1 — Update `AuthContext` to support dual-storage login

**Intent**  
`AuthContext` must accept a `remember` boolean on `login()`, write to the
correct storage backend, and on init read from whichever backend holds the
existing session.  Existing `localStorage` data is kept as-is (backward
compatibility).

**Expected Outcomes**
- `login(token, user, remember)` saves to `localStorage` when `remember === true`,
  `sessionStorage` otherwise.
- On cold load, `AuthContext` checks `localStorage` first then `sessionStorage`
  for an existing token/user (so existing sessions survive).
- `logout()` clears both storages.
- `AuthContextValue` exposes `login(token, user, remember: boolean)`.

**Todo List**
1. Add helper `getStorage(remember: boolean)` returning `localStorage` or `sessionStorage`.
2. Change init of `token`/`user` state to check `localStorage` first, then `sessionStorage`.
3. Update `login()` signature to accept `remember: boolean`, write to the chosen store.
4. Update the `useEffect` that persists on change to use the same chosen store (store
   which storage was chosen in a `sessionStorage` sentinel key `dashboard_persist`
   so it survives page reload but not full browser close when remember=false).
5. Update `logout()` to clear both `localStorage` and `sessionStorage` for all keys.
6. Update the `AuthContextValue` TypeScript interface accordingly.

**Relevant Context**
- `packages/client/src/context/AuthContext.tsx` — full file, ~76 lines
- Keys: `dashboard_token`, `dashboard_user`

**Status**: [ ] pending

---

### Sub-Task 2 — Add "Remember me" checkbox to `LoginPage` (email/password flow)

**Intent**  
Let users who log in with email/password choose whether to persist their session.
The checkbox state is passed to `auth.login()` as the `remember` flag.

**Expected Outcomes**
- A "Remember me" checkbox appears below the password field, defaulting to unchecked.
- On successful login, `auth.login(result.token, result.user, rememberMe)` is called.
- The checkbox is only shown in `login` mode (not `register` mode).
- Checkbox label is translated via `t('login.rememberMe')`.

**Todo List**
1. Add `rememberMe` boolean state (default `false`) to `LoginPage`.
2. Render the checkbox (with label) below the password field, visible only when `mode === 'login'`.
3. Pass `rememberMe` as the third argument to `auth.login(...)` in `handleSubmit`.
4. Add `login.rememberMe` key to all i18n JSON files (`en`, `ar`, `de`, `es`, `fa`, `fr`, `hi`, `id`, `pt`, `ru`, `tr`, `zh`).

**Relevant Context**
- `packages/client/src/pages/LoginPage.tsx` — full file
- `packages/client/src/i18n/en.json` lines 29-42 (login namespace)
- All other locale files under `packages/client/src/i18n/`

**Status**: [ ] pending

---

### Sub-Task 3 — Create `RememberMePage` for the Google OAuth flow

**Intent**  
After Google OAuth completes, instead of immediately calling `login()` and
navigating to `/dashboard`, the callback redirects to a new dedicated page
`/auth/remember` that carries the token and encoded user in state.  The user
sees two buttons: "Stay logged in" (remember=true) and "Not now" (remember=false).
Pressing either stores the session and navigates to `/dashboard`.

**Expected Outcomes**
- New page `packages/client/src/pages/RememberMePage.tsx` at route `/auth/remember`.
- Page receives `{ token, encodedUser }` via `useLocation().state` (passed from `AuthCallbackPage`).
- If state is missing (e.g. direct navigation), redirect to `/login`.
- Two buttons call `auth.login(token, user, true/false)` then navigate to `/dashboard`.
- Page is styled consistently with `AuthCallbackPage` (centered card).
- Translated strings: `auth.stayLoggedIn`, `auth.notNow`, `auth.rememberTitle`, `auth.rememberSubtitle`.

**Todo List**
1. Create `packages/client/src/pages/RememberMePage.tsx`.
2. Register route `/auth/remember` in `App.tsx` (public route, alongside `/auth/callback`).
3. Update `AuthCallbackPage` to navigate to `/auth/remember` with state instead of
   calling `login()` and navigating to `/dashboard` directly.
4. Add translated keys to all i18n locale files.

**Relevant Context**
- `packages/client/src/pages/AuthCallbackPage.tsx` — full file, to be updated
- `packages/client/src/App.tsx` lines 38-42 (route definitions)
- `packages/client/src/i18n/en.json` lines 445-447 (auth namespace)

**Status**: [ ] pending

---

## Notes

- No server-side changes required — the "remember me" choice is purely a client-side
  storage concern. The JWT token itself does not change.
- Sub-Tasks 2 and 3 depend on Sub-Task 1 completing first (updated `login()` signature).
- Sub-Tasks 2 and 3 can be implemented in parallel once Sub-Task 1 is done.
- The `dashboard_persist` sentinel is written to `sessionStorage` in both cases so it
  survives page refresh but is cleared when the browser is closed (for the
  remember=false case, the session data also lives in `sessionStorage`, so both are
  naturally cleaned up together).
