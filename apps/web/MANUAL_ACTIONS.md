# KOUPPI — Manual Actions Checklist

> **Living document.** Update this file when new assets, env steps, or human-only tasks are added.  
> Ask the AI: *"What's left on MANUAL_ACTIONS?"* to get a status against this list.

Last updated: 2026-07-14

---

## What the AI / agent CAN do

- Write and refactor React/TypeScript UI code
- Create theme config, stores, hooks, and CSS fallbacks
- Add **placeholder** SVG assets (simple, not photo-realistic)
- Wire theme selector, props toggles, and graceful 404 fallbacks
- Run tests, TypeScript checks, and dev servers (when tools are available)
- Document exact file paths and dimensions you need

## What the AI / agent CANNOT do

- Download copyrighted or licensed photo textures from the web into your repo
- Guarantee photo-realistic visuals without **your** high-quality image files
- Install `pnpm` globally on your machine (may need you to run commands)
- Fix `better-sqlite3` Node version mismatch without you rebuilding native modules
- Visually QA on your exact monitor / phone (you must confirm in browser)
- Purchase premium assets (Shutterstock, Unity Asset Store paid packs, etc.)

---

## Quick start (dev environment)

| Step | Action | You | AI |
|------|--------|-----|-----|
| 1 | Install pnpm globally | `npm install -g pnpm` | — |
| 2 | Install deps from repo root | `cd kouppi && pnpm install` | — |
| 3 | Start dev (preferred) | `pnpm dev` | can run `turbo dev` if pnpm exists |
| 4 | Start dev (no pnpm) | Terminal 1: `cd apps/web && .\node_modules\.bin\next.cmd dev` | ✓ |
| 5 | Start server (multiplayer) | Terminal 2: `cd apps/server && .\node_modules\.bin\tsx.cmd src/server.ts` | ✓ |
| 6 | Open game | http://localhost:3000/play/single | — |
| 7 | Fix Career DB error | `pnpm rebuild better-sqlite3` or reinstall with matching Node | — |

---

## Asset folders (already created)

```
apps/web/public/assets/
├── tables/     ← felt + rail textures
├── floors/     ← casino carpet / wood backgrounds
└── props/      ← plants, people, distant tables, bar
```

**Placeholder SVGs ship with the repo** so the app works immediately. Replace them with realistic PNG/JPG for production polish.

---

## ASSET CHECKLIST — Tables (`public/assets/tables/`)

Replace placeholders when you have better art. Update URLs in `apps/web/lib/tableThemes.ts` if you change file extension (`.svg` → `.png`).

| File | Used by theme | Status | Your action |
|------|---------------|--------|-------------|
| `classic-green.svg` | Classic Green felt | 🟡 Enhanced SVG (fabric noise, betting line) | Optional: oval green felt PNG |
| `midnight-blue.svg` | Midnight Blue felt | 🟡 Enhanced SVG | Optional: deep blue felt PNG |
| `royal-blue.svg` | Royal Blue felt | 🟡 Enhanced SVG | Optional: bright blue felt PNG |
| `woodland-green.svg` | Woodland felt | 🟡 Enhanced SVG | Optional: forest-green felt PNG |
| `rail-brown.svg` | Classic Green rail | 🟡 Enhanced SVG (wood grain) | Optional: brown rail ring PNG |
| `rail-black.svg` | Midnight + Royal rail | 🟡 Enhanced SVG | Optional: black rail PNG |
| `rail-dark-wood.svg` | Woodland rail | 🟡 Enhanced SVG | Optional: dark wood rail PNG |

### Recommended specs (tables)

- **Felt:** Oval top-down view, soft lighting from top, subtle fabric noise. PNG with transparency optional.
- **Rail:** Ring-shaped texture (outer oval minus inner cutout) OR full oval that aligns with CSS inset layers.
- **Size:** 1600×1000 px minimum; 2× for retina optional (`classic-green@2x.png` — requires code change).

### Free asset sources (you download)

- [Unsplash](https://unsplash.com/s/photos/poker-table) — reference photos (crop/edit)
- [Freepik](https://www.freepik.com/search?format=search&query=poker%20table%20top%20view) — vectors (check license)
- [Pixabay](https://pixabay.com/images/search/casino%20carpet/) — carpets / interiors
- [Poly Haven](https://polyhaven.com/textures) — CC0 PBR textures (wood, fabric) for manual compositing
- [ambientCG](https://ambientcg.com/) — CC0 carpet/fabric/wood textures

---

## ASSET CHECKLIST — Floors (`public/assets/floors/`)

**Code status:** ✅ Perspective floor plane, wall zone, baseboards, and spotlight pool are implemented in `CasinoFloor.tsx`.  
**Art status:** ⬜ Placeholder SVG patterns ship in-repo; replace with photo JPG/PNG for production realism.

| File | Used by theme | Status | Your action |
|------|---------------|--------|-------------|
| `casino-carpet-warm.svg` | Classic Green | 🟡 Enhanced SVG placeholder | Optional: replace with seamless warm casino carpet JPG (1920×1080+) |
| `casino-carpet-dark.svg` | Midnight Blue | 🟡 Enhanced SVG placeholder | Optional: replace with dark patterned carpet JPG |
| `casino-carpet-pattern.svg` | Royal Blue | 🟡 Enhanced SVG placeholder | Optional: replace with ornate casino carpet JPG |
| `wood-floor.svg` | Woodland | 🟡 Enhanced SVG placeholder | Optional: replace with hardwood plank JPG (tileable) |

### Recommended specs (floors)

- **Seamless tileable** textures work best (can repeat if `background-size` changes later).
- **Resolution:** 1920×1080 minimum; 4K optional for large desktops.
- Avoid high-contrast patterns behind the table — they compete with cards.

---

## ASSET CHECKLIST — Props (`public/assets/props/`)

**Code status:** ✅ Full props system in `BackgroundProps.tsx` with depth layers (far/mid/near), theme toggles, chandelier, sconces, slots, neon sign.  
**Art status:** 🟡 Enhanced SVG placeholders — replace with transparent PNGs for production.

| File | Theme / flag | Status | Your action |
|------|--------------|--------|-------------|
| `plant-left.svg` / `plant-right.svg` | `props.plants` | 🟡 Enhanced SVG | Optional: potted plant PNG |
| `people-silhouette.svg` | `props.distantPeople` | 🟡 Enhanced SVG | Optional: crowd PNG |
| `people-silhouette-right.svg` | `props.distantPeople` | 🟡 Enhanced SVG | Optional: second crowd variant |
| `distant-table-left.svg` / `distant-table-right.svg` | `props.extraTables` | 🟡 Enhanced SVG | Optional: blurred table PNG |
| `bar-silhouette.svg` | `props.barSilhouette` | 🟡 Enhanced SVG | Optional: bar counter PNG |
| `chandelier.svg` | `props.chandelier` | 🟡 Enhanced SVG | Optional: chandelier PNG |
| `wall-sconce.svg` | `props.wallSconces` | 🟡 Enhanced SVG | Optional: wall light PNG |
| `slot-machine.svg` | `props.slotMachines` | 🟡 Enhanced SVG | Optional: slot machine PNG |
| `neon-sign.svg` | Royal Blue theme | 🟡 Enhanced SVG | Optional: neon sign PNG |

Toggle props per theme in `apps/web/lib/tableThemes.ts` → `props: { ... }`.

---

## Config updates when you swap assets

1. Drop file into correct `public/assets/` subfolder.
2. If extension changes (`.svg` → `.png`), edit `apps/web/lib/tableThemes.ts`:
   - `tableTextureUrl`
   - `railTextureUrl`
   - `floorTextureUrl`
3. Hard-refresh browser (`Ctrl+Shift+R`).
4. If image 404s, CSS color fallbacks still apply — no crash.

---

## Theme system (already implemented — no action unless customizing)

| Item | Location |
|------|----------|
| Theme definitions | `apps/web/lib/tableThemes.ts` |
| UI-only store (persisted) | `apps/web/store/uiThemeStore.ts` |
| Hook | `apps/web/hooks/useTableTheme.ts` |
| Theme selector | Single-player settings + in-game HUD (SP + MP) |
| Table rendering | `apps/web/components/PokerTable.tsx` |
| Floor rendering | `apps/web/components/game/CasinoFloor.tsx` |
| Floor + props wrapper | `CasinoBackground.tsx` |

### Add a new theme (optional)

1. Add ID to `TableThemeId` in `tableThemes.ts`
2. Add entry to `TABLE_THEMES` array with URLs + colors + props flags
3. Add corresponding asset files
4. Theme appears automatically in dropdown

---

## Visual QA checklist (you do in browser)

- [ ] `/play/single` — all 4 themes switch correctly
- [ ] `/lobby` → join room — multiplayer uses same themes
- [ ] Career room (`career-game-*`) — same table/floor as multiplayer
- [ ] Mobile portrait — props do not cover cards or seats
- [ ] Mobile landscape — table readable, floor not cropped badly
- [ ] Missing asset test — rename one PNG temporarily; gradient fallback should appear
- [ ] Theme persists after page reload (localStorage `kouppi-ui-theme`)

---

## Future manual tasks (not yet required)

| Task | When |
|------|------|
| Replace card face CDN art with branded deck PNG/SVG | Optional — KOUPPI backs + fallbacks already work |
| Custom chip artwork (photo textures on edge) | Optional — procedural chips implemented |
| Commission custom avatar illustrations | Avatars polish phase |
| Add `@2x` retina asset variants | After base PNGs approved |
| Add sound pack / music | Audio polish |
| Production deploy env vars | Deploy phase |
| Playwright E2E visual snapshots | CI hardening |

---

## Commands reference

```powershell
# From kouppi/
pnpm install
pnpm dev

# Typecheck + tests (apps/web)
cd apps/web
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\vitest.cmd run

# Rebuild native modules (Career / SQLite)
pnpm rebuild better-sqlite3
```

---

## How to keep this file updated

When you or the AI add a new asset path, env requirement, or human-only step:

1. Add a row to the relevant checklist table.
2. Mark status: ⬜ Todo | 🟡 In progress | ✅ Done
3. Bump **Last updated** date at the top.
