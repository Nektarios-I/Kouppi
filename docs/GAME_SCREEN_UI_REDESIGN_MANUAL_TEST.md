# KOUPPI Game Screen UI Redesign — Verification Matrix

**Date run:** 2026-07-24
**Environment:** Windows 10, Node 25.9.0 (unsupported engine warning expected),
pnpm 10.12.4.

## Automated results

### Focused redesign/regression tests

```powershell
pnpm --filter @kouppi/web test -- --run __tests__/gameScreen.redesign.test.tsx __tests__/gameScreen.integrations.test.ts __tests__/PlayerSeat.test.tsx __tests__/gameActionPanel.shistri.test.tsx __tests__/tableEventFeedback.normalize.test.ts __tests__/sprint3.multiplayer.test.tsx
```

Actual: **PASS** — 6 files, 48 tests.

Coverage exercised:

- shared `GameScreen` zones and reserved dock slot
- all `GameActionDock` states
- compact `GameActionPanel` and preserved SHISTRI copy
- utility identity and one-tap mute
- Settings open/close/Escape/focus/leave request
- History default closed, tabs, entries, Escape, and focus restoration
- local `YOUR TURN` versus opponent `TURN`
- calm dealer local-turn copy
- SP dispatch and Next Turn source integration
- MP intent, confirmation, host, and Career route source integration

### Full web unit/component suite

```powershell
pnpm --filter @kouppi/web test -- --run
```

Actual: **PASS** — 29 files, 201 tests.

The run emitted only pre-existing expected test stderr for simulated auth network
failures and the unsupported Node engine warning.

### Production web build

```powershell
pnpm --filter @kouppi/web build
```

Actual: **PASS**.

`@kouppi/protocol` and `@kouppi/game-core` built, Next.js generated the optimized
production application, and static/type validation completed. Warnings:

- Node 25 is outside the declared `>=20 <23` engine range.
- `caniuse-lite` data is outdated.
- npm reported existing unknown pnpm-related environment keys.

No dependency or lockfile changes were made.

## Browser/manual viewport matrix

Single Player was exercised in a real browser with active-turn controls. DOM
bounds were measured at each viewport for page overflow, table/seat visibility,
dock overflow, action-button visibility, and History clearance.

For every row below, test:

1. waiting/opponent turn
2. local turn with amount controls
3. SP Next Turn or MP pending/disabled
4. after resolution
5. History open on each tab
6. Settings open and scrolled
7. leave confirmation
8. RoundEnd panel

| Width | SP 2P | SP multi-bot | MP player | MP spectator | Career |
|---:|:---:|:---:|:---:|:---:|:---:|
| 320 | Pass | Unverified | Unverified | Unverified | Unverified |
| 360 | Pass | Unverified | Unverified | Unverified | Unverified |
| 375 | Pass | Unverified | Unverified | Unverified | Unverified |
| 390 | Pass | Unverified | Unverified | Unverified | Unverified |
| 414 | Pass | Unverified | Unverified | Unverified | Unverified |
| 768 | Pass | Unverified | Unverified | Unverified | Unverified |
| 1024 | Pass | Unverified | Unverified | Unverified | Unverified |
| 1280 | Pass | Unverified | Unverified | Unverified | Unverified |
| 1366 | Pass | Unverified | Unverified | Unverified | Unverified |
| 1440 | Pass | Unverified | Unverified | Unverified | Unverified |
| 1600+ | Pass | Unverified | Unverified | Unverified | Unverified |

Additional short-screen check: 640×700 passed.

At 320×568 the action shell measured 142px client height and 142px scroll
height; all four action buttons ended at 541.3px, inside the 568px viewport.
At 768px and wider the action shell measured 130px client and scroll height;
all controls remained in one row and inside the viewport. No tested viewport
had document overflow.

Screenshots:

- `C:\Users\User\AppData\Local\Temp\cursor\screenshots\320x568-kouppi.png`
- `C:\Users\User\AppData\Local\Temp\cursor\screenshots\390x844-kouppi.png`
- `C:\Users\User\AppData\Local\Temp\cursor\screenshots\1366x768-kouppi-fixed.png`
- `C:\Users\User\AppData\Local\Temp\cursor\screenshots\1600x900-kouppi.png`

## Manual checklist

- [x] No document scroll or horizontal overflow (SP tested widths).
- [x] Full oval and both default SP seats remain visible.
- [ ] Cards, pot, meaningful chips, dealer label, and table theme are unchanged.
- [x] Active dock remains inside its reserved stage; source/component tests cover stable state swapping.
- [ ] Local seat says `YOUR TURN`; opponents say `TURN`.
- [ ] Dealer does not repeat `YOUR TURN`.
- [x] No large `YOUR MOVE` window or center-felt result sentence.
- [x] History overlays without table resize.
- [x] Mobile History sheet ends above the dock.
- [x] Settings includes theme, audio/effects, help, leave, and host tools (host UI component/source tested).
- [x] Mute works in one tap (component test).
- [x] Escape and close restore focus for History and Settings.
- [x] Tab focus stays inside each open overlay (component test).
- [ ] SP Pass/Bet/KOUPPI/SHISTRI/Next work.
- [ ] MP intents, KOUPPI/SHISTRI confirms, host kick/close, Chat, and Emote work.
- [ ] Spectator dock is read-only.
- [ ] Career leave returns to `/career`.
- [ ] ConfirmDialog and RoundEnd remain above other chrome.
- [x] Reduced-motion CSS removes new animation.

MP player/spectator and Career room browser rows remain unverified because they
require a running game server and populated rooms. Their shared-shell wiring,
intent paths, confirmations, spectator state, host controls, and Career return
path are covered by source integration and existing component tests.
