# KOUPPI Player Seat UI — Manual Test Guide

**Date:** 2026-07-17  
**Feature:** Perimeter-anchored seat pods (Phase 3)

---

## Commands run (automated)

From `kouppi/apps/web`:

```bash
npx vitest run __tests__/seatLayout.test.ts __tests__/PlayerSeat.test.tsx
npx vitest run
npm run build
```

### Results (2026-07-17)

| Command | Result |
|---------|--------|
| Seat unit tests | **19/19 passed** |
| Full web vitest suite | **60/60 passed** (14 files) |
| `npm run build` | **exit 0** (Next.js 14.2.35 production build) |

---

## Automated layout checks covered by unit tests

- Breakpoints at 320 / 639 / 640 / 1023 / 1024 / 1440
- Local player bottom-center for N = 2…8
- Unique seat anchors and unique bet anchors
- `bet ≠ seat` for every slot
- Seat centers outside safe-zone ellipse
- 2-player opponent on top edge (`y < 10`)
- Mobile vs desktop coordinates differ
- Compact money format (`2.5K`, `12.5K`, `1.2M`)
- Human / bot / turn / bankrupt / initials / mobile opponent rendering

---

## Manual visual checklist

### How to launch

1. **Single-player (primary overlap regression):**  
   `npm run dev` from monorepo / web → open `/play/single` → start with **1 bot** (default 2-player).
2. **Multiplayer:** create/join room → `/room/[id]` → start game.
3. **Career:** `/career` → match → lands on `/room/career-game-*` (same table shell).

Use browser DevTools device toolbar for widths below.

### Widths to check

| Width | Focus |
|-------|--------|
| 320 | No clip of TURN badge / top seats; opponents compact |
| 360 | Same |
| 375 | iPhone SE-ish |
| 390 | Common Android |
| 414 | Large phone |
| 768 | Tablet horizontal pods |
| 1024 | Desktop pods |
| 1366 | Laptop |
| 1440 | Wide desktop |

### Scenarios

| # | Scenario | Pass criteria |
|---|----------|---------------|
| 1 | SP 2P, Bot 1 turn | Top seat does **not** cover dealer banner / pot / cards; no “Your turn” text on Bot 1 pod; cyan ring + TURN badge |
| 2 | SP 2P, your turn | Bottom hero pod active; action dock usable; no tall Your turn under pod |
| 3 | SP 4–6 bots | Seats around perimeter; center clear |
| 4 | SP 8 players | All seats visible; no center pile-up |
| 5 | Long name opponent | Truncates with ellipsis; full name in `title` |
| 6 | Large bankroll (e.g. 12500) | Shows compact `12.5K` |
| 7 | Bet placed (when `turn.betAmount` set) | Bet marker between seat and center; not under pod |
| 8 | MP disconnected player | OFF / reconnect badge if connection map present |
| 9 | MP local turn + timer | TURN + seconds on hero seat |
| 10 | Career table | Same seat UI as casual MP |
| 11 | Mobile + action dock | Hero seat does not cover Pass/Bet controls |
| 12 | Mobile + chat/emote FAB | Seats still identifiable |

### Explicit non-overlap checks

- [ ] Seat vs own bet marker
- [ ] Seat vs central pot / ChipStack
- [ ] Seat vs center cards
- [ ] Seat vs dealer banner message
- [ ] Local seat vs action dock
- [ ] Mobile side seats vs viewport edge (minimal clip OK; content readable)

---

## Known limitations / follow-ups

1. Seat tap **details popover** not implemented (optional in spec).
2. Bet markers only appear when `turn.betAmount` is present for a player (game data — not faked).
3. Dealer banner may still show `YOUR TURN` (center cue); seat no longer duplicates a tall turn row.
4. Full pixel-perfect visual QA at every width requires a human pass in the browser (geometry + unit tests automated; screenshot E2E not added).

---

## Manual pass log (fill during QA)

| Width | SP 2P | SP max | MP | Notes |
|-------|-------|--------|-----|-------|
| 320 | | | | |
| 360 | | | | |
| 375 | | | | |
| 390 | | | | |
| 414 | | | | |
| 768 | | | | |
| 1024 | | | | |
| 1366 | | | | |
| 1440 | | | | |
