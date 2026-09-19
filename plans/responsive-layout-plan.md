# Full Responsive Layout

## Overview

The app currently has a fixed desktop sidebar (224px wide) that takes too much space on mobile, no mobile padding on several page containers, a fixed-width `SyncQueuePanel` that overflows on narrow screens, and a few two-column form layouts that squeeze too small. The approach is mobile-first: on small screens the sidebar collapses to hidden and a hamburger in the top bar opens it as an overlay drawer. All other fixes are Tailwind class additions.

No new components are needed — `AppLayout`, `Sidebar`, `SyncQueuePanel`, and the three missing-padding pages are the only files that need material changes.

---

## Sub-Tasks

### 1. Mobile sidebar — overlay drawer below `md`, persistent rail/full above

**Intent:** On mobile (`< md = 768px`) the sidebar is hidden by default and slides in as an overlay drawer when the hamburger is tapped. On desktop (`md+`) it behaves as today (toggle between full `w-56` and icon-only `w-14`). This is the single most impactful responsiveness change.

**Expected Outcomes:**
- On mobile: sidebar is off-screen by default; hamburger in top bar toggles a full-width overlay drawer with a dark backdrop
- Tapping a nav link or the backdrop closes the drawer on mobile
- On `md+`: sidebar is always visible; hamburger collapses it to icon-only (`w-14`) as it does today
- The `aside` element uses `fixed inset-y-0 left-0 z-40` positioning on mobile (translated off-screen when closed)
- A semi-transparent backdrop `div` is shown on mobile when the drawer is open
- `collapsed` state in `AppLayout` is reused as the desktop collapse toggle; a separate `mobileOpen` state drives the drawer

**Todo List:**
1. In [`packages/client/src/layouts/AppLayout.tsx`](packages/client/src/layouts/AppLayout.tsx):
   - Add `mobileOpen` state (boolean, default false)
   - Pass `mobileOpen` and `onClose` callback to `Sidebar`
   - Toggle `mobileOpen` on hamburger click on mobile; keep `collapsed` toggle for desktop
   - Render a backdrop `div` (`md:hidden fixed inset-0 bg-black/40 z-30`) when `mobileOpen` is true; clicking it calls `onClose`
   - Main content area: add `md:ml-0` (no offset needed since sidebar is fixed on mobile)
2. In [`packages/client/src/components/Sidebar.tsx`](packages/client/src/components/Sidebar.tsx):
   - Accept `mobileOpen: boolean` and `onClose: () => void` props
   - Add mobile positioning classes to the `<nav>`:  
     `fixed inset-y-0 left-0 z-40 md:relative md:inset-auto md:z-auto`  
     `transition-transform md:transition-none`  
     `${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`
   - On each `NavLink` click: call `onClose()` (so tapping a link closes the drawer on mobile)
   - Width: `w-64 md:w-56` when expanded, `md:w-14` when collapsed (desktop only)

**Relevant Context:**
- [`packages/client/src/layouts/AppLayout.tsx`](packages/client/src/layouts/AppLayout.tsx)
- [`packages/client/src/components/Sidebar.tsx`](packages/client/src/components/Sidebar.tsx)

**Status:** [x] done

---

### 2. Fix missing mobile padding on page containers + responsive main content padding

**Intent:** Three pages (`TasksPage`, `BillsPage`, `SettingsPage`) use `max-w-2xl mx-auto` without `px-4`, so content touches the screen edge on mobile. The `AppLayout` main content uses `p-6` which is too generous on mobile.

**Expected Outcomes:**
- `AppLayout` main uses `p-3 sm:p-6` instead of `p-6`
- `TasksPage`, `BillsPage`, `SettingsPage` containers add `px-4` (and `py-6` where missing)

**Todo List:**
1. In [`packages/client/src/layouts/AppLayout.tsx`](packages/client/src/layouts/AppLayout.tsx): change `p-6` → `p-3 sm:p-6` on `<main>`
2. In [`packages/client/src/pages/TasksPage.tsx`](packages/client/src/pages/TasksPage.tsx): change `max-w-2xl mx-auto space-y-4` → `max-w-2xl mx-auto space-y-4 px-4 py-4`
3. In [`packages/client/src/pages/BillsPage.tsx`](packages/client/src/pages/BillsPage.tsx): change `max-w-2xl mx-auto space-y-6` → `max-w-2xl mx-auto space-y-6 px-4 py-4`
4. In [`packages/client/src/pages/SettingsPage.tsx`](packages/client/src/pages/SettingsPage.tsx): change `max-w-2xl mx-auto space-y-6` → `max-w-2xl mx-auto space-y-6 px-4 py-4`

**Relevant Context:**
- [`packages/client/src/layouts/AppLayout.tsx`](packages/client/src/layouts/AppLayout.tsx) — line 58
- [`packages/client/src/pages/TasksPage.tsx`](packages/client/src/pages/TasksPage.tsx) — line 401
- [`packages/client/src/pages/BillsPage.tsx`](packages/client/src/pages/BillsPage.tsx) — line 547
- [`packages/client/src/pages/SettingsPage.tsx`](packages/client/src/pages/SettingsPage.tsx) — line 178

**Status:** [x] done

---

### 3. Fix `SyncQueuePanel` fixed width overflow on mobile

**Intent:** The panel is `w-72` (288px) which overflows on screens narrower than ~320px. On mobile it should stretch to fill available width with a safe margin.

**Expected Outcomes:**
- Panel uses `w-[calc(100vw-2rem)] sm:w-72` so it stays within the viewport on all screen sizes
- Position remains `fixed bottom-4 right-4`

**Todo List:**
1. In [`packages/client/src/components/SyncQueuePanel.tsx`](packages/client/src/components/SyncQueuePanel.tsx): change `w-72` → `w-[calc(100vw-2rem)] sm:w-72` on the outer `div`

**Relevant Context:**
- [`packages/client/src/components/SyncQueuePanel.tsx`](packages/client/src/components/SyncQueuePanel.tsx) — line 82

**Status:** [x] done

---

### 4. Responsive page headers — stack on mobile

**Intent:** Several pages have `flex items-center justify-between` headers with title + button(s) that squeeze at narrow widths. They should stack vertically on mobile.

**Expected Outcomes:**
- `TasksPage` header stacks title and sync buttons on small screens (`flex-col sm:flex-row`)
- `BillsPage` header (if present) is similarly treated
- All page headers with multiple buttons use `flex-wrap gap-2` or `flex-col sm:flex-row`

**Todo List:**
1. In [`packages/client/src/pages/TasksPage.tsx`](packages/client/src/pages/TasksPage.tsx) — header `div` (line 403): change `flex items-center justify-between` → `flex flex-wrap items-center justify-between gap-2`
2. Read `BillsPage.tsx` header area fully to identify whether a similar change is needed; apply if so
3. Read `RemindersPage.tsx` header (line 170) — already has `px-4`, confirm header buttons don't need stacking
4. No change needed for pages whose headers only have a single button (HabitsPage, ImportantDatesPage, DocumentsPage — these are fine)

**Relevant Context:**
- [`packages/client/src/pages/TasksPage.tsx`](packages/client/src/pages/TasksPage.tsx) — line 403
- [`packages/client/src/pages/BillsPage.tsx`](packages/client/src/pages/BillsPage.tsx) — header section

**Status:** [x] done

---

### 5. Responsive TaskForm — stack due-date and priority fields on mobile

**Intent:** The `TaskForm` has a `flex gap-3` row with two `flex-1` children (Due Date + Priority) that squeeze to under 150px each on narrow screens. They should stack on mobile.

**Expected Outcomes:**
- Due Date and Priority fields are full-width stacked on mobile, side-by-side on `sm+`
- Uses `flex flex-col sm:flex-row gap-3`

**Todo List:**
1. In [`packages/client/src/components/tasks/TaskForm.tsx`](packages/client/src/components/tasks/TaskForm.tsx) — line 56: change `flex gap-3` → `flex flex-col sm:flex-row gap-3`

**Relevant Context:**
- [`packages/client/src/components/tasks/TaskForm.tsx`](packages/client/src/components/tasks/TaskForm.tsx) — line 56

**Status:** [x] done
