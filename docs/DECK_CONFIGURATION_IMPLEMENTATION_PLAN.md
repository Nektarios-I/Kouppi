# Deck Configuration Implementation Plan

## Ordered tasks

1. **Add shared deck config constants/types and normalization**  
   - Risk: Low
2. **Refactor card/deck engine for unique card identity + multi-deck shoe build**  
   - Risk: High
3. **Introduce centralized shuffle abstraction with production RNG + test seam**  
   - Risk: Medium
4. **Implement shuffle policies (`RESET_EACH_ROUND`, `CONTINUOUS_SHOE`) in reducer lifecycle**  
   - Risk: High
5. **Wire protocol/server validation and room config persistence**  
   - Risk: Medium
6. **Integrate single-player setup controls and state handoff**  
   - Risk: Medium
7. **Integrate multiplayer host room creation controls + read-only display**  
   - Risk: Medium
8. **Set centralized server defaults for auto-created tables and Career**  
   - Risk: Medium
9. **Update reconnect/state payload compatibility and room listing summaries**  
   - Risk: Medium
10. **Expand automated tests (unit + integration + UI)**  
   - Risk: High
11. **Run full verification commands and write final docs report/manual test**  
   - Risk: Medium

## Expected files to change

### Game-core

- `packages/game-core/src/types.ts`
- `packages/game-core/src/deck.ts`
- `packages/game-core/src/rng.ts`
- `packages/game-core/src/reducer.ts`
- `packages/game-core/src/index.ts`
- tests:
  - `packages/game-core/tests/reducer.test.ts`
  - `packages/game-core/tests/flow.invariants.test.ts`
  - `packages/game-core/tests/invariants.test.ts`
  - new dedicated deck/shoe tests

### Protocol

- `packages/protocol/src/messages.ts`

### Server

- `apps/server/src/rooms.ts`
- `apps/server/src/serverFactory.ts`
- `apps/server/src/types.ts` (if metadata additions needed)
- `apps/server/src/career/careerRoomManager.ts`
- potentially room snapshot persistence helpers:
  - `apps/server/src/stores/roomSnapshot.ts`
  - redis store serializers if needed
- tests:
  - `apps/server/tests/rooms.test.ts`
  - `apps/server/tests/socket.test.ts`
  - career flow tests

### Web

- `apps/web/components/SettingsDialog.tsx`
- `apps/web/store/gameStore.ts`
- `apps/web/components/CreateRoomDialog.tsx`
- `apps/web/store/remoteGameStore.ts`
- `apps/web/components/game/WaitingRoom.tsx`
- `apps/web/app/room/[id]/page.tsx`
- `apps/web/components/MultiplayerTableGraphics.tsx`
- `apps/web/components/TableGraphics.tsx`
- `apps/web/lib/roomPresets.ts` (if preset defaults include new rules)
- web tests for setup/create/join display

### Docs

- `docs/DECK_AND_SHUFFLE_CURRENT_BEHAVIOR_REPORT.md` (already added)
- `docs/DECK_CONFIGURATION_SPEC.md` (already added)
- `docs/DECK_CONFIGURATION_MANUAL_TEST.md` (to add)
- `docs/DECK_CONFIGURATION_IMPLEMENTATION_REPORT.md` (to add)

## Migration/backward compatibility strategy

- Add default-normalization function in game-core/server for missing fields.
- Accept older room payloads by making protocol fields optional and defaulting server-side.
- Preserve current room behavior for existing active rooms via fallback defaults.
- Ensure old clients cannot crash if they do not send new fields.

## Testing strategy

- **Unit (game-core)**:
  - deck count exact sizes for 1/3/5/7/9
  - unique card ids
  - shuffle reproducibility with injected deterministic RNG
  - policy lifecycle assertions (reset each round vs continuous shoe)
  - no impossible draws
- **Integration (server)**:
  - host create/join/start with valid/invalid config
  - non-host cannot alter settings
  - reconnect keeps same remaining shoe state
  - career and auto-created tables enforce server default policy
- **UI/component**:
  - single-player control rendering + validation
  - create-room controls + summary display
  - read-only in-game settings summary

## Self-review checklist (pre-implementation validation)

- Card identity for 3/5/7/9 decks:
  - Planned unique `card.id` on every physical instance; rank/suit preserved.
- Impossible draws prevention:
  - Planned centralized draw guard + pre-round threshold checks.
- Continuous shoe mid-round reshuffle:
  - Planned prohibition; reshuffle only on round boundary.
- Reconnect preservation:
  - Planned shoe state persisted in authoritative `GameState` and broadcast.
- Auto/Career not client-controlled:
  - Planned server-configured defaults in career/match creation paths.
- Host-only room settings enforcement:
  - Planned server-side validation at `createRoom` only; no runtime mutation endpoint.
- Old/default rooms load:
  - Planned normalization with defaults.
- Bots/humans same authoritative deck:
  - Shared reducer state path maintained.
- UI cannot modify active rules:
  - Planned create/start-time controls only; in-game read-only labels.
- Shared randomization path:
  - Planned one shuffle abstraction used for all deck paths.
