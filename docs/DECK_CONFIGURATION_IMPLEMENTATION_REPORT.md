# Deck Configuration Implementation Report

## Final architecture

Implemented a shared deck configuration model across game-core, server, protocol, and UI:

- Added deck policy enum:
  - `RESET_EACH_ROUND`
  - `CONTINUOUS_SHOE`
- Added strict deck count options:
  - `1 | 3 | 5 | 7 | 9`
- Added explicit shoe metadata in `GameState` (`deckCount`, `shufflePolicy`, `shoeSize`, `generation`, `remaining`, etc).
- Added unique physical card identity (`card.id`) for multi-deck safety.
- Centralized shoe construction with `buildShoe()` and Fisher-Yates shuffle flow.
- Updated lifecycle:
  - Fresh-deck policy rebuilds full shoe each round.
  - Continuous policy carries remaining shoe across rounds and only rebuilds at round boundary threshold.

## Defaults

- Global defaults:
  - `deckCount = 1`
  - `shufflePolicy = RESET_EACH_ROUND`
- Server auto/Career defaults are centralized in:
  - `apps/server/src/config/deckRules.ts`

## Supported configurations

- Policies:
  - Fresh Deck Every Round (`RESET_EACH_ROUND`)
  - Continuous Shoe (`CONTINUOUS_SHOE`)
- Deck counts:
  - `1, 3, 5, 7, 9`

## Files changed

- `docs/DECK_AND_SHUFFLE_CURRENT_BEHAVIOR_REPORT.md`
- `docs/DECK_CONFIGURATION_SPEC.md`
- `docs/DECK_CONFIGURATION_IMPLEMENTATION_PLAN.md`
- `docs/DECK_CONFIGURATION_MANUAL_TEST.md`
- `docs/DECK_CONFIGURATION_IMPLEMENTATION_REPORT.md`
- `packages/game-core/src/types.ts`
- `packages/game-core/src/deck.ts`
- `packages/game-core/src/rng.ts`
- `packages/game-core/src/reducer.ts`
- `packages/game-core/tests/deckConfiguration.test.ts`
- `packages/game-core/tests/shistri.test.ts`
- `packages/protocol/src/messages.ts`
- `apps/server/src/config/deckRules.ts`
- `apps/server/src/rooms.ts`
- `apps/server/src/serverFactory.ts`
- `apps/server/src/career/careerRoomManager.ts`
- `apps/server/tests/rooms.test.ts`
- `apps/web/store/remoteGameStore.ts`
- `apps/web/store/gameStore.ts`
- `apps/web/components/SettingsDialog.tsx`
- `apps/web/components/CreateRoomDialog.tsx`
- `apps/web/app/room/[id]/page.tsx`
- `apps/web/components/MultiplayerTableGraphics.tsx`
- `apps/web/components/TableGraphics.tsx`
- `apps/web/lib/roomPresets.ts`

## Automated verification results

- Passed: `pnpm --filter @kouppi/game-core test`
  - 6/6 files, 37/37 tests
- Passed: `pnpm build` (all packages)
- Passed: `pnpm lint` (warnings only; no failures)
- Passed: focused web tests
  - `remoteGameStore`, `multiplayer.room`, `singlePlayer.remount`
- Server full suite:
  - 25/27 test files passed
  - failures:
    - `tests/socket.test.ts` timeout
    - `tests/career/careerQueueIntegration.test.ts` intermittent "Already in a room"

## Manual verification

- Single-player setup includes required labels/options.
- Manual multiplayer host creation includes required labels/options.
- In-room and in-game read-only rule summaries show deck count + policy.
- Career/auto-room path now server-injects central deck defaults.

## Remaining follow-ups

- Stabilize/diagnose the two failing server integration tests in this environment before hard release gate.
- Consider migrating single-player randomness seed source to cryptographic source if strict fairness requirements apply to local mode as well.
