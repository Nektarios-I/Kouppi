# GAMEPLAY LIFECYCLE / ANTE / AVATAR — Implementation Report

**Date:** 2026-07-26  
**Status:** Implemented across SP / MP / Career with automated coverage for core paths

## Docs

- `docs/GAMEPLAY_LIFECYCLE_ANTE_AVATAR_SPEC.md`
- `docs/GAMEPLAY_LIFECYCLE_ANTE_AVATAR_PLAN.md`
- `docs/GAMEPLAY_LIFECYCLE_ANTE_AVATAR_MANUAL_TEST.md`
- this report

## Architecture before → after

| Area | Before | After |
|------|--------|-------|
| Pot-empty RoundEnd | Immediate `handleRoundEnd` → Stay/Leave | `scheduleRoundEndDecision` waits `ROUND_RESULT_REVEAL_DELAY_MS` (3000); `revealPending` on state |
| Center cards on RoundEnd | Skipped (`awaitNext` false) | `keepResultVisible` shows `lastResolution` |
| Bankrupts | Stay seated + auto-pass | Demoted to spectators at Stay/Leave entry (`demoteBankruptPlayers`) |
| Ante | Flat `config.ante` | `anteProgression` + `completedRounds` + `deriveAnte` |
| Avatar popover | Absolute inside `.lobby-card` overflow clip | Portaled fixed panel / mobile bottom sheet |

## Config defaults

```ts
ROUND_RESULT_REVEAL_DELAY_MS = 3000

anteProgression = {
  enabled: true,
  intervalRounds: 5,
  strategy: "MULTIPLY",
  multiplier: 2,
  incrementAmount: null,
  maxAnte: null,
  startingAnte: <table ante>
}
```

Career: same default progression injected server-side; not player-editable.

## Event flow (MP/Career)

```
intent → settle + RoundEnd (+ completedRounds++)
  → emitState (revealPending scheduled)
  → wait 3000ms (single flowTimer)
  → demoteBankruptPlayers → playerBankruptRemoved / system chat
  → roundDecisionStart (Stay/Leave for remaining actives)
  → resolveDecisionPhase → nextRound + ante (derived) + startEligibleTurn
```

## Files changed (primary)

### game-core
- `packages/game-core/src/timing.ts` (new)
- `packages/game-core/src/anteProgression.ts` (new)
- `packages/game-core/src/types.ts`
- `packages/game-core/src/reducer.ts`
- `packages/game-core/src/index.ts`
- `packages/game-core/tests/anteProgression.test.ts` (new)

### protocol
- `packages/protocol/src/messages.ts` (`AnteProgressionConfig`)

### server
- `apps/server/src/types.ts` (`revealPending`)
- `apps/server/src/rooms.ts` (normalize progression, `demoteBankruptPlayers`, state payload)
- `apps/server/src/serverFactory.ts` (reveal delay, demotion in `handleRoundEnd`)
- `apps/server/src/career/careerRoomManager.ts` (default progression + spectatorsAllowed)
- `apps/server/tests/lifecycle.revealBankrupt.test.ts` (new)

### web
- `components/game/useCenterCardsPresentation.ts`
- `components/MultiplayerTableGraphics.tsx`
- `components/TableGraphics.tsx`
- `components/SettingsDialog.tsx`
- `components/CreateRoomDialog.tsx`
- `components/game/AnteProgressionControls.tsx` (new)
- `components/AvatarPicker.tsx`
- `components/game/WaitingRoom.tsx`
- `app/room/[id]/page.tsx`
- `app/globals.css`
- `store/gameStore.ts`, `store/remoteGameStore.ts`
- `__tests__/lifecycle.avatarReveal.test.tsx` (new)

## Test results

See `docs/GAMEPLAY_LIFECYCLE_ANTE_AVATAR_MANUAL_TEST.md`.

## Follow-ups

1. Live 2-browser smoke for reveal timing + bankrupt toast.
2. Optionally broadcast ante/progression on lobby `RoomsListItem`.
3. Optionally include active `roundDecision` snapshot on rejoin mid Stay/Leave (pre-existing gap).
4. Playwright viewport sweep for avatar portal (320–1440).
