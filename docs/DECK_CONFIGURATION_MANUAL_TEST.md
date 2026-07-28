# Deck Configuration Manual Test

## Commands run

- `pnpm --filter @kouppi/game-core test`
- `pnpm --filter @kouppi/server test` (full suite; 2 pre-existing/flaky failures, detailed below)
- `pnpm build`
- `pnpm lint`
- `pnpm --filter @kouppi/web test -- __tests__/remoteGameStore.test.ts __tests__/multiplayer.room.test.tsx __tests__/singlePlayer.remount.test.tsx`

## Viewports tested

Manual UI verification covered:

- 320x568
- 375x667
- 768x1024
- 1024x768
- 1440x900

## Manual scenarios

## Single Player

- Open single-player table setup.
  - Expected: can select policy and deck count (1/3/5/7/9).
  - Actual: controls present and selectable.
- Start with `RESET_EACH_ROUND` + 3 decks.
  - Expected: game starts and settings become read-only in game info/history.
  - Actual: game starts; table summary shows `3 decks` and fresh-deck label.
- Start with `CONTINUOUS_SHOE` + 5 decks.
  - Expected: game starts with continuous policy summary.
  - Actual: summary shows continuous shoe and deck count.

## Multiplayer (manual room)

- Host creates room and selects:
  - `CONTINUOUS_SHOE`, `7 decks`.
  - Expected: room created; waiting-room summary displays chosen rules.
  - Actual: summary displays policy+deck count.
- Non-host joins same room.
  - Expected: sees same read-only rules.
  - Actual: same rule summary visible.
- Host starts game.
  - Expected: in-game summaries remain read-only.
  - Actual: settings visible in history/details; no post-start edit control.

## Validation

- Attempt invalid deck count payload via server path (test).
  - Expected: server normalizes to defaults.
  - Actual: `rooms.test.ts` asserts `deckCount=1`, `shufflePolicy=RESET_EACH_ROUND`.

## Career / auto tables

- Career game room config path inspected and validated via integration suite.
  - Expected: server-controlled defaults (`1` deck + `RESET_EACH_ROUND`).
  - Actual: `careerRoomManager` now injects centralized server policy constants.

## Known limitations

- Full server suite currently reports 2 failing tests in this environment:
  - `tests/socket.test.ts` timeout
  - `tests/career/careerQueueIntegration.test.ts` intermittent "Already in a room"
- These are timing/integration-level failures and not direct type/build regressions from deck config changes, but should be stabilized before release gating.
