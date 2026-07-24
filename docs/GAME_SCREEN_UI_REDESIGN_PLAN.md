# KOUPPI Game Screen UI Redesign — Implementation Plan

**Date:** 2026-07-24
**Status:** Phases 3–8 executed on `feat/game-screen-redesign`
**Specification:** `docs/GAME_SCREEN_UI_REDESIGN_SPEC.md`

## Principles

1. Use one shared `GameScreen` contract for SP and MP/Career.
2. Preserve the protected table, rules, stores, protocol, and routing.
3. Reuse the table-feedback provider for History.
4. Keep the action dock mounted and height-reserved in every state.
5. Remove old chrome only after feature parity.
6. Use focused red-green tests before each new component or behavior.

## Phase 3 — Foundation layout

- Add `.game-screen` height-budget variables and three-zone flex layout.
- Add `GameScreen` with utility, history, table, and dock slots.
- Integrate the shared shell in `TableGraphics` and
  `MultiplayerTableGraphics`.
- Stop the legacy side rail from owning desktop table width.
- Reserve dock height in every game state.

Exit: stable utility/table/dock structure with no conditional dock container.

## Phase 4 — Utility and Settings

- Add `GameUtilityBar` with brand, mode, optional timer/metadata, mute, and
  Settings.
- Add `GameSettingsMenu` with table appearance, advanced audio/effects,
  rules/help, leave, and optional host tools.
- Remove page-level `SoundControl` from active SP/MP screens.
- Move theme and leave/close operations out of header chrome.
- Request leave confirmation before abandoning active play.

Exit: no exposed theme or leave button in the utility bar; mute stays one tap.

## Phase 5 — History

- Add `HistoryDrawer` with Actions, Hand / Round, and Table tabs.
- Feed Actions from `TableFeedbackProvider.logEntries` and `activeRibbon`.
- Keep History closed by default and overlay-only at every width.
- Use a left-edge desktop trigger and mobile sheet above the action dock.
- Implement Escape, close, backdrop, focus containment, focus restoration, and
  keyboard tab navigation.
- Remove the production dependency on `TableFeedbackLogSlot`/left rail.

Exit: opening History never changes table width; generic results remain off felt.

## Phase 6 — Turn and action dock

- Add `GameActionDock` states: waiting, active, next, spectator, disabled.
- Refactor `GameActionPanel` into compact dock content without `YOUR MOVE`
  window chrome.
- Keep SP Next Turn in the same reserved dock.
- Keep all SP dispatch and MP intent/confirmation paths.
- Display `YOUR TURN` only on the local seat and dock helper.
- Keep opponent `TURN`; suppress duplicate local-turn dealer copy.

Exit: all action states occupy one stable dock and retain existing behavior.

## Phase 7 — Cleanup

- Remove production `GameHUD`, side-rail, secondary host strip, and page sound
  FAB wiring from in-game shells.
- Set the obsolete desktop side-width token to zero and hide the old side slot.
- Keep compatibility components only where existing tests or non-production
  imports still reference them.
- Keep Chat/Emote page integrations and blocking RoundEnd/Confirm layers.

Exit: active SP and MP/Career compose only the new shell.

## Phase 8 — Verification and documentation

Automated:

```powershell
pnpm --filter @kouppi/web test -- --run __tests__/gameScreen.redesign.test.tsx __tests__/gameScreen.integrations.test.ts __tests__/PlayerSeat.test.tsx __tests__/gameActionPanel.shistri.test.tsx __tests__/tableEventFeedback.normalize.test.ts
pnpm --filter @kouppi/web test -- --run
pnpm --filter @kouppi/web build
```

Manual:

- Exercise widths 320 through 1600+.
- Exercise SP, MP player, MP spectator, and Career.
- Exercise waiting, local action, opponent turn, next, disabled/pending,
  resolution, both overlays, leave confirmation, RoundEnd, host kick/close.

Documentation:

- `GAME_SCREEN_UI_REDESIGN_MANUAL_TEST.md`
- `GAME_SCREEN_UI_REDESIGN_IMPLEMENTATION_REPORT.md`

## Rollback boundaries

- Shell: restore old shell composition and legacy height variables.
- Utility: restore `GameHUD` and page sound entry.
- History: restore `TableFeedbackLogSlot`.
- Dock: restore conditional action/next mounts.

No game-core or protocol rollback is needed because this plan does not change
those systems.
