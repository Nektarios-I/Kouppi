# GAMEPLAY LIFECYCLE / ANTE / AVATAR — Manual Test

**Date:** 2026-07-26

## Commands run

```bash
pnpm --filter @kouppi/game-core build
pnpm --filter @kouppi/game-core test
pnpm --filter @kouppi/protocol build
pnpm --filter @kouppi/server build
pnpm --filter @kouppi/server test -- tests/lifecycle.revealBankrupt.test.ts tests/rooms.test.ts tests/sprint2.multiplayer.test.ts
pnpm --filter @kouppi/web lint
pnpm --filter @kouppi/web exec vitest run __tests__/lifecycle.avatarReveal.test.tsx __tests__/gameScreen.redesign.test.tsx __tests__/remoteGameStore.test.ts __tests__/gameStore.reset.test.ts
```

## Automated results

| Suite | Result |
|-------|--------|
| game-core (34 tests) | PASS |
| server lifecycle + rooms + sprint2 (22 tests) | PASS |
| web lifecycle + redesign + stores (19 tests) | PASS |
| server `tsc` build | PASS |
| web lint | PASS (pre-existing warnings only) |

## Manual scenarios (checklist)

### A. Result / Stay-Leave

| Scenario | Expected | Actual |
|----------|----------|--------|
| Normal pot-empty win (MP) | Result card ~3s, then Stay/Leave | Pending live browser |
| KOUPPI win | Same | Pending live browser |
| SP RoundEnd | Continue panel after ~3s; cards visible during wait | Pending live browser |
| Reconnect during reveal | See RoundEnd + cards; Stay/Leave when server fires | Pending live browser |
| Non-emptying bet | Still uses 1.5s next-turn path (no Stay/Leave) | Covered by existing flow |

### B. Bankrupt

| Scenario | Expected | Actual |
|----------|----------|--------|
| Loser at 0 after settle | Demoted to spectator before Stay/Leave; personal message | Unit: PASS (`demoteBankruptPlayers`) |
| Winner paid >0 | Remains seated | Unit: PASS |
| Multiple bankrupts | All demoted | Pending live |
| SP human broke | New table / Exit message | Code path present |
| SP broke bots | Removed on Continue | Code path present |
| `<2` actives | `not_enough_players` / no next round | Server path preserved |

### C. Ante progression

| Scenario | Expected | Actual |
|----------|----------|--------|
| Default ×2 / 5 rounds | Formula matches deriveAnte | Unit: PASS |
| Disabled | Flat ante | Unit: PASS |
| ADD + maxAnte | Caps correctly | Unit: PASS |
| SP / MP create UI | Controls present | Code present |
| Career | Server default progression locked | Code: `defaultAnteProgression` on career gameConfig |
| Reconnect | Derived from startingAnte + completedRounds | Design enforced in reducer |

### D. Avatar

| Scenario | Expected | Actual |
|----------|----------|--------|
| Waiting room open menu | Fully visible (portal); Escape closes | Unit: PASS |
| 320–1440px | Panel/sheet usable | Pending live viewport sweep |
| Persistence | Save still calls onSelect / setAvatar | Unchanged path |

## Known limitations

- Full browser E2E for MP Stay/Leave timing not automated in this pass (use live 2-client smoke).
- Lobby room list still does not show exact ante digits (waiting room shows summary when `roomConfig` is local).
- Career mid-match bankrupt spectators are excluded from active seats; Career end accounting remains room-close based.
