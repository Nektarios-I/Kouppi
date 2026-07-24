# Table Event Feedback — Manual Test Script

**Date:** 2026-07-23  
**Depends on:** [`TABLE_EVENT_FEEDBACK_AUDIT_AND_SPEC.md`](./TABLE_EVENT_FEEDBACK_AUDIT_AND_SPEC.md)

Use Chrome/Edge/Firefox. Open DevTools → Rendering → emulate `prefers-reduced-motion` when noted. Test at widths: **320, 360, 375, 390, 414, 768, 1024, 1366, 1440**.

---

## Shared expectations (all modes)

For **normal** bet / win / loss / KOUPPI / SHISTRI / pass:

1. **No** full-screen celebration (`🎉 WIN!`, confetti, giant gradient text).
2. **No** blocking OK dialog for the outcome.
3. Compact **result ribbon** appears in the central table zone (not covering action dock).
4. **Hand history** records a matching line (desktop panel or mobile FAB).
5. Chip/seat feedback respects Table effects: Full / Reduced / Off.
6. With Table sound **Off**, no chip/win cue playback for outcomes.
7. Action controls remain usable while ribbon is visible.

For **match / round end** (pot empty):

- Full-screen `RoundEndPanel` (Stay/Leave, Refill & Continue, or Play Again) **is allowed**.

---

## A. Single Player (`/play/single` or equivalent)

| # | Step | Expect |
|---|------|--------|
| A1 | Place a normal bet that wins | Ribbon: `You won {n}`; seat gold highlight briefly; chips move pot→you (Full); no confetti |
| A2 | Place a normal bet that loses | Ribbon: `You lost {n}`; brief loss seat dim; chips seat→pot (Full); no red full-screen |
| A3 | Pass | Ribbon: `{name} passed`; dealer calm `PASS` |
| A4 | KOUPPI win/loss | Ribbon uses won/lost copy; log may tag `(KOUPPI)`; no `🎰 KOUPPI!` overlay |
| A5 | SHISTRI (if eligible) win | Small `SHISTRI` badge; ribbon `You won SHISTRI · +{n}`; warm gold, not cyan |
| A6 | SHISTRI loss | Ribbon `You lost SHISTRI · -{n}`; no confetti |
| A7 | Drain pot to RoundEnd | `RoundEndPanel` appears with standings; ribbon must not replace this major panel |
| A8 | Rapid consecutive resolutions | One ribbon at a time; history bounded; no duplicate identical lines for same resolution |

---

## B. Multiplayer (two clients, same room)

| # | Step | Expect |
|---|------|--------|
| B1 | Client A bets and resolves | Both A and B see matching ribbon + log (names from state) |
| B2 | Client B wins pot | A sees `{B} won {n}`; B sees `You won {n}` |
| B3 | SHISTRI on either client | Both see SHISTRI badge + ribbon; no blocking modal (confirm before send is OK) |
| B4 | Reconnect mid-hand if possible | After sync, do not spam duplicate ribbons for the same resolution key when possible |
| B5 | Pot empty → Stay/Leave | `RoundEndPanel` only; normal ribbon system not used as the blocker |
| B6 | Confirm KOUPPI/SHISTRI dialogs | Still appear **before** action (explicit confirm); after resolve, table feedback only |

---

## C. Career Mode

| # | Step | Expect |
|---|------|--------|
| C1 | Repeat B1–B3 in a Career match room | Same three-layer feedback as multiplayer |
| C2 | Career match ends (pot empty / session end) | Major `RoundEndPanel` / host reset path only — not a normal pot ribbon as the end screen |
| C3 | No fabricated promotion/relegation UI | Only show ranking data if already provided by existing payload |

---

## D. Settings

| # | Step | Expect |
|---|------|--------|
| D1 | Sound FAB → Table effects **Full** | Chip travel + seat highlight + ribbon |
| D2 | Table effects **Reduced** | No chip travel; short fade/state; ribbon remains |
| D3 | Table effects **Off** | No decorative chip/seat FX; ribbon + log remain |
| D4 | Table sound **Off** | No outcome chip cues |
| D5 | Table sound **On** + master unmuted | Subtle chip cues only (not loud win fanfare every hand) |
| D6 | OS `prefers-reduced-motion: reduce` with Full selected | Behaves like Reduced visuals |

---

## E. Responsive / collision

| Width | Checks |
|-------|--------|
| 320–414 | No horizontal overflow; ribbon in safe zone; log FAB ≥44×44; FAB above emote (left), not under chat (right); action dock clear |
| 768 | Desktop log dock usable; ribbon centered |
| 1024–1440 | Seats readable; log does not cover local seat or dock |

Also verify:

- Chat FAB (bottom-right) and Emote FAB (bottom-left) do not overlap the hand-history FAB.
- Opening hand history does not permanently block gameplay (can close).

---

## F. Accessibility smoke

1. Ribbon uses `role="status"` / `aria-live="polite"`.
2. Hand history toggle/FAB has accessible name; focus-visible outline present.
3. Win/loss distinguishable by text, not color alone.

---

## Sign-off checklist

- [ ] SP A1–A8
- [ ] MP B1–B6
- [ ] Career C1–C3
- [ ] Settings D1–D6
- [ ] Responsive E
- [ ] A11y F
