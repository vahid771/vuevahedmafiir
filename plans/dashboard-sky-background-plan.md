# Dashboard Sky Background Scene — Plan

## Overview

Add a CSS + div-based background scene scoped to the **main content column** of the dashboard page. The scene is a layered illustration depicting:

- **Sky gradient** — colour shifts based on local hour (night/dawn/morning/midday/afternoon/dusk)
- **Celestial body** — sun (day) or moon (night) positioned on a sky-arc based on time-of-day; moon shows correct phase using two overlapping divs; lit side mirrors hemisphere
- **Ground / horizon strip** — season-appropriate bottom strip: spring (green + blossoms), summer (deep green), autumn (orange/brown), winter (snow + bare trees); season is derived from month + hemisphere
- **Translucent cards** — all existing dashboard content cards use `bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm`

The scene is computed **once on load** (recomputed when timezone or country changes) using only JS math — no external APIs, no images, no SVG viewBox math.

> **Scope:** Only behind the main content area. Sidebar and header retain their opaque backgrounds.

> **Rendering approach:** Pure CSS `<div>` elements with `position: absolute/fixed`, CSS gradients, `border-radius`, and `box-shadow`. No SVG. This avoids all SVG viewBox scaling/percentage issues.

---

## Sub-Tasks

---

### Sub-Task 1 — Replace DashboardSkyScene with CSS-div renderer

**Intent:** Rewrite `packages/client/src/components/DashboardSkyScene.tsx` from scratch using only CSS-div layers. Keep the same props interface (`scene: SkyScene`) and memo wrapper — only the rendering changes.

**Expected Outcomes:**
- Scene is visible and correctly proportioned at all viewport sizes
- Sky gradient fills the full viewport
- Sun (daytime) or Moon (night) rendered as absolutely-positioned round divs with correct phase/position
- Seasonal ground strip visible as a bottom strip (~22vh high) with soft hill silhouette
- Total visual weight is "silent" — everything is desaturated and semi-transparent so content cards remain readable

**Layers (bottom to top, all `absolute` inside the fixed wrapper):**

1. **Sky** — full-size div, `background: linear-gradient(to bottom, topColor, bottomColor)`, opacity 0.45–0.55
2. **Stars** (night/dusk/dawn only) — 30 tiny absolutely-positioned `<span>` dots, 2–4px, very low opacity
3. **Sun** — round div at `left: ${sunMoonX}%`, `top: ${sunMoonY}%`, `transform: translate(-50%, -50%)`, radial-gradient background, box-shadow glow, opacity 0.5
4. **Moon** — two overlapping round divs clipped inside an `overflow: hidden` container; outer = lit disc, inner = shadow disc offset to cover unlit portion; hemisphere flip applied as `scaleX(-1)` transform on the whole moon when `southern=true`
5. **Ground** — absolutely positioned div pinned to bottom (`bottom: 0`), height ~22%, `border-radius: 60% 60% 0 0 / 30px 30px 0 0` for soft hill silhouette, season-appropriate muted background color, opacity 0.20–0.25; small tree silhouettes as child `<div>` elements using `clip-path` or simple border-radius shapes

**Todo List:**
1. Delete the old SVG-based content and rewrite `DashboardSkyScene.tsx`
2. Define `SKY_COLOURS` map (same phases, same muted colors from current code)
3. Render **sky layer**: full-size absolute div with CSS gradient
4. Render **stars layer**: map `STARS` array to `<span>` elements with `position: absolute`, `left/top` as %, `width/height` in px (2–3px), `border-radius: 50%`, `background: #6b7a99`
5. Render **sun**: single round div (`border-radius: 50%`) with `radial-gradient` background and `box-shadow` glow; positioned via `left/top` %
6. Render **moon container**: `position: absolute`, `overflow: hidden`, `border-radius: 50%`, fixed px size (e.g. 48×48px); inside it: lit disc div (full size, gray gradient) + shadow div (same height, width = `shadowRx * 2`, positioned to cover the unlit side); hemisphere flip via `scaleX(-1)` on the container
7. Render **ground layer**: absolute div pinned bottom, season color, soft top border-radius; add 3–5 minimal tree silhouettes as child divs using simple geometric shapes (trunk = tall narrow div, canopy = round div on top)
8. Wrap everything in `<div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: -1 }}>`

**Moon phase geometry (CSS div approach):**
- Moon container: `width: 48px; height: 48px; border-radius: 50%; overflow: hidden; position: absolute`
- Lit disc: `width: 100%; height: 100%; background: radial-gradient(...)` (always full size)
- Shadow div: `position: absolute; top: 0; height: 100%; background: <sky-matching color>; border-radius: 50%`
  - When `lit = 0` (new moon): shadow `width: 100%; left: 0` (covers all)
  - When `lit = 0.5` (quarter): shadow `width: 50%; left: 0` (waxing) or `right: 0` (waning)
  - When `lit = 1` (full): shadow `width: 0`
  - Waxing (phase 0→0.5): shadow on the left (`left: 0`)
  - Waning (phase 0.5→1): shadow on the right (`right: 0`)
  - Southern hemisphere: flip the container with `transform: scaleX(-1)`

**Relevant Context:**
- `packages/client/src/utils/skyScene.ts` — `SkyScene` type unchanged; `southern` field already present
- `packages/client/src/components/DashboardSkyScene.tsx` — full rewrite; keep same export signature
- `packages/client/src/hooks/useSkyScene.ts` — unchanged
- `packages/client/src/pages/DashboardPage.tsx` — unchanged (already mounts `<DashboardSkyScene scene={skyScene} />`)

**Status:** `[x] done`

---

## Sky Phase → Colour Map (unchanged)

| skyPhase   | top         | bottom      | opacity |
|------------|-------------|-------------|---------|
| night      | `#c8cfe0`   | `#dce2ee`   | 0.55    |
| dawn       | `#dce0ea`   | `#edd9ca`   | 0.50    |
| morning    | `#d6e8f5`   | `#eef2e8`   | 0.45    |
| midday     | `#d0e8f7`   | `#e8f4fb`   | 0.40    |
| afternoon  | `#d8eaf6`   | `#ede8d8`   | 0.42    |
| dusk       | `#e8d8cc`   | `#d8dcee`   | 0.50    |

## Season → Ground Colour

| Season | Ground base | Opacity |
|--------|-------------|---------|
| spring | `#a7c4a0`   | 0.22    |
| summer | `#7d9e7a`   | 0.20    |
| autumn | `#a8835a`   | 0.22    |
| winter | `#c8d4de`   | 0.20    |
