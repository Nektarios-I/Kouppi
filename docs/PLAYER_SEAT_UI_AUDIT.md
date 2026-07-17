# KOUPPI Player Seat UI — Phase 0 Audit

**Date:** 2026-07-17  
**Scope:** Table rendering architecture, player-seat display, layout/overlap/responsive issues  
**Status:** Discovery complete — no code changes in this phase

---

## Executive Summary

All live game modes (single-player, casual multiplayer, Career Mode) render player seats through a **single shared pipeline**:

`Mode shell` → `PokerTable` → `getPlayerPosition()` → `PlayerSeat`

The current player display is a vertically stacked, center-anchored card (`PlayerSeat`) with emoji avatar, name, bankroll, and an optional **"Your turn"** row. Seats are placed using **fixed percentage coordinates** inside the tilted table container (`aspect-[16/10]`), with **no perimeter-aware layout**, **no separate bet markers**, and **no mobile-specific seat variant**.

Overlap and obstruction issues stem from:

1. Seat anchors placed **inside the felt play area** rather than on the rail perimeter.
2. Turn state **expanding seat footprint** (`scale-105/110` + extra text row) without collision avoidance.
3. **"Your turn" shown on every active seat**, not gated on `isMe` — Bot 1 displays misleading turn copy.
4. **Duplicate turn messaging** across dealer banner (`YOUR TURN`), HUD status, action dock (`YOUR MOVE`), and seat panel.
5. **No responsive seat geometry** — only Tailwind `sm:` typography/padding scaling.
6. **Fixed viewport overlays** (chat FAB bottom-right, emote FAB bottom-left) competing with bottom hero seat and action dock on mobile.

There are **no existing unit tests** for `PlayerSeat`, `seatPositions`, or `PokerTable`.

---

## 1. Component & File Map

### 1.1 Core table rendering (shared by all live modes)

| Path | Role |
|------|------|
| `kouppi/apps/web/components/PokerTable.tsx` | Main oval table: felt, rail, dealer banner, central pot/chips, center card slot, seat placement, renders `PlayerSeat` |
| `kouppi/apps/web/components/game/PlayerSeat.tsx` | **Primary player panel component** — avatar, name, bankroll, turn highlight, emote anchor |
| `kouppi/apps/web/components/game/seatPositions.ts` | Seat coordinate math (`PLAYER_POSITIONS`, `getPlayerPosition`, unused `getSeatPositionForPlayer`) |
| `kouppi/apps/web/components/game/CenterCards.tsx` | Center-table cards (upcards, flip, pass) |
| `kouppi/apps/web/components/game/useCenterCardsPresentation.ts` | Card presentation logic hook |

### 1.2 Mode-specific table shells (thin wrappers — same `PokerTable`)

| Path | Mode | Store |
|------|------|-------|
| `kouppi/apps/web/components/TableGraphics.tsx` (`SinglePlayerTableGraphics`) | Single-player vs bots | `useGameStore` |
| `kouppi/apps/web/components/MultiplayerTableGraphics.tsx` | Casual multiplayer + Career in-game | `useRemoteGameStore` |

### 1.3 Route entry points

| Path | Flow |
|------|------|
| `kouppi/apps/web/app/play/single/page.tsx` | Settings dialog → `TableGraphics` → `PokerTable` |
| `kouppi/apps/web/app/room/[id]/page.tsx` | Waiting room / join → `MultiplayerTableGraphics` → `PokerTable` |
| `kouppi/apps/web/app/career/page.tsx` | `CareerLobby` → redirect to `/room/career-game-*` → same multiplayer shell |

Career and casual multiplayer share **`MultiplayerTableGraphics`** and **`/room/[id]`**; only join/subscription differs (`subscribeToCareerRoom` vs `joinRoom`).

### 1.4 HUD, actions, chips, turn indicators

| Path | Role |
|------|------|
| `kouppi/apps/web/components/game/GameHUD.tsx` | Header strip, badges, turn timer ring (MP), status/result banners |
| `kouppi/apps/web/components/game/GameActionPanel.tsx` | Bet controls dock below table (`YOUR MOVE`, bankroll/pot stats) |
| `kouppi/apps/web/components/game/GamePanels.tsx` | Round end standings, game log, next-turn button |
| `kouppi/apps/web/components/ChipAnimation.tsx` | `Chip` (single), `ChipStack` (central pot), `ChipFlyAnimation` (transient bet feedback) |
| `kouppi/apps/web/components/Confetti.tsx` | Win celebration overlay |

### 1.5 Avatars & emotes on seats

| Path | Role |
|------|------|
| `kouppi/apps/web/components/AvatarPicker.tsx` | `Avatar` display component (emoji in colored circle) |
| `kouppi/apps/web/lib/avatars.ts` | Preset emoji categories, `getBotAvatar`, `getAvatarFromId`, `getDefaultAvatar` |
| `kouppi/apps/web/components/EmoteDisplay.tsx` | `PlayerEmote` bubble anchored above seat via `PlayerSeat` |
| `kouppi/apps/web/components/EmotePanel.tsx` | Fixed `bottom-4 left-4` emote FAB (multiplayer room page) |

### 1.6 Styling & theming

| Path | Role |
|------|------|
| `kouppi/apps/web/app/globals.css` | Table perspective/tilt, felt/rail classes, HUD, action dock, chat/emote FABs, avatar display |
| `kouppi/apps/web/tailwind.config.js` | Design tokens; **only default `sm` (640px)** — no custom `md`/`lg`/`xl` |
| `kouppi/apps/web/lib/tableThemes.ts` | Felt/rail/floor theme definitions |
| `kouppi/apps/web/hooks/useTableTheme.ts` | Theme selection hook |
| `kouppi/apps/web/components/game/TableThemeSelector.tsx` | In-game theme picker |
| `kouppi/apps/web/components/game/CasinoBackground.tsx` | Room wrapper (floor + props) |

### 1.7 Game state stores

| Path | Role |
|------|------|
| `kouppi/apps/web/store/gameStore.ts` | Single-player Zustand store; `configureSinglePlayer()` builds You + N bots |
| `kouppi/apps/web/store/remoteGameStore.ts` | Multiplayer socket store; `PlayerInfo`, avatars, emotes, turn timer |
| `kouppi/packages/game-core/src/types.ts` | Canonical `Player`, `GameState`, `TurnInfo`, `Resolution` |

### 1.8 Pre-game player lists (not on-table seats)

| Path | Role |
|------|------|
| `kouppi/apps/web/components/game/WaitingRoom.tsx` | Lobby player rows with avatars |
| `kouppi/apps/web/components/CareerLobby.tsx` | Career queue/room UI before game |

### 1.9 Experimental / alternate (not production)

| Path | Role |
|------|------|
| `kouppi/apps/web/components/game/ThreeDTablePlaceholder.tsx` | Polar-coordinate seat mock at `/3d-preview` — different math, not wired to live play |

### 1.10 Room page overlays (multiplayer)

| Path | Position | Risk |
|------|----------|------|
| `kouppi/apps/web/components/Chat.tsx` | `.chat-fab` fixed bottom-right | Covers bottom-right table area / hero seat edge |
| `kouppi/apps/web/components/EmotePanel.tsx` | `fixed bottom-4 left-4 z-50` | Covers bottom-left; near hero seat in 2P |
| `kouppi/apps/web/components/SoundControl.tsx` | Fixed top-right | Lower risk for seats |

### 1.11 Tests touching table UI

| Path | Coverage |
|------|----------|
| `kouppi/apps/web/__tests__/multiplayer.room.test.tsx` | Mocks `MultiplayerTableGraphics` — no seat layout assertions |
| `kouppi/apps/web/__tests__/sprint*.multiplayer.test.tsx` | Store/socket tests |
| **None** | `PlayerSeat`, `seatPositions`, `PokerTable` |

**Test stack:** Vitest + Testing Library; Playwright listed but E2E may be skipped.

---

## 2. Which Component Renders Player Panels?

**`PlayerSeat`** (`kouppi/apps/web/components/game/PlayerSeat.tsx`) is the sole player panel renderer.

It is instantiated exclusively from **`PokerTable.tsx`**:

```tsx
{players.map((player, index) => {
  const position = getPlayerPosition(index, players.length, effectiveMyIndex);
  return (
    <div key={player.id} className="absolute z-30" style={position}>
      <PlayerSeat
        player={player}
        isCurrentTurn={index === currentIndex}
        isMe={player.id === playerId}
        isBankrupt={player.bankroll <= 0}
        avatar={avatars[player.id]}
      />
    </div>
  );
})}
```

Mode shells pass `players`, `currentIndex`, `playerId`, and `avatars` into `PokerTable`; they never render seats directly.

---

## 3. How Player Seat Positions Are Calculated

### 3.1 Fixed anchor ring (8 slots)

Defined in `seatPositions.ts` as percentage `top`/`left` within `.table-tilt`:

| Index | top | left | Approx. position |
|-------|-----|------|------------------|
| 0 | 85% | 50% | Bottom center (hero default) |
| 1 | 70% | 15% | Lower left |
| 2 | 35% | 5% | Mid left |
| 3 | 8% | 20% | Upper left |
| 4 | 8% | 50% | **Top center** |
| 5 | 8% | 80% | Upper right |
| 6 | 35% | 95% | Mid right |
| 7 | 70% | 85% | Lower right |

All positions use `transform: translate(-50%, -50%)` — element center anchored to the coordinate.

### 3.2 Viewer-relative rotation

```ts
const adjustedIndex = (index - myIndex + totalPlayers) % totalPlayers;
```

Player count mappings:

| Players | Seat indices used |
|---------|-------------------|
| ≤ 2 | `[0, 4]` — hero bottom, opponent **top center** |
| ≤ 4 | `[0, 2, 4, 6]` — bottom, left, top, right |
| 5–8 | `adjustedIndex % 8` — all 8 slots (wrapping) |

`effectiveMyIndex` in `PokerTable`: if `playerId` not found (spectator), defaults to **0** — seats rotate as if viewer were first player.

### 3.3 Center-table vertical stack (same coordinate space)

All absolute within `.table-tilt` (`aspect-[16/10]`, `rotateX(12deg)`):

| Element | Position | z-index |
|---------|----------|---------|
| Dealer chip tray | `top: 5%` | 5 |
| Dealer banner (`dealerMessage`) | `top: 16%` | 10 |
| Pot + `ChipStack` | `top: 38%` | 10 |
| Center cards (`children`) | `top: 54%` | 20 |
| Player seats | `PLAYER_POSITIONS` | **30** |

Decorative safe zones (pointer-events none, visual only):

- `.table-action-zone` — `top: 52%`, 62% × 38% ellipse
- `.table-pot-zone` — `top: 38%`, 24% × 17% ellipse

### 3.4 Unused helper

`getSeatPositionForPlayer(playerId, players, viewerPlayerId)` exists but is **not imported anywhere**. Emotes anchor relative to `PlayerSeat` DOM, not this helper.

### 3.5 No container-relative or breakpoint-aware layout

- Positions are **viewport/table-percent only** — no `ResizeObserver`, no CSS container queries.
- No distinction between desktop/tablet/mobile seat configs.
- `ThreeDTablePlaceholder` uses polar math (`angles` array) — a separate experiment, not production.

---

## 4. Root Cause Analysis — Overlaps & Obstruction

### 4.1 Bot 1 / top seat vs central UI (desktop & mobile)

**Single-player default:** You (index 0) + Bot 1 (index 1). With hero rotation, Bot 1 maps to slot **4 (top center, 8% from top)**.

The center column stacks:

- Dealer banner at **16%** (`YOUR TURN`, `BOT THINKING...`, resolution text)
- Pot/chips at **38%**
- Cards at **54%**

A top-center seat panel (~72–88px min-width + padding + avatar + 3–4 text rows) extends downward from 8%, **overlapping dealer banner and pot**. When Bot 1 is active:

- `scale-105 sm:scale-110` enlarges the panel further.
- Green success ring + shadow adds visual clutter over central messages.

### 4.2 "Your turn" on every active seat (bug)

```tsx
{isCurrentTurn && (
  <div className="... animate-pulse">Your turn</div>
)}
```

This is **not gated on `isMe`**. When Bot 1's turn is active, Bot 1's seat shows **"Your turn"** — incorrect copy and +1 layout row under the seat, worsening overlap with center content and duplicating:

| Source | Message |
|--------|---------|
| `dealerMessage` in mode shells | `"YOUR TURN"` / `"BOT THINKING..."` |
| `GameHUD` status banner | `"Waiting for {name}'s move..."` |
| `GameActionPanel` | `"YOUR MOVE"` |
| `PlayerSeat` | `"Your turn"` (all current-turn seats) |
| `GameHUD` turn timer | Numeric ring (MP only) |

### 4.3 Player panel sits ON the felt, not on the rail

Seat anchors at 85%/70%/35%/8% place panel **centers inside the oval felt**, not on the outer rail/cushion. The visual reads as floating HUD boxes on the play surface rather than perimeter-attached pods.

Slot 0 (hero) at `85%` is near the bottom felt edge but still inside the ellipse — competes with:

- `GameActionPanel` below the table
- Chat/emote FABs on multiplayer
- Center cards when table is short on mobile

### 4.4 No per-seat bet/chip layer

**There are no per-player bet markers on the table today.**

- Central pot only: `ChipStack` at 38%.
- `TurnInfo.betAmount` exists in game-core but is **not rendered** on seats.
- `ChipFlyAnimation` uses fixed `bottom: 28%` and random `left: 38–62%` — not tied to seat positions.

User feedback mentioning "Bot 1 overlaps its own chips" likely refers to **central pot chips** appearing under/near the top seat, or transient chip-fly animation paths — not a dedicated per-seat bet widget.

### 4.5 Turn styling increases footprint

Active seat classes:

- `bg-black/65 ring-2 ring-success scale-105 sm:scale-110`
- Optional gold ring for `isMe` (`ring-gold/80`) — stacks with turn ring
- `animate-pulse` on turn text

Combined with vertical flex column layout, active seats are the **largest** elements on the table.

### 4.6 Emote bubble overflow

`PlayerEmote` sits at `absolute -top-10` above each seat — adds ~40px above top seats, increasing clipping risk at viewport top on mobile.

### 4.7 Mobile: scaled desktop, not dedicated layout

Responsive behavior is limited to:

- `sm:` padding/font on `PlayerSeat` (`min-w-[72px]` → `min-w-[88px]`)
- Table rail inset tweaks
- Page `px-3` / `px-4`

**Seat `%` coordinates unchanged at all widths.** On 320px:

- Table max-width `max-w-4xl` but constrained by container; aspect 16:10 yields ~320×200px table.
- Full vertical seat pods at 4+ positions consume most of the felt.
- Bottom hero seat + action dock + chat FAB stack vertically — hero seat may feel cramped or obscured.

### 4.8 Visual quality issues (matches user feedback)

| Current | Issue |
|---------|-------|
| `bg-black/55–65` rounded-xl box | Large opaque black rectangle on felt |
| Emoji in circle (`Avatar`, fallback `😊`) | Casual / childish vs poker-table aesthetic |
| Vertical stack: avatar → name → bankroll → turn | Tall pod; not compact horizontal "seat pod" |
| Green success turn ring | Poker apps typically use blue/cyan active state |
| Raw bankroll integer | No compact formatting (K/M) |

---

## 5. Shared vs Mode-Specific Table Implementations

```
┌─────────────────────────────────────────────────────────────┐
│  /play/single          /room/[id]         /career → room    │
│       │                     │                    │          │
│  TableGraphics.tsx    MultiplayerTableGraphics.tsx (shared) │
│       │                     │                    │          │
│       └──────────────┬──────┘                    │          │
│                      ▼                           │          │
│               PokerTable.tsx  ◄── SINGLE table implementation
│                      │                                      │
│         ┌────────────┼────────────┐                        │
│         ▼            ▼            ▼                        │
│   PlayerSeat   CenterCards   seatPositions.ts              │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Shared? | Notes |
|-------|---------|-------|
| `PokerTable`, `PlayerSeat`, `seatPositions` | **Yes** | One change affects SP, MP, Career |
| `CenterCards`, `useCenterCardsPresentation` | **Yes** | |
| `GameHUD`, `GameActionPanel`, `GamePanels` | **Yes** | |
| `CasinoBackground`, table themes | **Yes** | |
| `TableGraphics` vs `MultiplayerTableGraphics` | Mode shells | Different stores, dealer message logic, MP has timer/kick/emotes |
| Waiting room / Career lobby lists | **Separate** | Row UI, not `PlayerSeat` |
| `ThreeDTablePlaceholder` | **Separate** | Not live |

### Supported player counts

| Context | Count |
|---------|-------|
| Single-player | 1 human + 0–7 bots → **2–8 players** (`SettingsDialog`) |
| Multiplayer rooms | Default `maxPlayers: 8` (`rooms.ts`, server) |
| Career | `MAX_PLAYERS_PER_ROOM` (server career module) |
| Seat slots defined | **8** in `PLAYER_POSITIONS` |
| game-core `TableConfig.maxPlayers` | Up to 20 (theoretical; UI only maps 8 slots) |

---

## 6. Current Responsive Behavior

### Breakpoints

- Tailwind default: `sm` = 640px only in practice (no custom breakpoints in `tailwind.config.js`).
- User-required test widths (320–1440) have **no dedicated seat layout rules**.

### What scales with `sm:`

| Component | Mobile | sm+ |
|-----------|--------|-----|
| `PlayerSeat` | `min-w-[72px]`, `p-2`, `text-[10px]` | `min-w-[88px]`, `p-2.5`, turn `scale-110` |
| `PokerTable` rail | `inset-[3px]`, `inset-[14px]` felt | `inset-[5px]`, `inset-[19px]` |
| Dealer/pot text | smaller | larger |
| `GameHUD` | column header | row header |
| `GameActionPanel` | 2-col buttons | 4-col |

### What does NOT adapt

- Seat `%` positions per breakpoint
- Horizontal vs vertical seat pod layout
- Perimeter vs felt anchoring
- Bet marker placement
- Table tilt (`rotateX(12deg)`) — fixed in CSS
- z-index layering strategy

---

## 7. Player State Data Available for Seat UI

### 7.1 In-game `Player` (`@kouppi/game-core`)

```ts
interface Player {
  id: string;
  name: string;
  bankroll: Chips;      // number
  isBot: boolean;
  active: boolean;      // false when bankrupt
}
```

### 7.2 Turn-level (available but mostly unused in seat UI)

```ts
interface TurnInfo {
  playerId: string;
  upcards?: Upcards;
  betAmount?: Chips;    // current player's bet — NOT rendered on table
  reveal?: Card;
}
```

### 7.3 Remote lobby metadata (`PlayerInfo` in `remoteGameStore`)

```ts
type PlayerInfo = {
  id: string;
  name: string;
  avatar?: AvatarConfig;
  ready?: boolean;
  connected?: boolean;
  reconnectRemainingSec?: number | null;
};
```

Merged into seat avatars via `avatarMap` in mode shells. **`connected` is not passed to `PlayerSeat` today.**

### 7.4 What `PlayerSeat` receives and displays

| Field | Source | Displayed? |
|-------|--------|------------|
| `id` | `Player` | Key only |
| `name` | `Player` | Yes, truncated `max-w-[76px]` |
| `bankroll` | `Player` | Yes, raw number in gold pill |
| `isBot` | `Player` | Avatar fallback only (`getBotAvatar`) — **no BOT badge** |
| `isMe` | derived | Gold ring + `(you)` suffix |
| `isCurrentTurn` | `index === currentIndex` | Green ring, scale, **"Your turn"** |
| `isBankrupt` | `bankroll <= 0` | Opacity + grayscale + error pill |
| `avatar` | optional `AvatarConfig` | Emoji circle via `Avatar` |
| `active` | `Player` | **Not passed** — bankrupt inferred from bankroll |
| `betAmount` | `TurnInfo` | **Not available** |
| `connected` | `PlayerInfo` (MP) | **Not available** |
| Winner | `lastResolution` | **Not on seat** — HUD/celebration only |

### 7.5 Domain terminology

KOUPPI uses **bankroll** and **chips** (type alias `Chips = number`), **pot** for central pool, **ante** for round start. No "fold" — players **pass**. No "all-in" label — **kouppi** is full-pot bet.

### 7.6 Avatar system

```ts
type AvatarConfig = { emoji: string; color: string; borderColor: string };
```

- Humans: picker in waiting room / lobby; fallback `getAvatarFromId` (SP) or random categories.
- Bots: `getBotAvatar(id)` — deterministic emoji from `["🤖","🦾","👾",...]`.
- Missing avatar fallback in `PlayerSeat`: gray circle with **😊**.

---

## 8. Styling Architecture & Reusable Primitives

### Three layers

1. **Tailwind utilities** inline in components
2. **Global semantic classes** in `globals.css`:
   - Table: `.table-perspective`, `.table-tilt`, `.table-dealer-banner`, `.table-pot-amount`, `.table-action-zone`, `.table-pot-zone`
   - HUD: `.hud-header-strip`, `.hud-timer-ring`, `.hud-status-banner`, `.game-action-dock*`
   - Chips: `.casino-chip`, `animate-chip-fly`, `animate-chip-stack`
   - Overlays: `.chat-fab`, `.emote-fab`, `.avatar-display`
3. **Theme inline styles** from `tableThemes.ts` / `useTableTheme()` (felt gradients, rail colors, glow)

### 3D effect

CSS `perspective: 1500px` + `rotateX(12deg)` on `.table-tilt` — not WebGL/PixiJS.

### Design tokens (tailwind.config.js)

- Felt greens, rail browns, gold/brass accents, `bg-casino` navy backgrounds
- User desired direction mentions **blue/black navy felt** — current default theme is **green felt + brown rail**; themes may override via `tableThemes.ts`

### Reusable UI primitives suitable for seat refactor

| Primitive | Use for seats |
|-----------|---------------|
| `Avatar` / `avatar-display` | Base avatar circle — needs bot/human/initials variant |
| `HudButton` | Not for seats |
| `Chip` / `ChipStack` | Bet markers (`PlayerBetMarker`) |
| `.hud-badge` | Status badges (BOT, TURN, disconnected) |
| `clsx` (dependency) | Conditional seat classes |

### No existing components for

- Horizontal seat pod layout
- Seat layout configuration by breakpoint
- Popover/bottom sheet (would need simple custom or existing modal patterns — `ConfirmDialog`, `game-modal-panel` exist)

---

## 9. Z-Index & Layering (Current)

| Layer | z-index | Notes |
|-------|---------|-------|
| Table pedestal/shadows | below content | |
| Dealer tray | 5 | |
| Dealer banner, pot | 10 | |
| Center cards | 20 | |
| **Player seats** | **30** | Above cards/pot — seats can visually cover center content |
| Emote above seat | 40 (local) | |
| Chip fly animation | 40 (fixed viewport) | |
| Chat/emote FABs | 50 | |
| Modals/confirm | 50+ | |

**Problem:** Seats at z-30 sit **above** pot (10) and cards (20), so overlap is visually seats-on-top-of-play-area, not clipped behind.

---

## 10. Risks in Changing Table Geometry

| Risk | Detail | Mitigation direction |
|------|--------|---------------------|
| **Single shared pipeline** | `seatPositions.ts` change affects SP, MP, Career simultaneously | Incremental; feature-flag or layout version if needed |
| **Hero rotation** | Must keep `(index - myIndex) % N` correct; spectator `effectiveMyIndex = 0` | Test spectator + all player counts |
| **Center stack coupling** | Dealer/pot/cards use hardcoded `%` tops | Define central **safe zone** rect; move seats outside it |
| **2-player top seat** | Slot 4 at 8% inherently collides | 2P-specific outer anchors or move opponent to side |
| **Turn scale animation** | `scale-110` magnifies bounding box | Prefer ring/glow without scale, or scale avatar only |
| **Emote anchoring** | Relative to seat DOM | Update if seat structure changes |
| **Chip fly animation** | Decoupled from seats | Wire to bet anchor coords later |
| **MP overlays** | Chat/emote FAB positions fixed | Coordinate with bottom hero + action dock |
| **game-core maxPlayers 20 vs 8 UI slots** | Layout must not break if >8 (edge case) | Clamp or extend slot ring |
| **Empty seats** | Game removes bankrupt players over rounds; no empty-seat placeholders in live UI | Confirm reducer behavior before empty-seat UI |
| **Tests** | No layout tests today | Add unit tests for seat config as part of implementation |
| **ThreeD placeholder drift** | Different polar math | Do not treat as source of truth |

---

## 11. Key Type Definitions (reference)

```ts
// seatPositions.ts
interface SeatPosition {
  top: string;
  left: string;
  transform: string;
}

// PlayerSeat.tsx
interface SeatPlayer {
  id: string;
  name: string;
  bankroll: number;
  isBot?: boolean;
}

interface PlayerSeatProps {
  player: SeatPlayer;
  isCurrentTurn: boolean;
  isMe: boolean;
  isBankrupt: boolean;
  avatar?: AvatarConfig;
}

// PokerTable.tsx
interface PokerTableProps {
  pot: number;
  players: Player[];
  currentIndex: number;
  playerId?: string;
  children?: React.ReactNode;
  dealerMessage?: string;
  avatars?: Record<string, AvatarConfig>;
}
```

---

## 12. Gap Analysis vs Target UX (preview for Phase 1)

| Requirement | Current state |
|-------------|---------------|
| Perimeter-anchored seat pods | Seats on felt at fixed % |
| Separate bet/chip layer per player | Central pot only; `betAmount` unused |
| Central safe zone reserved | Decorative zones only; seats ignore them |
| Compact horizontal desktop pod | Vertical stack in black box |
| Mobile-specific compact layout | Same layout, smaller text |
| Blue/cyan active turn (accessible) | Green success ring + "Your turn" text |
| BOT badge / professional bot avatar | Emoji only |
| Initials fallback for humans | 😊 emoji fallback |
| Compact money formatting | Raw integer |
| No large YOUR TURN under seat | Present on all active seats |
| Layout driven by player count + breakpoint + container | Player count only |
| Seat tap detail popover | Not implemented |

---

## 13. Recommended Next Steps (Phase 1+)

1. **Phase 1:** Write `PLAYER_SEAT_UI_SPEC.md` — component architecture, seat-layout model, z-index spec, breakpoints, acceptance criteria.
2. **Phase 2:** Add file-level implementation checklist to spec.
3. **Phase 3:** Implement in order: layout foundation → `PlayerSeat` refactor → bet markers → turn redesign → mobile variant.
4. **Phase 4:** Vitest tests for `seatPositions` + `PlayerSeat`; manual test matrix doc.

---

## Appendix A — Turn Indicator Inventory

| Location | When shown | Copy |
|----------|------------|------|
| `PokerTable` dealer banner | Always during play | `YOUR TURN`, `KOUPPI`, `BOT THINKING...`, resolution |
| `GameHUD.statusBanner` | MP: waiting; SP: bot thinking | `Waiting for X...` / `🤖 X is thinking...` |
| `GameHUD.turnTimer` | MP, active turn | Numeric seconds ring |
| `GameActionPanel` | Local player's turn with cards | `YOUR MOVE` |
| `PlayerSeat` | **Any** current turn seat | `Your turn` (bug) |

---

## Appendix B — Single-Player Bot Count Configuration

From `SettingsDialog.tsx`:

- `numberBots`: 0–7 (clamped)
- Total players: 1–8
- Default: 1 bot → **2-player** layout (hero bottom, Bot 1 top center) — highest overlap scenario

---

*End of Phase 0 audit.*
