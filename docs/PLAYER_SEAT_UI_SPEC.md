# KOUPPI Player Seat UI — Design Specification

**Date:** 2026-07-17  
**Status:** Phase 3 implemented — see [`PLAYER_SEAT_UI_IMPLEMENTATION_REPORT.md`](./PLAYER_SEAT_UI_IMPLEMENTATION_REPORT.md)  
**Depends on:** [`PLAYER_SEAT_UI_AUDIT.md`](./PLAYER_SEAT_UI_AUDIT.md)  
**Applies to:** Single-player, casual multiplayer, private lobbies, Career Mode (shared `PokerTable` pipeline)

### Implementation adjustments (Phase 3)

1. **`formatSeatAmount`:** Always keeps one decimal for K/M when not a whole number (e.g. `12500` → `12.5K`).
2. **Seat details popover:** Deferred (optional); layout/non-overlap prioritized.
3. **`PlayerEmote`:** Still reads `useRemoteGameStore` (pre-existing); seat pods remain presentational.
4. **`seatPositions.ts`:** Thin compatibility shim over `seatLayout.ts`.
5. **Mobile opponent UI:** Variant inside `PlayerSeat` (`breakpoint === "mobile" && !isMe`), not a separate file.

---

## Goals

Redesign the on-table player display into a **perimeter-anchored seat pod** system that:

1. Keeps the **central felt safe zone** clear for cards, pot, dealer messages, and turn feedback.
2. Places compact player HUD pods around the **table rail / perimeter**, not floating on the felt center.
3. Separates **player pods** from **bet/chip markers** (inner anchors between seat and center).
4. Uses a **dedicated compact mobile layout** (not a scaled-down desktop pod).
5. Looks like a professional online card-table UI (dark navy/black rail aesthetic; restrained accents).
6. Preserves all game logic, networking, and mode shells — **presentation-only** refactor.

### Non-goals

- Rewriting Socket.IO, Career matchmaking, game reducer, scoring, or rules.
- Adding PixiJS/Phaser or a new design-system dependency.
- Paid/remote avatar assets or copyrighted poker-site graphics.
- Replacing the existing emoji avatar picker for lobby selection (seats may still consume `AvatarConfig`; presentation of bots and fallbacks will be upgraded).

---

## 1. Component Architecture

### 1.1 Principle

Keep **one shared presentational seat system** under `PokerTable`. Mode shells (`TableGraphics`, `MultiplayerTableGraphics`) continue to supply game state; they must not duplicate seat geometry.

### 1.2 Proposed components

| Component | Path (proposed) | Responsibility |
|-----------|-----------------|----------------|
| **`TableSeatLayout`** | `components/game/TableSeatLayout.tsx` | Maps players → outer seat anchors + inner bet anchors; renders positioned wrappers; owns breakpoint choice |
| **`PlayerSeat`** | `components/game/PlayerSeat.tsx` (evolve in place) | Compact seat pod: avatar, name, bankroll, bot/status badges, turn chrome |
| **`PlayerAvatar`** | `components/game/PlayerAvatar.tsx` | Avatar rendering: profile emoji, bot emblem, initials monogram fallback |
| **`PlayerStatusBadge`** | `components/game/PlayerStatusBadge.tsx` | Small badges: `BOT`, `TURN`, `OFFLINE`, etc. |
| **`PlayerBetMarker`** | `components/game/PlayerBetMarker.tsx` | Tiny chip/amount badge at **inner** bet anchor (not inside the pod) |
| **`MobilePlayerSeat`** | Variant inside `PlayerSeat` or `PlayerSeat.mobile.tsx` | Compact opponent circle + truncated meta; hero bottom pod |
| **Seat layout model** | `components/game/seatLayout.ts` (replace/extend `seatPositions.ts`) | Pure functions: anchors, safe zone, breakpoint → config |

### 1.3 Reuse (do not duplicate)

| Existing | Reuse as |
|----------|----------|
| `Avatar` / `avatar-display` | Optional base for emoji display inside `PlayerAvatar` |
| `Chip` from `ChipAnimation.tsx` | Visual for `PlayerBetMarker` (size `small`) |
| `PlayerEmote` | Remains anchored relative to seat wrapper |
| `HudButton` / `ConfirmDialog` | Optional seat detail sheet (secondary) |
| Mode shells | Pass props only; no new seat positioning logic |

### 1.4 Ownership diagram

```
PokerTable
├── Felt / rail / center stack (dealer, pot, cards)     [background + play layers]
├── TableSeatLayout
│   ├── [per player] outer wrapper → PlayerSeat (+ emote)
│   └── [per player] inner wrapper → PlayerBetMarker (if bet > 0)
└── children (CenterCards) remains in center safe zone
```

`PokerTable` stops calling `getPlayerPosition` + `PlayerSeat` directly; it delegates to `TableSeatLayout`.

---

## 2. Data Contract

### 2.1 Domain terminology (preserve)

| Domain term | UI label guidance |
|-------------|-------------------|
| `bankroll` | Primary stack display (not “score” unless Career UI already uses that elsewhere) |
| `pot` | Central only |
| `betAmount` / chips | Per-seat bet marker when present |
| `isBot` | `BOT` badge |
| Pass (not fold) | No folded state unless product adds it later |
| Kouppi / Shistri | Not seat badges; remain in dealer/HUD/action flow |

### 2.2 Types (explicit — no `any`)

```ts
/** Breakpoint for seat geometry (not necessarily Tailwind sm) */
export type SeatLayoutBreakpoint = "mobile" | "tablet" | "desktop";

/** Normalized 0–100 coordinates within the table container */
export interface SeatAnchor {
  x: number; // left %
  y: number; // top %
}

export interface SeatSlotConfig {
  /** Outer anchor: player pod center */
  seat: SeatAnchor;
  /** Inner anchor: bet/chip marker between seat and table center */
  bet: SeatAnchor;
  /** Visual placement hint for truncation / alignment */
  edge: "bottom" | "top" | "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
}

export interface SeatLayoutConfig {
  playerCount: number;
  viewerIndex: number;
  breakpoint: SeatLayoutBreakpoint;
  /** Index in players[] → slot config (viewer-rotated so local is bottom-center) */
  slots: SeatSlotConfig[];
  /** Reserved center ellipse (percent of table box) — documentation + tests */
  safeZone: {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
  };
}

export interface SeatPlayerView {
  id: string;
  name: string;
  bankroll: number;
  isBot: boolean;
  isActive: boolean;       // from Player.active
  isBankrupt: boolean;     // bankroll <= 0 (or !isActive)
  isMe: boolean;
  isCurrentTurn: boolean;
  avatar?: AvatarConfig;
  /** From TurnInfo when this player is current and has bet; else 0/undefined */
  currentBet?: number;
  /** Multiplayer only — from PlayerInfo when available */
  connected?: boolean;
  reconnectRemainingSec?: number | null;
}

export interface PlayerSeatProps {
  player: SeatPlayerView;
  breakpoint: SeatLayoutBreakpoint;
  edge: SeatSlotConfig["edge"];
  /** Optional compact turn timer seconds when isMe && isCurrentTurn (MP) */
  turnRemainingSec?: number | null;
  onOpenDetails?: (playerId: string) => void;
}

export interface PlayerBetMarkerProps {
  amount: number;
  isCurrentTurn?: boolean;
}

export interface PlayerAvatarProps {
  name: string;
  isBot: boolean;
  isMe: boolean;
  avatar?: AvatarConfig;
  size: "sm" | "md" | "lg";
}
```

### 2.3 Props PokerTable must accept / forward

Extend `PokerTableProps` minimally:

| Prop | Type | Notes |
|------|------|-------|
| Existing | `pot`, `players`, `currentIndex`, `playerId`, `avatars`, `dealerMessage`, `children` | Unchanged semantics |
| `connectionByPlayerId?` | `Record<string, { connected?: boolean; reconnectRemainingSec?: number \| null }>` | Optional; MP shell supplies from `playersInRoom` |
| `currentBetByPlayerId?` | `Record<string, number>` | Optional; shells map from `turn.betAmount` for current player |
| `turnRemainingSec?` | `number \| null` | Optional; MP timer for local active seat chrome |

Shells map store → these props. **Do not** import stores inside seat presentational components (except existing `PlayerEmote` ↔ remote store, which may remain or be refactored to a prop later — prefer prop injection if low-risk).

### 2.4 Formatting helpers

```ts
/** Compact bankroll/bet display for small seats */
formatSeatAmount(value: number): string
// Examples: 2480 → "2.5K" or "2,480" depending on width policy;
// Prefer: < 1000 as integer; >= 1000 as "1.2K", "12.5K"; >= 1_000_000 as "1.2M"
```

Truncate names with CSS `truncate` + `title`/`aria-label` full name. Mobile opponents: ~6–8 chars + ellipsis.

---

## 3. Seat-Layout Model

### 3.1 Breakpoints

| Breakpoint | Condition (CSS / matchMedia) | Seat UI |
|------------|------------------------------|---------|
| `mobile` | container width **&lt; 640px** (align with Tailwind `sm`) | Compact: opponents = avatar rings; hero = short bottom pod |
| `tablet` | **640px – 1023px** | Compact horizontal pods; slightly smaller than desktop |
| `desktop` | **≥ 1024px** | Full horizontal seat pods |

Prefer **table container width** (ResizeObserver or CSS container queries on `.table-tilt`) over raw viewport when feasible, so embedded layouts stay correct.

### 3.2 Central safe zone

Permanent reserved ellipse inside the table box (percent of width/height):

```
safeZone: { cx: 50, cy: 42, rx: 28, ry: 26 }
```

Roughly covers: dealer banner (~16%), pot (~38%), cards (~54%).  

**Rule:** Outer seat anchors must place the **pod bounding box** outside this ellipse (pod center may sit near the rail; the pod must not cover the ellipse interior). Bet anchors sit **between** seat and center but **outside** a tighter pot/card core:

```
betSafeCore: { cx: 50, cy: 42, rx: 18, ry: 16 }
```

### 3.3 Local-player bottom-center rotation

Retain existing rotation:

```ts
adjustedIndex = (index - viewerIndex + N) % N
```

Slot 0 is always **bottom-center** for the local player when `playerId` is found. Spectators: `viewerIndex = 0` (current behavior).

### 3.4 Outer seat ring (desktop / tablet)

Coordinates are **pod centers** as `%` of the table container. Values push pods toward the rail (farther from felt center than today’s 8%/85% interior placements).

Canonical ring of **8 slots** (viewer-relative indices after rotation):

| Slot | seat (x,y) | edge | Notes |
|------|------------|------|-------|
| 0 | (50, 92) | bottom | Local / hero |
| 1 | (12, 72) | bottom-left | |
| 2 | (6, 42) | left | |
| 3 | (18, 10) | top-left | |
| 4 | (50, 4) | top | Opposite in 2P |
| 5 | (82, 10) | top-right | |
| 6 | (94, 42) | right | |
| 7 | (88, 72) | bottom-right | |

Compared to current `PLAYER_POSITIONS`, slots move **outward** (esp. top from `y: 8` → `y: 4`, bottom from `y: 85` → `y: 92`) so pods hug the rail and leave the center clear.

### 3.5 Inner bet anchors

For each seat slot, bet marker = midpoint (or 60% toward center) between seat and table center `(50, 42)`:

```ts
function betAnchor(seat: SeatAnchor, center = { x: 50, y: 42 }, t = 0.55): SeatAnchor {
  return {
    x: seat.x + (center.x - seat.x) * t,
    y: seat.y + (center.y - seat.y) * t,
  };
}
```

**Invariant:** `bet ≠ seat` for every slot. Bet markers never render underneath the pod.

### 3.6 Player-count slot maps

After rotation, map `adjustedIndex` → ring slot index:

| N | Ring slot indices (order = adjusted 0…N-1) |
|---|--------------------------------------------|
| 2 | `[0, 4]` |
| 3 | `[0, 3, 5]` — avoid pure left/right only; keep top corners for opponents |
| 4 | `[0, 2, 4, 6]` |
| 5 | `[0, 2, 3, 5, 6]` |
| 6 | `[0, 1, 2, 4, 6, 7]` |
| 7 | `[0, 1, 2, 3, 5, 6, 7]` |
| 8 | `[0, 1, 2, 3, 4, 5, 6, 7]` |

For N &gt; 8 (theoretical game-core max): clamp to 8 ring slots with modulo and document limitation; do not invent a 20-seat UI in this pass.

Empty seats: live game state typically omits empty slots (no placeholders). If `players.length` shrinks mid-session, recompute layout from remaining players — **do not** leave orphan anchors.

### 3.7 Mobile-specific geometry

Same slot indices, **adjusted coordinates** and **different component density**:

| Slot | Mobile seat (x,y) | Rendering |
|------|-------------------|-----------|
| 0 | (50, 94) | Hero: compact horizontal pod above action dock, still inside table box |
| 1–7 | Slightly inset from desktop (e.g. left `x: 8`, right `x: 92`) | Opponent: circular avatar + optional 1-line bankroll; name truncated |

Mobile rules:

- Opponents: **no** multi-line black card; avatar ring + optional bankroll under avatar.
- Hero: slightly larger than opponents; must not cover `GameActionPanel` (panel remains **below** table — hero stays inside table aspect box).
- Turn: avatar **ring + small TURN label** on the active seat; no tall “Your turn” block.
- Bet markers: even smaller; same inner-anchor math with mobile seat coords.
- At **320px** width: ensure turn ring and labels are not clipped (`overflow: visible` on seat wrappers; table container may allow slight bleed outside oval).

### 3.8 CSS positioning strategy

- Prefer `%` + `transform: translate(-50%, -50%)` on wrappers (container-relative).
- Encode ring as data in `seatLayout.ts` — **named constants**, not scattered magic numbers in JSX.
- Optional CSS variables on the table root: `--seat-safe-rx`, `--seat-safe-ry` for documentation/debug overlays (dev-only).
- **Do not** use unexplained one-off pixel offsets that only work at one resolution.

### 3.9 Dealer / turn messaging policy

| Message type | Placement |
|--------------|-----------|
| Global phase / result | Dealer banner (center-safe) — keep |
| Local “your move” | Action dock + active seat chrome — keep dock |
| Seat turn | Compact ring + optional `TURN` badge / timer — **remove** large “Your turn” under pod |
| Waiting for opponent | HUD status banner — keep |

Dealer may still show `YOUR TURN` for the local player as a short center cue; seat must not duplicate a tall text block. Prefer reducing dealer `YOUR TURN` prominence later if redundant — optional follow-up; **required** is removing the seat’s tall turn row.

---

## 4. Layering / Z-Index Specification

Explicit stacking inside `.table-tilt` (and page overlays):

| Layer | z-index | Contents |
|-------|---------|----------|
| 0 | auto / 0 | Felt, rail, decorative betting/action zones |
| 1 | 5 | Dealer tray chrome |
| 2 | 10 | Dealer banner, pot amount, central `ChipStack` |
| 3 | 15 | **Bet markers** (`PlayerBetMarker`) |
| 4 | 20 | Center cards |
| 5 | 25 | **Player seat pods** |
| 6 | 30 | Emote bubbles (above seats) |
| 7 | 40 | Chip-fly animation (viewport fixed) |
| 8 | 50 | Chat / emote FABs, modals |

**Critical rules:**

1. Bet markers (15) sit **below** seat pods (25) in z-order but are **spatially** inward — pods must not cover their own bet anchors.
2. Cards (20) remain above pot; seats (25) may sit above cards **only** at perimeter — safe zone prevents seats overlapping card area.
3. Never raise seat z-index above center messages in a way that covers dealer banner; keep dealer at 10 and seats outside its footprint.
4. Action dock is **outside** the table stack (document flow below table) — treat as sibling layer; hero seat must not extend into dock.

---

## 5. State Visuals

### 5.1 Default human

- Dark translucent navy/black pod (`rgba(8,12,24,0.72)`–`0.85`), cool blue-gray border `1px`.
- Horizontal layout (desktop/tablet): `[Avatar] | name + bankroll`.
- Name: `font-ui`, readable sans; bankroll: tabular nums, gold/amber accent (existing token).

### 5.2 Bot

- Same pod structure.
- `PlayerAvatar`: curated bot look — prefer restrained robot/emblem from existing bot emoji set **or** monogram `B1`-style initials on muted slate; add small **`BOT`** badge (amber/gold accent, high contrast).
- Do not rely on random human face emojis for bots when `isBot` is true (always use `getBotAvatar` / bot path).

### 5.3 Current turn

- Accessible cyan/royal-blue **ring** around avatar (and subtle pod outline).
- Small `TURN` badge or icon (not color alone).
- Optional compact timer digits when `turnRemainingSec` provided (local seat preferred).
- **No** `scale-110` on the entire pod (causes overlap); optional subtle pulse on ring with `prefers-reduced-motion: reduce` disabling animation.
- Copy: for local player, aria-live “Your turn”; for others, “{name}'s turn” — never show “Your turn” on a bot/opponent seat as misleading UI text.

### 5.4 Bankrupt / inactive

- Dim + desaturate (`opacity` ~0.45–0.55, grayscale optional).
- Bankroll pill uses error token.
- Still readable; keep name visible.

### 5.5 Disconnected (when `connected === false`)

- Dimmed pod + small `OFFLINE` or reconnect seconds badge.
- Only when MP supplies connection map; SP omits.

### 5.6 Winner

- If `lastResolution.win && playerId matches` during `awaitNext`: optional subtle gold border on that seat for a few seconds — **no** blocking modal on the table (celebration overlay already exists).

### 5.7 Empty seat

- Not required for live table (no empty placeholders today). Spec: if added later, dashed ring only at perimeter; out of scope for v1.

---

## 6. Avatar System

| Case | Behavior |
|------|----------|
| Human with `AvatarConfig` | Show emoji in colored circle (existing) |
| Human without avatar | Initials monogram from name (1–2 letters), deterministic color from `AVATAR_COLORS` hash |
| Bot | Bot avatar path + `BOT` badge; never 😊 fallback |
| Missing everything | Initials or `?` monogram — **never** childish default smile if avoidable |

No remote image URLs. No new paid assets. Optional tiny original SVG bot glyph later; emoji/CSS is acceptable for v1.

---

## 7. Accessibility

1. **Contrast:** Pod text ≥ WCAG AA against pod background; gold on dark for bankroll.
2. **Turn not color-only:** ring + `TURN` label / aria-live.
3. **Labels:** `aria-label` on seat: `"{name}, bankroll {n}, {bot|player}{, your turn}"`.
4. **Focus:** If seats are interactive (details), `button` or `tabIndex={0}` with visible focus ring.
5. **Reduced motion:** Disable pulse/scale animations under `prefers-reduced-motion`.
6. **Tap targets:** Mobile interactive seats ≥ 44×44px hit area (avatar may be visually smaller with padding).

---

## 8. Optional Seat Details (secondary)

If implementable without new dependencies:

- Tap/click seat → compact popover (desktop) or bottom sheet (mobile) using existing modal panel styles (`.game-modal-panel` / lightweight absolute panel).
- Content: full name, bankroll, bot/human, connection status.
- **Primary acceptance does not require this**; ship layout first, then optional details.

---

## 9. Acceptance Criteria

### 9.1 Desktop (≥ 1024px)

- [ ] Seats read as compact horizontal pods, not oversized black vertical cards.
- [ ] No seat pod overlaps central cards, pot, or dealer banner.
- [ ] No seat pod overlaps its own bet marker.
- [ ] Local player is bottom-center for all supported N.
- [ ] Active turn is clear via ring + label/timer without tall “Your turn” block under the pod.
- [ ] Bots show `BOT` badge and distinct avatar path.
- [ ] 2-player case: Bot 1 does not cover pot/dealer message.
- [ ] Long names truncate; large bankrolls compact-format without breaking layout.

### 9.2 Tablet (640–1023px)

- [ ] Same perimeter model; pods remain usable; no center occlusion.

### 9.3 Mobile (&lt; 640px), including 320 / 360 / 375 / 390 / 414

- [ ] Dedicated compact layout (not merely scaled desktop card).
- [ ] Opponents are small perimeter seats; hero bottom compact.
- [ ] Central play area remains readable.
- [ ] Action controls remain reachable; hero seat does not cover action dock.
- [ ] Turn indicator visible without clipping at 320px.
- [ ] Chat/emote FABs may overlap edges slightly — seats must remain identifiable.

### 9.4 Modes

- [ ] Single-player bots: layout correct for 2–8 players.
- [ ] Casual multiplayer `/room/[id]`: seats + optional connection state.
- [ ] Private lobbies: same table UI.
- [ ] Career Mode: same `MultiplayerTableGraphics` seats.
- [ ] No game-logic / socket regressions.

### 9.5 Architecture

- [ ] Single seat layout module shared by all modes.
- [ ] Type-safe props; no `any`.
- [ ] Seat anchors driven by config model (count + viewer + breakpoint).
- [ ] Builds and existing tests pass; new seat/layout unit tests added.

---

## 10. Visual Direction Notes

- Prefer themes already in repo (`midnight-blue`, `royal-blue`) for blue/black table aesthetic; seat chrome should look correct on green themes too.
- Avoid purple-glow AI clichés; use cool blue/cyan for turn, amber for bot badge, gold for bankroll (existing tokens).
- Pods: translucent navy, not flat `#000` bricks.

---

# Phase 2 — Implementation Plan (File-Level Checklist)

Priority order: geometry → seat component → bets → turn → desktop polish → mobile → optional details → tests.

---

### Task 1 — Seat layout foundation

| | |
|--|--|
| **Files** | Create `kouppi/apps/web/components/game/seatLayout.ts`; deprecate/thin `seatPositions.ts` (re-export or migrate callers) |
| **Change** | Pure functions: `getSeatLayoutBreakpoint(width)`, `getSeatLayoutConfig({ playerCount, viewerIndex, breakpoint })`, `formatSeatAmount`, safe-zone constants, slot maps for 2–8 |
| **Why** | Replace ad-hoc `%` with named perimeter + bet anchors; enable tests |
| **Deps / risk** | All modes share this; wrong 2P top anchor reintroduces overlap |
| **Tests** | `seatLayout.test.ts`: unique seat vs bet anchors; local bottom-center; all N ∈ [2,8]; bet ≠ seat |

---

### Task 2 — Wire layout into PokerTable

| | |
|--|--|
| **Files** | `PokerTable.tsx`; new `TableSeatLayout.tsx` |
| **Change** | Render seats via layout config; optional CSS layer wrappers; pass `edge` + breakpoint into seats |
| **Why** | Single placement site; clear layering |
| **Deps / risk** | Emote positioning; spectator viewerIndex |
| **Tests** | Smoke render with 2 and 6 players (Testing Library) |

---

### Task 3 — Reusable PlayerSeat + PlayerAvatar + badges

| | |
|--|--|
| **Files** | `PlayerSeat.tsx`, new `PlayerAvatar.tsx`, `PlayerStatusBadge.tsx`; possibly `lib/avatars.ts` (initials helper) |
| **Change** | Horizontal compact pod; remove tall “Your turn” row; bot badge; bankrupt/disconnect styles; accessible labels |
| **Why** | Fixes childish vertical card + misleading bot turn copy |
| **Deps / risk** | Avatar picker still emoji-based — OK |
| **Tests** | `PlayerSeat.test.tsx`: human, bot, fallback initials, turn label a11y, long name truncate, compact money |

---

### Task 4 — Separate bet / chip placement

| | |
|--|--|
| **Files** | `PlayerBetMarker.tsx`; `TableSeatLayout.tsx`; `TableGraphics.tsx` / `MultiplayerTableGraphics.tsx` (pass `currentBetByPlayerId`) |
| **Change** | Render bet at inner anchor when amount &gt; 0; reuse `Chip` small |
| **Why** | Prevents pod-over-chip; fulfills bet layer requirement |
| **Deps / risk** | `turn.betAmount` only for current turn — may be sparse; still correct when present |
| **Tests** | Bet marker not rendered at seat anchor; amount formats |

---

### Task 5 — Turn-state redesign

| | |
|--|--|
| **Files** | `PlayerSeat.tsx`; optionally soften duplicate dealer `YOUR TURN` in shells (optional) |
| **Change** | Ring + TURN badge + optional timer; no full-pod scale; correct aria copy for me vs other |
| **Why** | Compact, accessible turn without overlap |
| **Deps / risk** | MP timer prop threading |
| **Tests** | Turn state classes / roles; bot never shows “Your turn” as personal copy |

---

### Task 6 — Desktop / tablet styling polish

| | |
|--|--|
| **Files** | `PlayerSeat.tsx`, `globals.css` (seat-specific classes if needed) |
| **Change** | Navy translucent surfaces, borders, turn cyan, bot amber; truncate/format |
| **Why** | Professional poker-table look |
| **Deps / risk** | Theme clash with classic green — verify both |
| **Tests** | Visual manual checklist (Phase 4) |

---

### Task 7 — Mobile compact variant

| | |
|--|--|
| **Files** | `PlayerSeat.tsx` / `MobilePlayerSeat`; `seatLayout.ts` mobile coordinates; `PokerTable` / `TableSeatLayout` breakpoint detection |
| **Change** | Switch component density at mobile; ResizeObserver or `matchMedia` |
| **Why** | Purpose-built mobile seats |
| **Deps / risk** | FAB overlap; action dock clearance |
| **Tests** | Mobile variant renders compact structure; layout config differs by breakpoint |

---

### Task 8 — Optional seat details

| | |
|--|--|
| **Files** | Small `SeatDetailsPopover.tsx` or inline in `PlayerSeat` |
| **Change** | Tap opens compact panel with existing primitives |
| **Why** | Secondary UX for truncated names |
| **Deps / risk** | Focus trap / click-outside — keep minimal |
| **Tests** | Optional; skip if deferred |

---

### Task 9 — Mode shell prop wiring

| | |
|--|--|
| **Files** | `TableGraphics.tsx`, `MultiplayerTableGraphics.tsx` |
| **Change** | Map `connectionByPlayerId`, `currentBetByPlayerId`, `turnRemainingSec` into `PokerTable` |
| **Why** | Seats stay presentational; modes supply data |
| **Deps / risk** | Must not alter intents/socket |
| **Tests** | Existing multiplayer room tests still pass |

---

### Task 10 — Tests & manual verification docs

| | |
|--|--|
| **Files** | `__tests__/seatLayout.test.ts`, `__tests__/PlayerSeat.test.tsx`; `docs/PLAYER_SEAT_UI_MANUAL_TEST.md`; later `PLAYER_SEAT_UI_IMPLEMENTATION_REPORT.md` |
| **Change** | Unit/layout tests; manual width matrix; build/typecheck commands |
| **Why** | Phase 4 gate |
| **Deps / risk** | Playwright E2E only if already configured |
| **Commands** | `npm test -w @kouppi/web`, `npm run build -w @kouppi/web` (exact paths confirmed during Phase 3) |

---

## Implementation Order Summary

1. `seatLayout.ts` + tests  
2. `TableSeatLayout` + `PokerTable` integration  
3. `PlayerSeat` / `PlayerAvatar` / badges redesign  
4. `PlayerBetMarker` + shell bet props  
5. Turn chrome (no scale / no tall text)  
6. Desktop styling  
7. Mobile variant + breakpoint detection  
8. Optional details  
9. Full regression + manual matrix  

---

## Out of Scope / Follow-ups

- Replacing lobby emoji avatar picker with professional portrait art.
- Reworking chat/emote FAB positions (note only if they still collide after seat move).
- Aligning `ThreeDTablePlaceholder` with new layout.
- Supporting &gt;8 simultaneous seat UI slots.
- Changing dealer banner copy globally (optional polish).

---

*End of Phase 1 specification + Phase 2 plan. Do not implement until Phase 3 is explicitly started.*
