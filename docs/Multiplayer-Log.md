# Multiplayer Work Log

Date: 2025-12-28

## Step 1: Protocol + Server Scaffolding

- Created `packages/protocol` for typed multiplayer messages (intents, room lifecycle) using `zod`.
- Added unit tests for protocol schemas (`messages.test.ts`).
- Created `apps/server` (Express + Socket.IO) with in-memory room management.
- Server enforces authoritative state using `@kouppi/game-core` `applyAction()` with seed, broadcasts snapshots.
- Added unit tests (`rooms.test.ts`) validating room init and basic intents.

## TDD: Lobby UI + Connection Status

1. Determine goals: Show connection status; list available rooms with player counts and join buttons.
2. Write tests (`apps/web/__tests__/multiplayer.lobby.test.tsx`):
   - Asserts a `conn-status` element shows "Connected" when store reports connected.
   - Renders lobby rows with Join buttons; clicking Join calls `joinRoom` with the room id.
3. Implement functionality:
   - Extended `apps/web/store/remoteGameStore.ts` with `rooms` state and `listRooms()`; listen for `rooms` events.
   - Updated `apps/web/app/multiplayer/page.tsx` to render connection badge, Refresh Lobby, and lobby list with Join.
4. Run tests: Web unit tests executed with Vitest; suite passes locally.

## Next Steps (Planned)

- Add periodic lobby refresh and better error toasts.
- Reconnection UI indicator and auto-rejoin last room.
- Presence/heartbeats and server-side bots.
- Persistence for rooms and logs.
