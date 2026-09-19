# Modern Multilingual Redesign

## Overview

Full overhaul of the React client in four sequential phases:

1. **i18n** — install `react-i18next`, extract all English strings into `en.json`, provide Persian translations in `fa.json`, add a `LanguageContext` that persists the choice in `user_preferences`, apply `dir="rtl"` site-wide for Persian.
2. **Design System** — extend `tailwind.config.js` with a custom token set (color palette, radius, shadow), extract reusable `Button`, `Card`, `Input`, `Badge` primitives, and apply them across all pages and components.
3. **Dark Mode** — add Tailwind `darkMode: 'class'`, a `ThemeContext` that persists the choice, a toggle in the top bar, and `dark:` variants throughout the component tree.
4. **Animations** — install `framer-motion`, add page-transition wrapper, card entrance animations, and micro-interactions on interactive elements.

**Language approach:** Language stored as `language` column in `user_preferences` (server + DB). `LanguageContext` reads it on login, writes on change. Translation files live at `packages/client/src/i18n/en.json` and `fa.json`. Persian uses `dir="rtl"` on `<html>` or the root layout `div`.

---

## Sub-Tasks

### 1. Install i18n packages and scaffold translation infrastructure

**Intent:** Add `react-i18next` + `i18next` + `i18next-browser-languagedetector` to the client and create the translation file structure and i18n initialiser. No UI strings are moved yet — this just builds the foundation.

**Expected Outcomes:**
- `i18next`, `react-i18next`, `i18next-browser-languagedetector` installed in `packages/client`
- `packages/client/src/i18n/index.ts` — initialises i18next with the two resources
- `packages/client/src/i18n/en.json` — English translations (all keys, values = original English strings)
- `packages/client/src/i18n/fa.json` — Persian translations (all keys, values = Farsi equivalents)
- `packages/client/src/main.tsx` imports `'./i18n'` before rendering
- Translation keys are organised by page/component namespace: `common`, `nav`, `login`, `dashboard`, `tasks`, `bills`, `reminders`, `habits`, `dates`, `documents`, `settings`, `sync`

**Todo List:**
1. Run `npm install i18next react-i18next i18next-browser-languagedetector --workspace=@dashboard/client`
2. Create `packages/client/src/i18n/en.json` with all namespaced English keys
3. Create `packages/client/src/i18n/fa.json` with all namespaced Persian translations
4. Create `packages/client/src/i18n/index.ts` — init i18next with `en`/`fa` resources, `fallbackLng: 'en'`, `interpolation: { escapeValue: false }`
5. Add `import './i18n'` to `packages/client/src/main.tsx`

**Relevant Context:**
- [`packages/client/src/main.tsx`](packages/client/src/main.tsx)
- [`packages/client/package.json`](packages/client/package.json)

**Status:** [x] done

---

### 2. Add `language` preference to DB, server, and client API

**Intent:** Persist the user's chosen language (`en` / `fa`) in `user_preferences` so it survives page refresh and is available across devices.

**Expected Outcomes:**
- `language TEXT DEFAULT 'en'` column added to `user_preferences` CREATE TABLE in `db.ts`
- `GET /api/preferences` returns `language` field
- `PATCH /api/preferences` accepts and validates `language` (`en` | `fa`)
- `UserPreferences` client interface gains `language: 'en' | 'fa'`
- `updatePreferences` client function accepts `{ calendar?, language? }`

**Todo List:**
1. In [`packages/server/src/db.ts`](packages/server/src/db.ts): add `language TEXT NOT NULL DEFAULT 'en'` to `user_preferences` CREATE TABLE
2. In [`packages/server/src/preferences/router.ts`](packages/server/src/preferences/router.ts):
   - `getOrCreatePreferences`: insert default `language = 'en'` in INSERT; SELECT returns it
   - `PATCH`: accept `language` in body, validate `['en','fa']`, include in UPDATE
3. In [`packages/client/src/api/preferences.ts`](packages/client/src/api/preferences.ts):
   - Add `language: 'en' | 'fa'` to `UserPreferences` interface
   - Change `updatePreferences` data type to `{ calendar?: CalendarType; language?: 'en' | 'fa' }`

**Relevant Context:**
- [`packages/server/src/db.ts`](packages/server/src/db.ts) — line 104–110
- [`packages/server/src/preferences/router.ts`](packages/server/src/preferences/router.ts)
- [`packages/client/src/api/preferences.ts`](packages/client/src/api/preferences.ts)

**Status:** [x] done

---

### 3. Create `LanguageContext` and wire `dir` into the root layout

**Intent:** A React context that reads the user's language preference from the server, exposes `lang` and `setLang`, calls i18next `changeLanguage`, and sets `dir="rtl"` on the root layout div for Persian.

**Expected Outcomes:**
- `packages/client/src/context/LanguageContext.tsx` — `LanguageProvider` + `useLanguage` hook
- On mount (when token present): loads preference via `getPreferences`, calls `i18n.changeLanguage(lang)` and stores in state
- `setLang(lang)`: calls `updatePreferences(token, { language: lang })` + `i18n.changeLanguage(lang)` + updates state
- `App.tsx` wraps the tree with `<LanguageProvider>`
- `AppLayout.tsx` applies `dir={lang === 'fa' ? 'rtl' : 'ltr'}` to the outer div
- Login page also applies `dir` based on `i18n.language`

**Todo List:**
1. Create `packages/client/src/context/LanguageContext.tsx`
2. In [`packages/client/src/App.tsx`](packages/client/src/App.tsx): wrap with `<LanguageProvider>` inside `<AuthProvider>` but after `<CalendarProvider>` (needs token)
3. In [`packages/client/src/layouts/AppLayout.tsx`](packages/client/src/layouts/AppLayout.tsx): read `lang` from `useLanguage()`, set `dir` on root div
4. In [`packages/client/src/pages/LoginPage.tsx`](packages/client/src/pages/LoginPage.tsx): use `useTranslation` and `i18n.dir()` for dir attribute

**Relevant Context:**
- [`packages/client/src/context/CalendarContext.tsx`](packages/client/src/context/CalendarContext.tsx) — follow the same pattern
- [`packages/client/src/App.tsx`](packages/client/src/App.tsx)
- [`packages/client/src/layouts/AppLayout.tsx`](packages/client/src/layouts/AppLayout.tsx)

**Status:** [x] done

---

### 4. Replace hardcoded strings with `useTranslation` — pages

**Intent:** Replace every hardcoded English string in all page components with `t('key')` calls, working through pages one by one.

**Expected Outcomes:**
- Every page imports `useTranslation` and calls `const { t } = useTranslation()`
- All user-visible strings replaced with `t('namespace.key')` using the keys defined in sub-task 1
- Pages covered: `LoginPage`, `DashboardPage`, `TasksPage`, `BillsPage`, `RemindersPage`, `HabitsPage`, `ImportantDatesPage`, `DocumentsPage`, `SettingsPage`, `PrivacyPage`, `TermsPage`, `AuthCallbackPage`
- Language selector (two buttons: EN / فا) added to `SettingsPage` and wired to `setLang`
- Day abbreviations in `HabitsPage` (`DAYS`) come from translation keys

**Todo List:**
1. `LoginPage.tsx` — replace all strings; set `dir` from `i18n.dir()`
2. `DashboardPage.tsx` — replace all strings incl. quick-link labels
3. `TasksPage.tsx` — replace all strings incl. confirm dialogs (use `t()` in `confirm()` calls), sync button labels
4. `BillsPage.tsx` — replace all strings incl. status badges, recurrence labels, currency label
5. `RemindersPage.tsx` — replace all strings
6. `HabitsPage.tsx` — replace all strings; `DAYS` array from `t('habits.days', { returnObjects: true })`
7. `ImportantDatesPage.tsx` — replace all strings incl. relative date labels ("Today!", "Tomorrow", "in X days")
8. `DocumentsPage.tsx` — replace all strings
9. `SettingsPage.tsx` — replace all strings; add Language section with EN/FA toggle calling `setLang`
10. `PrivacyPage.tsx` + `TermsPage.tsx` + `AuthCallbackPage.tsx` — replace strings

**Relevant Context:**
- `packages/client/src/pages/` — all page files
- `packages/client/src/i18n/en.json` and `fa.json` from sub-task 1

**Status:** [x] done

---

### 5. Replace hardcoded strings with `useTranslation` — components and layout

**Intent:** Replace hardcoded strings in all shared components and the layout.

**Expected Outcomes:**
- All components use `t()` for user-visible strings
- Components covered: `Sidebar`, `AppLayout`, `SyncQueuePanel`, `TaskForm`, `BillForm`, `SubscriptionForm`, `ReminderForm`, `DateForm`, `HabitForm`
- `Sidebar` nav item labels come from `t('nav.*')` keys
- `SyncQueuePanel` status messages use `t('sync.*')`

**Todo List:**
1. `Sidebar.tsx` — replace nav label strings with `t('nav.*')`
2. `AppLayout.tsx` — replace "Life Dashboard", "Logout", aria-label
3. `SyncQueuePanel.tsx` — replace status/button strings
4. `TaskForm.tsx` — replace all labels/placeholders/options
5. `BillForm.tsx` — replace all labels/placeholders/options
6. `SubscriptionForm.tsx` — replace all labels/placeholders/options
7. `ReminderForm.tsx` — replace all labels/placeholders
8. `DateForm.tsx` — replace all labels/strings
9. `HabitForm.tsx` — replace all labels/strings

**Relevant Context:**
- `packages/client/src/components/` — all component files

**Status:** [x] done

---

### 6. Create `tailwind.config.js` with custom design tokens

**Intent:** Extend Tailwind's theme with a curated design token set: a primary brand colour, semantic surface/text tokens, custom border radius scale, and custom box shadows. This is the design system foundation that all subsequent redesign work builds on.

**Expected Outcomes:**
- `packages/client/tailwind.config.js` created (or updated) with `theme.extend` containing:
  - `colors.primary` (indigo/violet scale, e.g. `primary.500 = #6366f1`)
  - `colors.surface` (light: white/gray-50; dark variants added in sub-task 8)
  - `colors.text` (primary, secondary, muted, inverse)
  - `colors.border` (default, strong, subtle)
  - `borderRadius.card = '1rem'`, `borderRadius.btn = '0.5rem'`
  - `boxShadow.card`, `boxShadow.dropdown`
  - `fontFamily.sans` includes Vazirmatn first
- `index.css` imports Vazirmatn from Google Fonts `@import` at top; adds CSS vars for semantic tokens

**Todo List:**
1. Create/overwrite `packages/client/tailwind.config.js` with the extended theme
2. Update `packages/client/src/index.css`: add `@import` for Vazirmatn variable font; define `--color-primary` etc. CSS vars in `:root`

**Relevant Context:**
- [`packages/client/src/index.css`](packages/client/src/index.css)
- No existing `tailwind.config.js` found (will create)

**Status:** [x] done

---

### 7. Extract shared UI primitives (Button, Card, Input, Badge)

**Intent:** Create a small set of reusable React components that encode the design tokens so individual pages don't repeat Tailwind class strings. Apply them across the app.

**Expected Outcomes:**
- `packages/client/src/components/ui/Button.tsx` — variant props (`primary`, `secondary`, `danger`, `ghost`), `size` props (`sm`, `md`), loading state prop
- `packages/client/src/components/ui/Card.tsx` — standard `p-4 sm:p-6 rounded-card shadow-card bg-surface border border-border` wrapper
- `packages/client/src/components/ui/Input.tsx` — consistent label + input pattern with error state
- `packages/client/src/components/ui/Badge.tsx` — variant prop for status colours
- All form components (`TaskForm`, `BillForm`, `SubscriptionForm`, `ReminderForm`, `DateForm`, `HabitForm`) refactored to use `<Button>` and `<Input>`
- Page headers, list items, and section containers refactored to use `<Card>`
- Status badges across `BillsPage`, `RemindersPage`, `ImportantDatesPage` use `<Badge>`

**Todo List:**
1. Create `packages/client/src/components/ui/` directory with `Button.tsx`, `Card.tsx`, `Input.tsx`, `Badge.tsx`
2. Update all form components to use `<Button>` and `<Input>`
3. Update `BillsPage`, `TasksPage`, `RemindersPage`, `HabitsPage`, `ImportantDatesPage`, `DocumentsPage`, `SettingsPage`, `DashboardPage` to use `<Card>` for section wrappers
4. Replace inline badge `span`s with `<Badge>` across pages

**Relevant Context:**
- `packages/client/src/components/bills/`, `tasks/`, etc. — form files to update

**Status:** [x] done

---

### 8. Dark mode — ThemeContext, Tailwind config, and `dark:` variants

**Intent:** Add dark mode support with a `ThemeContext` that persists the `theme` choice (`light` | `dark`) in localStorage, a toggle button in the top bar, and `dark:` Tailwind variants on all surfaces.

**Expected Outcomes:**
- `packages/client/src/context/ThemeContext.tsx` — `ThemeProvider` + `useTheme`; applies `dark` class to `<html>` when active; persists in `localStorage`
- Tailwind config has `darkMode: 'class'`
- Top bar in `AppLayout` gains a sun/moon toggle button wired to `useTheme`
- All `bg-white`, `bg-gray-50`, `bg-gray-900` etc. get `dark:` counterparts across every page and component
- `index.css` `:root` defines light-mode CSS vars; `html.dark` block defines dark overrides

**Todo List:**
1. Create `packages/client/src/context/ThemeContext.tsx`
2. Wrap `App.tsx` with `<ThemeProvider>`
3. Update `tailwind.config.js`: add `darkMode: 'class'`
4. Add theme toggle button to `AppLayout.tsx` top bar
5. Add `dark:` variants to: `AppLayout`, `Sidebar`, `SyncQueuePanel`, all page containers and cards, all form components, `LoginPage`
6. Update `index.css` with `html.dark` CSS var overrides

**Relevant Context:**
- [`packages/client/src/layouts/AppLayout.tsx`](packages/client/src/layouts/AppLayout.tsx)
- [`packages/client/src/context/`](packages/client/src/context/)

**Status:** [x] done

---

### 9. Animations with framer-motion

**Intent:** Add tasteful motion: page-entry fade+slide transitions, list-item staggered entrances on the habit and task lists, and micro-interactions (scale on button press, smooth accordion for the suggestions panel).

**Expected Outcomes:**
- `framer-motion` installed in `packages/client`
- `packages/client/src/components/PageTransition.tsx` — wraps `<Outlet>` with `AnimatePresence` + `motion.div` fade-slide
- `AppLayout` uses `<PageTransition>` instead of bare `<Outlet>`
- Habit cards and task rows use `motion.li` with `initial/animate/exit` variants and `staggerChildren` on the parent list
- `Button` component adds `whileHover={{ scale: 1.02 }}` + `whileTap={{ scale: 0.97 }}`
- The "Suggested Habits" collapsible section uses `motion.div` with `AnimatePresence` for smooth height animation
- No animation on elements that users interact with repeatedly (toggles, checkboxes) — only entrance/exit and press

**Todo List:**
1. Run `npm install framer-motion --workspace=@dashboard/client`
2. Create `packages/client/src/components/PageTransition.tsx`
3. Update `AppLayout.tsx` to use `<PageTransition>`
4. Add staggered `motion.li` to `HabitsPage` habit list and `TasksPage` task rows
5. Add `whileHover`/`whileTap` to `Button.tsx` component
6. Replace the `{suggestionsOpen && ...}` in `HabitsPage` with `AnimatePresence` + `motion.div`

**Relevant Context:**
- [`packages/client/src/layouts/AppLayout.tsx`](packages/client/src/layouts/AppLayout.tsx)
- [`packages/client/src/pages/HabitsPage.tsx`](packages/client/src/pages/HabitsPage.tsx)
- [`packages/client/src/pages/TasksPage.tsx`](packages/client/src/pages/TasksPage.tsx)
- [`packages/client/src/components/ui/Button.tsx`](packages/client/src/components/ui/Button.tsx) (created in sub-task 7)

**Status:** [x] done
