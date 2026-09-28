# World Map Country Picker Plan

## Overview

Replace the plain `<select>` dropdown in the Location Settings page with an interactive SVG world map built on `react-simple-maps`. The user first sees the full world with continents as clickable zones; clicking a continent zooms smoothly into that region showing individual countries as selectable shapes. Clicking a country selects it, saves it via the existing `setCountry()` API, and highlights it on the map.

The existing `<select>` dropdown and "Detect Location" button remain as fallback options below the map.

**Library**: `react-simple-maps` + `d3-zoom` (peer dep, already pulled in by most bundlers). No external tile servers, no API keys, works offline.

---

## Sub-Tasks

---

### Sub-Task 1 — Install react-simple-maps

**Intent**
Add the `react-simple-maps` package (and its `@types` if needed) to the client.

**Expected Outcomes**
- `react-simple-maps` appears in `packages/client/package.json` dependencies.
- `npx tsc --noEmit` still passes after install.

**Todo List**
1. In `packages/client/`, run `npm install react-simple-maps`.
2. Check if `@types/react-simple-maps` is needed (the package ships its own types since v3 — skip if types are bundled).
3. Run `npx tsc --noEmit` to confirm no new errors.

**Relevant Context**
- `packages/client/package.json` — current deps list; no map library present.

**Status**: [x] done

---

### Sub-Task 2 — Define continent bounding boxes and country→continent map

**Intent**
Create a static data file that maps every country ISO code to its continent, and defines the zoom viewport (center + zoom scale) for each continent. This drives the two-level zoom behaviour (world → continent).

**Expected Outcomes**
- A new file `packages/client/src/utils/continents.ts` exports:
  - `COUNTRY_TO_CONTINENT: Record<string, Continent>` — maps each of the 65 supported country codes to one of 7 continents.
  - `CONTINENT_VIEWPORTS: Record<Continent, { center: [number, number]; zoom: number }>` — lon/lat center + zoom scale for each continent's bounding box.
  - `Continent` type — `'africa' | 'asia' | 'europe' | 'north-america' | 'south-america' | 'oceania' | 'middle-east'`.
  - `CONTINENT_LABELS: Record<Continent, string>` — English display names.

**Todo List**
1. Create `packages/client/src/utils/continents.ts`.
2. Define the `Continent` union type.
3. Map all 65 `COUNTRY_CODES` from `CalendarSettingsPage.tsx` to their continent (Middle East = IR, IQ, JO, KW, SA, AE, QA, OM, PS, YE, BH — treat as separate from Asia for better zoom).
4. Define `CONTINENT_VIEWPORTS` with sensible `[lon, lat]` centers and zoom values (e.g. Europe: center `[15, 52]` zoom `4`, Middle East: center `[45, 26]` zoom `4`, Asia: center `[100, 35]` zoom `2.5`).

**Relevant Context**
- `COUNTRY_CODES` list in `packages/client/src/pages/settings/CalendarSettingsPage.tsx` (line 8–14) — these are the only 65 countries that need to be mapped.

**Status**: [x] done

---

### Sub-Task 3 — Build the WorldMapPicker component

**Intent**
Create a self-contained `WorldMapPicker` React component that renders the two-level interactive map: world view with continent highlights → zoomed continent view with individual country shapes.

**Expected Outcomes**
- New file `packages/client/src/components/WorldMapPicker.tsx`.
- **World view**: full globe SVG; each country shape coloured by continent; hovering a continent highlights it; clicking a continent transitions to that continent's zoom level.
- **Continent view**: map zoomed to the selected continent's viewport; country shapes for that continent are individually hoverable and clickable; non-continent countries are shown dimmed; clicking a country calls `onSelect(countryCode)`.
- **Back button**: shown in continent view, returns to world view.
- **Selected country**: the currently-selected country code (passed as a prop) is always highlighted in blue regardless of zoom level.
- **Hover tooltip**: floating label showing the hovered country's display name (via `Intl.DisplayNames`).
- Smooth zoom transition using `react-simple-maps`' built-in `MapChart` + `ZoomableGroup` or by animating the `center`/`zoom` props with `framer-motion`.
- Props interface: `{ selected: string | null; onSelect: (code: string) => void; lang: string }`.

**Todo List**
1. Create `packages/client/src/components/WorldMapPicker.tsx`.
2. Import `ComposableMap`, `Geographies`, `Geography`, `ZoomableGroup` from `react-simple-maps`.
3. Use the public Natural Earth 110m GeoJSON from the `react-simple-maps` CDN URL (`https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json`) — this is the standard approach and works offline once cached.
4. Add `continentView: Continent | null` state — `null` = world view.
5. In world view: colour each country by its continent using `COUNTRY_TO_CONTINENT`; handle `onClick` on continent group to set `continentView`.
6. In continent view: render the same map but animate `center` and `zoom` to `CONTINENT_VIEWPORTS[continentView]`; style countries in the selected continent as interactive, others as dimmed. Clicking a country in `COUNTRY_CODES` calls `onSelect`.
7. Add hover state for tooltip — show country name near the cursor using a small absolutely-positioned `<div>`.
8. Highlight `selected` country in blue always.
9. Add a "← Back to world" button (top-left of the map container) visible in continent view.
10. Use `framer-motion` (already installed) to animate the `center`/`zoom` change.
11. Run `npx tsc --noEmit`.

**Relevant Context**
- `framer-motion` is already in `packages/client/package.json`.
- `COUNTRY_CODES` and `useCountryList` from `packages/client/src/pages/settings/CalendarSettingsPage.tsx` — reuse for country name resolution.
- `packages/client/src/utils/continents.ts` — created in Sub-Task 2.
- `packages/client/src/components/FlagImg.tsx` — use in the tooltip alongside the country name.

**Status**: [x] done

---

### Sub-Task 4 — Integrate WorldMapPicker into LocationSettingsPage

**Intent**
Replace the plain `<select>` dropdown in `LocationSettingsPage` with the new `WorldMapPicker`, keeping the existing "Detect Location" button, selected-country badge, and "Manage holidays" link untouched below the map.

**Expected Outcomes**
- `LocationSettingsPage.tsx` imports and renders `<WorldMapPicker>` above the existing controls.
- Clicking a country on the map calls `handleCountrySelect(code)` — the same function already used by the old `<select>`.
- The old `<CountrySelect>` dropdown is kept but collapsed into a "Search by name" disclosure/accordion below the map (for keyboard/accessibility users).
- The selected country is passed to `WorldMapPicker` as the `selected` prop so it stays highlighted.
- `lang` is passed from `useLanguage()` for country name localisation in the tooltip.

**Todo List**
1. Open `packages/client/src/pages/settings/LocationSettingsPage.tsx`.
2. Import `WorldMapPicker` and `useLanguage`.
3. Render `<WorldMapPicker selected={country} onSelect={handleCountrySelect} lang={lang} />` as the primary input at the top of the card.
4. Wrap the old `<CountrySelect>` in a collapsible `<details>` element labelled "Search by name" so it is still accessible but not visually dominant.
5. Run `npx tsc --noEmit`.

**Relevant Context**
- `packages/client/src/pages/settings/LocationSettingsPage.tsx` — existing page; `handleCountrySelect`, `country`, `locationSaving` are already defined.
- `packages/client/src/context/LanguageContext.tsx` — `useLanguage()` hook for `lang`.

**Status**: [x] done

---

## Notes for Implementation

- Sub-tasks must be done in order: 1 → 2 → 3 → 4.
- The GeoJSON used by `react-simple-maps` uses numeric ISO 3166-1 **numeric** codes internally, not alpha-2. The `Geography` component's `geo.properties` object contains `name` and in some datasets `iso_a2`. Use the `name` property or `iso_a2` if available to match against `COUNTRY_CODES`. The standard approach is to match on `geo.id` (numeric) using a lookup table or on `geo.properties.iso_a2`.
- The `ZoomableGroup` approach in `react-simple-maps` accepts `center=[lon, lat]` and `zoom` as controlled props — animating these with `framer-motion`'s `useMotionValue` / `useSpring` gives smooth continent zoom.
- Keep the map height fixed (e.g. `h-[320px]` or `h-[400px]`) so it doesn't push the rest of the settings page.
- Only the 65 countries in `COUNTRY_CODES` are selectable — all other countries are rendered as non-interactive background shapes.
