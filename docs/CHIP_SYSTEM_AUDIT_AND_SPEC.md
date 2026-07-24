# KOUPPI Chip System — Audit & Spec

**Date:** 2026-07-23  
**Scope:** Visual chip stacks + seat↔pot transfer animation. Presentation only — no rule, bankroll, SHISTRI math, protocol, or matchmaking changes.  
**Modes:** Single Player (`TableGraphics`), Multiplayer + Career (`MultiplayerTableGraphics` via shared remote store).

---

## 1. Current architecture

### Shared rendering path

```
TableGraphics | MultiplayerTableGraphics
  → PokerTable (pot ChipStack @ data-pot-anchor)
  → TableSeatLayout (bet markers z-15, seats z-25)
  → PlayerSeat (exact bankroll text)
  → TableFeedbackOverlays → TablePhysicalFeedbackLayer (seat↔pot flies)
```

| Concern | Exact path |
|---------|------------|
| Pot UI | `apps/web/components/PokerTable.tsx` |
| Seats / bets | `apps/web/components/game/TableSeatLayout.tsx`, `seatLayout.ts` |
| Legacy chips | `apps/web/components/ChipAnimation.tsx` (`Chip`, `ChipStack`, orphan `ChipFlyAnimation`) |
| Physical flies | `apps/web/components/tableFeedback/TablePhysicalFeedbackLayer.tsx` |
| Feedback normalize | `apps/web/lib/tableEventFeedback/normalize.ts` |
| Effects prefs | `apps/web/store/tableEffectsStore.ts` |
| SP store | `apps/web/store/gameStore.ts` |
| MP/Career store | `apps/web/store/remoteGameStore.ts` |
| Authority | `packages/game-core` `GameState`, `Resolution`, `reducer.ts` |

### Existing chip behavior

- Pot: `ChipStack` with incorrect denominations (includes gold/50, no 1/1000/maroon).
- Bet markers: wired to `currentBetByPlayerId` ← `turn.betAmount`, but reducer clears `turn` in the same action → markers almost never show post-commit.
- Transfers: `lastResolution` → `normalizeResolutionEvent` → `chip_to_pot` / `chip_from_pot` → single `Chip` fly (not true denomination stacks).
- No per-seat bankroll chip stacks.

### Economy

- `Chips = number`; integer units; `SHISTRI_DEFAULT_MIN_CHIP = 1`.
- No decimal chip values in game-core. Presentation assumes non-negative integers.

---

## 2. Data availability matrix

| Data needed | Single Player | Multiplayer | Career | Exact source | Reliable for animation? | Fallback |
|-------------|---------------|-------------|--------|--------------|-------------------------|----------|
| Player ID | Yes | Yes | Yes (MP path) | `players[].id` | Yes | Skip transfer |
| Bankroll | Yes | Yes | Yes | `players[].bankroll` | Yes (display) | Empty stack |
| Current pot | Yes | Yes | Yes | `round.pot` | Yes | Empty pot stack |
| Per-seat wager | Partial | Partial | Partial | `turn.betAmount` while turn live | **No after resolve** | Show only when `> 0`; never invent |
| Acting player | Yes | Yes | Yes | `currentIndex` / `turn.playerId` | Yes | — |
| Action type | Yes | Yes | Yes | `lastResolution.kind` | Yes | No transfer |
| Winner | Yes (single) | Yes | Yes | `lastResolution.playerId` + `win` | Yes | No invent splits |
| Resolution amount | Yes | Yes | Yes | `lastResolution.amount` | Yes | Skip if ≤0 |
| SHISTRI stake | Client UI only pre-resolve | Same | Same | `shistriBet(...)`; outcome `amount` | After resolve: Yes | Win = full pot; loss = stake |
| State revision | No | `gameStateVersion` | Same MP | Server snapshot `version` | Partial | Client dedupe key |
| Round / match end | Yes | Yes | Yes | `phase === RoundEnd` | Major UI only | No duplicate pot fly |

---

## 3. Implementation inventory

| Item | Action |
|------|--------|
| Official `lib/chips/*` denominations + decompose + presentation | **Create** |
| `PokerChip`, `ChipStack`, `PlayerChipStack`, `PotChipStack` | **Create** |
| `ChipTransferLayer`, `useChipTransferEvents`, derive/dedupe | **Create**; wire into physical feedback |
| Pot `ChipStack` in `PokerTable` | **Replace** with `PotChipStack` |
| `PlayerBetMarker` | **Enhance** to use official stack |
| Per-seat bankroll stack anchors | **Add** `bankroll` on `SeatSlotConfig` |
| `ChipAnimation.Chip` / legacy `breakdownChips` | **Shim** → new tokens; deprecate gold/50 |
| `ChipFlyAnimation` / `AnimatedPot` | Leave unused; do not re-wire |
| Table feedback ribbon / log / effects | **Retain**; physical flies use new transfer visuals |
| Confetti / Celebration for normal wins | Already out of feedback path — leave |

---

## 4. Chip architecture

### Modules

```
apps/web/lib/chips/
  denominations.ts      — KOUPPI_CHIP_DENOMINATIONS (source of truth)
  types.ts
  decomposeAmountToChips.ts
  chipPresentation.ts   — visual caps + VisualChipStack
  formatChipAmount.ts
  deriveChipTransfers.ts
  dedupeTransfers.ts
  index.ts

apps/web/components/chips/
  PokerChip.tsx
  ChipStack.tsx
  PlayerChipStack.tsx
  PotChipStack.tsx
  ChipTransferLayer.tsx

apps/web/hooks/useChipTransferEvents.ts
```

### Boundaries

- **Source of truth:** game-core / stores (`bankroll`, `pot`, `lastResolution`).
- **Presentation:** chip modules only decompose / cap / animate visuals.
- **Transfers:** derived from `lastResolution` (same truth as table feedback). Never invent amounts.
- **Dedupe:** bounded seen-set (cap 64) keyed by resolution identity (+ optional version salt).
- **Per-seat bet:** render only when authoritative `currentBetByPlayerId[id] > 0`.

### SHISTRI

- Loss: `amount` = stake → `shistri-loss` / `bet-to-pot`-style seat→pot.
- Win: `amount` = full pot → `shistri-win` / pot→winner.
- No separate pre-reveal declare state in core; optional optimistic stake pulse already exists in feedback (`publishStake`) — not required for accuracy.

---

## 5. Layout plan

| Anchor | Placement | Notes |
|--------|-----------|-------|
| Bankroll stack | `betAnchor(seat, center, t≈0.28)` → `slot.bankroll` | In front of seat toward center; z≈14 |
| Wager marker | Existing `slot.bet` (t=0.55) | z=15; only if amount > 0 |
| Pot | Existing `data-pot-anchor` | z=10 chrome; stacks slightly larger |
| Transfer layer | Fixed overlay z=18 (existing physical layer) | `pointer-events: none` |
| Seats | z=25 | Above static stacks |
| Ribbon / dock | z=22 / 40 | Unchanged |

**Mobile:** compact stacks; fewer denomination groups; local bottom stack must clear action dock; no horizontal table scroll.

**Z-index (intentional):** felt → cards (20) → bankroll (14) → wager (15) → pot chrome (10) → transfers (18) → seats (25) → ribbon (22) → dock (40) → major modals (≥50).

---

## 6. Test plan

1. Pure: decompose, presentation caps, format, transfer derive/dedupe.
2. Components: PokerChip, ChipStack, Player/Pot, ChipTransferLayer (reduced-motion, missing anchors, cleanup).
3. Integration: SP/MP shared `PokerTable` path; resolution → transfer intent; RoundEnd does not invent duplicate ordinary pot transfer.
4. Commands: focused vitest; web suite; typecheck/build as available.

---

## Decisions locked for implementation

1. Integer chip units only (no decimal denomination).
2. Official set: 1, 5, 10, 25, 100, 500, 1000 (ivory→maroon).
3. Caps: 7 groups; 5 discs/group; 18 player / 22 pot / 10 transfer discs.
4. Drive transfers from `lastResolution` amounts — never guess bankroll deltas alone.
5. No framer-motion; CSS + timers; respect `tableEffectsStore` + `prefers-reduced-motion`.
