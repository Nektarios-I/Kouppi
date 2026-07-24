# KOUPPI Chip System — Manual Test Plan

**Date:** 2026-07-23  
**Prerequisite:** Local web + server running; table effects settings available via Sound control.

---

## A. Single Player

1. Open `/play/single`, start a table.
2. Confirm each seated player shows a compact **bankroll chip stack** in front of the seat (toward pot) and exact bankroll text on the seat pod.
3. Confirm central **pot** shows chip stack + exact numeric label + “POT”.
4. Place a normal bet → after resolution, chips travel **seat → pot** (loss) or **pot → seat** (win) matching `lastResolution.amount`.
5. Confirm compact **result ribbon** and event log update; no full-screen celebration for normal outcomes.
6. Declare **SHISTRI** when eligible:
   - Loss: stake amount moves seat → pot; ribbon/log show SHISTRI loss.
   - Win: full pot amount moves pot → winner; pot may go to 0 / RoundEnd.
7. On RoundEnd (pot empty), major modal appears; **no duplicate** ordinary pot-fly invented beyond the resolving transfer.
8. Bankrupt / 0 bankroll: no bankroll discs for that seat.

---

## B. Multiplayer (two browsers)

1. Host creates room; second client joins; start game.
2. Each client sees the same pot stack and seat bankroll stacks from shared state.
3. On a bet resolution, both clients animate the **same direction and amount**.
4. Soft-refresh / reconnect one client: transfer should **not** endlessly replay (dedupe). If seen-set cleared, at most one re-emit is acceptable (documented limitation — no server event id).
5. Spectator (if available): sees stacks + transfers, no action dock.

---

## C. Career

1. Enter a Career game room (same `MultiplayerTableGraphics` path).
2. Repeat SP checks for bankroll stacks, pot, bet/win/SHISTRI transfers.
3. Match end uses Career/MP RoundEnd path — no invented promotion chip flies.

---

## D. Settings & motion

| Setting | Expected |
|---------|----------|
| Effects **Full** | Static stacks + seat↔pot travel |
| Effects **Reduced** | Static stacks; no travel path; ribbon/log still update |
| Effects **Off** | No physical flies; numeric stacks may remain for comprehension |
| OS `prefers-reduced-motion` | Forces reduced travel even if Full |

Master mute / table sound Off: visuals unchanged; optional chip SFX gated.

---

## E. Responsive widths

Resize (or DevTools) to: **320, 360, 375, 390, 414, 768, 1024, 1366, 1440**.

For each:

- No horizontal table scroll.
- Local bottom stack does not cover action dock.
- Pot / cards / dealer banner / result ribbon remain readable.
- Chat FAB / emote FAB / event-log FAB do not collide with stacks.
- Mobile: denser / fewer denomination groups; exact numbers still readable.

---

## F. Edge values

| Case | Check |
|------|-------|
| Pot / bankroll 0 | No discs |
| 1, 5, 25, 100, 500, 1000 | Correct colors + labels |
| 2347 | Maroon/black/green/blue/ivory mix; exact label truthful |
| Large bankroll | Count markers (`×N`), not hundreds of discs |
| Long player name | Truncation on seat; stacks still clear |
| Bankrupt player | Dim seat; no bankroll stack |

---

## G. Overlap checklist

Verify chip piles do **not** cover:

- [ ] Player seat pods / names / avatars  
- [ ] Center cards  
- [ ] Pot numeric label / dealer banner  
- [ ] Action dock  
- [ ] Result ribbon  
- [ ] Chat / emote / hand-history controls  

---

## H. Wager markers

- With only central pot (no live `turn.betAmount` after resolve): **no fake** per-seat wager markers.
- If a live per-seat bet is ever exposed via `currentBetByPlayerId`: marker appears between bankroll stack and pot with exact amount.
