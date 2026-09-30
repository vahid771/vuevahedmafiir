# Admin Sky Scene Sandbox Plan

## Overview

Add a **Sky Scene** tab to the existing Admin Dashboard page that lets admins interactively
preview any combination of season + sky phase (time of day) live, without affecting their own
dashboard. This is a pure client-side visual sandbox — no server or database changes are needed.

The sky scene is already rendered by `DashboardSkyScene` which accepts a plain `SkyScene` prop.
We just need to build a synthetic `SkyScene` object from the admin's chosen parameters and pass
it straight to that component. All the rendering logic is already written and reusable.

**Scope:** Client-only. One new component file + changes to `AdminDashboardPage.tsx`.

---

## Sub-Tasks

---

### Sub-Task 1 — Add the Sky Scene Sandbox Component

**Intent**
Create a self-contained `SkySceneSandbox` component that renders:
- A season selector (spring / summer / autumn / winter) as segmented button group
- A sky phase selector (night / dawn / morning / midday / afternoon / dusk) as segmented button group
- A Southern Hemisphere toggle (checkbox/switch)
- A live preview of `DashboardSkyScene` driven by the chosen parameters

The component builds a synthetic `SkyScene` from the selected parameters using the same helpers
already in `skyScene.ts` (`getCelestialPosition`, `getMoonPhase`, `getSkyPhase`). The `hourAngle`
is derived by mapping the selected phase to a representative hour so celestial body position and
visual rendering are consistent.

**Sky Phase → Representative Hour mapping** (used only for sun/moon position):
- night → 2, dawn → 6, morning → 8, midday → 13, afternoon → 17, dusk → 20

**Expected Outcomes**
- Selecting any season changes ground colour, tree colours, and canopy colour in the preview
- Selecting any sky phase changes sky gradient, stars visibility, sun/moon position and type
- Toggling Southern Hemisphere flips seasons (visual label unchanged — admin explicitly chose it)
  and flips the moon lit-side rendering
- Preview is a full-width `DashboardSkyScene` render inside the sandbox card
- No clock overlay interference — the preview uses a fake/static timezone so the clock text is not
  the focus; the component should pass `loading={false}` and the real `scene` prop

**Todo List**
1. Create `packages/client/src/components/SkySceneSandbox.tsx`
2. Import `DashboardSkyScene` (default import), types `Season`, `SkyPhase`, `SkyScene` from
   `../utils/skyScene`, and helpers `getCelestialPosition`, `getMoonPhase`, `getSkyPhase`
3. Define the `PHASE_HOUR` constant map (`SkyPhase` → representative hour number)
4. Define `buildScene(season, phase, southern): SkyScene` — constructs the full SkyScene object
   using the representative hour, `getCelestialPosition`, `getMoonPhase(new Date())`, and the
   provided season/phase/southern values directly
5. Render two segmented button groups (Season, Sky Phase) + a Southern Hemisphere toggle switch
6. Render `<DashboardSkyScene scene={buildScene(...)} />` below the controls
7. Style controls to match the existing admin panel aesthetic (same Tailwind classes as
   `AdminDashboardPage` filter buttons: `rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5` pill groups)

**Relevant Context**
- `packages/client/src/components/DashboardSkyScene.tsx` — line 306: `interface Props { scene: SkyScene; loading?: boolean }`; line 465: `export default memo(DashboardSkyScene)`
- `packages/client/src/utils/skyScene.ts` — all pure helpers + `SkyScene` / `Season` / `SkyPhase` types
- `packages/client/src/pages/AdminDashboardPage.tsx` — lines 282–287: existing `tabClass` / filter button style patterns to reuse

**Status:** [x] done

---

### Sub-Task 2 — Wire the Sandbox into AdminDashboardPage

**Intent**
Add a third tab **"🌤 Sky Scene"** to the existing admin tab bar and render `SkySceneSandbox`
when it is active. No other tabs are changed.

**Expected Outcomes**
- Three tabs in the admin panel: Images | Users | Sky Scene
- Sky Scene tab renders `SkySceneSandbox` inside the same padded card wrapper used by the Users tab
- Selecting the Sky Scene tab does not disturb image or user tab state

**Todo List**
1. In `AdminDashboardPage.tsx`, extend the `Tab` type to `'images' | 'users' | 'sky'`
2. Import `SkySceneSandbox` from `../components/SkySceneSandbox`
3. Add a third `<button>` in the tab bar for `'sky'` (emoji 🌤, label `"Sky Scene"`)
4. Add a conditional render block for `tab === 'sky'` that renders
   `<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"><SkySceneSandbox /></div>`

**Relevant Context**
- `packages/client/src/pages/AdminDashboardPage.tsx` — lines 234, 282–314: tab type, tabClass helper, tab bar
- `packages/client/src/pages/AdminDashboardPage.tsx` — lines 386–391: Users tab wrapper pattern to copy

**Status:** [x] done

---

## Notes for Implementation

- `DashboardSkyScene` internally uses `useCalendar()` only for the live clock display portion.
  The sky rendering itself is fully driven by the `scene` prop, so the preview will look exactly
  like it does on the real dashboard.
- No i18n keys need to be added — the season and phase labels can be plain English strings
  (same as the existing `SEASON_LABEL` / `PHASE_LABEL` constants already defined inside
  `DashboardSkyScene.tsx` — these can be duplicated locally or re-exported if preferred).
- No server routes, database schema, or API client changes are needed.
