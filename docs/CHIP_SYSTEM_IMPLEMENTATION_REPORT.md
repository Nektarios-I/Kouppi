# KOUPPI Chip System — Implementation Report

**Date:** 2026-07-23  
**Status:** Done

---

## Status

**Done** — Official denomination model, visual stacks (player / wager / pot), transfer derivation + travel layer, shared SP/MP/Career integration via `PokerTable` + table feedback, tests, and docs.

---

## Exact files changed / added

### Added

- `docs/CHIP_SYSTEM_AUDIT_AND_SPEC.md`
- `docs/CHIP_SYSTEM_MANUAL_TEST.md`
- `docs/CHIP_SYSTEM_IMPLEMENTATION_REPORT.md` (this file)
- `apps/web/lib/chips/denominations.ts`
- `apps/web/lib/chips/types.ts`
- `apps/web/lib/chips/decomposeAmountToChips.ts`
- `apps/web/lib/chips/chipPresentation.ts`
- `apps/web/lib/chips/formatChipAmount.ts`
- `apps/web/lib/chips/deriveChipTransfers.ts`
- `apps/web/lib/chips/dedupeTransfers.ts`
- `apps/web/lib/chips/index.ts`
- `apps/web/components/chips/PokerChip.tsx`
- `apps/web/components/chips/ChipStack.tsx`
- `apps/web/components/chips/PlayerChipStack.tsx`
- `apps/web/components/chips/PotChipStack.tsx`
- `apps/web/components/chips/ChipTransferLayer.tsx`
- `apps/web/hooks/useChipTransferEvents.ts`
- `apps/web/__tests__/chips.decompose.test.ts`
- `apps/web/__tests__/chips.components.test.tsx`

### Modified

- `apps/web/components/PokerTable.tsx` — `PotChipStack`
- `apps/web/components/game/TableSeatLayout.tsx` — bankroll stacks + wager markers
- `apps/web/components/game/seatLayout.ts` — `bankroll` anchor (`t=0.28`)
- `apps/web/components/game/PlayerBetMarker.tsx` — official wager stack
- `apps/web/components/tableFeedback/TablePhysicalFeedbackLayer.tsx` — `ChipTransferLayer`
- `apps/web/components/ChipAnimation.tsx` — compatibility shim → official tokens
- `apps/web/app/globals.css` — stack styling
- `apps/web/__tests__/seatLayout.test.ts` — bankroll anchor tests

**Not modified:** game-core reducer, SHISTRI math, server protocol, bankroll rules.

---

## Official KOUPPI chip denomination standard

| Value | Key | Label | Fill |
|------:|-----|-------|------|
| 1000 | maroon | 1K | `#6E1E2B` |
| 500 | purple | 500 | `#5B2A86` |
| 100 | black | 100 | `#20242B` |
| 25 | green | 25 | `#14734A` |
| 10 | blue | 10 | `#1C5FA8` |
| 5 | red | 5 | `#B92D3A` |
| 1 | ivory | 1 | `#E8DDC6` |

Source: `apps/web/lib/chips/denominations.ts`.

Economy decision: game-core `Chips` are **integers** (`minChip = 1`). No decimal denomination added.

---

## Conversion / decomposition

- Greedy highest → lowest via `decomposeAmountToChips`.
- Valid non-negative integers: `sum(count × value) === sourceAmount`.
- Invalid / negative / NaN → empty stack (no crash).

---

## Visual caps / count markers

| Cap | Value |
|-----|------:|
| Denomination groups | 7 |
| Visible discs / group | 5 |
| Player bankroll discs | 18 |
| Pot discs | 22 |
| Transfer discs | 10 |

Overflow → `×N` marker; `representedAmount` remains exact; `isApproximate` stays false when markers cover overflow.

---

## Behavior summary

### Player stacks

- Anchor: `slot.bankroll` between seat and bet, toward center.
- Visual only; exact bankroll remains on `PlayerSeat`.
- Zero / bankrupt → no discs.

### Wager markers

- Existing `slot.bet` + `PlayerBetMarker`.
- Render **only** when `currentBetByPlayerId[id] > 0`.
- Never invented from pot alone (post-resolve `turn` is cleared in reducer).

### Pot stack

- `PotChipStack` at `data-pot-anchor` with exact label + POT caption.

### Transfers

- Derived from authoritative `lastResolution` (same truth as table feedback).
- Loss / stake → seat bankroll → pot (`bet-to-pot` / `stake-to-pot` / `shistri-loss`).
- Win → pot → winner (`pot-to-winner` / `shistri-win`).
- Duration 350–750 ms; capped travelling stack (≤10 discs) + exact amount badge.
- Dedupe: bounded seen-set (64) on transfer / physical event ids.
- Missing anchors → skip travel safely; ribbon/log still fire.

### SHISTRI

- Respects core semantics: loss `amount` = stake; win `amount` = full pot.
- Badge retained on physical layer.
- No fake multi-loser animations; no inventing undeclared stake state.

### Shared modes

- SP: `TableGraphics` → `PokerTable`.
- MP + Career: `MultiplayerTableGraphics` → same `PokerTable` + feedback overlays.

### Responsive

- Mobile/tablet: denser stacks (`xs`, top groups); local hero scaled down for action dock clearance.
- No mode-specific absolute % hardcodes beyond shared `seatLayout`.

### Accessibility / reduced motion

- Stack containers: `Player bankroll: N chips` / `Pot: N chips`.
- Decorative discs `aria-hidden`.
- Effects Full / Reduced / Off + `prefers-reduced-motion` via `tableEffectsStore` / `effectiveEffectsLevel`.
- Reduced: no travel path; Off: no physical layer.

---

## Tests added

- `chips.decompose.test.ts` — decompose, caps, format, derive, dedupe.
- `chips.components.test.tsx` — PokerChip, ChipStack, Player/Pot, TransferLayer, PokerTable integration.
- `seatLayout.test.ts` — bankroll between seat and bet.

---

## Commands run and results

| Command | Result |
|---------|--------|
| `pnpm --filter @kouppi/web exec vitest run __tests__/chips.*` | **48 passed** |
| `pnpm --filter @kouppi/web exec vitest run` | **27 files / 178 tests passed** |
| `pnpm --filter @kouppi/web exec tsc --noEmit` | Pre-existing errors only (`serverUrl.test.ts` NODE_ENV assign; `remoteGameStore.ts` `.code`) — **unrelated** to chip work |
| Web production build | Next.js **compiled successfully**; build then failed typecheck on pre-existing `remoteGameStore.ts:315` (`result.code`) — **unrelated** to chip work |

Game-core / server tests not run (untouched).

---

## Manual checks required

See `docs/CHIP_SYSTEM_MANUAL_TEST.md` (SP / MP / Career / settings / widths / edges / overlaps).

---

## Known limitations / extension points

1. **No server event IDs** — client dedupe keys; reconnect with cleared seen-set may re-emit once.
2. **Per-seat live wager** rarely visible — reducer clears `turn` atomically; markers ready when state exposes bets.
3. **Split pots / `pot-to-winners`** — not in game-core; API reserved, not invented.
4. **Optimistic stake pulse** (`publishStake`) exists in feedback but shells do not require it for accuracy.
5. Legacy `ChipFlyAnimation` / `AnimatedPot` remain unused stubs in shim module.
