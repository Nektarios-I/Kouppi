# KOUPPI Player Seat UI — Implementation Report

**Date:** 2026-07-17  
**Status:** Done — implemented, unit-tested, production build green

---

## 1. Files / components changed

### Created

| Path |
|------|
| `kouppi/apps/web/components/game/seatLayout.ts` |
| `kouppi/apps/web/components/game/TableSeatLayout.tsx` |
| `kouppi/apps/web/components/game/PlayerAvatar.tsx` |
| `kouppi/apps/web/components/game/PlayerStatusBadge.tsx` |
| `kouppi/apps/web/components/game/PlayerBetMarker.tsx` |
| `kouppi/apps/web/__tests__/seatLayout.test.ts` |
| `kouppi/apps/web/__tests__/PlayerSeat.test.tsx` |
| `kouppi/docs/PLAYER_SEAT_UI_MANUAL_TEST.md` |
| `kouppi/docs/PLAYER_SEAT_UI_IMPLEMENTATION_REPORT.md` |

### Modified

| Path |
|------|
| `kouppi/apps/web/components/game/PlayerSeat.tsx` |
| `kouppi/apps/web/components/game/seatPositions.ts` (compat shim) |
| `kouppi/apps/web/components/PokerTable.tsx` |
| `kouppi/apps/web/components/TableGraphics.tsx` |
| `kouppi/apps/web/components/MultiplayerTableGraphics.tsx` |
| `kouppi/apps/web/app/globals.css` |
| `kouppi/docs/PLAYER_SEAT_UI_SPEC.md` |

---

## 2. Old architecture vs new

### Before

```
Mode shell → PokerTable → getPlayerPosition(% interior) → PlayerSeat
  (tall black vertical card, emoji, “Your turn” row, scale-110)
```

- Seats floated on the felt interior.
- z-30 seats above pot/cards without a safe-zone model.
- No per-seat bet layer.
- Same layout at all breakpoints (only text/padding `sm:` tweaks).

### After

```
Mode shell → PokerTable → TableSeatLayout(seatLayout.ts)
  ├─ PlayerBetMarker @ inner bet anchors (z-15)
  └─ PlayerSeat @ perimeter seat anchors (z-25)
       ├─ desktop/tablet/mobile-hero: horizontal navy pod
       └─ mobile opponents: compact avatar ring + meta
```

Shared by Single Player, Multiplayer, and Career (same `PokerTable` / `MultiplayerTableGraphics` path).

---

## 3. Seat layout & layering model

- **Outer ring:** 8 perimeter slots; viewer-rotated so local player is bottom-center.
- **Inner bets:** `betAnchor(seat, center, t=0.55)` toward `(50, 42)`.
- **Safe zone:** `{ cx:50, cy:42, rx:28, ry:26 }` — seat centers outside ellipse (unit-tested).
- **Counts:** Slot maps for 2–8 players (UI max); N>8 modulo-wraps.
- **Breakpoints:** table `ResizeObserver` → mobile &lt;640 / tablet &lt;1024 / desktop.
- **Layers:** felt → dealer/pot (10) → bets (15) → cards (20) → seats (25) → emotes (30).

---

## 4. Desktop behavior

- Compact **horizontal** pods: avatar | name + badges | bankroll + TURN.
- Dark translucent navy surface, cool gray border.
- Active: cyan ring + glow + `TURN` badge (no full-pod scale).
- Local: gold edge when idle; cyan when active; optional turn timer seconds (MP).
- Top opponent in 2P sits at `y≈4%` so dealer/pot/cards stay clear.

---

## 5. Mobile behavior

- Opponents: **avatar-first** compact seats (no wide black card).
- Hero: short horizontal pod at bottom perimeter.
- Truncated names (~7 chars); compact bankroll line.
- TURN pip + badge; no tall turn text.
- Geometry uses mobile ring (slightly inset sides).

---

## 6. Avatar / bot fallback

| Case | Behavior |
|------|----------|
| Human + `AvatarConfig` | Emoji circle |
| Human, no avatar | Initials monogram + hashed `AVATAR_COLORS` |
| Bot | `getBotAvatar` + amber **BOT** badge |
| Never | Large “Your turn” under bot pods; 😊-only as primary bot identity |

---

## 7. Turn, bets, chips, messages, cards

| Element | Behavior |
|---------|----------|
| Turn | Ring + `TURN`; `sr-only` “Your turn” (me) / “{name}'s turn” (other) |
| Bet markers | Only if `currentBetByPlayerId[id] > 0` from `turn.betAmount` |
| Central pot / cards / dealer | Unchanged positions; seats moved to perimeter + lower z than before relative to spatial clearance |
| Action dock | Still below table; hero stays inside table box |

---

## 8. Tests & commands

```bash
cd kouppi/apps/web
npx vitest run __tests__/seatLayout.test.ts __tests__/PlayerSeat.test.tsx
# → 19 passed

npx vitest run
# → 60 passed (14 files)

npm run build
# → success (Next.js production build)
```

---

## 9. Manual widths

Automated breakpoint/geometry coverage exists; visual sign-off matrix is in  
[`PLAYER_SEAT_UI_MANUAL_TEST.md`](./PLAYER_SEAT_UI_MANUAL_TEST.md)  
(widths 320–1440). Browser pixel QA should still be spot-checked by a human for glow strength / density taste.

---

## 10. Remaining limitations / follow-ups

1. Optional **seat details** popover/sheet — not shipped.
2. Bet markers sparse until/unless `turn.betAmount` is set.
3. Dealer banner `YOUR TURN` retained as center cue (optional later de-dupe).
4. Chat/emote FAB positions unchanged; monitor on very small phones.
5. Subjective polish: active glow strength, BOT badge contrast, mobile density.

---

## Review points for product

- Cyan turn glow intensity (CSS `--seat-turn-glow`)
- Amber BOT badge vs quieter slate
- Compact amounts (`2.5K` style)
- Mobile opponent density (avatar + 2 text lines)
